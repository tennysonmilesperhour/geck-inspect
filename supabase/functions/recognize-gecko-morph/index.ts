// Supabase Edge Function — recognize-gecko-morph (v6: self-hosted bank)
//
// Two-pass few-shot bank, all images on geck-inspect Supabase storage
// so Anthropic's image-prefetch is fast and reliable:
//
//   1. hero_anchor rows WHERE anchor_category = 'primary_morph'
//      — competition / show-winner photos for the primary_morph axis.
//      Non-primary_morph hero anchors (genetic_trait, base_color)
//      exist in gecko_images for the Morph Guide UI but are excluded
//      from the bank so they don't bias primary_morph predictions.
//
//   2. manual_touch rows — community-verified examples that fill
//      remaining slots for morphs the hero pool doesn't cover.
//      Filtered to URLs hosted on this Supabase project so prefetch
//      stays fast. auto_bulk_approved rows are excluded.
//
// History of eval runs (eval_set_size / top1_accuracy):
//   #1 baseline (no bank)        100/100  27.0%
//   #5 v2 manual-touch 12-image  100/100  34.0%  (best, mixed-CDN)
//   #6 v2.1 6-image lean         100/100  14.0%
//   #7 v3 hero-anchor 5-image     87/100  23.1%
//   #8 v4 hybrid 8-image (slow)   18/100   5.6%  (CDN prefetch fails)
//   #9 v5 disabled               100/100  30.0%  (production safety net)
//
// v6 re-enables the bank now that anchor URLs live on geck-inspect
// storage. Goal: recreate the v2 34% win on a stable substrate.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PRIMARY_MORPH_IDS, GENETIC_TRAIT_IDS, SECONDARY_TRAIT_IDS,
  BASE_COLOR_IDS, PATTERN_INTENSITY_IDS, WHITE_AMOUNT_IDS,
  FIRED_STATE_IDS, TAXONOMY_VERSION,
} from "./taxonomy.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_MODEL = Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-4-6";

// Cross-project sink for the per-call spend log. Lives in geck-data's
// Supabase project (separate from this function's own SUPABASE_URL) so
// the /data-admin/control panel has a single source of truth for
// Anthropic spend across production and eval. Logging fails open: a
// missing env var or a write error never prevents a successful
// recognition from returning to the caller.
const GECK_DATA_SUPABASE_URL = Deno.env.get("GECK_DATA_SUPABASE_URL");
const GECK_DATA_SUPABASE_SERVICE_KEY = Deno.env.get("GECK_DATA_SUPABASE_SERVICE_KEY");

// Shared secret that lets the eval script (scripts/eval_morph_id.py)
// tag its calls as surface='morph_id_eval' regardless of auth state.
// Without it, all non-admin callers fall through to 'morph_id_production'.
const EVAL_SHARED_SECRET = Deno.env.get("EVAL_SHARED_SECRET");

// USD per million tokens. Used to compute est_cost_cents at write time.
// Frozen here so historic rows don't drift if Anthropic re-prices.
const PRICE_PER_MTOK_USD: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5":  { input: 1,  output: 5 },
  "claude-sonnet-4-6": { input: 3,  output: 15 },
  "claude-opus-4-7":   { input: 15, output: 75 },
};

function computeCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = PRICE_PER_MTOK_USD[model];
  if (!price) return 0;
  const dollars = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  return Math.round(dollars * 10000) / 100;
}

const ALLOWED_SURFACES = new Set([
  "morph_id_production",
  "morph_id_eval",
  "morph_id_train",
  "morph_id_unknown",
]);

function resolveSurface(
  rawSurface: unknown,
  isAdmin: boolean,
  evalSecretHeader: string | null,
): string {
  const tagAllowed = isAdmin || (
    !!EVAL_SHARED_SECRET && evalSecretHeader === EVAL_SHARED_SECRET
  );
  if (tagAllowed && typeof rawSurface === "string" && ALLOWED_SURFACES.has(rawSurface)) {
    return rawSurface;
  }
  return "morph_id_production";
}

type InvocationLog = {
  surface: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_creation_tokens: number | null;
  est_cost_cents: number | null;
  user_id: string | null;
  tier: string | null;
  is_admin: boolean;
  photo_count: number | null;
  few_shot_count: number | null;
  http_status: number | null;
  error_code: string | null;
  duration_ms: number | null;
  request_id: string | null;
};

async function logInvocation(row: InvocationLog): Promise<void> {
  if (!GECK_DATA_SUPABASE_URL || !GECK_DATA_SUPABASE_SERVICE_KEY) return;
  try {
    const sink = createClient(GECK_DATA_SUPABASE_URL, GECK_DATA_SUPABASE_SERVICE_KEY);
    const { error } = await sink.from("model_invocations").insert(row);
    if (error) console.error("model_invocations insert failed:", error.message);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("model_invocations sink threw:", message);
  }
}

// Allowed per-request model overrides. The eval pipeline switches between
// haiku (cheap, default for iteration) and sonnet (benchmark) via the
// request body. Anything else falls back to the env-configured default
// so a stray client can't make us run opus by accident.
const ALLOWED_MODELS = new Set([
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
  "claude-opus-4-7",
]);
function resolveModel(raw: unknown): string {
  return typeof raw === "string" && ALLOWED_MODELS.has(raw) ? raw : CLAUDE_MODEL;
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Bank is ENABLED by default now that anchor images are mirrored to
// geck-inspect Supabase storage and the manual_touch filler is filtered
// to URLs on the same project. Set the env vars to 0 to disable for an
// emergency revert without a code change.
const FEW_SHOT_PER_MORPH = Math.min(2, Math.max(0,
  Number(Deno.env.get("FEW_SHOT_PER_MORPH") ?? "1") || 0));
const MAX_BANK_TOTAL = Math.min(12, Math.max(0,
  Number(Deno.env.get("FEW_SHOT_MAX_TOTAL") ?? "10") || 0));
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

// Per-tier monthly credit allotments. Keep in sync with
// src/lib/tierLimits.js#monthlyMorphIDCredits. Unknown / missing tier
// falls back to `free`, matching the frontend's tierOf() helper.
const TIER_MORPH_ID_CREDITS: Record<string, number> = {
  free: 1,
  keeper: 3,
  breeder: 6,
  enterprise: 15,
};

type Profile = {
  auth_user_id: string;
  membership_tier: string | null;
  subscription_status: string | null;
  role: string | null;
  morph_id_show_value_estimate: boolean | null;
};

async function loadProfile(authToken: string): Promise<Profile | null> {
  // Use the caller's JWT to identify them, then fetch the profile row
  // server-side with the service role so RLS doesn't gate the lookup
  // even for users whose `profiles.email` linkage is legacy.
  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${authToken}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await admin.from("profiles")
    .select("membership_tier, subscription_status, role, morph_id_show_value_estimate")
    .eq("email", user.email)
    .maybeSingle();
  return {
    auth_user_id: user.id,
    membership_tier: data?.membership_tier ?? null,
    subscription_status: data?.subscription_status ?? null,
    role: data?.role ?? null,
    morph_id_show_value_estimate: data?.morph_id_show_value_estimate ?? false,
  };
}

function resolveTier(profile: Profile): string {
  if (profile.subscription_status === "grandfathered") return "breeder";
  const t = profile.membership_tier;
  return t && t in TIER_MORPH_ID_CREDITS ? t : "free";
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
      console.log(`few-shot bank v6: ${combined.length} examples (${heroCount} hero + ${fillerCount} manual) across ${distinctMorphs} morphs`);
      return combined;
    })();
  }
  return fewShotCache;
}

function buildInstructions(fewShotBank: FewShotExample[], includeValueEstimate: boolean) {
  const bankIntro = fewShotBank.length === 0 ? "" :
    `\n\nFew-shot reference: the first ${fewShotBank.length} attached image(s) are LABELED reference examples (the final image is the user's photo to identify). Hero-anchor entries are competition-judged show winners (gold-standard visual definitions); manual-touch entries are community-verified examples. Use them as visual anchors for the canonical look of each primary_morph BEFORE evaluating the user's photo. The mapping, in order:\n${fewShotBank.map((ex, i) => {
      const tier = ex.source === "hero_anchor" ? " [hero]" : "";
      const name = ex.gecko_name ? ` "${ex.gecko_name}"` : "";
      const color = ex.base_color ? ` (base ${ex.base_color})` : "";
      return `  ${i + 1}. ${ex.primary_morph}${tier}${name}${color}`;
    }).join("\n")}`;

  const valueLine = includeValueEstimate
    ? `\n- value_estimate_usd_low / value_estimate_usd_high: a CONSERVATIVE retail price band in US dollars for an unrelated, unproven specimen at the apparent life stage, based on the morph quality you actually see in the photo. Reflect uncertainty by widening the band. value_estimate_notes is one sentence on what drives the band (e.g., "high white expression on a clean pin lifts this; unproven het knocks it down").`
    : "";

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
  confidence_score substantially and explain why in the explanation field.${valueLine}

Taxonomy version: ${TAXONOMY_VERSION}.${bankIntro}`;
}

function buildTool(includeValueEstimate: boolean) {
  const properties: Record<string, unknown> = {
    primary_morph:     { type: "string", enum: PRIMARY_MORPH_IDS },
    genetic_traits:    { type: "array", items: { type: "string", enum: GENETIC_TRAIT_IDS } },
    secondary_traits:  { type: "array", items: { type: "string", enum: SECONDARY_TRAIT_IDS } },
    base_color:        { type: "string", enum: BASE_COLOR_IDS },
    pattern_intensity: { type: "string", enum: PATTERN_INTENSITY_IDS },
    white_amount:      { type: "string", enum: WHITE_AMOUNT_IDS },
    fired_state:       { type: "string", enum: FIRED_STATE_IDS },
    confidence_score:  { type: "integer", minimum: 0, maximum: 100 },
    explanation:       { type: "string", description: "1-2 sentences citing visual evidence." },
  };
  if (includeValueEstimate) {
    properties.value_estimate_usd_low = {
      type: "integer", minimum: 0,
      description: "Conservative low end of retail price band in USD for an unrelated, unproven specimen at apparent life stage.",
    };
    properties.value_estimate_usd_high = {
      type: "integer", minimum: 0,
      description: "Conservative high end of retail price band in USD.",
    };
    properties.value_estimate_notes = {
      type: "string",
      description: "One sentence on what drives the price band.",
    };
  }
  return {
    name: "submit_morph_analysis",
    description: "Submit the structured morph analysis for this crested gecko photo.",
    input_schema: {
      type: "object",
      required: ["primary_morph", "confidence_score", "explanation"],
      properties,
    },
  };
}

function clampToTaxonomy(
  raw: Record<string, unknown>,
  includeValueEstimate: boolean,
  model: string,
) {
  const pick = (v: unknown, allowed: string[]) =>
    typeof v === "string" && allowed.includes(v) ? v : null;
  const pickMany = (v: unknown, allowed: string[]) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string" && allowed.includes(x)) : [];
  const out: Record<string, unknown> = {
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
    model,
  };
  if (includeValueEstimate) {
    const low = Number(raw.value_estimate_usd_low);
    const high = Number(raw.value_estimate_usd_high);
    if (Number.isFinite(low) && Number.isFinite(high) && high >= low && low >= 0) {
      out.value_estimate = {
        usd_low: Math.round(low),
        usd_high: Math.round(high),
        notes: typeof raw.value_estimate_notes === "string" ? raw.value_estimate_notes : "",
      };
    }
  }
  return out;
}

class UpstreamError extends Error {
  status: number;
  code: string;
  httpStatus: number;
  requestId: string | null;
  durationMs: number;
  constructor(
    message: string,
    status: number,
    code: string,
    extra: { httpStatus?: number; requestId?: string | null; durationMs?: number } = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.httpStatus = extra.httpStatus ?? status;
    this.requestId = extra.requestId ?? null;
    this.durationMs = extra.durationMs ?? 0;
  }
}

type UpstreamUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

type CallClaudeResult = {
  raw: Record<string, unknown>;
  few_shot_count: number;
  usage: UpstreamUsage;
  http_status: number;
  request_id: string | null;
  duration_ms: number;
};

async function callClaude(
  imageUrls: string[],
  includeValueEstimate: boolean,
  model: string,
): Promise<CallClaudeResult> {
  const bank = await loadFewShotBank();
  const bankBlocks = bank.map((ex) => ({ type: "image", source: { type: "url", url: ex.image_url } }));
  const userBlocks = imageUrls.map((url) => ({ type: "image", source: { type: "url", url } }));
  const multiNote = imageUrls.length > 1
    ? `\n\nNOTE: the LAST ${imageUrls.length} photos are of the SAME user-submitted animal. Synthesize across them.`
    : "";
  const tool = buildTool(includeValueEstimate);
  const startedAt = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{
        role: "user",
        content: [
          ...bankBlocks,
          ...userBlocks,
          { type: "text", text: buildInstructions(bank, includeValueEstimate) + multiNote },
        ],
      }],
    }),
  });
  const requestId = res.headers.get("request-id");
  const durationMs = Date.now() - startedAt;
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    const code = res.status === 429 ? "upstream_rate_limited" : "upstream_error";
    throw new UpstreamError(`Anthropic ${res.status}: ${detail}`, res.status, code, {
      httpStatus: res.status,
      requestId,
      durationMs,
    });
  }
  const body = await res.json();
  const toolBlock = (body.content || []).find((b: { type: string }) => b.type === "tool_use");
  if (!toolBlock?.input) {
    throw new UpstreamError("Claude did not return a tool_use block", 502, "upstream_error", {
      httpStatus: res.status,
      requestId,
      durationMs,
    });
  }
  const usage: UpstreamUsage = body.usage ?? { input_tokens: 0, output_tokens: 0 };
  return {
    raw: toolBlock.input as Record<string, unknown>,
    few_shot_count: bank.length,
    usage,
    http_status: res.status,
    request_id: requestId,
    duration_ms: durationMs,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only", code: "method_not_allowed" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not set", code: "config_error" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "auth required", code: "auth_required" }, 401);

  let profile: Profile | null;
  try {
    profile = await loadProfile(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `auth lookup failed: ${message}`, code: "auth_required" }, 401);
  }
  if (!profile) return json({ error: "auth required", code: "auth_required" }, 401);

  const isAdmin = profile.role === "admin";
  const tier = resolveTier(profile);
  const creditsIncluded = TIER_MORPH_ID_CREDITS[tier] ?? TIER_MORPH_ID_CREDITS.free;

  // Paid tiers only get the value estimate, and only when the profile
  // toggle is on. Admins inherit Breeder-or-better, so we read the
  // toggle as-is for them.
  const isPaidTier = tier === "keeper" || tier === "breeder" || tier === "enterprise";
  const includeValueEstimate = !!profile.morph_id_show_value_estimate && (isPaidTier || isAdmin);

  // Hoisted so the catch block can include them in the spend-log row.
  // Defaults match what `logInvocation` should see if we crash before
  // parsing the request body.
  let imageUrls: string[] = [];
  let model = CLAUDE_MODEL;
  let surface = "morph_id_production";

  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.imageUrls)) {
      imageUrls = body.imageUrls.filter((u: unknown) => typeof u === "string" && u);
    } else if (typeof body?.imageUrl === "string") {
      imageUrls = [body.imageUrl];
    }
    if (imageUrls.length === 0) {
      return json({ error: "imageUrls or imageUrl is required", code: "bad_request" }, 400);
    }
    imageUrls = imageUrls.slice(0, 5);

    // Per-request model override (defaults to env-configured CLAUDE_MODEL).
    // The eval pipeline sends `model: "claude-haiku-4-5"` for cheap iteration
    // and "claude-sonnet-4-6" for benchmark runs. Production callers
    // (Recognition.jsx, TrainModel.jsx) omit `model` and get the env default.
    model = resolveModel(body?.model);

    // Surface tag for the spend-log sink. Eval script sends
    // surface='morph_id_eval' + the shared secret header; admin callers
    // can tag themselves freely; everyone else gets 'morph_id_production'.
    surface = resolveSurface(
      body?.surface,
      isAdmin,
      req.headers.get("x-eval-secret"),
    );

    let creditsConsumed = 0;
    let creditsRemaining: number | null = null;
    if (!isAdmin) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: usage, error: rpcErr } = await admin.rpc("consume_morph_id_credit", {
        p_user_id: profile.auth_user_id,
        p_tier: tier,
        p_credits_included: creditsIncluded,
      });
      if (rpcErr) {
        if ((rpcErr.message || "").includes("morph_id_credits_exhausted")) {
          return json({
            error: "Monthly MorphID credit limit reached.",
            code: "morph_id_credits_exhausted",
            tier,
            credits_included: creditsIncluded,
          }, 402);
        }
        return json({
          error: `credit check failed: ${rpcErr.message}`,
          code: "credit_check_failed",
        }, 500);
      }
      creditsConsumed = usage?.credits_consumed ?? 0;
      creditsRemaining = Math.max(0, creditsIncluded - creditsConsumed);
    }

    const result = await callClaude(imageUrls, includeValueEstimate, model);
    const analysis = clampToTaxonomy(result.raw, includeValueEstimate, model);
    await logInvocation({
      surface,
      model,
      input_tokens: result.usage.input_tokens ?? 0,
      output_tokens: result.usage.output_tokens ?? 0,
      cache_read_tokens: result.usage.cache_read_input_tokens ?? null,
      cache_creation_tokens: result.usage.cache_creation_input_tokens ?? null,
      est_cost_cents: computeCostCents(
        model,
        result.usage.input_tokens ?? 0,
        result.usage.output_tokens ?? 0,
      ),
      user_id: profile.auth_user_id,
      tier,
      is_admin: isAdmin,
      photo_count: imageUrls.length,
      few_shot_count: result.few_shot_count,
      http_status: result.http_status,
      error_code: null,
      duration_ms: result.duration_ms,
      request_id: result.request_id,
    });
    return json({
      success: true,
      analysis,
      model,
      photo_count: imageUrls.length,
      few_shot_count: result.few_shot_count,
      tier,
      is_admin: isAdmin,
      credits_included: creditsIncluded,
      credits_consumed: creditsConsumed,
      credits_remaining: creditsRemaining,
      value_estimate_included: includeValueEstimate,
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      await logInvocation({
        surface,
        model,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: null,
        cache_creation_tokens: null,
        est_cost_cents: 0,
        user_id: profile.auth_user_id,
        tier,
        is_admin: isAdmin,
        photo_count: imageUrls.length,
        few_shot_count: null,
        http_status: err.httpStatus,
        error_code: err.code,
        duration_ms: err.durationMs,
        request_id: err.requestId,
      });
      return json({ error: err.message, code: err.code }, err.status === 429 ? 503 : 502);
    }
    const message = err instanceof Error ? err.message : String(err);
    await logInvocation({
      surface,
      model,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: null,
      cache_creation_tokens: null,
      est_cost_cents: 0,
      user_id: profile.auth_user_id,
      tier,
      is_admin: isAdmin,
      photo_count: imageUrls.length,
      few_shot_count: null,
      http_status: null,
      error_code: "internal_error",
      duration_ms: null,
      request_id: null,
    });
    return json({ error: message, code: "internal_error" }, 500);
  }
});
