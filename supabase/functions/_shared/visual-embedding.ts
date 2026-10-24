export const VISUAL_EMBEDDING_DIMENSION = 768;
export const DEFAULT_VISUAL_EMBEDDING_MODEL = "krthr/clip-embeddings";

// The Replicate version each embedding model runs at, pinned.
//
// Until October 2026 the version was looked up as the model's "latest" on
// every cold start. krthr/clip-embeddings is a community model: its owner
// can publish a new version at any time, and a new version with different
// weights would put new photos in a different vector space from the 1,900
// stored ones, so Morph ID's "closest verified samples" would quietly stop
// matching. Pinning means the version only changes when this file does.
//
// 1c037107... is the model's latest version and the one in use when it was
// pinned on 16 Oct 2026 (Replicate's versions page shows it as "Latest",
// unchanged for about three years). It wraps the openai/clip-vit-large-
// patch14 weights that scripts/backfill-morph-embeddings-local.py uses for
// the stored vectors.
//
// To update it: open https://replicate.com/krthr/clip-embeddings/versions,
// copy the full version id, put it here, and run the visual embedding
// tests (pnpm test visualEmbedding). A version with different weights also
// means re-embedding the stored photos (scripts/README.md), or old and new
// vectors will not compare. If Replicate ever refuses the pinned version,
// the code below falls back to the model's latest version for that run
// and logs a warning naming the pin, so Morph ID keeps working.
// A SIGLIP_MODEL secret of the form "owner/model:version" pins itself.
export const PINNED_VISUAL_EMBEDDING_VERSIONS: Readonly<Record<string, string>> = Object.freeze({
  "krthr/clip-embeddings": "1c0371070cb827ec3c7f2f28adcdde54b50dcd239aa6faea0bc98b174ef03fb4",
});

type ReplicatePrediction = {
  id?: string;
  status?: string;
  error?: unknown;
  output?: unknown;
  urls?: { get?: string };
};

export function normalizeEmbedding(values: number[]): number[] {
  let normSquared = 0;
  for (const value of values) normSquared += value * value;
  const norm = Math.sqrt(normSquared);
  if (!norm) return values;
  return values.map((value) => value / norm);
}

export function meanNormalizedEmbeddings(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dimension = vectors[0].length;
  if (!dimension || vectors.some((vector) => vector.length !== dimension)) return [];
  const mean = new Array<number>(dimension).fill(0);
  for (const vector of vectors) {
    for (let index = 0; index < dimension; index += 1) mean[index] += vector[index];
  }
  return normalizeEmbedding(mean.map((value) => value / vectors.length));
}

function extractEmbedding(output: unknown): number[] | null {
  if (Array.isArray(output)) {
    if (output.length > 0 && output.every((value) => typeof value === "number")) {
      return output as number[];
    }
    if (output.length === 1 && Array.isArray(output[0])) {
      return extractEmbedding(output[0]);
    }
    const first = output[0];
    if (first && typeof first === "object" && "embedding" in first) {
      return extractEmbedding((first as { embedding: unknown }).embedding);
    }
  }
  if (output && typeof output === "object" && "embedding" in output) {
    return extractEmbedding((output as { embedding: unknown }).embedding);
  }
  return null;
}

const versionCache = new Map<string, string>();
// Pins Replicate has refused in this instance, so the fallback is taken
// once, not on every photo.
const refusedPins = new Set<string>();

async function latestVersion(model: string, token: string, signal?: AbortSignal): Promise<string | null> {
  const cached = versionCache.get(model);
  if (cached) return cached;
  const response = await fetch(`https://api.replicate.com/v1/models/${model}`, {
    headers: { Authorization: `Token ${token}` },
    signal,
  });
  if (!response.ok) return null;
  const body = await response.json();
  const version = body?.latest_version?.id || null;
  if (version) versionCache.set(model, version);
  return version;
}

/**
 * The version to run and where it came from: "explicit" (owner/model:version),
 * "pinned" (PINNED_VISUAL_EMBEDDING_VERSIONS) or "latest" (looked up).
 */
async function resolveVersion(
  model: string,
  token: string,
  signal?: AbortSignal,
): Promise<{ version: string | null; source: "explicit" | "pinned" | "latest" }> {
  const colon = model.indexOf(":");
  if (colon !== -1) return { version: model.slice(colon + 1), source: "explicit" };
  const pinned = PINNED_VISUAL_EMBEDDING_VERSIONS[model];
  if (pinned && !refusedPins.has(model)) return { version: pinned, source: "pinned" };
  return { version: await latestVersion(model, token, signal), source: "latest" };
}

/**
 * Whether Replicate's answer means "that version does not exist or is not
 * yours to run", as opposed to any other refusal.
 *
 * Replicate answers 422 both for an unknown version ("Invalid version or
 * not permitted") and for a bad input ("Input validation failed", with
 * invalid_fields). Only the first should move this instance off the pin:
 * one odd photo must not switch every later photo to another version, and
 * so possibly to another vector space. A 404 is always a missing version.
 */
export async function refusedVersion(response: Response): Promise<boolean> {
  if (response.status === 404) return true;
  if (response.status !== 422) return false;
  const text = await response.clone().text().catch(() => "");
  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  if (body && typeof body === "object") {
    if (body.invalid_fields) return false;
    return /version/i.test(`${body.title ?? ""} ${body.detail ?? ""}`);
  }
  return /version/i.test(text);
}

// Replicate holds a prediction request open for at most 60 seconds
// ("Prefer: wait=60") before it answers with the prediction still running.
const MAX_PREFER_WAIT_SECONDS = 60;
// A throttled request is retried only when the wait leaves this much of the
// deadline for the prediction itself.
const RETRY_MIN_ROOM_MS = 5_000;

/** The model was still booting (or running) when the time ran out. */
export class EmbeddingTimeoutError extends Error {
  phase: "starting" | "running";
  constructor(phase: "starting" | "running") {
    super(`Replicate timed out while the embedding model was ${phase === "starting" ? "starting up" : "running"}`);
    this.name = "EmbeddingTimeoutError";
    this.phase = phase;
  }
}

/** The caller stopped waiting (the request ended early); nobody needs the result. */
export class EmbeddingCanceledError extends Error {
  constructor() {
    super("Embedding request canceled");
    this.name = "EmbeddingCanceledError";
  }
}

/** "wait=N" for the whole seconds left before the deadline, 1 to 60. */
export function preferWait(deadline: number | undefined, now = Date.now()): string {
  if (deadline == null) return `wait=${MAX_PREFER_WAIT_SECONDS}`;
  const seconds = Math.floor((deadline - now) / 1000);
  return `wait=${Math.min(MAX_PREFER_WAIT_SECONDS, Math.max(1, seconds))}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPrediction(
  prediction: ReplicatePrediction,
  token: string,
  until: number,
  signal: AbortSignal,
): Promise<ReplicatePrediction> {
  if (prediction.output != null || prediction.status === "succeeded") return prediction;
  const pollUrl = prediction.urls?.get;
  if (!pollUrl) return prediction;

  let current = prediction;
  while (["starting", "processing"].includes(current.status || "") && Date.now() < until) {
    await sleep(Math.min(750, Math.max(0, until - Date.now())));
    if (Date.now() >= until || signal.aborted) break;
    const response = await fetch(pollUrl, {
      headers: { Authorization: `Token ${token}` },
      signal,
    });
    if (!response.ok) {
      throw new Error(`Replicate poll ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    current = await response.json();
  }
  return current;
}

async function createPrediction(
  url: string,
  init: () => RequestInit,
  attempts: number,
  deadline: number | undefined,
): Promise<Response> {
  let response: Response | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    response = await fetch(url, init());
    if (response.status !== 429 || attempt === attempts) return response;

    let retrySeconds = Number(response.headers.get("retry-after")) || 0;
    if (!retrySeconds) {
      const detail = await response.clone().json().catch(() => ({}));
      retrySeconds = Number(detail?.retry_after) || 10;
    }
    const waitMs = Math.min(15, Math.max(1, retrySeconds)) * 1_000;
    // Under a deadline, wait only when the retry can still finish inside it.
    // Otherwise hand back the throttled answer, as a single attempt would.
    if (deadline != null && Date.now() + waitMs + RETRY_MIN_ROOM_MS > deadline) return response;
    await sleep(waitMs);
  }
  return response!;
}

export async function createVisualEmbedding(
  imageUrl: string,
  options: {
    token: string;
    model?: string;
    // Without a deadline: how long to poll after the first answer.
    timeoutMs?: number;
    // An absolute time (ms since the epoch) by which the embedding must be
    // done. One timer covers the version lookup, the prediction request,
    // a throttled retry and every poll, and Prefer: wait asks Replicate to
    // hold the request for the seconds left. At the deadline this throws
    // EmbeddingTimeoutError and leaves the prediction running on Replicate,
    // so the model is warm for the next request.
    deadline?: number;
    // Aborted by the caller when it no longer needs the result.
    signal?: AbortSignal;
    rateLimitAttempts?: number;
  },
): Promise<{ embedding: number[]; model: string; version: string | null }> {
  const model = options.model || DEFAULT_VISUAL_EMBEDDING_MODEL;
  const modelPath = model.includes(":") ? model.split(":")[0] : model;
  const deadline = options.deadline;
  const input = { image: imageUrl };

  const controller = new AbortController();
  let reachedDeadline = false;
  const timer = deadline != null
    ? setTimeout(() => {
      reachedDeadline = true;
      controller.abort();
    }, Math.max(0, deadline - Date.now()))
    : null;
  const stop = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", stop);
  const signal = controller.signal;
  // The last status Replicate reported, so a deadline says which phase it hit.
  let lastStatus = "starting";

  try {
    const headers = () => ({
      Authorization: `Token ${options.token}`,
      "Content-Type": "application/json",
      Prefer: preferWait(deadline),
    });

    const rateLimitAttempts = Math.max(1, Math.min(3, options.rateLimitAttempts || 3));
    // Community models (the default is one) have no model-level predictions
    // endpoint, so posting there first cost a second prediction request per
    // photo. Under Replicate's low-credit limit (one request at a time) that
    // second request was always throttled and the photo lookup never ran.
    // Post one prediction at a known version: the pinned one for the default
    // model (no lookup at all), otherwise the latest, looked up once per
    // instance. The model-level endpoint stays as the last fallback.
    const resolved = await resolveVersion(model, options.token, signal);
    let knownVersion = resolved.version;
    const predictWith = (version: string | null) => version
      ? createPrediction("https://api.replicate.com/v1/predictions", () => ({
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ version, input }),
        signal,
      }), rateLimitAttempts, deadline)
      : createPrediction(`https://api.replicate.com/v1/models/${modelPath}/predictions`, () => ({
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ input }),
        signal,
      }), rateLimitAttempts, deadline);
    let response = await predictWith(knownVersion);
    // A pinned version Replicate no longer accepts (removed, or a typo in
    // the pin): use the latest version for this instance rather than stop
    // Morph ID's photo matching, and say so in the logs. Any other refusal
    // (a bad photo URL) is that photo's error and leaves the pin alone.
    if (resolved.source === "pinned" && await refusedVersion(response)) {
      console.warn(`Replicate refused pinned version ${knownVersion} of ${model} (${response.status}); using its latest version. Update PINNED_VISUAL_EMBEDDING_VERSIONS.`);
      refusedPins.add(model);
      knownVersion = await latestVersion(model, options.token, signal);
      response = await predictWith(knownVersion);
    }
    if (!knownVersion && (response.status === 404 || response.status === 422)) {
      throw new Error(`Replicate ${response.status}: model "${model}" has no resolvable version`);
    }
    if (!response.ok) {
      throw new Error(`Replicate ${response.status}: ${(await response.text()).slice(0, 400)}`);
    }

    const created: ReplicatePrediction = await response.json();
    lastStatus = created.status || lastStatus;
    const prediction = await waitForPrediction(
      created,
      options.token,
      deadline ?? Date.now() + (options.timeoutMs ?? 55_000),
      signal,
    );
    lastStatus = prediction.status || lastStatus;
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(`Replicate prediction ${prediction.status}: ${String(prediction.error || "unknown error")}`);
    }
    // Replicate boots the model on the first request after it goes idle, which
    // can outlast the wait (2 of 220 on run 17).
    if (prediction.status === "starting" || prediction.status === "processing") {
      if (options.signal?.aborted && !reachedDeadline) throw new EmbeddingCanceledError();
      throw new EmbeddingTimeoutError(prediction.status === "starting" ? "starting" : "running");
    }
    const raw = extractEmbedding(prediction.output);
    if (!raw) throw new Error("Unrecognized Replicate embedding output shape");
    const embedding = normalizeEmbedding(raw);
    if (
      embedding.length !== VISUAL_EMBEDDING_DIMENSION ||
      embedding.some((value) => !Number.isFinite(value))
    ) {
      throw new Error(`Embedding model returned an invalid ${embedding.length}-dimension vector`);
    }
    return { embedding, model, version: knownVersion };
  } catch (err) {
    if (err instanceof EmbeddingTimeoutError || err instanceof EmbeddingCanceledError) throw err;
    // A fetch cut off by the deadline or by the caller rejects with an
    // AbortError; say which.
    if (reachedDeadline) throw new EmbeddingTimeoutError(lastStatus === "processing" ? "running" : "starting");
    if (options.signal?.aborted) throw new EmbeddingCanceledError();
    throw err;
  } finally {
    if (timer != null) clearTimeout(timer);
    options.signal?.removeEventListener("abort", stop);
  }
}
