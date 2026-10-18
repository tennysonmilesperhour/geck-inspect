// The order of the steps before a Morph ID analysis, with the network calls
// passed in. Kept apart from index.ts (Deno URL imports) so vitest can check
// the order (src/lib/__tests__/morphSteps.test.js).
//
// Until October 2026 every step waited for the one before it: sign-in,
// profile, plan, the per-network cap, the request key, the credit, the
// scans-left read, and only then the photo embedding. Now:
//
//   1. The sign-in check and reading the body run together.
//   2. Profile, plan and the two per-network reads (the cap and today's
//      count) run together. The per-network reads are only used when the
//      cap applies; for admin and evaluation calls they are thrown away.
//   3. The request key is claimed before the credit is taken (a repeat of a
//      finished request must never spend a credit), and the credit is taken
//      before the analyzer is called (a paid call needs a reserved scan).
//   4. Only then does the photo lookup (embedding plus reference photos)
//      start, alongside the scans-left read, which is awaited only when the
//      answer is built. Admin and evaluation calls take no scan, so for them
//      it starts right after the cap check.
//
// The photo lookup comes last on purpose. Replicate runs a prediction once
// it has accepted the request, whether or not we keep waiting, and the photo
// URL is the caller's. Starting it earlier let a repeat (double tap), a run
// still going, a network over its daily cap or an account with no scans left
// send Replicate a photo on every call, with no cap, and under Replicate's
// one-request-at-a-time limit (less than $5 of credit) that throttles the
// embeddings of members who are being served. Now only a call that will
// reach the analyzer reaches Replicate.
import { isWarmRequest } from "./morph-warm.ts";

export type AuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
};

export type ProfileRow = {
  membership_tier?: string | null;
  subscription_status?: string | null;
  role?: string | null;
  morph_id_show_value_estimate?: boolean | null;
} | null;

export type Profile = {
  auth_user_id: string;
  membership_tier: string | null;
  subscription_status: string | null;
  role: string | null;
  morph_id_show_value_estimate: boolean | null;
  is_eval_account: boolean;
};

export type RequestClaim =
  | { kind: "disabled" }
  | { kind: "claimed" }
  | { kind: "replay"; response: Record<string, unknown> }
  | { kind: "running" };

export type ParsedRequest = {
  imageUrls: string[];
  ageStage: string;
  firedState: string;
  requestKey: string | null;
};

export type MorphStepDeps<Evidence> = {
  getUser(): Promise<AuthUser | null>;
  readBody(): Promise<Record<string, unknown>>;
  /** Starts the photo lookup. Must not throw; checks `signal` to stop early. */
  startEvidence(imageUrls: string[], signal: AbortSignal): Promise<Evidence>;
  loadProfileRow(user: AuthUser): Promise<ProfileRow>;
  loadEffectiveTier(): Promise<{ data: unknown; error: unknown }>;
  fetchPerIpCap(): Promise<number | null>;
  countIpCalls(ipHash: string): Promise<number>;
  claimRequestKey(userId: string, key: string): Promise<RequestClaim>;
  consumeCredit(userId: string, tier: string, creditsIncluded: number): Promise<{
    data: { credits_consumed?: number } | null;
    error: { message?: string } | null;
  }>;
  readScansRemaining(userId: string, tier: string, monthly: number): Promise<number | null>;
  settleRequestKey(userId: string, key: string | null, status: "done" | "failed", response: null): Promise<void>;
};

export type MorphStepPolicy = {
  /** The analyzer key is set. */
  configured: boolean;
  ipHash: string | null;
  parseRequest(body: Record<string, unknown>): ParsedRequest | null;
  resolveTier(profile: Profile): string;
  creditsFor(tier: string): number;
  resolveModel(body: Record<string, unknown>, mayChoose: boolean): string;
  resolveSurface(body: Record<string, unknown>, mayTag: boolean): string;
};

// What the handler's error path needs, filled in as the steps run (it used
// to be the handler's hoisted variables).
export type MorphStepState = {
  profile: Profile | null;
  tier: string | null;
  creditsIncluded: number;
  isAdmin: boolean;
  isEvalAccount: boolean;
  imageUrls: string[];
  ageStage: string;
  firedState: string;
  model: string;
  surface: string;
  claimedKey: string | null;
  creditWasConsumed: boolean;
  creditsConsumed: number;
};

export function newStepState(defaultModel: string): MorphStepState {
  return {
    profile: null,
    tier: null,
    creditsIncluded: 0,
    isAdmin: false,
    isEvalAccount: false,
    imageUrls: [],
    ageStage: "unknown",
    firedState: "unknown",
    model: defaultModel,
    surface: "morph_id_production",
    claimedKey: null,
    creditWasConsumed: false,
    creditsConsumed: 0,
  };
}

export type MorphStepOutcome<Evidence> =
  | { kind: "auth_failed"; error: string }
  | { kind: "warm"; user: AuthUser; body: Record<string, unknown> }
  | { kind: "not_configured" }
  | { kind: "bad_request" }
  | { kind: "ip_limited"; cap: number; used: number }
  | { kind: "replay"; response: Record<string, unknown> }
  | { kind: "running" }
  | { kind: "credits_exhausted" }
  | { kind: "credit_check_failed"; message: string }
  | {
    kind: "ready";
    evidence: Promise<Evidence>;
    /** Null for admin and evaluation calls, which take no credit. */
    scansRemaining: Promise<number | null> | null;
    /** Stops the photo lookup if the request ends before it is used. */
    abortEvidence: () => void;
  };

type Timer = { measure<T>(step: "auth" | "db", work: PromiseLike<T>): Promise<T> };
const untimed: Timer = { measure: (_step, work) => Promise.resolve(work) };

function profileFrom(user: AuthUser, row: ProfileRow, effectiveTier: unknown): Profile {
  return {
    auth_user_id: user.id,
    membership_tier: (effectiveTier as string | null | undefined) ?? row?.membership_tier ?? null,
    subscription_status: row?.subscription_status ?? null,
    role: row?.role ?? null,
    morph_id_show_value_estimate: row?.morph_id_show_value_estimate ?? false,
    // Set only by the morph-id-eval workflow (scripts/morph-id-eval/run-ci.mjs).
    // app_metadata can be written by the service role alone, so a user cannot
    // grant it to themselves.
    is_eval_account: user.app_metadata?.morph_eval === true,
  };
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Runs everything before the analyzer call. Returns how the request ends
 * early, or "ready" with the photo lookup running. `state` is filled in as
 * it goes. A throw (a database call that throws instead of returning an
 * error) reaches the handler's error path; the photo lookup has not started
 * by then.
 */
export async function runMorphSteps<Evidence>(
  deps: MorphStepDeps<Evidence>,
  policy: MorphStepPolicy,
  state: MorphStepState,
  timing: Timer = untimed,
): Promise<MorphStepOutcome<Evidence>> {
  // 1. Sign-in check and the body together.
  const [signedIn, body] = await Promise.all([
    timing.measure("auth", deps.getUser().then(
      (user) => ({ user, error: null as string | null }),
      (err) => ({ user: null, error: messageOf(err) }),
    )),
    deps.readBody().catch(() => ({} as Record<string, unknown>)),
  ]);
  if (signedIn.error) return { kind: "auth_failed", error: `auth lookup failed: ${signedIn.error}` };
  const user = signedIn.user;
  if (!user) return { kind: "auth_failed", error: "auth required" };
  if (isWarmRequest(body)) return { kind: "warm", user, body };
  if (!policy.configured) return { kind: "not_configured" };

  const parsed = policy.parseRequest(body);
  if (!parsed) return { kind: "bad_request" };
  state.imageUrls = parsed.imageUrls;
  state.ageStage = parsed.ageStage;
  state.firedState = parsed.firedState;

  // 2. Profile, plan and the per-network reads together. The per-network
  // reads are awaited only when the cap applies (step 3); a failure there
  // is handled where they are awaited.
  const ipHash = policy.ipHash;
  const networkReads = ipHash
    ? Promise.all([deps.fetchPerIpCap(), deps.countIpCalls(ipHash)])
    : null;
  networkReads?.catch(() => {});
  let profile: Profile;
  try {
    const [row, tierResult] = await timing.measure("db", Promise.all([
      deps.loadProfileRow(user),
      deps.loadEffectiveTier(),
    ]));
    if (tierResult.error) throw new Error("Could not verify membership access");
    profile = profileFrom(user, row, tierResult.data);
  } catch (err) {
    return { kind: "auth_failed", error: `auth lookup failed: ${messageOf(err)}` };
  }
  state.profile = profile;
  state.isAdmin = profile.role === "admin";
  // The evaluation account grades the held-out test set without spending
  // credits and may tag its calls as morph_id_eval. It gets nothing else.
  state.isEvalAccount = profile.is_eval_account;
  state.tier = policy.resolveTier(profile);
  state.creditsIncluded = policy.creditsFor(state.tier);
  const mayChoose = state.isAdmin || state.isEvalAccount;
  state.model = policy.resolveModel(body, mayChoose);
  state.surface = policy.resolveSurface(body, mayChoose);

  // 3. Per-network daily cap. Only production traffic counts (eval and
  // admin self-tagged calls are exempt).
  if (!state.isAdmin && state.surface === "morph_id_production" && networkReads) {
    const [cap, used] = await timing.measure("db", networkReads);
    if (cap && cap > 0 && used >= cap) return { kind: "ip_limited", cap, used };
  }

  // 4. A repeat of a request this member already sent (double tap, retry
  // after a dropped connection) is answered from the stored result, or
  // told to wait while the first run is still going. Neither costs a
  // credit. Admin and evaluation calls never use credits, so they skip it.
  const metered = !state.isAdmin && !state.isEvalAccount;
  if (metered && parsed.requestKey) {
    const claim = await timing.measure("db", deps.claimRequestKey(profile.auth_user_id, parsed.requestKey));
    if (claim.kind === "replay") return { kind: "replay", response: claim.response };
    if (claim.kind === "running") return { kind: "running" };
    if (claim.kind === "claimed") state.claimedKey = parsed.requestKey;
  }

  // 5. Reserve the scan.
  if (metered) {
    const { data: usage, error } = await timing.measure(
      "db",
      deps.consumeCredit(profile.auth_user_id, state.tier, state.creditsIncluded),
    );
    if (error) {
      await deps.settleRequestKey(profile.auth_user_id, state.claimedKey, "failed", null);
      if ((error.message || "").includes("morph_id_credits_exhausted")) return { kind: "credits_exhausted" };
      return { kind: "credit_check_failed", message: error.message || "" };
    }
    state.creditsConsumed = usage?.credits_consumed ?? 0;
    state.creditWasConsumed = true;
  }

  // 6. This call will reach the analyzer: start the photo lookup, and the
  // scans-left read alongside it. Both are awaited later.
  const lookup = new AbortController();
  const evidence = deps.startEvidence(parsed.imageUrls, lookup.signal);
  const scansRemaining = metered
    ? deps.readScansRemaining(profile.auth_user_id, state.tier, state.creditsIncluded)
    : null;
  return { kind: "ready", evidence, scansRemaining, abortEvidence: () => lookup.abort() };
}

// Supabase keeps a worker running for work handed to EdgeRuntime.waitUntil
// after the response is sent (send-email uses the same thing).
type EdgeRuntimeLike = { waitUntil(promise: Promise<unknown>): void };

/**
 * Runs `work` after the response: hands it to EdgeRuntime.waitUntil when the
 * runtime has it (and returns at once), otherwise waits for it. A failure is
 * logged, never thrown, so it cannot change the answer.
 */
export function finishAfterResponse(work: Promise<unknown>): Promise<void> {
  const safe = Promise.resolve(work).then(
    () => undefined,
    (err) => {
      console.error("background write failed:", messageOf(err));
    },
  );
  const runtime = (globalThis as { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(safe);
    return Promise.resolve();
  }
  return safe;
}
