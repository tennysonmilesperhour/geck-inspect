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
//
// Speed (17 Oct 2026; the model and the prompt are unchanged): the photo
// lookup starts as soon as the member is signed in and runs while the
// profile, plan, per-network cap, request key and credit are checked
// (../_shared/morph-steps.ts). One time budget runs from arrival
// (../_shared/morph-budget.ts). Every answer carries a Server-Timing header
// (../_shared/morph-timing.ts). The page wakes the photo-matching model
// before Identify with { action: "warm" } (../_shared/morph-warm.ts). The
// request the model reads is built in request.ts; a snapshot test keeps it
// byte for byte what it was, and changing it needs a graded run.

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
import { RETRYABLE_UPSTREAM_STATUS, retryShape, upstreamErrorCode, upstreamFailureResponse } from "../_shared/morph-upstream.ts";
import { refundMorphIdCreditOnce } from "../_shared/morph-refund.ts";
import { clientIp } from "../_shared/client-ip.ts";
import { costCentsFromUsage } from "../_shared/model-cost.ts";
import {
  createVisualEmbedding,
  DEFAULT_VISUAL_EMBEDDING_MODEL,
  EmbeddingCanceledError,
  EmbeddingTimeoutError,
  meanNormalizedEmbeddings,
} from "../_shared/visual-embedding.ts";
import {
  CLAUDE_MAX_MS,
  claudeTimeoutMs,
  deadlineSignal,
  morphDeadlines,
  type MorphDeadlines,
  skipClaude,
} from "../_shared/morph-budget.ts";
import { MorphTiming, serverTimingHeader, timingLogLine } from "../_shared/morph-timing.ts";
import {
  finishAfterResponse,
  newStepState,
  type ParsedRequest,
  type Profile,
  type RequestClaim,
  runMorphSteps,
} from "../_shared/morph-steps.ts";
import { buildWarmRequest, DEFAULT_WARM_IMAGE_URL, shouldWarm, WARM_SURFACE } from "../_shared/morph-warm.ts";
import { buildClaudeRequest, type FewShotExample } from "./request.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_MODEL = Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-4-6";
// Time limits (whole request 105 s from arrival; the embedding by 69.5 s for
// one or two photos, 59 s for five; the analyzer at most 90 s and never
// started with less than its minimum for the photo count) are in
// ../_shared/morph-budget.ts, with the reasons.
const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
// The photo the warm-up embeds (../_shared/morph-warm.ts).
const WARM_IMAGE_URL = Deno.env.get("MORPH_WARM_IMAGE_URL") || DEFAULT_WARM_IMAGE_URL;
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

// The shared helper explains which headers can be trusted. Local
// invocations (curl from the same host) have neither and return null.
function extractClientIp(req: Request): string | null {
  return clientIp(req.headers);
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

// est_cost_cents is worked out when the row is written (so a later price
// change does not rewrite history) by costCentsFromUsage, which counts the
// cache writes and cache reads as well as plain input and output. Before
// 16 Oct 2026 this file counted input and output only, so older rows read
// about 15 percent low (production: 75.84 cents logged against 89.53 real
// over 25 calls), and it listed Opus at three times the real price.

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
  // Lets the page (and the browser's network panel) read where the time went.
  "Access-Control-Expose-Headers": "Server-Timing",
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...CORS, ...extraHeaders },
  });
}

// Per-tier monthly credit allotments. Keep in sync with
// src/lib/tierLimits.js#monthlyMorphIDCredits and the monthly case in
// morph_id_scans_remaining(). Unknown / missing tier falls back to
// `free`, matching the frontend's tierOf() helper. Bonus scans are not
// in this map. The database adds them on top, and only after the
// monthly allowance is used.
// Free is one a month from the October 2026 release (migration
// 20261015151300). The database uses 1 for Free whatever this map says,
// so the change holds before a redeploy.
const TIER_MORPH_ID_CREDITS: Record<string, number> = {
  free: 1,
  keeper: 3,
  breeder: 6,
  enterprise: 15,
};

// The photos and context from the request body, or null when no usable
// photo URL was sent.
function parseRequest(body: Record<string, unknown>): ParsedRequest | null {
  const isSafeImageUrl = (value: unknown) => {
    if (typeof value !== "string" || value.length > 2048) return false;
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  };
  let imageUrls: string[] = [];
  if (Array.isArray(body?.imageUrls)) {
    imageUrls = body.imageUrls.filter(isSafeImageUrl) as string[];
  } else if (isSafeImageUrl(body?.imageUrl)) {
    imageUrls = [body.imageUrl as string];
  }
  if (imageUrls.length === 0) return null;
  return {
    imageUrls: imageUrls.slice(0, 5),
    ageStage: typeof body?.age_stage === "string" && AGE_STAGE_IDS.includes(body.age_stage)
      ? body.age_stage
      : "unknown",
    firedState: typeof body?.fired_state === "string" && FIRED_STATE_IDS.includes(body.fired_state)
      ? body.fired_state
      : "unknown",
    requestKey: typeof body?.request_key === "string" && REQUEST_KEY_PATTERN.test(body.request_key)
      ? body.request_key
      : null,
  };
}

// When the newest warm-up went out (any member), or null.
async function lastWarmAt(): Promise<string | null> {
  try {
    const { data } = await geckDataSink()
      .from("model_invocations")
      .select("called_at")
      .eq("surface", WARM_SURFACE)
      .order("called_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return typeof data?.called_at === "string" ? data.called_at : null;
  } catch (_err) {
    return null;
  }
}

// Asks Replicate to boot the photo-matching model with the project's own
// photo, at most once a minute across all members, and answers 202 without
// waiting for it. Reads nothing from the body, takes no credit and no
// request key, and is not counted by the per-network cap (that counts only
// morph_id_production rows). See ../_shared/morph-warm.ts.
async function warmUp(
  userId: string,
  body: Record<string, unknown>,
  ipHash: string | null,
): Promise<{ warmed: boolean; reason?: string }> {
  if (!VISUAL_RETRIEVAL_ENABLED || !REPLICATE_API_TOKEN) return { warmed: false, reason: "not_configured" };
  const request = buildWarmRequest(body, {
    token: REPLICATE_API_TOKEN,
    model: VISUAL_EMBEDDING_MODEL,
    imageUrl: WARM_IMAGE_URL,
  });
  if (!request) return { warmed: false, reason: "no_known_version" };
  if (!shouldWarm(await lastWarmAt(), Date.now())) return { warmed: false, reason: "recent" };

  const started = Date.now();
  let httpStatus: number | null = null;
  let errorCode: string | null = null;
  let predictionId: string | null = null;
  try {
    const res = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(10_000) });
    httpStatus = res.status;
    const created = await res.json().catch(() => null);
    predictionId = typeof created?.id === "string" ? created.id : null;
    if (!res.ok) errorCode = `replicate_${res.status}`;
  } catch (_err) {
    errorCode = "warm_failed";
  }
  await finishAfterResponse(logInvocation({
    surface: WARM_SURFACE,
    model: VISUAL_EMBEDDING_MODEL,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: null,
    cache_creation_tokens: null,
    est_cost_cents: 0,
    user_id: userId,
    tier: null,
    is_admin: false,
    photo_count: 0,
    few_shot_count: null,
    http_status: httpStatus,
    error_code: errorCode,
    duration_ms: Date.now() - started,
    request_id: predictionId,
    ip_hash: ipHash,
  }));
  return errorCode ? { warmed: false, reason: errorCode } : { warmed: true };
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

// Scans left after bonus credits. Null when that function is not
// installed yet, so the caller keeps the older monthly subtraction.
async function readMorphIdScansRemaining(
  userId: string,
  tier: string,
  monthly: number,
): Promise<number | null> {
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await admin.rpc("morph_id_scans_remaining", {
      p_user_id: userId,
      p_tier: tier,
      p_monthly: monthly,
    });
    if (error || data == null || typeof data !== "object") return null;
    const remaining = Number((data as { remaining?: unknown }).remaining);
    return Number.isFinite(remaining) ? remaining : null;
  } catch (err) {
    console.error(
      "morph_id_scans_remaining failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

async function refundMorphIdCredit(userId: string): Promise<boolean> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const confirmed = await refundMorphIdCreditOnce(() =>
    admin.rpc("refund_morph_id_credit", { p_user_id: userId }),
  );
  if (!confirmed) console.error("MorphID credit refund failed or could not be confirmed");
  return confirmed;
}

function resolveTier(profile: Profile): string {
  if (profile.subscription_status === "grandfathered") return "breeder";
  const t = profile.membership_tier;
  return t && t in TIER_MORPH_ID_CREDITS ? t : "free";
}

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

type EvidenceResult = {
  evidence: VisualEvidence;
  // The embedding was still booting (or running) at its deadline. The
  // request then ends with upstream_timeout before the analyzer is called:
  // answering without the reference photos would change what the model
  // reads, and the time left would not cover an analyzer call anyway.
  timedOut: boolean;
};

function unavailableEvidence(model: string | null, note: string): VisualEvidence {
  return {
    status: "unavailable",
    model,
    photo_count: 0,
    neighbors: [],
    consensus: null,
    note,
  };
}

async function loadVisualEvidence(
  imageUrls: string[],
  options: { signal: AbortSignal; deadlines: MorphDeadlines; timing: MorphTiming },
): Promise<EvidenceResult> {
  if (!VISUAL_RETRIEVAL_ENABLED) {
    return { evidence: unavailableEvidence(null, "Visual retrieval is disabled."), timedOut: false };
  }
  if (!REPLICATE_API_TOKEN) {
    return { evidence: unavailableEvidence(null, "Visual embedding provider is not configured."), timedOut: false };
  }

  try {
    const settled = await options.timing.measure("embed", Promise.allSettled(
      imageUrls.slice(0, RETRIEVAL_MAX_PHOTOS).map((imageUrl) =>
        createVisualEmbedding(imageUrl, {
          token: REPLICATE_API_TOKEN,
          model: VISUAL_EMBEDDING_MODEL,
          // One deadline for the request, the throttled retry and every
          // poll (69.5 s from arrival for one or two photos, 59 s for five,
          // ../_shared/morph-budget.ts).
          deadline: options.deadlines.embed,
          signal: options.signal,
          // Retrieval is corroborating evidence, but answering without it
          // changes the prompt. A throttled request (Replicate allows one
          // at a time under $5 of credit) waits once for Retry-After when
          // that still fits before the deadline, then the answer goes ahead
          // without references as before.
          rateLimitAttempts: 2,
        })
      ),
    ));
    const embeddings = settled.flatMap((result) =>
      result.status === "fulfilled" ? [result.value.embedding] : []
    );
    const queryEmbedding = meanNormalizedEmbeddings(embeddings);
    if (queryEmbedding.length === 0) {
      const failures = settled.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
      if (failures.some((reason) => reason instanceof EmbeddingCanceledError)) {
        // The request already ended; nobody reads this.
        return { evidence: unavailableEvidence(VISUAL_EMBEDDING_MODEL, "Canceled."), timedOut: false };
      }
      const firstError = failures[0];
      const detail = firstError !== undefined
        ? String(firstError instanceof Error ? firstError.message : firstError)
        : "No query embedding was produced.";
      console.error("visual evidence unavailable:", detail.slice(0, 300));
      return {
        evidence: unavailableEvidence(VISUAL_EMBEDDING_MODEL, detail.slice(0, 180)),
        timedOut: failures.some((reason) => reason instanceof EmbeddingTimeoutError),
      };
    }
    if (options.signal.aborted) {
      return { evidence: unavailableEvidence(VISUAL_EMBEDDING_MODEL, "Canceled."), timedOut: false };
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // The query gets 3 s past the embedding deadline; past that the answer
    // goes ahead without references, as it does when the query fails.
    const neighborLimit = deadlineSignal(options.deadlines.neighbors, options.signal);
    try {
      const { data, error } = await options.timing.measure(
        "neighbors",
        admin.rpc("morph_visual_neighbors", {
          query_embedding: queryEmbedding,
          match_count: 48,
        }).abortSignal(neighborLimit.signal),
      );
      if (error) throw new Error(`visual neighbor query failed: ${error.message}`);
      return {
        evidence: buildVisualEvidence((data || []) as RawVisualNeighbor[], {
          model: VISUAL_EMBEDDING_MODEL,
          photoCount: embeddings.length,
          minSimilarity: RETRIEVAL_MIN_SIMILARITY,
          maxNeighbors: 8,
          maxPerMorph: 2,
          rankingDepth: 16,
        }),
        timedOut: false,
      };
    } finally {
      neighborLimit.clear();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!options.signal.aborted) console.error("visual evidence unavailable:", message);
    return { evidence: unavailableEvidence(VISUAL_EMBEDDING_MODEL, message.slice(0, 180)), timedOut: false };
  }
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
  deadlineMs: number = CLAUDE_MAX_MS,
): Promise<CallClaudeResult> {
  const bank = await loadFewShotBank();

  // The instructions, tool schema and content blocks are built in
  // request.ts (prompt caching, reference photos, the member's photos and
  // the trailing context line); see the notes there.
  const { body: request, shape } = buildClaudeRequest({
    bank,
    imageUrls,
    includeValueEstimate,
    model,
    context,
    visualEvidence,
  });
  let requestBody = JSON.stringify(request);
  const startedAt = Date.now();

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
    // The time left in this call's budget (min(90 s, time left in the
    // request)). There is no floor: the handler does not start a call with
    // less than its minimum for the photo count (claudeMinMs).
    const remainingMs = Math.max(0, deadlineMs - (Date.now() - startedAt));
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
        // An answer cut off at the ceiling would be cut off again by the
        // same request, so the retry gets twice the room (retryShape).
        // Nothing the model reads changes.
        if (truncated) {
          requestBody = JSON.stringify({ ...request, max_tokens: retryShape(shape, "max_tokens").maxTokens });
        }
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
  // The time budget runs from here (../_shared/morph-budget.ts).
  const arrivedAt = Date.now();
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only", code: "method_not_allowed" }, 405);

  const timing = new MorphTiming(arrivedAt);
  // Filled in as the steps run; the error path reads it.
  const state = newStepState(CLAUDE_MODEL);
  // Every answer carries a Server-Timing header and writes one timing line
  // to the log (no photo URLs, nothing about the member).
  const respond = (body: Record<string, unknown>, status = 200, label?: string) => {
    timing.finish();
    const durations = timing.snapshot();
    const outcome = label ?? (typeof body.code === "string" ? body.code : (status < 300 ? "ok" : "error"));
    console.log(timingLogLine({ outcome, status, photoCount: state.imageUrls.length, durations }));
    return json(body, status, { "Server-Timing": serverTimingHeader(durations) });
  };

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return respond({ error: "auth required", code: "auth_required" }, 401);

  // Hash the caller's IP once up front; null when IP_HASH_SALT is unset
  // or the client IP can't be determined. Both cases skip per-IP
  // enforcement AND log ip_hash=null so the row is still useful for
  // every other dashboard slice.
  const ipHash = await hashIp(extractClientIp(req));

  // The caller's JWT identifies them; the profile row is then read with the
  // service role so RLS doesn't gate the lookup even for users whose
  // `profiles.email` linkage is legacy.
  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let abortEvidence = () => {};
  try {
    const outcome = await runMorphSteps<EvidenceResult>({
      getUser: async () => {
        const { data } = await userClient.auth.getUser();
        return data?.user ?? null;
      },
      readBody: async () => {
        const parsed = await req.json().catch(() => ({}));
        return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
      },
      // The deadlines depend on how many photos Claude will read.
      startEvidence: (imageUrls, signal) => loadVisualEvidence(imageUrls, {
        signal,
        deadlines: morphDeadlines(arrivedAt, imageUrls.length),
        timing,
      }),
      loadProfileRow: async (user) => {
        const { data } = await admin.from("profiles")
          .select("membership_tier, subscription_status, role, morph_id_show_value_estimate")
          .eq("email", user.email)
          .maybeSingle();
        return data ?? null;
      },
      loadEffectiveTier: async () => {
        const { data, error } = await userClient.rpc("effective_tier_for_current_user");
        return { data, error };
      },
      fetchPerIpCap: fetchPerIpDailyCap,
      countIpCalls: countTodaysCallsForIp,
      claimRequestKey,
      consumeCredit: async (userId, tier, creditsIncluded) => {
        const { data, error } = await admin.rpc("consume_morph_id_credit", {
          p_user_id: userId,
          p_tier: tier,
          p_credits_included: creditsIncluded,
        });
        return { data, error };
      },
      readScansRemaining: readMorphIdScansRemaining,
      settleRequestKey,
    }, {
      configured: !!ANTHROPIC_API_KEY,
      ipHash,
      parseRequest,
      resolveTier,
      creditsFor: (tier) => TIER_MORPH_ID_CREDITS[tier] ?? TIER_MORPH_ID_CREDITS.free,
      // Per-request model override (defaults to env-configured CLAUDE_MODEL).
      // The eval pipeline sends `model: "claude-haiku-4-5"` for cheap iteration
      // and "claude-sonnet-4-6" for benchmark runs. Production callers
      // (Recognition.jsx) omit `model` and get the env default.
      // Only admins and the eval account may choose: any member could name
      // the most expensive model, which costs several times the default.
      resolveModel: (body, mayChoose) => mayChoose ? resolveModel(body?.model) : CLAUDE_MODEL,
      // Surface tag for the spend-log sink. Eval script sends
      // surface='morph_id_eval' + the shared secret header; admin callers
      // can tag themselves freely; everyone else gets 'morph_id_production'.
      resolveSurface: (body, mayTag) => resolveSurface(body?.surface, mayTag, req.headers.get("x-eval-secret")),
    }, state, timing);

    switch (outcome.kind) {
      case "auth_failed":
        return respond({ error: outcome.error, code: "auth_required" }, 401);
      case "warm":
        return respond(await warmUp(outcome.user.id, outcome.body, ipHash), 202, "warm");
      case "not_configured":
        return respond({ error: "Morph ID is not configured", code: "config_error" }, 500);
      case "bad_request":
        return respond({ error: "imageUrls or imageUrl is required", code: "bad_request" }, 400);
      case "ip_limited":
        // Per-IP daily cap. Cap value is pulled live from
        // runtime_config.morph_id_per_ip_daily, so changes via the
        // /data-admin/control panel take effect on the next request.
        await finishAfterResponse(logInvocation({
          surface: state.surface, model: state.model,
          input_tokens: 0, output_tokens: 0,
          cache_read_tokens: null, cache_creation_tokens: null,
          est_cost_cents: 0,
          user_id: state.profile?.auth_user_id ?? null, tier: state.tier, is_admin: state.isAdmin,
          photo_count: state.imageUrls.length, few_shot_count: null,
          http_status: 429,
          error_code: "morph_id_ip_daily_exhausted",
          duration_ms: 0, request_id: null,
          ip_hash: ipHash,
        }));
        return respond({
          error: "Daily MorphID limit reached for this network. Try again tomorrow.",
          code: "morph_id_ip_daily_exhausted",
          cap: outcome.cap, used: outcome.used,
        }, 429);
      case "replay":
        return respond({ ...outcome.response, replayed: true });
      case "running":
        return respond({
          error: "Your last analysis of these photos is still running.",
          code: "morph_id_in_progress",
        }, 409);
      case "credits_exhausted":
        return respond({
          error: "Monthly MorphID credit limit reached.",
          code: "morph_id_credits_exhausted",
          tier: state.tier,
          credits_included: state.creditsIncluded,
        }, 402);
      case "credit_check_failed":
        return respond({
          error: `credit check failed: ${outcome.message}`,
          code: "credit_check_failed",
        }, 500);
    }
    abortEvidence = outcome.abortEvidence;

    const profile = state.profile!;
    const tier = state.tier!;
    const { isAdmin, imageUrls, model, ageStage, firedState, creditsIncluded } = state;
    // Paid members who turn on the Settings toggle see asking prices for the
    // looks Morph ID found. The app works those out from the Price Index,
    // with the number of listings behind them (src/lib/morphIdPriceRange.js);
    // this flag only tells it to. The model is no longer asked to guess a
    // dollar band from the photo: that number had no source behind it and
    // contradicted "value estimates from real listings", so it stays off
    // (the prompt and schema plumbing for it is kept but never switched on).
    // Admins inherit Breeder-or-better, so the toggle is read as-is for them.
    const isPaidTier = tier === "keeper" || tier === "breeder" || tier === "enterprise";
    const showPriceRange = !!profile.morph_id_show_value_estimate && (isPaidTier || isAdmin);
    const includeValueEstimate = false;

    // The photo lookup has been running since the scan was reserved; wait
    // for it here.
    const waitStarted = Date.now();
    const { evidence: visualEvidence, timedOut } = await outcome.evidence;
    timing.add("wait", Date.now() - waitStarted);
    // A call that cannot finish is not started: the member gets the usual
    // "try again" answer with the scan handed back, at the embedding
    // deadline (69.5 s for one or two photos, 59 s for five) instead of a
    // timed-out analyzer call at 105 s. The Replicate boot carries on, so
    // the retry finds the model warm.
    if (timedOut || skipClaude(arrivedAt, Date.now(), imageUrls.length)) {
      throw new UpstreamError(
        timedOut
          ? "Analyzer timed out before it started: the photo-matching model was still starting up"
          : "Analyzer timed out before it started: too little time left for an answer",
        504,
        "upstream_timeout",
        { httpStatus: 504, durationMs: 0 },
      );
    }

    const result = await timing.measure("claude", callClaude(
      imageUrls,
      includeValueEstimate,
      model,
      { ageStage, firedState },
      visualEvidence,
      claudeTimeoutMs(arrivedAt, Date.now()),
    ));
    const analysis = clampToTaxonomy(
      result.raw,
      includeValueEstimate,
      model,
      visualEvidence,
      imageUrls.length,
    );
    analysis.age_stage = ageStage;
    analysis.user_reported_fired_state = firedState;

    const writesStarted = Date.now();
    let creditsConsumed = state.creditsConsumed;
    let creditsRemaining: number | null = null;
    if (outcome.scansRemaining) {
      creditsRemaining = await outcome.scansRemaining;
      if (creditsRemaining == null) {
        creditsRemaining = Math.max(0, creditsIncluded - creditsConsumed);
      }
    }
    // D19: a "better photos needed" answer gives the member nothing to act
    // on, so the credit is handed back and they can retake the photos. Since
    // 6 Oct 2026 this covers paid monthly credits too, not only the free scan.
    let creditRefunded = false;
    if (
      state.creditWasConsumed &&
      analysis.assessment_status === "insufficient_evidence"
    ) {
      const refunded = await refundMorphIdCredit(profile.auth_user_id);
      if (refunded) {
        state.creditWasConsumed = false;
        creditRefunded = true;
        creditsConsumed = Math.max(0, creditsConsumed - 1);
        const refreshed = await readMorphIdScansRemaining(
          profile.auth_user_id,
          tier,
          creditsIncluded,
        );
        creditsRemaining = refreshed ?? Math.max(0, (creditsRemaining ?? 0) + 1);
      }
    }
    // The spend log is written after the answer goes out (it took 88 to
    // 1,265 ms when it was awaited). Logging fails open either way.
    const spendLog = logInvocation({
      surface: state.surface,
      model,
      input_tokens: result.usage.input_tokens ?? 0,
      output_tokens: result.usage.output_tokens ?? 0,
      cache_read_tokens: result.usage.cache_read_input_tokens ?? null,
      cache_creation_tokens: result.usage.cache_creation_input_tokens ?? null,
      est_cost_cents: costCentsFromUsage(model, result.usage),
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
      value_estimate_included: showPriceRange,
      // The photos this answer read, exactly as sent. A share card may only
      // show one of these (create_morph_id_share compares the strings), so
      // a strong answer cannot be paired with a different photo.
      image_urls: imageUrls,
    };
    // Awaited: a retry with the same key replays this stored answer.
    await settleRequestKey(profile.auth_user_id, state.claimedKey, "done", responseBody);
    timing.add("writes", Date.now() - writesStarted);
    await finishAfterResponse(spendLog);
    return respond(responseBody);
  } catch (err) {
    abortEvidence();
    const profile = state.profile;
    if (!profile) {
      // Nothing was reserved before the member was known.
      const message = err instanceof Error ? err.message : String(err);
      return respond({ error: message, code: "internal_error", credit_refunded: false, failure_kind: "application" }, 500);
    }
    // Provider failures (network, 5xx, billing, timeout) and our own
    // errors both return the reserved scan. A member's monthly scan is
    // only used up when an analysis actually comes back.
    const writesStarted = Date.now();
    let creditRefundedOnError = false;
    if (state.creditWasConsumed) {
      creditRefundedOnError = await refundMorphIdCredit(profile.auth_user_id);
    }
    await settleRequestKey(profile.auth_user_id, state.claimedKey, "failed", null);
    timing.add("writes", Date.now() - writesStarted);
    if (err instanceof UpstreamError) {
      const failure = upstreamFailureResponse({
        code: err.code,
        diagnostic: err.message,
        creditRefunded: creditRefundedOnError,
      });
      await finishAfterResponse(logInvocation({
        surface: state.surface,
        model: state.model,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: null,
        cache_creation_tokens: null,
        est_cost_cents: 0,
        user_id: profile.auth_user_id,
        tier: state.tier,
        is_admin: state.isAdmin,
        photo_count: state.imageUrls.length,
        few_shot_count: null,
        http_status: err.httpStatus,
        // Billing stays distinct from a bad request or a 5xx in our code,
        // so a credit-balance outage is not triaged as an application bug.
        error_code: failure.failure_kind === "provider_billing" ? "provider_billing" : err.code,
        duration_ms: err.durationMs,
        request_id: err.requestId,
        ip_hash: ipHash,
      }));
      return respond(failure, err.status === 429 ? 503 : 502);
    }
    const message = err instanceof Error ? err.message : String(err);
    await finishAfterResponse(logInvocation({
      surface: state.surface,
      model: state.model,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: null,
      cache_creation_tokens: null,
      est_cost_cents: 0,
      user_id: profile.auth_user_id,
      tier: state.tier,
      is_admin: state.isAdmin,
      photo_count: state.imageUrls.length,
      few_shot_count: null,
      http_status: null,
      error_code: "internal_error",
      duration_ms: null,
      request_id: null,
      ip_hash: ipHash,
    }));
    return respond({
      error: message,
      code: "internal_error",
      credit_refunded: creditRefundedOnError,
      failure_kind: "application",
    }, 500);
  }
});
