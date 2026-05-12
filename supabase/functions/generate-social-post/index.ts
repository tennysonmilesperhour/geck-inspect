// Supabase Edge Function — generate-social-post
//
// Generates a social-media post variant for a given gecko using Claude with
// prompt caching. The system prompt (voice presets + platform rules + crestie
// hashtag library + anti-AI-tell rules) is cached so repeat calls for the
// same user pay cache-read rates instead of full input rates.
//
// Cost model:
//   Sonnet 4.6  $3 / $15 per MTok in/out  (1.25x cache write, 0.1x cache read)
//   Haiku  4.5  $1 / $5  per MTok in/out  (1.25x cache write, 0.1x cache read)
//
// First generation per post (`kind=generate`) uses Sonnet because the initial
// 3 variants set the quality bar. Iterations (`kind=regenerate`,
// `voice_cycle`, `tweak`) use Haiku because tweaks don't need the larger
// model.
//
// Iteration cap: hard-stops at 10 generations per draft post. The composer
// also disables the button at 10 to give a soft warning first.
//
// Secrets:
//   ANTHROPIC_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Deploy:
//   supabase functions deploy generate-social-post

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const SONNET = "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5";

const ITERATION_CAP_PER_POST = 10;

// Anthropic per-MTok pricing in cents (1 USD = 100 cents).
const PRICING_CENTS = {
  [SONNET]: { input: 300, cacheWrite: 375, cacheRead: 30, output: 1500 },
  [HAIKU]:  { input: 100, cacheWrite: 125, cacheRead: 10, output: 500 },
};

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
// System prompt — cached. Must be > 1024 tokens for Sonnet caching to take
// effect, > 2048 for Haiku. The full preset library + hashtag library easily
// clears that bar.
// ---------------------------------------------------------------------------

const VOICE_PRESETS: Record<string, string> = {
  educator:
    "Educator voice. Teach as you go. Weave one or two genetics or husbandry facts naturally into the post (Lilly White is dominant, Cappuccino vs Mocha distinctions, fired vs unfired states, axanthic recessiveness, etc). Cite the gecko's specific traits. Tone is warm and credible, not lecturing. Reads like a passionate breeder explaining what makes this animal special.",
  storyteller:
    "Storyteller voice. Personal, journey-focused, present-tense moments. Reference time spent with this gecko, milestones reached, what you noticed about its personality, body language, color shifts. Emotional but earned, never saccharine. The reader should feel like they were let in on a private update.",
  hobbyist_hype:
    "Hobbyist hype voice. Excited peer-to-peer. Morph names can be UPPERCASED for emphasis when warranted. Short bursts, exclamation points used sparingly but not zero. Reads like a Discord post in the best crestie server. Specific praise for the trait combo, lineage, or visual standout features.",
  pro_breeder:
    "Pro breeder voice. Clinical, precise, project-forward. Lead with morph and notable traits in proper terminology. State pairings, projects, available status, and asks plainly. No fluff. Reads as a working breeder informing other working breeders. Reputation-building tone.",
  casual:
    "Casual conversational voice. Low-key friend tone. Asks the audience an open question or invites a reply. Treats followers as a community. Plain language, contractions, gentle humor where it fits. Never tries too hard.",
};

const PLATFORM_RULES: Record<string, string> = {
  bluesky:
    "Bluesky: 300 char hard limit including hashtags. No emoji-spam. Hashtags work but feel less central than on IG. 1-3 hashtags max. Linking out is fine; there's an active reptile community.",
  threads:
    "Threads: 500 char limit. Quieter, lower-CTR than IG but high engagement on text-led posts. Hashtags less critical (1-3). Hooks that read as a quote do well.",
  reddit:
    "Reddit: title is the make-or-break. No hashtags. Subreddit-specific norms: r/CrestedGecko welcomes ID/morph posts and breeding updates with photos; r/Reptiles wants broader appeal; r/Geckos varied. Body should be conversational, not promotional. Mods will remove transactional content from non-marketplace subs.",
  facebook_page:
    "Facebook Page: 1-3 short paragraphs. 0-3 hashtags. Audience skews older than IG, more tolerance for storytelling and lineage detail. Calls to comment / message work well. Avoid IG-style hashtag walls.",
  instagram:
    "Instagram: caption can run long but the first 125 chars matter most (visible above the fold). 5-15 hashtags appended at the end OR placed in the first comment. Carousel posts get the highest engagement. Hashtags should mix high-volume crestie tags with niche morph-specific tags.",
  x:
    "X (Twitter): 280 char limit. Hooks land harder than hashtags. 1-2 hashtags max. Photo carousels (up to 4 images) outperform single-image posts. Reply CTAs work better than 'DM me'.",
  tiktok:
    "TikTok: this is a video script, not a static caption. Provide a 15-30 second script structure: hook (first 2 seconds), beat 1, beat 2, payoff. Caption should be one short line that complements the video. 3-5 hashtags including #fyp, #crestedgecko, and one morph-specific tag.",
  youtube_community:
    "YouTube Community post: 1-2 paragraphs. Treat as a casual update to existing subscribers. Polls work well; consider a one-line poll variant. No hashtags.",
  clipboard:
    "Generic clipboard format: medium-length, platform-neutral. 5-7 hashtags. Hook + 1-2 paragraphs + CTA + hashtags. User will tweak before posting.",
};

const CRESTIE_HASHTAG_LIBRARY = `
HIGH-VOLUME CORE (use 1-2 always):
  #crestedgecko #crestedgeckos #correlophusciliatus #reptilesofinstagram
  #geckosofinstagram #cresties

MORPH-SPECIFIC (use the ones that match THIS gecko):
  Lilly White: #lillywhite #lillywhitecrested #lillywhitegecko
  Harlequin / Extreme Harlequin: #harlequincrestedgecko #extremeharlequin
  Phantom: #phantomcrestedgecko #phantomgecko
  Cappuccino / Mocha: #cappuccinocrestedgecko #mochacrestedgecko
  Axanthic: #axanthiccrestedgecko #axanthicgecko
  Sable: #sablecrestedgecko
  Highway: #highwaycrestedgecko #pinstripegecko
  Dalmatian: #dalmatiancrestedgecko
  Pinstripe: #pinstripecrestedgecko #fullpinstripe
  Patternless / Solid: #patternlesscrestedgecko
  Drippy / Tiger: #tigercrestedgecko

COMMUNITY / SALES (when applicable):
  #reptilebreeder #crestedgeckobreeder #crestedgeckosforsale (sales only)
  #reptilelife #morphmarket #geckobreeding #cresteddaddy

BREEDING / LIFECYCLE:
  #geckoeggs #crestedgeckohatchling #babygecko #geckohatching
  #crestedgeckobreeding #breedingproject

NICHE / EVERGREEN:
  #correlophus #rhacodactylus (genus shift, older but still tagged)
  #firedupgecko #firedup (when photo shows fired state)

DO NOT use generic / over-saturated tags as primaries:
  Avoid leading with #reptiles or #lizards alone — they bury crestie content
  in unrelated traffic. Use them only as supplemental tags after morph-specific.
`.trim();

const ANTI_AI_TELLS = `
HARD RULES (any violation must be self-corrected before output):
- Never use em dashes (—). If you would use one, rewrite with a comma, period,
  or colon instead. Em dashes are the single biggest "this was written by AI"
  giveaway in 2026 social copy.
- Never use en dashes (–) as substitutes for em dashes.
- Never use the phrases: "delve", "embark on a journey", "in the realm of",
  "the world of", "navigate the landscape", "robust ecosystem", "tapestry",
  "testament to", "leverage", "unprecedented", "let's explore", "in today's
  fast-paced world". These read as AI-generated to crested gecko hobbyists.
- Don't open with "Meet ___!" unless the template is literally Meet (intro
  for a new gecko). Vary openings.
- Hyphens in genuine compound words ("crested-gecko-first", "well-known")
  are fine. The rule is about the em-dash punctuation mark, not hyphens.
- Don't pad with empty adjectives. "Stunning" alone says nothing; "stunning
  Lilly White Phantom" says something specific.
`.trim();

function buildSystemPrompt(): string {
  return `
You are a social media post writer for a crested gecko breeder. Your job is
to produce a tight, on-brand post about a specific gecko, tailored to a
specific platform, using the breeder's chosen voice.

# Voice presets

${Object.entries(VOICE_PRESETS).map(([k, v]) => `## ${k}\n${v}`).join("\n\n")}

# Platform rules

${Object.entries(PLATFORM_RULES).map(([k, v]) => `## ${k}\n${v}`).join("\n\n")}

# Crested gecko hashtag library

${CRESTIE_HASHTAG_LIBRARY}

# Anti-AI-tell rules

${ANTI_AI_TELLS}

# Output

Always call the \`submit_post_variant\` tool. Produce exactly the requested
number of variants. Each variant must include a hook (the opening line or
two), a body, hashtags (an array of strings INCLUDING the # prefix), and a
cta (call to action, can be empty string for platforms where CTAs feel
forced like Reddit). Compose body so it reads naturally on the target
platform; respect length limits.

Quality bar: every post should pass the "would a real crestie breeder send
this?" test. Specific over generic. Particular over vague. The animal's
actual traits, lineage, and recent changes should be visible in the copy.
`.trim();
}

const TOOL_DEF = {
  name: "submit_post_variant",
  description: "Submit one or more social media post variants for the user to choose from.",
  input_schema: {
    type: "object",
    required: ["variants"],
    properties: {
      variants: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          required: ["hook", "body", "hashtags", "cta"],
          properties: {
            hook:     { type: "string", description: "Opening line or two. Should stop the scroll." },
            body:     { type: "string", description: "Main caption body. May include the hook or stand alone after it." },
            hashtags: { type: "array", items: { type: "string" }, description: "Hashtags including the # prefix." },
            cta:      { type: "string", description: "Call to action. Empty string when platform forbids them (Reddit) or when the post is purely informational." },
          },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Cost helper — returns cents, rounded up. Adds a small safety margin so we
// never under-bill ourselves.
// ---------------------------------------------------------------------------
function computeCents(model: string, usage: {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}): number {
  const rates = PRICING_CENTS[model];
  if (!rates) return 0;
  const inputT  = Math.max(0, (usage.input_tokens || 0) - (usage.cache_read_input_tokens || 0) - (usage.cache_creation_input_tokens || 0));
  const cwT     = usage.cache_creation_input_tokens || 0;
  const crT     = usage.cache_read_input_tokens || 0;
  const outputT = usage.output_tokens || 0;
  const microCents =
    inputT  * rates.input +
    cwT     * rates.cacheWrite +
    crT     * rates.cacheRead +
    outputT * rates.output;
  // microCents is per-million-token-cents. Divide by 1M, round up.
  return Math.ceil(microCents / 1_000_000);
}

// ---------------------------------------------------------------------------
// Main handler
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
    photo_urls?: string[];
  };
  platforms: string[];
  template: string;        // 'meet' | 'available' | 'pairing' | 'eggs' | 'hatchling' | 'milestone' | 'throwback' | 'lineage' | 'educational'
  voice_preset: string;    // matches VOICE_PRESETS keys
  voice_custom?: string | null;
  tone?: string;
  length_pref?: string;    // 'short' | 'medium' | 'long'
  starting_point?: string;
  variant_count?: number;  // default 3
  kind?: string;           // 'generate' | 'regenerate' | 'voice_cycle' | 'tweak'
  previous_variants?: { content: string }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!ANTHROPIC_API_KEY) return json({ error: "anthropic_key_missing" }, 500);

  // Auth — verify_jwt is true, so Supabase already gated us by an authed
  // user. We pull the user id from the JWT for logging + rate limiting.
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "no_jwt" }, 401);

  const supaAuth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: userData, error: userErr } = await supaAuth.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "auth_failed" }, 401);
  const user = userData.user;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // Validate
  if (!body.post_id || !body.gecko?.id || !Array.isArray(body.platforms) || body.platforms.length === 0) {
    return json({ error: "missing_fields" }, 400);
  }
  if (!VOICE_PRESETS[body.voice_preset] && !body.voice_custom) {
    return json({ error: "unknown_voice_preset" }, 400);
  }

  // Iteration cap — atomically increment
  const { data: postRow, error: postErr } = await supabase
    .from("social_posts")
    .select("id, iteration_count, created_by_user_id")
    .eq("id", body.post_id)
    .maybeSingle();
  if (postErr || !postRow) return json({ error: "post_not_found" }, 404);
  if (postRow.created_by_user_id !== user.id) return json({ error: "forbidden" }, 403);
  if ((postRow.iteration_count || 0) >= ITERATION_CAP_PER_POST) {
    return json({ error: "iteration_cap_reached", cap: ITERATION_CAP_PER_POST }, 429);
  }

  const kind = body.kind || "generate";
  const variantCount = Math.max(1, Math.min(5, body.variant_count || 3));

  // First generation uses Sonnet; iterations use Haiku.
  const model = kind === "generate" ? SONNET : HAIKU;

  const userPrompt = buildUserPrompt(body, variantCount);

  // Build messages with cache_control on the system block.
  const messages = [
    { role: "user", content: userPrompt },
  ];

  const anthropicBody = {
    model,
    max_tokens: 2500,
    system: [
      {
        type: "text",
        text: buildSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
      ...(body.voice_custom
        ? [{
            type: "text",
            text: `# Custom voice override\n\n${body.voice_custom}`,
          }]
        : []),
    ],
    tools: [TOOL_DEF],
    tool_choice: { type: "tool", name: "submit_post_variant" },
    messages,
  };

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicBody),
    });
  } catch (e) {
    return json({ error: "anthropic_unreachable", detail: String(e) }, 502);
  }

  if (!res.ok) {
    const text = await res.text();
    return json({ error: "anthropic_failed", status: res.status, detail: text.slice(0, 500) }, 502);
  }

  const completion = await res.json() as {
    content: Array<{ type: string; input?: { variants?: unknown[] }; text?: string }>;
    usage: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };

  // Pull the tool-use block.
  const toolBlock = completion.content?.find((c) => c.type === "tool_use");
  const variants = (toolBlock?.input as { variants?: unknown[] } | undefined)?.variants;
  if (!Array.isArray(variants) || variants.length === 0) {
    return json({ error: "no_variants_returned" }, 502);
  }

  // Cost accounting
  const cents = computeCents(model, completion.usage || {});
  const monthKey = new Date().toISOString().slice(0, 7);

  // Log generation
  await supabase.from("social_generation_log").insert({
    user_id: user.id,
    post_id: body.post_id,
    model,
    input_tokens: completion.usage?.input_tokens || 0,
    output_tokens: completion.usage?.output_tokens || 0,
    cache_read_tokens: completion.usage?.cache_read_input_tokens || 0,
    cache_creation_tokens: completion.usage?.cache_creation_input_tokens || 0,
    cents_cost: cents,
    kind,
  });

  // Bump iteration count
  await supabase
    .from("social_posts")
    .update({ iteration_count: (postRow.iteration_count || 0) + 1, updated_date: new Date().toISOString() })
    .eq("id", body.post_id);

  // Atomically increment monthly api_cents_spent + generations_count.
  await supabase.rpc("increment_social_usage_spend", {
    p_user_id: user.id,
    p_month_key: monthKey,
    p_cents: cents,
  });

  return json({
    ok: true,
    variants,
    cents,
    model,
    iteration_count: (postRow.iteration_count || 0) + 1,
    iteration_cap: ITERATION_CAP_PER_POST,
  });
});

// ---------------------------------------------------------------------------
// User-prompt builder. Pulls the gecko profile down into a compact briefing
// the model can act on.
// ---------------------------------------------------------------------------
function buildUserPrompt(body: GenerateRequest, variantCount: number): string {
  const g = body.gecko;
  const lineage = [
    g.sire ? `Sire: ${g.sire.name || "unknown"}${g.sire.morph ? ` (${g.sire.morph})` : ""}` : null,
    g.dam  ? `Dam: ${g.dam.name || "unknown"}${g.dam.morph ? ` (${g.dam.morph})` : ""}`     : null,
  ].filter(Boolean).join(" / ");

  const recent = (g.recent_changes || []).filter(Boolean).slice(0, 6).join("; ");

  const previous = (body.previous_variants || [])
    .slice(0, 5)
    .map((v, i) => `${i + 1}. ${v.content}`)
    .join("\n");

  const lengthDirective = body.length_pref === "short"
    ? "Keep each variant tight: 1-2 short paragraphs."
    : body.length_pref === "long"
    ? "Each variant can run 3-4 paragraphs. Include lineage detail."
    : "Aim for medium length: 2-3 paragraphs.";

  return [
    `# Brief`,
    `Template: ${body.template}`,
    `Platform(s): ${body.platforms.join(", ")} (write ${variantCount} variant(s) for the FIRST platform listed; the user will adapt others if needed)`,
    `Voice preset: ${body.voice_preset}${body.voice_custom ? " + custom voice override" : ""}`,
    body.tone ? `Tone: ${body.tone}` : "",
    `Length: ${lengthDirective}`,
    body.starting_point ? `User's starting point / required angle: ${body.starting_point}` : "",
    "",
    `# Gecko`,
    `ID: ${g.id}`,
    `Name: ${g.name || "(unnamed)"}`,
    `Morph: ${g.morph || "(not specified)"}`,
    `Sex: ${g.sex || "(not specified)"}`,
    g.hatch_date ? `Hatched: ${g.hatch_date}` : "",
    g.weight_g != null ? `Current weight: ${g.weight_g}g` : "",
    g.sale_status ? `Sale status: ${g.sale_status}` : "",
    lineage ? `Lineage: ${lineage}` : "",
    g.notes ? `Breeder notes: ${g.notes.slice(0, 400)}` : "",
    recent ? `Recent changes: ${recent}` : "",
    "",
    previous ? `# Previously generated variants (do NOT repeat phrasing):\n${previous}\n` : "",
    `# Task`,
    `Generate ${variantCount} variant(s) by calling submit_post_variant. Each variant must respect the platform rules for ${body.platforms[0]}.`,
  ].filter(Boolean).join("\n");
}
