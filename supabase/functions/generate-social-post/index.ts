// Supabase Edge Function: generate-social-post
//
// Drafts social posts about one of the member's geckos. The aim is a post
// the keeper would be glad to have written: built on what actually
// happened, the gecko's real data and what is visible in the photo, in
// the keeper's voice. Never invented details, never stock praise.
//
// Inputs that make the posts good (all sent by PromoteComposer):
//   moment       the keeper's own words about why they are posting now
//   facts        true statements built from the gecko's records
//                (src/lib/postCraft.js buildGeckoFacts)
//   photo_urls   up to 2 photos the model looks at, so it can mention
//                what is really in the picture
//   voice_custom the keeper's pasted captions, to copy their rhythm
//
// Kinds:
//   generate / regenerate / voice_cycle: 3 drafts, each a different approach
//   hook_rewrite: 5 new opening lines for the current draft
//   tweak:        1 revision of the current draft (shorter, plainer, ...)
//
// Model: Claude Sonnet 5.5 for every kind. It writes noticeably better
// than Haiku and costs less than Sonnet 4.6 did. The system prompt is
// cached, so repeat calls pay the cache-read rate for it.
//
// Iteration cap: hard-stops at 10 generations per draft post (admins
// exempt). The composer shows the count.
//
// Secrets: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy:  supabase functions deploy generate-social-post

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { scrubDashes } from "../_shared/promote.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const MODEL = "claude-sonnet-5-5";

const ITERATION_CAP_PER_POST = 10;

// Anthropic per-MTok pricing in cents. A refusal fallback can serve the
// request from another model, so the response's model picks the row;
// an unknown model is billed at the highest rate here so we never
// under-count.
const PRICING_CENTS: Record<string, { input: number; cacheWrite: number; cacheRead: number; output: number }> = {
  "claude-sonnet-5-5": { input: 200, cacheWrite: 250, cacheRead: 20, output: 1000 },
  "claude-opus-5-5":   { input: 400, cacheWrite: 500, cacheRead: 20, output: 2000 },
  "claude-sonnet-4-6": { input: 300, cacheWrite: 375, cacheRead: 30, output: 1500 },
};
const FALLBACK_PRICING = PRICING_CENTS["claude-opus-5-5"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ---------------------------------------------------------------------------
// System prompt (cached). Stable text only: nothing per-request goes here.
// ---------------------------------------------------------------------------

const VOICE_PRESETS: Record<string, string> = {
  educator:
    "Educator. The keeper likes explaining what makes an animal what it is. Pick ONE thing worth teaching that this gecko actually shows (how its trait is inherited, why it looks different fired up, what a term means) and explain it in a sentence or two the way you would at a reptile expo table. Only teach what you are sure is correct; if the genetics are uncertain or still debated in the hobby, say so.",
  storyteller:
    "Storyteller. Tells a small true moment. Built from the keeper's own words and the dated records, told in order, with one concrete detail that puts the reader in the room. If the keeper did not supply a moment, keep it short rather than invent one.",
  hobbyist_hype:
    "Excited hobbyist. A keeper who cannot wait to show a friend. Energy comes from specifics (\"look at the cream on that dorsal\") rather than adjectives. Allowed: one exclamation point, one emoji, morph names in caps once if it fits. Still has to be true.",
  pro_breeder:
    "Working breeder. Plain, precise, project-minded. Proper terminology, short sentences, the facts a serious buyer or fellow breeder wants (morph, sex, weight, age, lineage, project goal, availability). Confident without hype. No exclamation points.",
  casual:
    "Casual. Like texting a friend who also keeps cresties. Lowercase-leaning rhythm is fine, contractions, a dry joke if one is sitting right there. If it asks a question, it is one the keeper would genuinely want answered.",
};

const PLATFORM_RULES: Record<string, string> = {
  bluesky:
    "Bluesky: 300 characters INCLUDING hashtags, hard limit. Aim for 200-260 so there is room. 0-2 hashtags. Text-first, conversational, the reptile community there is small and friendly and dislikes marketing tone.",
  threads:
    "Threads: 500 characters. Text-first and conversational. 0-1 topic tag (Threads allows one). Short paragraphs.",
  reddit:
    "Reddit: no hashtags, no CTA, no emoji. The `hook` is the post TITLE: plain, specific, under 100 characters, no clickbait (\"6 months of growth on my Lilly White male, 4g to 31g\"). The body reads like a keeper talking to other keepers, includes useful detail, and never sells. r/CrestedGecko removes sales posts.",
  facebook_page:
    "Facebook: 1-3 short paragraphs. 0-3 hashtags. The audience is used to longer updates and lineage detail, and comments are where sales start, so a plain \"message me if you are interested\" is fine for sales posts.",
  instagram:
    "Instagram: only the first ~125 characters show before \"more\", so the first line has to carry the post on its own. Then 1-3 short paragraphs. 3-5 specific hashtags at the end (more looks spammy and Instagram limits them). Mention swiping only if more than one photo is attached.",
  x:
    "X: 280 characters INCLUDING hashtags. One or two sentences. 0-1 hashtag. Say the one interesting thing and stop.",
  tiktok:
    "TikTok: write a short video plan, not a caption. `body` holds the beats: an on-screen text hook for the first 2 seconds, 2-3 shots to film (what to point the camera at), and the payoff. `hook` is the on-screen text. `cta` is the one-line caption. 3-4 hashtags, always including #crestedgecko.",
  youtube_community:
    "YouTube Community post: 1-2 short paragraphs to existing subscribers, like a quick update between videos. No hashtags.",
  clipboard:
    "General post: platform-neutral, medium length, 3-5 hashtags.",
};

const TEMPLATES: Record<string, string> = {
  meet: "Introducing a gecko to followers (new arrival, holdback, or one that has never been posted).",
  available: "Sales post. Lead with what a buyer needs to decide: morph, sex (or that it is unsexed), weight, age, price if given, and how to ask. Disclose tail loss and anything else a buyer would want to know. No urgency language.",
  pairing: "Announcing a pairing. Say who with and what the keeper hopes to produce, without promising outcomes genetics cannot promise.",
  eggs: "Clutch update.",
  hatchling: "A new hatchling.",
  milestone: "A milestone: weight, age, first shed, finally eating, anything the keeper is pleased about.",
  throwback: "Then and now. Use real dates and weights where given.",
  lineage: "Spotlighting where this gecko comes from.",
  educational: "Teaching followers about this gecko's morph or traits, using this animal as the example.",
};

const HASHTAGS = `
Core (pick 1): #crestedgecko #crestedgeckos #correlophusciliatus #cresties
Morph tags (only if this gecko actually has the trait):
  Lilly White #lillywhite, Harlequin #harlequincrestedgecko, Extreme Harlequin #extremeharlequin,
  Phantom #phantomcrestedgecko, Cappuccino #cappuccinocrestedgecko, Axanthic #axanthiccrestedgecko,
  Sable #sablecrestedgecko, Highway #highwaycrestedgecko, Dalmatian #dalmatiancrestedgecko,
  Pinstripe #pinstripecrestedgecko, Patternless #patternlesscrestedgecko, Tiger #tigercrestedgecko
Life stage: #crestedgeckohatchling #geckoeggs #crestedgeckobreeding
Sales only: #crestedgeckosforsale #crestedgeckobreeder
Fewer, specific tags beat a wall of tags. Never put hashtags inside sentences.
`.trim();

const SYSTEM_PROMPT = `
You help crested gecko keepers write social posts about their own animals. The keeper will read your drafts, pick one, edit it, and post it under their own name, so every draft has to be something they would be glad to have written.

# What makes a post worth reading

People follow keepers, not brands. The posts that do well in the crestie community are small, specific and true: a weight that finally went up, a photo where the dorsal cream is glowing because she fired up at night, a hatchling that already has a pinstripe, a buyer's question answered plainly. A good post has one idea and one concrete detail that carries it.

Work from the material, in this order:
1. The keeper's own words about what happened ("moment"). If given, this is the spine of the post. Keep their facts and their phrasing where it is good; do not polish the personality out of it.
2. The attached photos. Look closely and mention one or two things that are clearly visible (fired up or down, a specific pattern feature, the color, the pose, the setting). Never describe something you cannot see.
3. The records: dated weights, sheds, events, parents, age, status. Real numbers and dates make a post feel real ("4g in July, 31g today" beats "growing so fast").

# Truth rules (these matter more than anything else)

- Use only facts from the moment, the records and what is visible in the photos. Do not invent behavior, personality, feelings, events, buyers, waitlists, prices, places, shows or plans.
- If the material is thin, write a shorter post. A two-line true caption is better than a paragraph of filler.
- Never use placeholders like [price] or [name]. If a post really needs something the keeper did not give (a price on a sales post, say), leave it out and list it in check_before_posting.
- Genetics: be accurate and modest. Lilly White and Cappuccino are incomplete dominant (the super forms are lethal or problematic, and good breeders do not pair two together); Axanthic is recessive; many pattern traits (Harlequin, Pinstripe, Dalmatian) are polygenic or line-bred, not simple genes. Do not claim a pairing "will produce" anything uncertain. When unsure, describe instead of label.
- Crested geckos that drop their tail do not regrow it. If a sales post's records note tail loss, include it plainly.
- Fired up (darker, more contrast) and fired down (paler) can make the same gecko look very different; it is fine and honest to say which the photo shows.

# How it should sound

Like a real keeper typing on their phone at the rack: plain words, short sentences, contractions, specific nouns. Varied sentence length. Humor only when it comes from the actual situation.

Never write these (they mark a post as AI-written to this community):
- Em dashes or en dashes. Use a comma, a period, or a colon.
- Announcer openings: "Meet ___!", "Say hello to", "Introducing", "Allow me to introduce".
- Stock praise: stunning, gorgeous, stunner, showstopper, eye candy, absolute unit, steals the show, speaks for itself, beauty, gem.
- AI vocabulary: delve, tapestry, testament, journey, embark, realm, elevate, showcase, boasts, nestled, vibrant tapestry, "in the world of".
- The shapes "It's not just X, it's Y", "From X to Y,", three-adjective lists, and rhetorical questions with no real answer ("Is there anything cuter?").
- Engagement bait: "Who else loves...", "Drop a 🦎 if...", "Let us know in the comments", "Stay tuned", "Smash that follow".
- Pushy sales lines: "won't last long", "act fast", "don't miss out".
- "This little one", "this little guy". Use the gecko's name or nothing.
- Strings of emoji. Zero or one emoji per post, used like a person would.
- More than one exclamation point.

A question at the end is good only if the keeper would actually want the answers ("Would you hold her back or pair her with my Sable male?"). Otherwise end on the last true thing and stop.

Examples of the difference:
  Flat: "Meet Juniper! 🦎✨ This stunning Lilly White is an absolute showstopper with incredible color. Who else is obsessed with Lilly Whites?! 😍🔥"
  Good: "Juniper hit 31g this week. She was 4g when she hatched in March and wouldn't touch the dish for a month. Lilly White from my Sable project, fired up in this shot."

  Flat: "Introducing our newest available gecko! Don't miss out on this gorgeous male, he won't last long!"
  Good: "Available: male Harlequin Pinstripe, 22g, hatched Feb 2026, eating Pangea and crickets. Full tail. $250 plus shipping. Message me with questions."

# Voices

${Object.entries(VOICE_PRESETS).map(([k, v]) => `## ${k}\n${v}`).join("\n\n")}

If a "Keeper's own writing" block is present, it beats the preset: match its sentence length, punctuation, capitalization, emoji habits and favorite words. Copy the rhythm, never the content.

# Post types

${Object.entries(TEMPLATES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

# Platforms

${Object.entries(PLATFORM_RULES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

# Hashtags

${HASHTAGS}

# Output

Always answer by calling the submit_post_variant tool, never with plain text.
- hook: the opening line (for Reddit, the title). It has to work on its own.
- body: the rest of the post. It must NOT repeat the hook.
- cta: a closing line only when the post needs one (sales, a real question). Usually empty.
- hashtags: with the # prefix, following the platform rules. Can be empty.
- approach: 2-5 words naming the angle so the keeper can tell drafts apart ("Just the facts", "The weigh-in story", "Asking for pairing ideas").
- check_before_posting: short notes about anything the keeper should add or confirm (missing price, unsexed, photo looks fired down). Empty when there is nothing.

When asked for several drafts, make them genuinely different approaches, not rewordings: for example one very short and plain, one built around the moment or the photo detail, one in a different structure (a question to followers, a then-and-now, a mini lesson). Respect the length limits of the target platform in every draft.
`.trim();

const TOOL_DEF = {
  name: "submit_post_variant",
  description: "Submit the post drafts for the keeper to choose from.",
  input_schema: {
    type: "object",
    required: ["variants"],
    properties: {
      variants: {
        type: "array",
        items: {
          type: "object",
          required: ["hook", "body", "hashtags", "cta", "approach", "check_before_posting"],
          properties: {
            hook:     { type: "string", description: "Opening line (Reddit: the title)." },
            body:     { type: "string", description: "Rest of the post. Does not repeat the hook." },
            hashtags: { type: "array", items: { type: "string" }, description: "Hashtags including the # prefix." },
            cta:      { type: "string", description: "Closing line, or empty string." },
            approach: { type: "string", description: "2-5 word name for this draft's angle." },
            check_before_posting: {
              type: "array",
              items: { type: "string" },
              description: "Things the keeper should add or confirm. Empty when none.",
            },
          },
        },
      },
    },
  },
};

const TWEAK_INSTRUCTIONS: Record<string, string> = {
  shorter: "Make it about half as long. Keep the single most interesting detail and cut everything else.",
  plainer: "Make it plainer: remove adjectives, hype and emoji, keep the facts and the keeper's voice.",
  warmer: "Make it warmer and more personal, using only the true details already present. Do not add invented feelings or events.",
  funnier: "Make it lighter, with a bit of dry humor that comes from the actual situation. No forced jokes, no puns on 'gecko'.",
  more_detail: "Work in one or two more concrete details from the records or the photos (a weight, a date, a visible trait). Keep the length similar.",
  less_salesy: "Remove anything that sounds like marketing. If it is a sales post, keep only plain facts and a simple way to ask.",
  add_question: "End with one question the keeper would genuinely want answers to, tied to this gecko. Not engagement bait.",
  more_me: "Rewrite to sound more like the keeper's own writing (see the keeper's writing block if present, and the keeper's moment). Match their rhythm and word choice.",
};

// ---------------------------------------------------------------------------
// Cost helper. Returns cents, rounded up.
// ---------------------------------------------------------------------------
function computeCents(model: string, usage: {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}): number {
  const rates = PRICING_CENTS[model] || FALLBACK_PRICING;
  // input_tokens already excludes cached tokens on the Messages API.
  const microCents =
    (usage.input_tokens || 0) * rates.input +
    (usage.cache_creation_input_tokens || 0) * rates.cacheWrite +
    (usage.cache_read_input_tokens || 0) * rates.cacheRead +
    (usage.output_tokens || 0) * rates.output;
  return Math.ceil(microCents / 1_000_000);
}

// social_generation_log.kind has a check constraint; map newer kinds onto it.
function logKind(kind: string): string {
  if (kind === "generate" || kind === "regenerate" || kind === "voice_cycle") return kind;
  return "tweak";
}

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------

interface GenerateRequest {
  post_id: string;
  gecko: {
    id: string;
    name: string | null;
    morph: string | null;
    sex: string | null;
    hatch_date: string | null;
    weight_g: number | null;
    sale_status: string | null;
    notes: string | null;
    sire?: { name?: string; morph?: string } | null;
    dam?:  { name?: string; morph?: string } | null;
    recent_changes?: string[];
  };
  facts?: { profile?: string[]; recent?: string[] } | null;
  moment?: string | null;
  photo_urls?: string[];
  platforms: string[];
  template: string;
  voice_preset: string;
  voice_custom?: string | null;
  length_pref?: string;
  starting_point?: string;
  variant_count?: number;
  kind?: string;
  tweak?: string;
  current_text?: string;
  previous_variants?: { content: string }[];
}

function clean(s: unknown, max: number): string {
  return String(s ?? "").replace(/\s+\n/g, "\n").trim().slice(0, max);
}

function photoBlocks(urls: string[] | undefined) {
  return (urls || [])
    .filter((u) => typeof u === "string" && /^https:\/\//i.test(u))
    .slice(0, 2)
    .map((url) => ({ type: "image", source: { type: "url", url } }));
}

function geckoBrief(body: GenerateRequest): string {
  const g = body.gecko;
  const lines: string[] = [`Name: ${g.name || "(no name, do not make one up)"}`];
  const profile = (body.facts?.profile || []).map((f) => clean(f, 300)).filter(Boolean).slice(0, 16);
  const recent = (body.facts?.recent || []).map((f) => clean(f, 300)).filter(Boolean).slice(0, 8);
  if (profile.length > 0) {
    lines.push(...profile);
  } else {
    // Older clients send only the flat gecko fields.
    if (g.morph) lines.push(`Morph and traits: ${g.morph}`);
    if (g.sex) lines.push(`Sex: ${g.sex}`);
    if (g.hatch_date) lines.push(`Hatched: ${g.hatch_date}`);
    if (g.weight_g != null) lines.push(`Weight: ${g.weight_g}g`);
    if (g.sale_status) lines.push(`Status: ${g.sale_status}`);
    if (g.sire?.name) lines.push(`Sire: ${g.sire.name}${g.sire.morph ? ` (${g.sire.morph})` : ""}`);
    if (g.dam?.name) lines.push(`Dam: ${g.dam.name}${g.dam.morph ? ` (${g.dam.morph})` : ""}`);
  }
  if (g.notes) lines.push(`Keeper's notes on this gecko: ${clean(g.notes, 500)}`);
  if (recent.length > 0) {
    lines.push("", "Recent records (newest first):", ...recent.map((r) => `- ${r}`));
  }
  return lines.join("\n");
}

function buildUserText(body: GenerateRequest, variantCount: number, photoCount: number): string {
  const kind = body.kind || "generate";
  const platform = body.platforms[0];
  const others = body.platforms.slice(1);
  const moment = clean(body.moment || body.starting_point, 1200);

  const header = [
    `Platform: ${platform}${others.length ? ` (the keeper will also paste it to ${others.join(", ")}, so it must fit ${platform}'s limits)` : ""}`,
    `Post type: ${body.template}`,
    `Voice: ${body.voice_preset}`,
    `Length: ${body.length_pref === "short" ? "short (one to three sentences)" : body.length_pref === "long" ? "longer (up to 4 short paragraphs where the platform allows)" : "medium (a short paragraph or two where the platform allows)"}`,
    "",
    "# The gecko",
    geckoBrief(body),
    "",
    "# What the keeper says is going on",
    moment || "(nothing given; work from the records and the photos, and keep it short)",
    "",
    photoCount > 0
      ? `# Photos\n${photoCount} photo${photoCount === 1 ? " is" : "s are"} attached above. Use what you can clearly see.`
      : "# Photos\nNo photo attached. Do not describe how the gecko looks beyond the recorded morph.",
  ];

  if (kind === "hook_rewrite") {
    const current = clean(body.current_text || body.previous_variants?.[0]?.content, 3000);
    return [
      ...header,
      "",
      "# Current draft",
      current || "(empty)",
      "",
      "# Task",
      `Write ${variantCount} different opening lines for this draft. Put each in \`hook\`. Leave \`body\` and \`cta\` as empty strings, \`hashtags\` and \`check_before_posting\` as empty arrays, and set \`approach\` to the angle (a number, the photo detail, the moment, a question, the plain fact). Each hook must work as the first line people see, stay true to the draft, and avoid every phrase on the never-write list.`,
    ].join("\n");
  }

  if (kind === "tweak") {
    const current = clean(body.current_text, 3000);
    const instruction = TWEAK_INSTRUCTIONS[body.tweak || ""] || TWEAK_INSTRUCTIONS.plainer;
    return [
      ...header,
      "",
      "# Current draft (the keeper may have edited it; keep their edits)",
      current || "(empty)",
      "",
      "# Task",
      `Revise the draft: ${instruction}`,
      "Return exactly 1 variant. Keep any facts and phrases the keeper clearly wrote themselves. Split the result into hook, body and cta as usual.",
    ].join("\n");
  }

  const previous = (body.previous_variants || [])
    .slice(0, 5)
    .map((v, i) => `${i + 1}. ${clean(v.content, 600)}`)
    .join("\n");

  return [
    ...header,
    previous ? `\n# Drafts the keeper already passed on (take different approaches, reuse no phrasing)\n${previous}` : "",
    "",
    "# Task",
    `Write ${variantCount} drafts for ${platform}, each a genuinely different approach.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Anthropic call
// ---------------------------------------------------------------------------

async function callClaude(body: GenerateRequest, variantCount: number, withPhotos: boolean) {
  const photos = withPhotos ? photoBlocks(body.photo_urls) : [];
  const system: Array<Record<string, unknown>> = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  const voiceCustom = clean(body.voice_custom, 4000);
  if (voiceCustom) {
    system.push({
      type: "text",
      text: `# Keeper's own writing\n\nThis is how the keeper writes (their own captions or their description of their voice). Match it.\n\n${voiceCustom}`,
    });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      // Short creative writing: some thought helps pick a good angle,
      // a lot only adds latency.
      output_config: { effort: "medium" },
      // If a safety classifier declines (very unlikely for gecko posts),
      // the API retries on a fallback model inside the same call.
      fallbacks: "default",
      system,
      tools: [TOOL_DEF],
      // Sonnet 5.5 does not accept a forced tool choice; the system
      // prompt tells it to always call the tool.
      tool_choice: { type: "auto" },
      messages: [{
        role: "user",
        content: [
          ...photos,
          { type: "text", text: buildUserText(body, variantCount, photos.length) },
        ],
      }],
    }),
  });
  return { res, usedPhotos: photos.length > 0 };
}

interface RawVariant {
  hook?: unknown;
  body?: unknown;
  hashtags?: unknown;
  cta?: unknown;
  approach?: unknown;
  check_before_posting?: unknown;
}

function tidyVariant(v: RawVariant) {
  const str = (x: unknown) => scrubDashes(typeof x === "string" ? x : "").trim();
  const list = (x: unknown) => (Array.isArray(x) ? x : []).map((t) => str(t)).filter(Boolean);
  return {
    hook: str(v.hook),
    body: str(v.body),
    cta: str(v.cta),
    approach: str(v.approach),
    hashtags: list(v.hashtags).map((t) => (t.startsWith("#") ? t : `#${t}`).replace(/\s+/g, "")),
    check_before_posting: list(v.check_before_posting),
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!ANTHROPIC_API_KEY) return json({ error: "anthropic_key_missing" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "no_jwt" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "auth_failed" }, 401);
  const user = userData.user;

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!body.post_id || !body.gecko?.id || !Array.isArray(body.platforms) || body.platforms.length === 0) {
    return json({ error: "missing_fields" }, 400);
  }
  if (!VOICE_PRESETS[body.voice_preset]) body.voice_preset = "casual";
  if (!TEMPLATES[body.template]) body.template = "meet";

  // Admins bypass the iteration cap so the team can test freely.
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("email", user.email || "")
    .maybeSingle();
  const isAdmin = callerProfile?.role === "admin";

  const { data: postRow, error: postErr } = await supabase
    .from("social_posts")
    .select("id, iteration_count, created_by_user_id")
    .eq("id", body.post_id)
    .maybeSingle();
  if (postErr || !postRow) return json({ error: "post_not_found" }, 404);
  if (postRow.created_by_user_id !== user.id) return json({ error: "forbidden" }, 403);
  if (!isAdmin && (postRow.iteration_count || 0) >= ITERATION_CAP_PER_POST) {
    return json({ error: "iteration_cap_reached", cap: ITERATION_CAP_PER_POST }, 429);
  }

  const kind = body.kind || "generate";
  const variantCount = kind === "tweak" ? 1 : Math.max(1, Math.min(5, body.variant_count || 3));

  let res: Response | null = null;
  try {
    const first = await callClaude(body, variantCount, true);
    res = first.res;
    // A photo URL the API cannot fetch fails the whole request with a
    // 400. Try once more without photos rather than failing the keeper.
    if (res.status === 400 && first.usedPhotos) {
      const detail = await res.text();
      console.warn("retrying without photos:", detail.slice(0, 300));
      res = (await callClaude(body, variantCount, false)).res;
    }
  } catch (e) {
    console.error("anthropic unreachable", e);
    res = null;
  }
  if (!res) return json({ error: "anthropic_unreachable" }, 502);
  if (!res.ok) {
    const text = await res.text();
    console.error("anthropic failed", res.status, text.slice(0, 500));
    return json({ error: "anthropic_failed", status: res.status }, 502);
  }

  const completion = await res.json() as {
    model?: string;
    stop_reason?: string;
    content: Array<{ type: string; name?: string; input?: { variants?: RawVariant[] } }>;
    usage: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };

  const servedModel = completion.model || MODEL;
  const cents = computeCents(servedModel, completion.usage || {});
  const monthKey = new Date().toISOString().slice(0, 7);

  // Log and bill every call that reached the model, even one that came
  // back without drafts, so spend tracking stays honest.
  await supabase.from("social_generation_log").insert({
    user_id: user.id,
    post_id: body.post_id,
    model: servedModel,
    input_tokens: completion.usage?.input_tokens || 0,
    output_tokens: completion.usage?.output_tokens || 0,
    cache_read_tokens: completion.usage?.cache_read_input_tokens || 0,
    cache_creation_tokens: completion.usage?.cache_creation_input_tokens || 0,
    cents_cost: cents,
    kind: logKind(kind),
  });
  await supabase.rpc("increment_social_usage_spend", {
    p_user_id: user.id,
    p_month_key: monthKey,
    p_cents: cents,
  });

  if (completion.stop_reason === "refusal") {
    return json({ error: "declined" }, 422);
  }

  const toolBlock = completion.content?.find((c) => c.type === "tool_use" && c.name === TOOL_DEF.name);
  const raw = toolBlock?.input?.variants;
  const variants = Array.isArray(raw)
    ? raw.map(tidyVariant).filter((v) => v.hook || v.body).slice(0, variantCount)
    : [];
  if (variants.length === 0) {
    return json({ error: "no_variants_returned" }, 502);
  }

  // Only a call that produced drafts uses up one of the post's tries.
  const nextCount = (postRow.iteration_count || 0) + 1;
  await supabase
    .from("social_posts")
    .update({ iteration_count: nextCount, updated_date: new Date().toISOString() })
    .eq("id", body.post_id);

  return json({
    ok: true,
    variants,
    cents,
    model: servedModel,
    iteration_count: nextCount,
    iteration_cap: ITERATION_CAP_PER_POST,
  });
});
