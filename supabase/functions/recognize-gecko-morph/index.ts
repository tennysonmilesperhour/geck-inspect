// Supabase Edge Function — recognize-gecko-morph (v8: bank off by data)
//
// The bank loader + Anthropic prompt-caching plumbing are fully wired up
// (see v6/v7 for design) but the bank is DISABLED by default because
// the eval data says it HURTS primary_morph accuracy.
//
// Eval evidence (post credit top-up, post prompt-caching):
//
//   #9  v5 baseline (no bank)          100/100   30.0% top1
//   #12 v7 cached bank (n=50)           50/50    22.0% top1  ← REGRESSION
//
// What's happening: the bank covers only 5 primary_morphs (harlequin,
// pinstripe, dalmatian, phantom_pinstripe, tricolor). The model
// anchors hard on those and over-predicts harlequin while never
// predicting morphs that aren't in the bank (extreme_harlequin,
// pinstripe-fallback, etc.). Net regression of ~8 percentage points.
//
// Side note: base_color accuracy went UP (+19pp) because the bank
// text labels include base colors. Not enough to justify the
// primary_morph hit, since primary_morph is the headline metric.
//
// Re-enable when we have ≥12 primary_morph hero anchors covering
// extreme_harlequin, super_dalmatian, partial_pinstripe, brindle,
// tiger, flame at minimum. Until then, defaults stay at 0 and the
// function runs at baseline 30% / ~$0.01 per user call.
//
// Eval history (eval_set_size / top1_accuracy):
//   #1  baseline (no bank)         100/100  27.0%
//   #5  v2 manual-touch 12-image   100/100  34.0%  (best, mixed-CDN)
//   #6  v2.1 6-image lean          100/100  14.0%
//   #7  v3 hero-anchor 5-image      87/100  23.1%
//   #8  v4 hybrid 8-image            18/100   5.6%  (credit balance, not CDN)
//   #9  v5 disabled                100/100  30.0%  ← reference baseline
//   #10 v6 self-hosted bank          6/100   0.0%  (credit balance)
//   #11 v7 smoke (cached)            10/10  20.0%  (n too small)
//   #12 v7 cached bank n=50          50/50  22.0%  (decision point)

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PRIMARY_MORPH_IDS, GENETIC_TRAIT_IDS, SECONDARY_TRAIT_IDS,
  BASE_COLOR_IDS, PATTERN_INTENSITY_IDS, WHITE_AMOUNT_IDS,
  FIRED_STATE_IDS, TAXONOMY_VERSION,
} from "./taxonomy.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_MODEL = Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-4-6";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Bank is DISABLED by default because the v7 eval showed the
// 5-primary-morph bank regresses top1 accuracy by ~8pp vs the no-bank
// baseline (see header eval history). The plumbing stays in place;
// flip these env vars to 1/10 when ≥12 primary_morph hero anchors are
// available across the morphs the model currently misses.
const FEW_SHOT_PER_MORPH = Math.min(2, Math.max(0,
  Number(Deno.env.get("FEW_SHOT_PER_MORPH") ?? "0") || 0));
const MAX_BANK_TOTAL = Math.min(12, Math.max(0,
  Number(Deno.env.get("FEW_SHOT_MAX_TOTAL") ?? "0") || 0));
// Manual-touch fillers are restricted to URLs hosted on this Supabase
// project so Anthropic's prefetch is fast. Override via env if a faster
// CDN is observed and we want to broaden.
const FILLER_URL_PREFIX = Deno.env.get("FEW_SHOT_FILLER_URL_PREFIX")
  ?? `${SUPABASE_URL.replace(/\/$/, "")}/`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...CORS },
  });
}

type FewShotExample = {
  image_url: string;
  primary_morph: string;
  base_color: string | null;
  gecko_name?: string | null;
  source: "hero_anchor" | "manual_touch";
};

let fewShotCache: Promise<FewShotExample[]> | null = null;

type Row = {
  image_url: string | null;
  primary_morph: string | null;
  base_color: string | null;
  training_meta: Record<string, unknown> | null;
};

function takeOnePerMorph(
  rows: Row[],
  source: "hero_anchor" | "manual_touch",
  takenMorphs: Set<string>,
): FewShotExample[] {
  const buckets = new Map<string, FewShotExample[]>();
  for (const r of rows) {
    const m = r.primary_morph;
    if (!m || !r.image_url || takenMorphs.has(m)) continue;
    const arr = buckets.get(m) ?? [];
    if (arr.length >= FEW_SHOT_PER_MORPH) continue;
    arr.push({
      image_url: r.image_url,
      primary_morph: m,
      base_color: r.base_color ?? null,
      gecko_name: (r.training_meta?.gecko_name as string | null) ?? null,
      source,
    });
    buckets.set(m, arr);
  }
  return [...buckets.keys()].sort().flatMap((m) => buckets.get(m) ?? []);
}

async function loadFewShotBank(): Promise<FewShotExample[]> {
  if (FEW_SHOT_PER_MORPH === 0 || MAX_BANK_TOTAL === 0) return [];
  if (!fewShotCache) {
    fewShotCache = (async () => {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const baseQuery = () =>
        admin.from("gecko_images")
          .select("image_url, primary_morph, base_color, training_meta")
          .eq("verified", true)
          .not("primary_morph", "is", null)
          .not("image_url", "is", null)
          .in("primary_morph", PRIMARY_MORPH_IDS);

      const heroRes = await baseQuery()
        .filter("training_meta->>verification_tier", "eq", "hero_anchor")
        .filter("training_meta->>anchor_category", "eq", "primary_morph")
        .order("created_date", { ascending: false })
        .limit(200);
      if (heroRes.error) {
        console.error("hero_anchor load failed:", heroRes.error.message);
      }
      const heroExamples = takeOnePerMorph(heroRes.data ?? [], "hero_anchor", new Set());
      const heroMorphs = new Set(heroExamples.map((e) => e.primary_morph));

      const remaining = Math.max(0, MAX_BANK_TOTAL - heroExamples.length);
      let fillerExamples: FewShotExample[] = [];
      if (remaining > 0) {
        const fillerRes = await baseQuery()
          .is("training_meta->>verification_tier", null)
          .like("image_url", `${FILLER_URL_PREFIX}%`)
          .order("created_date", { ascending: false })
          .limit(500);
        if (fillerRes.error) {
          console.error("manual_touch filler load failed:", fillerRes.error.message);
        }
        fillerExamples = takeOnePerMorph(fillerRes.data ?? [], "manual_touch", heroMorphs)
          .slice(0, remaining);
      }

      const combined = [...heroExamples, ...fillerExamples].slice(0, MAX_BANK_TOTAL);
      const heroCount = combined.filter((e) => e.source === "hero_anchor").length;
      const fillerCount = combined.length - heroCount;
      const distinctMorphs = new Set(combined.map((e) => e.primary_morph)).size;
      console.log(`few-shot bank v8: ${combined.length} examples (${heroCount} hero + ${fillerCount} manual) across ${distinctMorphs} morphs`);
      return combined;
    })();
  }
  return fewShotCache;
}

/** Stable across all calls within a warm-instance lifetime. Cached. */
function buildCacheableInstructions(fewShotBank: FewShotExample[]) {
  const bankIntro = fewShotBank.length === 0 ? "" :
    `\n\nFew-shot reference: the first ${fewShotBank.length} attached image(s) are LABELED reference examples (the user's photo(s) follow, after this text). Hero-anchor entries are competition-judged show winners (gold-standard visual definitions); manual-touch entries are community-verified examples. Use them as visual anchors for the canonical look of each primary_morph BEFORE evaluating the user's photo. The mapping, in order:\n${fewShotBank.map((ex, i) => {
      const tier = ex.source === "hero_anchor" ? " [hero]" : "";
      const name = ex.gecko_name ? ` "${ex.gecko_name}"` : "";
      const color = ex.base_color ? ` (base ${ex.base_color})` : "";
      return `  ${i + 1}. ${ex.primary_morph}${tier}${name}${color}`;
    }).join("\n")}`;

  return `You are a world-expert crested gecko (Correlophus ciliatus) morph identifier. Analyze
the user's photograph(s) and call the \`submit_morph_analysis\` tool with your best
assessment. Use ONLY the ids provided in the tool's schema for each field — do not
invent ids; if unsure, pick the closest and lower your confidence score.

Rules:
- primary_morph is the single best pattern-class id. Don't call "harlequin" for a
  flame, or "extreme_harlequin" without >60% leg pattern.
- genetic_traits is ONLY for named/proven heritable traits (lily_white, axanthic,
  cappuccino, etc.). Leave empty if you don't see clear evidence.
- secondary_traits is observational modifiers. Multiple allowed.
- If the photo is blurry, oddly lit, or shows multiple animals, lower
  confidence_score substantially and explain why in the explanation field.

Taxonomy version: ${TAXONOMY_VERSION}.${bankIntro}`;
}

const TOOL = {
  name: "submit_morph_analysis",
  description: "Submit the structured morph analysis for this crested gecko photo.",
  input_schema: {
    type: "object",
    required: ["primary_morph", "confidence_score", "explanation"],
    properties: {
      primary_morph:     { type: "string", enum: PRIMARY_MORPH_IDS },
      genetic_traits:    { type: "array", items: { type: "string", enum: GENETIC_TRAIT_IDS } },
      secondary_traits:  { type: "array", items: { type: "string", enum: SECONDARY_TRAIT_IDS } },
      base_color:        { type: "string", enum: BASE_COLOR_IDS },
      pattern_intensity: { type: "string", enum: PATTERN_INTENSITY_IDS },
      white_amount:      { type: "string", enum: WHITE_AMOUNT_IDS },
      fired_state:       { type: "string", enum: FIRED_STATE_IDS },
      confidence_score:  { type: "integer", minimum: 0, maximum: 100 },
      explanation:       { type: "string", description: "1-2 sentences citing visual evidence." },
    },
  },
};

function clampToTaxonomy(raw: Record<string, unknown>) {
  const pick = (v: unknown, allowed: string[]) =>
    typeof v === "string" && allowed.includes(v) ? v : null;
  const pickMany = (v: unknown, allowed: string[]) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string" && allowed.includes(x)) : [];
  return {
    primary_morph:     pick(raw.primary_morph, PRIMARY_MORPH_IDS),
    genetic_traits:    pickMany(raw.genetic_traits, GENETIC_TRAIT_IDS),
    secondary_traits:  pickMany(raw.secondary_traits, SECONDARY_TRAIT_IDS),
    base_color:        pick(raw.base_color, BASE_COLOR_IDS),
    pattern_intensity: pick(raw.pattern_intensity, PATTERN_INTENSITY_IDS) || "medium",
    white_amount:      pick(raw.white_amount, WHITE_AMOUNT_IDS) || "medium",
    fired_state:       pick(raw.fired_state, FIRED_STATE_IDS) || "unknown",
    confidence_score:  Math.max(0, Math.min(100, Number(raw.confidence_score) || 0)),
    explanation:       typeof raw.explanation === "string" ? raw.explanation : "",
    taxonomy_version:  TAXONOMY_VERSION,
    model:             CLAUDE_MODEL,
  };
}

async function callClaude(imageUrls: string[]) {
  const bank = await loadFewShotBank();

  // Cacheable block: bank images + bank-intro + rules. Stable across all
  // calls within the warm-instance lifetime (and across cold starts as
  // long as the bank composition is unchanged).
  const cacheableContent: Record<string, unknown>[] = [
    ...bank.map((ex) => ({ type: "image", source: { type: "url", url: ex.image_url } })),
    { type: "text", text: buildCacheableInstructions(bank) },
  ];
  // Mark the LAST cacheable block with cache_control: everything in this
  // user-message up to and including this block is cached together. The
  // bank text always exists (even when bank is empty, the rules text is
  // there to anchor the cache), so this is safe to do unconditionally.
  cacheableContent[cacheableContent.length - 1] = {
    ...cacheableContent[cacheableContent.length - 1],
    cache_control: { type: "ephemeral" },
  };

  // Variable block: user-submitted image(s) and the optional
  // multi-photo synthesis hint.
  const userBlocks: Record<string, unknown>[] = imageUrls.map((url) =>
    ({ type: "image", source: { type: "url", url } }));
  const trailingText = imageUrls.length > 1
    ? `The ${imageUrls.length} images above are of the SAME user-submitted animal. Synthesize across them before calling the tool.`
    : `The image above is the user's submitted gecko. Call the tool with your analysis.`;
  const variableContent: Record<string, unknown>[] = [
    ...userBlocks,
    { type: "text", text: trailingText },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      // Prompt caching is GA on Sonnet 4 but the beta header doesn't
      // hurt and is needed for some account configurations.
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{
        role: "user",
        content: [...cacheableContent, ...variableContent],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const body = await res.json();
  const toolBlock = (body.content || []).find((b: { type: string }) => b.type === "tool_use");
  if (!toolBlock?.input) throw new Error("Claude did not return a tool_use block");
  const usage = (body.usage ?? {}) as Record<string, unknown>;
  return {
    raw: toolBlock.input as Record<string, unknown>,
    few_shot_count: bank.length,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not set" }, 500);
  try {
    const body = await req.json().catch(() => ({}));
    let imageUrls: string[] = [];
    if (Array.isArray(body?.imageUrls)) {
      imageUrls = body.imageUrls.filter((u: unknown) => typeof u === "string" && u);
    } else if (typeof body?.imageUrl === "string") {
      imageUrls = [body.imageUrl];
    }
    if (imageUrls.length === 0) return json({ error: "imageUrls or imageUrl is required" }, 400);
    imageUrls = imageUrls.slice(0, 5);
    const { raw, few_shot_count, cache_creation_input_tokens, cache_read_input_tokens } =
      await callClaude(imageUrls);
    const analysis = clampToTaxonomy(raw);
    return json({
      success: true,
      analysis,
      model: CLAUDE_MODEL,
      photo_count: imageUrls.length,
      few_shot_count,
      cache_creation_input_tokens,
      cache_read_input_tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
