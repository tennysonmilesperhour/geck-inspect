// Supabase Edge Function: recognize-gecko-morph (v9: raw-data visual retrieval)
//
// Two-pass few-shot bank, all images on geck-inspect Supabase storage
// so Anthropic's image-prefetch is fast and reliable. Anthropic prompt
// caching (`cache_control: ephemeral`) wraps the bank images + the
// instructions text so repeat callers within the 5-minute cache window
// pay ~10% of full input rate for the cached portion.
//
//   1. hero_anchor rows WHERE anchor_category = 'primary_morph',
//      competition / show-winner photos for the primary_morph axis.
//      Non-primary_morph hero anchors (genetic_trait, base_color)
//      exist in gecko_images for the Morph Guide UI but are excluded
//      from the bank so they don't bias primary_morph predictions.
//
//   2. manual_touch rows: community-verified examples that fill
//      remaining slots for morphs the hero pool doesn't cover.
//      Filtered to URLs hosted on this Supabase project so prefetch
//      stays fast. auto_bulk_approved rows are excluded.
//
// Prompt-cache layout per request:
//   [bank images] [bank-intro + instructions text WITH cache_control]
//   [user images] [trailing per-call text]
//
// The bank is DISABLED by default (FEW_SHOT_PER_MORPH=0, MAX=0)
// because the v7 eval data showed the 5-primary-morph bank REGRESSES
// top1 accuracy by ~8pp vs the no-bank baseline. The model anchors
// hard on the morphs that ARE in the bank (over-predicts harlequin)
// and stops predicting morphs that aren't (never predicts pinstripe,
// extreme_harlequin, etc.). Caching plumbing stays wired up so flipping
// the env vars to 1/10 immediately gets the cost benefit if/when the
// bank grows to cover ≥12 primary_morphs.
//
// Re-enable criteria: ≥12 primary_morph hero anchors covering at
// minimum extreme_harlequin, super_dalmatian, partial_pinstripe,
// brindle, tiger, flame.
//
// Eval history (eval_set_size / top1_accuracy):
//   #1  baseline (no bank)         100/100  27.0%
//   #5  v2 manual-touch 12-image   100/100  34.0%  (best, mixed-CDN)
//   #6  v2.1 6-image lean          100/100  14.0%
//   #7  v3 hero-anchor 5-image      87/100  23.1%
//   #8  v4 hybrid 8-image            18/100   5.6%  (credit balance, not CDN)
//   #9  v5 disabled                100/100  30.0%  ← reference baseline
//   #10 v6 self-hosted bank           6/100   0.0%  (credit balance)
//   #11 v7 smoke (cached)            10/10  20.0%  (n too small)
//   #12 v7 cached bank n=50          50/50  22.0%  (decision point: REGRESSION)
//
// Since 28 Sep 2026 the test set is 220 held-out listings graded against the
// patterns their breeders tagged (scripts/morph-id-eval/, Actions >
// morph-id-eval). Numbers are first answer / top three:
//   #17 v59 photo lookup working   220/220  43.6% / 68.6% breeder tag
//                                           (37.7% / 64.1% single picked pattern)
// Harlequin was the answer 148 times; Pinstripe and Tricolor never. v60
// makes Harlequin the base (pinning or tricolor leads over it) and fills the
// shortlist from the photo lookup's vote.
//   #19 v60 Harlequin base         195/220  37.4% / 72.8% breeder tag
//                                           (last 25 lost to API credit)
// v61 reads partial pinning as Pinstripe when the breeder photo vote leads
// with Pinstripe (same three on the shortlist, new order).

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PRIMARY_MORPH_IDS, PHOTO_GENETIC_TRAIT_IDS, SECONDARY_TRAIT_IDS,
  BASE_COLOR_IDS, PATTERN_INTENSITY_IDS, WHITE_AMOUNT_IDS,
  PATTERN_COLOR_IDS,
  FIRED_STATE_IDS, AGE_STAGE_IDS, TAXONOMY_VERSION,
  PATTERN_FAMILY_IDS, PINNING_IDS, BANDING_IDS, SPOTTING_IDS,
  WHITE_PLACEMENT_IDS,
} from "./taxonomy.ts";
import {
  buildVisualEvidence,
  evidenceAssessment,
  type RawVisualNeighbor,
  type VisualEvidence,
} from "../_shared/morph-evidence.ts";
import { buildShortlist, leadingPattern } from "../_shared/morph-naming.ts";
import { RETRYABLE_UPSTREAM_STATUS, requestShape, upstreamErrorCode } from "../_shared/morph-upstream.ts";
import {
  createVisualEmbedding,
  DEFAULT_VISUAL_EMBEDDING_MODEL,
  meanNormalizedEmbeddings,
} from "../_shared/visual-embedding.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_MODEL = Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-4-6";
// The whole request must finish inside the browser's 120 s deadline
// (src/lib/supabaseClient.js) so a timed-out analysis is refunded here
// instead of finishing unseen after the member gave up.
const REQUEST_BUDGET_MS = 100_000;
const CLAUDE_DEADLINE_MS = 90_000;
const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
const VISUAL_EMBEDDING_MODEL = Deno.env.get("SIGLIP_MODEL") ||
  DEFAULT_VISUAL_EMBEDDING_MODEL;
const VISUAL_RETRIEVAL_ENABLED = Deno.env.get("MORPH_VISUAL_RETRIEVAL") !== "false";
const RETRIEVAL_MAX_PHOTOS = Math.min(3, Math.max(1,
  Number(Deno.env.get("MORPH_RETRIEVAL_MAX_PHOTOS") || "1") || 1));
const RETRIEVAL_MIN_SIMILARITY = Math.min(0.95, Math.max(0,
  Number(Deno.env.get("MORPH_RETRIEVAL_MIN_SIMILARITY") || "0.50") || 0.50));

// Sink for the per-call spend log and the runtime_config caps: the
// geck_data schema in this project. It used to be a separate geck-data
// project reached through its own URL secret; that project was folded in on
// 4 Sep 2026 and deleted, the secret kept pointing at it, and the spend log
// and the per-IP cap failed silently until 28 Sep. Logging fails open: a
// write error never prevents a successful recognition from returning to
// the caller.
function geckDataSink() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { db: { schema: "geck_data" } });
}

// Shared secret that lets the eval script (scripts/eval-morph-id.mjs)
// tag its calls as surface='morph_id_eval' regardless of auth state.
// Without it, all non-admin callers fall through to 'morph_id_production'.
const EVAL_SHARED_SECRET = Deno.env.get("EVAL_SHARED_SECRET");

// Salt for hashing client IPs before they hit model_invocations.ip_hash.
// Stable per-deploy so today's count stays consistent for a given IP;
// rotating it resets per-IP enforcement (intended only if we believe
// the salt has leaked). Without this env var, per-IP enforcement is
// disabled and ip_hash is logged as null.
const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT");

async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip || !IP_HASH_SALT) return null;
  const input = `${IP_HASH_SALT}:${ip}`;
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractClientIp(req: Request): string | null {
  // Supabase Edge Functions sit behind a Cloudflare-style edge; both
  // headers are populated for genuine client requests. Local invocations
  // (curl from the same host) skip these and return null.
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return null;
}

// Returns the morph_id_per_ip_daily cap from geck_data.runtime_config (or
// null if missing/zero). Failure modes (unreachable DB, row absent) all
// silently disable enforcement so a config-tier outage can't take down
// recognition.
async function fetchPerIpDailyCap(): Promise<number | null> {
  try {
    const sink = geckDataSink();
    const { data } = await sink
      .from("runtime_config")
      .select("value")
      .eq("key", "morph_id_per_ip_daily")
      .maybeSingle();
    const v = Number(data?.value);
    if (!Number.isFinite(v) || v <= 0) return null;
    return v;
  } catch (_err) {
    return null;
  }
}

async function countTodaysCallsForIp(ipHash: string): Promise<number> {
  try {
    const sink = geckDataSink();
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count } = await sink
      .from("model_invocations")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("surface", "morph_id_production")
      .gte("called_at", startOfDay.toISOString());
    return count ?? 0;
  } catch (_err) {
    return 0;
  }
}

// USD per million tokens. Used to compute est_cost_cents at write time.
// Frozen here so historic rows don't drift if Anthropic re-prices.
const PRICE_PER_MTOK_USD: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5":  { input: 1,  output: 5 },
  "claude-sonnet-4-6": { input: 3,  output: 15 },
  "claude-opus-4-7":   { input: 15, output: 75 },
  "claude-sonnet-5-5": { input: 2,  output: 10 },
  "claude-opus-5-5":   { input: 4,  output: 20 },
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
  ip_hash: string | null;
};

async function logInvocation(row: InvocationLog): Promise<void> {
  try {
    const sink = geckDataSink();
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
  "claude-sonnet-5-5",
  "claude-opus-5-5",
]);
function resolveModel(raw: unknown): string {
  return typeof raw === "string" && ALLOWED_MODELS.has(raw) ? raw : CLAUDE_MODEL;
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Bank is DISABLED by default. The v7 eval showed the 5-primary-morph
// bank regresses top1 accuracy by ~8pp vs the no-bank baseline (see the
// header eval history). All the plumbing (loader, cache_control on the
// instructions block, usage accounting) is wired up; flip these env
// vars to 1 / 10 once ≥12 primary_morph hero anchors cover the morphs
// the model currently misses.
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

// Per-tier monthly credit allotments. Keep in sync with
// src/lib/tierLimits.js#monthlyMorphIDCredits. Unknown / missing tier
// falls back to `free`, matching the frontend's tierOf() helper.
const TIER_MORPH_ID_CREDITS: Record<string, number> = {
  free: 0,
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
  is_eval_account: boolean;
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
  const { data: effectiveTier, error: tierError } = await userClient.rpc("effective_tier_for_current_user");
  if (tierError) throw new Error("Could not verify membership access");
  return {
    auth_user_id: user.id,
    membership_tier: effectiveTier ?? data?.membership_tier ?? null,
    subscription_status: data?.subscription_status ?? null,
    role: data?.role ?? null,
    morph_id_show_value_estimate: data?.morph_id_show_value_estimate ?? false,
    // Set only by the morph-id-eval workflow (scripts/morph-id-eval/run-ci.mjs).
    // app_metadata can be written by the service role alone, so a user cannot
    // grant it to themselves.
    is_eval_account: user.app_metadata?.morph_eval === true,
  };
}

// Request keys: the browser sends one key per set of photos. A retry with
// the same key after a dropped connection or a double tap gets the stored
// answer back instead of running (and charging) a second analysis. Needs
// the morph_id_requests table (migration 20261005145947); until that is
// applied every helper here quietly does nothing and Morph ID works as
// before.
const REQUEST_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const REPLAY_WINDOW_MS = 60 * 60 * 1000;
const RUNNING_WINDOW_MS = 3 * 60 * 1000;

type RequestClaim =
  | { kind: "disabled" }
  | { kind: "claimed" }
  | { kind: "replay"; response: Record<string, unknown> }
  | { kind: "running" };

function requestStoreMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" ||
    /morph_id_requests/.test(error.message || "") && /does not exist|schema cache/.test(error.message || "");
}

async function claimRequestKey(userId: string, key: string | null): Promise<RequestClaim> {
  if (!key) return { kind: "disabled" };
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: insertError } = await admin.from("morph_id_requests")
      .insert({ user_id: userId, request_key: key, status: "running" });
    if (!insertError) return { kind: "claimed" };
    if (requestStoreMissing(insertError)) return { kind: "disabled" };
    if (insertError.code !== "23505") {
      console.error("morph_id_requests claim failed:", insertError.message);
      return { kind: "disabled" };
    }
    const { data: row, error: readError } = await admin.from("morph_id_requests")
      .select("status, response, updated_at")
      .eq("user_id", userId).eq("request_key", key).maybeSingle();
    if (readError || !row) return { kind: "disabled" };
    const age = Date.now() - Date.parse(row.updated_at);
    if (row.status === "done" && row.response && age < REPLAY_WINDOW_MS) {
      return { kind: "replay", response: row.response as Record<string, unknown> };
    }
    if (row.status === "running" && age < RUNNING_WINDOW_MS) return { kind: "running" };
    // Failed, stale or expired: take the key over for this run.
    const { error: takeError } = await admin.from("morph_id_requests")
      .update({ status: "running", response: null, updated_at: new Date().toISOString() })
      .eq("user_id", userId).eq("request_key", key);
    return takeError ? { kind: "disabled" } : { kind: "claimed" };
  } catch (err) {
    console.error("morph_id_requests claim threw:", err instanceof Error ? err.message : String(err));
    return { kind: "disabled" };
  }
}

async function settleRequestKey(
  userId: string,
  key: string | null,
  status: "done" | "failed",
  response: Record<string, unknown> | null,
): Promise<void> {
  if (!key) return;
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await admin.from("morph_id_requests")
      .update({ status, response, updated_at: new Date().toISOString() })
      .eq("user_id", userId).eq("request_key", key);
    if (error && !requestStoreMissing(error)) console.error("morph_id_requests settle failed:", error.message);
  } catch (err) {
    console.error("morph_id_requests settle threw:", err instanceof Error ? err.message : String(err));
  }
}

async function refundMorphIdCredit(userId: string): Promise<void> {
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await admin.rpc("refund_morph_id_credit", { p_user_id: userId });
    if (error) console.error("MorphID credit refund failed:", error.message);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("MorphID credit refund threw:", message);
  }
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
      console.log(`few-shot bank v8: ${combined.length} examples (${heroCount} hero + ${fillerCount} manual) across ${distinctMorphs} morphs`);
      return combined;
    })();
  }
  return fewShotCache;
}

async function loadVisualEvidence(imageUrls: string[]): Promise<VisualEvidence> {
  if (!VISUAL_RETRIEVAL_ENABLED) {
    return {
      status: "unavailable",
      model: null,
      photo_count: 0,
      neighbors: [],
      consensus: null,
      note: "Visual retrieval is disabled.",
    };
  }
  if (!REPLICATE_API_TOKEN) {
    return {
      status: "unavailable",
      model: null,
      photo_count: 0,
      neighbors: [],
      consensus: null,
      note: "Visual embedding provider is not configured.",
    };
  }

  try {
    const settled = await Promise.allSettled(
      imageUrls.slice(0, RETRIEVAL_MAX_PHOTOS).map((imageUrl) =>
        createVisualEmbedding(imageUrl, {
          token: REPLICATE_API_TOKEN,
          model: VISUAL_EMBEDDING_MODEL,
          timeoutMs: 52_000,
          // Retrieval is corroborating evidence. If the provider is throttled,
          // continue immediately with the vision model instead of delaying ID.
          rateLimitAttempts: 1,
        })
      ),
    );
    const embeddings = settled.flatMap((result) =>
      result.status === "fulfilled" ? [result.value.embedding] : []
    );
    const queryEmbedding = meanNormalizedEmbeddings(embeddings);
    if (queryEmbedding.length === 0) {
      const firstError = settled.find((result) => result.status === "rejected");
      const detail = firstError?.status === "rejected"
        ? String(firstError.reason instanceof Error ? firstError.reason.message : firstError.reason)
        : "No query embedding was produced.";
      console.error("visual evidence unavailable:", detail.slice(0, 300));
      return {
        status: "unavailable",
        model: VISUAL_EMBEDDING_MODEL,
        photo_count: 0,
        neighbors: [],
        consensus: null,
        note: detail.slice(0, 180),
      };
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await admin.rpc("morph_visual_neighbors", {
      query_embedding: queryEmbedding,
      match_count: 48,
    });
    if (error) throw new Error(`visual neighbor query failed: ${error.message}`);
    return buildVisualEvidence((data || []) as RawVisualNeighbor[], {
      model: VISUAL_EMBEDDING_MODEL,
      photoCount: embeddings.length,
      minSimilarity: RETRIEVAL_MIN_SIMILARITY,
      maxNeighbors: 8,
      maxPerMorph: 2,
      rankingDepth: 16,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("visual evidence unavailable:", message);
    return {
      status: "unavailable",
      model: VISUAL_EMBEDDING_MODEL,
      photo_count: 0,
      neighbors: [],
      consensus: null,
      note: message.slice(0, 180),
    };
  }
}

function buildRetrievalContext(evidence: VisualEvidence): string {
  if (evidence.status !== "available" || evidence.neighbors.length === 0) return "";
  const mapping = evidence.neighbors.map((neighbor, index) => {
    const traits = [
      ...neighbor.genetic_traits,
      ...neighbor.secondary_traits,
      neighbor.base_color,
    ].filter(Boolean).slice(0, 6).join(", ");
    const detail = traits ? `; other breeder tags=${traits}` : "";
    return `  ${index + 1}. breeder's main pattern=${neighbor.primary_morph}${detail}; similarity=${neighbor.similarity.toFixed(3)}`;
  }).join("\n");
  const vote = (evidence.ranking || []).slice(0, 3)
    .map((rank) => `${rank.primary_morph} ${Math.round(rank.share * 100)}%`).join(", ");
  const consensus = vote
    ? `Vote among the ${evidence.ranking_depth} closest reference photos (one per breeder): ${vote}.`
    : "No reference vote.";
  return `The ${evidence.neighbors.length} image(s) immediately before this note are the closest reference photos to the user's gecko, each tagged by the breeder who listed that animal. Breeder tags are reliable for those animals. A missing tag is unknown, not negative. Compare the user's gecko with them: a close reference can still differ in pattern, and the user's photos decide.\n${mapping}\n${consensus}`;
}

function buildInstructions(fewShotBank: FewShotExample[], includeValueEstimate: boolean) {
  const bankIntro = fewShotBank.length === 0 ? "" :
    `\n\nFew-shot reference: the first ${fewShotBank.length} attached image(s) are LABELED reference examples (the user's photo(s) follow, after this text). Hero-anchor entries are competition-judged show winners (gold-standard visual definitions); manual-touch entries are community-verified examples. Use them as visual anchors for the canonical look of each primary_morph BEFORE evaluating the user's photo. The mapping, in order:\n${fewShotBank.map((ex, i) => {
      const tier = ex.source === "hero_anchor" ? " [hero]" : "";
      const name = ex.gecko_name ? ` "${ex.gecko_name}"` : "";
      const color = ex.base_color ? ` (base ${ex.base_color})` : "";
      return `  ${i + 1}. ${ex.primary_morph}${tier}${name}${color}`;
    }).join("\n")}`;

  const valueLine = includeValueEstimate
    ? `\n- value_estimate_usd_low / value_estimate_usd_high: a CONSERVATIVE retail price band in US dollars for an unrelated, unproven specimen at the apparent life stage, based on the morph quality you actually see in the photo. Reflect uncertainty by widening the band. value_estimate_notes is one sentence on what drives the band (e.g., "high white expression on a clean pin lifts this; unproven het knocks it down").`
    : "";

  return `You are a world-expert crested gecko (Correlophus ciliatus) visual morph
identification assistant. Analyze the user's photograph(s) and call the
\`submit_morph_analysis\` tool. Use only ids in the schema.

Rules:
- First assess whether the images show one crested gecko clearly enough for visual
  identification. Set usable_for_id=false for the wrong subject, multiple animals,
  severe blur, heavy obstruction, or lighting that prevents a responsible call.
- primary_morph is the best visual pattern-class candidate. If evidence is
  insufficient, provide a technical fallback but set usable_for_id=false. The app
  will withhold that fallback as an identification.
- visual_profile is the primary representation of what is actually visible.
  Classify pattern family, pinning, banding, and spotting independently because
  these traits can co-occur. Use unknown when the relevant body region is not
  visible; use none only when the region is visible and the trait is absent.
- pattern_color describes the visible pattern pigment separately from the base
  color. Use mixed when two distinct pattern colors are visible (for example,
  cream/white plus orange/yellow in a tricolor animal).
- Return one photo_observations entry for each user photo, in the same order.
  Inspect every photo separately before synthesizing. A poor or redundant image
  may have contributes_to_result=false and must not dilute a strong diagnostic
  view. Per-photo evidence_signal is a relative evidence-strength signal, not an
  accuracy percentage.
- Return up to three distinct candidate_morphs in descending visual-evidence order.
  Scores are relative model signals, not calibrated probabilities. Cite the visual
  feature that supports or weakens each candidate.
- Do not call harlequin for a flame, or extreme_harlequin without more than 60%
  leg pattern.
- genetic_traits is only for a trait whose visible phenotype is strongly expressed.
  A photo cannot prove genotype, carrier status, lineage, or hidden hets. Leave the
  array empty when lineage would be required. Use generic axanthic for a visible
  axanthic-like phenotype; never infer axanthic_vca or axanthic_tsm from photos.
  Phantom and Cream-on-Cream are visual-expression suggestions, not proof of their
  underlying genotype.
- secondary_traits is observational modifiers. Multiple allowed.
- Harlequin is the base pattern most other crested gecko patterns sit on. When a
  harlequin also shows another pattern, that pattern is primary_morph, the way
  breeders list the animal: full pinning is pinstripe, partial pinning is
  partial_pinstripe, four stripes are quad_stripe, and three distinct colors is
  tricolor. List harlequin as another candidate_morph. Extreme harlequin and super
  harlequin are morphs in their own right: keep them as primary_morph and list the
  other pattern as a candidate.
- tricolor means three distinct colors (the base plus two pattern colors, such as
  cream/white and orange/yellow) in roughly equal amounts, usually on a harlequin,
  sometimes a pinstripe. Add tricolor to secondary_traits whenever the three colors
  are present.
- evidence_markers must name concrete visible features such as dorsal coverage,
  leg coverage, pin continuity, spot count, flank pattern, and white placement.
- uncertainty_reasons must name missing views, ambiguous lookalikes, age effects,
  fired state, blur, glare, or color cast when relevant.
- confidence_score is a model signal about the top visual candidate, not the
  probability that the identification is correct. Reference photos carry the tags
  of the breeders who listed them; use them to see how breeders name a look, but
  the user's own photos decide.${valueLine}

Taxonomy version: ${TAXONOMY_VERSION}.${bankIntro}`;
}

function buildTool(includeValueEstimate: boolean) {
  const properties: Record<string, unknown> = {
    primary_morph:     { type: "string", enum: PRIMARY_MORPH_IDS },
    genetic_traits:    { type: "array", items: { type: "string", enum: PHOTO_GENETIC_TRAIT_IDS } },
    secondary_traits:  { type: "array", items: { type: "string", enum: SECONDARY_TRAIT_IDS } },
    base_color:        { type: "string", enum: BASE_COLOR_IDS },
    pattern_intensity: { type: "string", enum: PATTERN_INTENSITY_IDS },
    white_amount:      { type: "string", enum: WHITE_AMOUNT_IDS },
    pattern_color:     { type: "string", enum: PATTERN_COLOR_IDS },
    fired_state:       { type: "string", enum: FIRED_STATE_IDS },
    confidence_score:  { type: "integer", minimum: 0, maximum: 100 },
    visual_profile: {
      type: "object",
      required: ["pattern_family", "pinning", "banding", "spotting", "white_cream_traits"],
      properties: {
        pattern_family: { type: "string", enum: PATTERN_FAMILY_IDS },
        pinning: { type: "string", enum: PINNING_IDS },
        banding: { type: "string", enum: BANDING_IDS },
        spotting: { type: "string", enum: SPOTTING_IDS },
        white_cream_traits: {
          type: "array",
          uniqueItems: true,
          items: { type: "string", enum: WHITE_PLACEMENT_IDS },
        },
      },
    },
    candidate_morphs:  {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        required: ["morph", "score", "why"],
        properties: {
          morph: { type: "string", enum: PRIMARY_MORPH_IDS },
          score: { type: "integer", minimum: 0, maximum: 100 },
          why: { type: "string", description: "Short visual evidence for or against this candidate." },
        },
      },
    },
    photo_observations: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        required: ["photo_number", "view", "quality_grade", "contributes_to_result", "evidence_signal", "visible_features", "limitations"],
        properties: {
          photo_number: { type: "integer", minimum: 1, maximum: 5 },
          view: { type: "string", enum: ["dorsal", "left_side", "right_side", "three_quarter", "head", "underside", "tail", "unclear"] },
          quality_grade: { type: "string", enum: ["good", "usable", "poor"] },
          contributes_to_result: { type: "boolean" },
          evidence_signal: { type: "integer", minimum: 0, maximum: 100 },
          visible_features: { type: "array", maxItems: 4, items: { type: "string" } },
          limitations: { type: "array", maxItems: 3, items: { type: "string" } },
        },
      },
    },
    evidence_markers:    { type: "array", maxItems: 6, items: { type: "string" } },
    uncertainty_reasons: { type: "array", maxItems: 5, items: { type: "string" } },
    photo_assessment: {
      type: "object",
      required: ["subject_is_crested_gecko", "usable_for_id", "quality_grade", "issues", "next_photo_needed"],
      properties: {
        subject_is_crested_gecko: { type: "boolean" },
        usable_for_id: { type: "boolean" },
        quality_grade: { type: "string", enum: ["good", "usable", "poor"] },
        issues: { type: "array", maxItems: 5, items: { type: "string" } },
        next_photo_needed: { type: "string", description: "The single most useful next photo, or an empty string." },
      },
    },
    explanation: { type: "string", description: "Two concise sentences grounded in visible evidence and uncertainty." },
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
      required: [
        "primary_morph", "confidence_score", "candidate_morphs",
        "visual_profile", "evidence_markers", "uncertainty_reasons",
        "photo_observations", "photo_assessment", "explanation",
      ],
      properties,
    },
  };
}

function clampToTaxonomy(
  raw: Record<string, unknown>,
  includeValueEstimate: boolean,
  model: string,
  visualEvidence: VisualEvidence,
  photoCount: number,
) {
  const pick = (v: unknown, allowed: string[]) =>
    typeof v === "string" && allowed.includes(v) ? v : null;
  const pickMany = (v: unknown, allowed: string[]) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string" && allowed.includes(x)) : [];
  const pickTextMany = (v: unknown, max: number) =>
    Array.isArray(v)
      ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, max)
      : [];
  const signal = Math.max(0, Math.min(100, Number(raw.confidence_score) || 0));
  const rawPrimaryMorph = pick(raw.primary_morph, PRIMARY_MORPH_IDS);
  const rawCandidates = Array.isArray(raw.candidate_morphs) ? raw.candidate_morphs : [];
  const seenCandidates = new Set<string>();
  const candidateMorphs = rawCandidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Record<string, unknown>;
    const morph = pick(item.morph, PRIMARY_MORPH_IDS);
    if (!morph || seenCandidates.has(morph)) return [];
    seenCandidates.add(morph);
    return [{
      morph,
      score: Math.max(0, Math.min(100, Number(item.score) || 0)),
      why: typeof item.why === "string" ? item.why : "",
    }];
  }).slice(0, 3);
  if (rawPrimaryMorph && !seenCandidates.has(rawPrimaryMorph)) {
    candidateMorphs.unshift({ morph: rawPrimaryMorph, score: signal, why: "Top visual candidate." });
    candidateMorphs.splice(3);
  }
  candidateMorphs.sort((a, b) => b.score - a.score);
  const modelPrimary = candidateMorphs[0]?.morph ?? rawPrimaryMorph;
  const modelSignal = candidateMorphs[0]?.score ?? signal;
  const secondaryTraits = pickMany(raw.secondary_traits, SECONDARY_TRAIT_IDS);
  const rawVisualProfile = raw.visual_profile && typeof raw.visual_profile === "object"
    ? raw.visual_profile as Record<string, unknown>
    : {};
  const visualProfile = {
    pattern_family: pick(rawVisualProfile.pattern_family, PATTERN_FAMILY_IDS) || "unknown",
    pinning: pick(rawVisualProfile.pinning, PINNING_IDS) || "unknown",
    banding: pick(rawVisualProfile.banding, BANDING_IDS) || "unknown",
    spotting: pick(rawVisualProfile.spotting, SPOTTING_IDS) || "unknown",
    white_cream_traits: pickMany(rawVisualProfile.white_cream_traits, WHITE_PLACEMENT_IDS),
  };
  // Harlequin is the base: pinning or the tricolor look takes the lead over
  // it; partial pinning reads as Pinstripe when the breeder photos say so;
  // the photo lookup fills the rest of the shortlist.
  const leading = leadingPattern(modelPrimary, visualProfile.pinning, secondaryTraits, visualEvidence);
  const primaryMorph = leading.morph;
  const shortlist = buildShortlist(leading, modelPrimary, candidateMorphs, visualEvidence, PRIMARY_MORPH_IDS);

  const rawPhoto = raw.photo_assessment && typeof raw.photo_assessment === "object"
    ? raw.photo_assessment as Record<string, unknown>
    : {};
  const qualityGrade = ["good", "usable", "poor"].includes(String(rawPhoto.quality_grade))
    ? String(rawPhoto.quality_grade)
    : "poor";
  const photoAssessment = {
    subject_is_crested_gecko: rawPhoto.subject_is_crested_gecko === true,
    usable_for_id: rawPhoto.usable_for_id === true,
    quality_grade: qualityGrade,
    issues: pickTextMany(rawPhoto.issues, 5),
    next_photo_needed: typeof rawPhoto.next_photo_needed === "string"
      ? rawPhoto.next_photo_needed
      : "Add a sharp top-down photo in neutral daylight.",
  };
  const margin = candidateMorphs.length > 1
    ? candidateMorphs[0].score - candidateMorphs[1].score
    : modelSignal;
  const assessment = evidenceAssessment(
    primaryMorph,
    modelSignal,
    margin,
    photoAssessment,
    visualEvidence,
  );
  const seenPhotoNumbers = new Set<number>();
  const photoObservations = (Array.isArray(raw.photo_observations) ? raw.photo_observations : [])
    .flatMap((observation) => {
      if (!observation || typeof observation !== "object") return [];
      const item = observation as Record<string, unknown>;
      const photoNumber = Math.round(Number(item.photo_number));
      if (!Number.isFinite(photoNumber) || photoNumber < 1 || photoNumber > photoCount || seenPhotoNumbers.has(photoNumber)) return [];
      seenPhotoNumbers.add(photoNumber);
      const view = ["dorsal", "left_side", "right_side", "three_quarter", "head", "underside", "tail", "unclear"]
        .includes(String(item.view)) ? String(item.view) : "unclear";
      const observationQuality = ["good", "usable", "poor"].includes(String(item.quality_grade))
        ? String(item.quality_grade) : "poor";
      return [{
        photo_number: photoNumber,
        view,
        quality_grade: observationQuality,
        contributes_to_result: item.contributes_to_result === true,
        evidence_signal: Math.max(0, Math.min(100, Number(item.evidence_signal) || 0)),
        visible_features: pickTextMany(item.visible_features, 4),
        limitations: pickTextMany(item.limitations, 3),
      }];
    })
    .sort((a, b) => a.photo_number - b.photo_number);
  const uncertaintyReasons = pickTextMany(raw.uncertainty_reasons, 5);
  if (assessment.conflict && visualEvidence.consensus) {
    uncertaintyReasons.unshift(
      `The photo reading and the closest breeder-tagged reference photos disagree (${String(primaryMorph).replace(/_/g, " ")} vs ${visualEvidence.consensus.primary_morph.replace(/_/g, " ")}).`,
    );
    uncertaintyReasons.splice(5);
  }
  const out: Record<string, unknown> = {
    primary_morph:     primaryMorph,
    genetic_traits:    pickMany(raw.genetic_traits, PHOTO_GENETIC_TRAIT_IDS),
    secondary_traits:  secondaryTraits,
    base_color:        pick(raw.base_color, BASE_COLOR_IDS),
    pattern_intensity: pick(raw.pattern_intensity, PATTERN_INTENSITY_IDS) || "unknown",
    white_amount:      pick(raw.white_amount, WHITE_AMOUNT_IDS) || "unknown",
    pattern_color:     pick(raw.pattern_color, PATTERN_COLOR_IDS) || "unknown",
    fired_state:       pick(raw.fired_state, FIRED_STATE_IDS) || "unknown",
    confidence_score:  modelSignal,
    model_signal:      modelSignal,
    visual_profile:    visualProfile,
    candidate_morphs:  shortlist,
    photo_observations: photoObservations,
    evidence_markers:  pickTextMany(raw.evidence_markers, 6),
    uncertainty_reasons: uncertaintyReasons,
    photo_assessment:  photoAssessment,
    assessment_status: assessment.status,
    visual_evidence:   visualEvidence,
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
  context: { ageStage: string; firedState: string },
  visualEvidence: VisualEvidence,
  deadlineMs: number = CLAUDE_DEADLINE_MS,
): Promise<CallClaudeResult> {
  const bank = await loadFewShotBank();

  // Cacheable block: bank images + bank-intro + rules text. Stable
  // across calls within the warm-instance lifetime (and across cold
  // starts as long as the bank composition + includeValueEstimate are
  // unchanged). The instructions text always exists (the no-bank
  // baseline still ships rules), so this block is always non-empty and
  // safe to anchor the cache on. Marking the LAST cacheable block with
  // cache_control: ephemeral caches everything up to and including it
  // for 5 minutes; subsequent requests pay 10% of input rate for that
  // prefix.
  const cacheableContent: Record<string, unknown>[] = [
    ...bank.map((ex) => ({ type: "image", source: { type: "url", url: ex.image_url } })),
    { type: "text", text: buildInstructions(bank, includeValueEstimate) },
  ];
  cacheableContent[cacheableContent.length - 1] = {
    ...cacheableContent[cacheableContent.length - 1],
    cache_control: { type: "ephemeral" },
  };

  // Variable block: query-specific visual neighbors followed by the user
  // images and a per-call trailing hint. Never cached because retrieval
  // changes with every request.
  const retrievalNeighbors = visualEvidence.status === "available"
    ? visualEvidence.neighbors.slice(0, 3)
    : [];
  const retrievalBlocks: Record<string, unknown>[] = retrievalNeighbors.length > 0
    ? [
      ...retrievalNeighbors.map((neighbor) => ({
        type: "image",
        source: { type: "url", url: neighbor.image_url },
      })),
      { type: "text", text: buildRetrievalContext({
        ...visualEvidence,
        neighbors: retrievalNeighbors,
      }) },
    ]
    : [];
  const userBlocks: Record<string, unknown>[] = imageUrls.map((url) => (
    { type: "image", source: { type: "url", url } }
  ));
  const photoText = imageUrls.length > 1
    ? `The immediately preceding ${imageUrls.length} images are of the same user-submitted animal. Synthesize across them.`
    : `The immediately preceding image is the user's submitted animal.`;
  const trailingText = `${photoText} User-provided context: life stage=${context.ageStage}; fired state=${context.firedState}. Treat unknown values as unavailable context. Call the tool with your analysis.`;
  const variableContent: Record<string, unknown>[] = [
    ...retrievalBlocks,
    ...userBlocks,
    { type: "text", text: trailingText },
  ];

  const tool = buildTool(includeValueEstimate);
  const startedAt = Date.now();
  // Newer models reject a forced tool call and think before answering; see
  // requestShape. 1536 max_tokens once cut off five-photo answers, so the
  // floor is 3000 (output is billed as used, so a higher ceiling is free).
  const shape = requestShape(model, tool.name);
  if (shape.callInstruction) {
    const last = variableContent[variableContent.length - 1] as { type: string; text: string };
    variableContent[variableContent.length - 1] = { ...last, text: last.text + shape.callInstruction };
  }
  const requestBody = JSON.stringify({
    model,
    max_tokens: shape.maxTokens,
    tools: [tool],
    tool_choice: shape.toolChoice,
    ...(shape.outputConfig ? { output_config: shape.outputConfig } : {}),
    messages: [{
      role: "user",
      content: [...cacheableContent, ...variableContent],
    }],
  });

  // One retry for a brief upstream hiccup (rate limit, overload, 5xx, a
  // dropped connection, a cut-off answer), only while enough of the budget
  // is left for a full second attempt. Every failure still refunds.
  const RETRY_MIN_REMAINING_MS = 40_000;
  let attempt = 0;
  let res!: Response;
  let body!: { content?: Array<{ type: string; input?: unknown }>; usage?: UpstreamUsage; stop_reason?: string };
  let toolBlock: { type: string; input?: unknown } | undefined;
  let requestId: string | null = null;
  let durationMs = 0;
  for (;;) {
    attempt += 1;
    const remainingMs = Math.max(15_000, deadlineMs - (Date.now() - startedAt));
    const canRetry = () =>
      attempt === 1 && deadlineMs - (Date.now() - startedAt) > RETRY_MIN_REMAINING_MS;
    const retryPause = () => new Promise((resolve) => setTimeout(resolve, 1500));
    // Hard deadline so the function always answers before the browser gives
    // up (120 s) and before the platform stops the worker. Without it a slow
    // analyzer call could finish after the member saw "took too long" (credit
    // charged, result lost) or be killed before the catch block could refund.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remainingMs);
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          // Prompt caching is GA on Sonnet 4 but the beta header is a no-op
          // when unneeded and required for some account configurations.
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
        body: requestBody,
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = controller.signal.aborted;
      if (!aborted && canRetry()) {
        await retryPause();
        continue;
      }
      throw new UpstreamError(
        aborted ? "Analyzer timed out" : `Analyzer request failed: ${err instanceof Error ? err.message : String(err)}`,
        aborted ? 504 : 502,
        aborted ? "upstream_timeout" : "upstream_error",
        { httpStatus: aborted ? 504 : 502, durationMs: Date.now() - startedAt },
      );
    }
    requestId = res.headers.get("request-id");
    durationMs = Date.now() - startedAt;
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 500);
      clearTimeout(timer);
      if (RETRYABLE_UPSTREAM_STATUS.has(res.status) && canRetry()) {
        await retryPause();
        continue;
      }
      throw new UpstreamError(`Anthropic ${res.status}: ${detail}`, res.status, upstreamErrorCode(res.status, detail), {
        httpStatus: res.status,
        requestId,
        durationMs,
      });
    }
    try {
      body = await res.json();
    } catch (err) {
      const aborted = controller.signal.aborted;
      throw new UpstreamError(
        aborted ? "Analyzer timed out" : `Analyzer response unreadable: ${err instanceof Error ? err.message : String(err)}`,
        aborted ? 504 : 502,
        aborted ? "upstream_timeout" : "upstream_error",
        { httpStatus: aborted ? 504 : res.status, requestId, durationMs: Date.now() - startedAt },
      );
    } finally {
      clearTimeout(timer);
    }
    // A safety decline is not a bad answer worth retrying the same way.
    if (body.stop_reason === "refusal") {
      throw new UpstreamError("Analyzer declined the request (refusal)", 502, "upstream_error", {
        httpStatus: res.status,
        requestId,
        durationMs,
      });
    }
    toolBlock = (body.content || []).find((b: { type: string }) => b.type === "tool_use");
    const truncated = body.stop_reason === "max_tokens";
    if (!toolBlock?.input || truncated) {
      if (canRetry()) {
        await retryPause();
        continue;
      }
      throw new UpstreamError(
        truncated ? "Claude's answer was cut off (max_tokens)" : "Claude did not return a tool_use block",
        502,
        "upstream_error",
        { httpStatus: res.status, requestId, durationMs },
      );
    }
    break;
  }
  const usage: UpstreamUsage = body.usage ?? { input_tokens: 0, output_tokens: 0 };
  return {
    raw: toolBlock!.input as Record<string, unknown>,
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
  if (!ANTHROPIC_API_KEY) return json({ error: "Morph ID is not configured", code: "config_error" }, 500);

  const isAdmin = profile.role === "admin";
  // The evaluation account grades the held-out test set without spending
  // credits and may tag its calls as morph_id_eval. It gets nothing else.
  const isEvalAccount = profile.is_eval_account;
  const tier = resolveTier(profile);
  const creditsIncluded = TIER_MORPH_ID_CREDITS[tier] ?? TIER_MORPH_ID_CREDITS.free;

  // Paid tiers only get the value estimate, and only when the profile
  // toggle is on. Admins inherit Breeder-or-better, so we read the
  // toggle as-is for them.
  const isPaidTier = tier === "keeper" || tier === "breeder" || tier === "enterprise";
  const includeValueEstimate = !!profile.morph_id_show_value_estimate && (isPaidTier || isAdmin);

  const requestStartedAt = Date.now();
  // Set once this run owns its request key; settled in both exits below.
  let claimedKey: string | null = null;

  // Hoisted so the catch block can include them in the spend-log row.
  // Defaults match what `logInvocation` should see if we crash before
  // parsing the request body.
  let imageUrls: string[] = [];
  let model = CLAUDE_MODEL;
  let surface = "morph_id_production";
  let creditWasConsumed = false;
  let ageStage = "unknown";
  let firedState = "unknown";

  // Hash the caller's IP once up front; null when IP_HASH_SALT is unset
  // or the client IP can't be determined. Both cases skip per-IP
  // enforcement AND log ip_hash=null so the row is still useful for
  // every other dashboard slice.
  const ipHash = await hashIp(extractClientIp(req));

  try {
    const body = await req.json().catch(() => ({}));
    const isSafeImageUrl = (value: unknown) => {
      if (typeof value !== "string" || value.length > 2048) return false;
      try { return new URL(value).protocol === "https:"; } catch { return false; }
    };
    if (Array.isArray(body?.imageUrls)) {
      imageUrls = body.imageUrls.filter(isSafeImageUrl) as string[];
    } else if (isSafeImageUrl(body?.imageUrl)) {
      imageUrls = [body.imageUrl];
    }
    if (imageUrls.length === 0) {
      return json({ error: "imageUrls or imageUrl is required", code: "bad_request" }, 400);
    }
    imageUrls = imageUrls.slice(0, 5);
    ageStage = typeof body?.age_stage === "string" && AGE_STAGE_IDS.includes(body.age_stage)
      ? body.age_stage
      : "unknown";
    firedState = typeof body?.fired_state === "string" && FIRED_STATE_IDS.includes(body.fired_state)
      ? body.fired_state
      : "unknown";

    // Per-request model override (defaults to env-configured CLAUDE_MODEL).
    // The eval pipeline sends `model: "claude-haiku-4-5"` for cheap iteration
    // and "claude-sonnet-4-6" for benchmark runs. Production callers
    // (Recognition.jsx) omit `model` and get the env default.
    // Only admins and the eval account may choose: any member could name
    // the most expensive model, which costs several times the default.
    model = (isAdmin || isEvalAccount) ? resolveModel(body?.model) : CLAUDE_MODEL;

    // Surface tag for the spend-log sink. Eval script sends
    // surface='morph_id_eval' + the shared secret header; admin callers
    // can tag themselves freely; everyone else gets 'morph_id_production'.
    surface = resolveSurface(
      body?.surface,
      isAdmin || isEvalAccount,
      req.headers.get("x-eval-secret"),
    );

    // Per-IP daily cap. Only enforced for production traffic (eval and
    // admin self-tagged calls are exempt). Cap value is pulled live from
    // runtime_config.morph_id_per_ip_daily, so changes via the
    // /data-admin/control panel take effect on the next request.
    if (!isAdmin && surface === "morph_id_production" && ipHash) {
      const cap = await fetchPerIpDailyCap();
      if (cap && cap > 0) {
        const used = await countTodaysCallsForIp(ipHash);
        if (used >= cap) {
          await logInvocation({
            surface, model,
            input_tokens: 0, output_tokens: 0,
            cache_read_tokens: null, cache_creation_tokens: null,
            est_cost_cents: 0,
            user_id: profile.auth_user_id, tier, is_admin: isAdmin,
            photo_count: imageUrls.length, few_shot_count: null,
            http_status: 429,
            error_code: "morph_id_ip_daily_exhausted",
            duration_ms: 0, request_id: null,
            ip_hash: ipHash,
          });
          return json({
            error: "Daily MorphID limit reached for this network. Try again tomorrow.",
            code: "morph_id_ip_daily_exhausted",
            cap, used,
          }, 429);
        }
      }
    }

    // A repeat of a request this member already sent (double tap, retry
    // after a dropped connection) is answered from the stored result, or
    // told to wait while the first run is still going. Neither costs a
    // credit. Admin and evaluation calls never use credits, so they skip it.
    const requestKey = typeof body?.request_key === "string" && REQUEST_KEY_PATTERN.test(body.request_key)
      ? body.request_key
      : null;
    if (!isAdmin && !isEvalAccount && requestKey) {
      const claim = await claimRequestKey(profile.auth_user_id, requestKey);
      if (claim.kind === "replay") {
        return json({ ...claim.response, replayed: true });
      }
      if (claim.kind === "running") {
        return json({
          error: "Your last analysis of these photos is still running.",
          code: "morph_id_in_progress",
        }, 409);
      }
      if (claim.kind === "claimed") claimedKey = requestKey;
    }

    let creditsConsumed = 0;
    let creditsRemaining: number | null = null;
    if (!isAdmin && !isEvalAccount) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: usage, error: rpcErr } = await admin.rpc("consume_morph_id_credit", {
        p_user_id: profile.auth_user_id,
        p_tier: tier,
        p_credits_included: creditsIncluded,
      });
      if (rpcErr) {
        await settleRequestKey(profile.auth_user_id, claimedKey, "failed", null);
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
      creditWasConsumed = true;
    }

    const visualEvidence = await loadVisualEvidence(imageUrls);
    const result = await callClaude(
      imageUrls,
      includeValueEstimate,
      model,
      { ageStage, firedState },
      visualEvidence,
      Math.min(CLAUDE_DEADLINE_MS, REQUEST_BUDGET_MS - (Date.now() - requestStartedAt)),
    );
    const analysis = clampToTaxonomy(
      result.raw,
      includeValueEstimate,
      model,
      visualEvidence,
      imageUrls.length,
    );
    analysis.age_stage = ageStage;
    analysis.user_reported_fired_state = firedState;
    // D19: a "better photos needed" answer gives the member nothing to act
    // on, so the credit is handed back and they can retake the photos. Since
    // 6 Oct 2026 this covers paid monthly credits too, not only the free try.
    let creditRefunded = false;
    if (
      creditWasConsumed &&
      analysis.assessment_status === "insufficient_evidence"
    ) {
      await refundMorphIdCredit(profile.auth_user_id);
      creditWasConsumed = false;
      creditRefunded = true;
      creditsConsumed = Math.max(0, creditsConsumed - 1);
      creditsRemaining = Math.max(0, creditsIncluded - creditsConsumed);
    }
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
      ip_hash: ipHash,
    });
    const responseBody = {
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
      credit_refunded: creditRefunded,
      value_estimate_included: includeValueEstimate,
    };
    await settleRequestKey(profile.auth_user_id, claimedKey, "done", responseBody);
    return json(responseBody);
  } catch (err) {
    if (creditWasConsumed) await refundMorphIdCredit(profile.auth_user_id);
    await settleRequestKey(profile.auth_user_id, claimedKey, "failed", null);
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
        ip_hash: ipHash,
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
      ip_hash: ipHash,
    });
    return json({ error: message, code: "internal_error" }, 500);
  }
});
