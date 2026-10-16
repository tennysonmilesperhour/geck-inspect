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

async function latestVersion(model: string, token: string): Promise<string | null> {
  const cached = versionCache.get(model);
  if (cached) return cached;
  const response = await fetch(`https://api.replicate.com/v1/models/${model}`, {
    headers: { Authorization: `Token ${token}` },
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
): Promise<{ version: string | null; source: "explicit" | "pinned" | "latest" }> {
  const colon = model.indexOf(":");
  if (colon !== -1) return { version: model.slice(colon + 1), source: "explicit" };
  const pinned = PINNED_VISUAL_EMBEDDING_VERSIONS[model];
  if (pinned && !refusedPins.has(model)) return { version: pinned, source: "pinned" };
  return { version: await latestVersion(model, token), source: "latest" };
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

async function waitForPrediction(
  prediction: ReplicatePrediction,
  token: string,
  timeoutMs = 55_000,
): Promise<ReplicatePrediction> {
  if (prediction.output != null || prediction.status === "succeeded") return prediction;
  const pollUrl = prediction.urls?.get;
  if (!pollUrl) return prediction;

  const deadline = Date.now() + timeoutMs;
  let current = prediction;
  while (["starting", "processing"].includes(current.status || "") && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    const response = await fetch(pollUrl, {
      headers: { Authorization: `Token ${token}` },
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
  init: RequestInit,
  attempts = 3,
): Promise<Response> {
  let response: Response | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    response = await fetch(url, init);
    if (response.status !== 429 || attempt === attempts) return response;

    let retrySeconds = Number(response.headers.get("retry-after")) || 0;
    if (!retrySeconds) {
      const detail = await response.clone().json().catch(() => ({}));
      retrySeconds = Number(detail?.retry_after) || 10;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(15, Math.max(1, retrySeconds)) * 1_000)
    );
  }
  return response!;
}

export async function createVisualEmbedding(
  imageUrl: string,
  options: {
    token: string;
    model?: string;
    timeoutMs?: number;
    rateLimitAttempts?: number;
  },
): Promise<{ embedding: number[]; model: string; version: string | null }> {
  const model = options.model || DEFAULT_VISUAL_EMBEDDING_MODEL;
  const modelPath = model.includes(":") ? model.split(":")[0] : model;
  const headers = {
    Authorization: `Token ${options.token}`,
    "Content-Type": "application/json",
    Prefer: "wait=60",
  };
  const input = { image: imageUrl };

  const rateLimitAttempts = Math.max(1, Math.min(3, options.rateLimitAttempts || 3));
  // Community models (the default is one) have no model-level predictions
  // endpoint, so posting there first cost a second prediction request per
  // photo. Under Replicate's low-credit limit (one request at a time) that
  // second request was always throttled and the photo lookup never ran.
  // Post one prediction at a known version: the pinned one for the default
  // model (no lookup at all), otherwise the latest, looked up once per
  // instance. The model-level endpoint stays as the last fallback.
  const resolved = await resolveVersion(model, options.token);
  let knownVersion = resolved.version;
  const predictWith = (version: string | null) => version
    ? createPrediction("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers,
      body: JSON.stringify({ version, input }),
    }, rateLimitAttempts)
    : createPrediction(`https://api.replicate.com/v1/models/${modelPath}/predictions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ input }),
    }, rateLimitAttempts);
  let response = await predictWith(knownVersion);
  // A pinned version Replicate no longer accepts (removed, or a typo in
  // the pin): use the latest version for this instance rather than stop
  // Morph ID's photo matching, and say so in the logs. Any other refusal
  // (a bad photo URL) is that photo's error and leaves the pin alone.
  if (resolved.source === "pinned" && await refusedVersion(response)) {
    console.warn(`Replicate refused pinned version ${knownVersion} of ${model} (${response.status}); using its latest version. Update PINNED_VISUAL_EMBEDDING_VERSIONS.`);
    refusedPins.add(model);
    knownVersion = await latestVersion(model, options.token);
    response = await predictWith(knownVersion);
  }
  if (!knownVersion && (response.status === 404 || response.status === 422)) {
    throw new Error(`Replicate ${response.status}: model "${model}" has no resolvable version`);
  }
  if (!response.ok) {
    throw new Error(`Replicate ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }

  const prediction = await waitForPrediction(
    await response.json(),
    options.token,
    options.timeoutMs,
  );
  if (prediction.status === "failed" || prediction.status === "canceled") {
    throw new Error(`Replicate prediction ${prediction.status}: ${String(prediction.error || "unknown error")}`);
  }
  // Replicate boots the model on the first request after it goes idle, which
  // can outlast the wait (2 of 220 on run 17).
  if (prediction.status === "starting" || prediction.status === "processing") {
    throw new Error(`Replicate timed out while the embedding model was ${prediction.status === "starting" ? "starting up" : "running"}`);
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
}
