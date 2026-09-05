export const VISUAL_EMBEDDING_DIMENSION = 768;
export const DEFAULT_VISUAL_EMBEDDING_MODEL = "krthr/clip-embeddings";

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

async function resolveVersion(model: string, token: string): Promise<string | null> {
  const colon = model.indexOf(":");
  if (colon !== -1) return model.slice(colon + 1);
  const response = await fetch(`https://api.replicate.com/v1/models/${model}`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!response.ok) return null;
  const body = await response.json();
  return body?.latest_version?.id || null;
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
): Promise<{ embedding: number[]; model: string }> {
  const model = options.model || DEFAULT_VISUAL_EMBEDDING_MODEL;
  const modelPath = model.includes(":") ? model.split(":")[0] : model;
  const headers = {
    Authorization: `Token ${options.token}`,
    "Content-Type": "application/json",
    Prefer: "wait=60",
  };
  const input = { image: imageUrl };

  const rateLimitAttempts = Math.max(1, Math.min(3, options.rateLimitAttempts || 3));
  let response = await createPrediction(`https://api.replicate.com/v1/models/${modelPath}/predictions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ input }),
  }, rateLimitAttempts);
  if (response.status === 404 || response.status === 422) {
    const version = await resolveVersion(model, options.token);
    if (!version) {
      throw new Error(
        `Replicate ${response.status}: model "${model}" has no resolvable version`,
      );
    }
    response = await createPrediction("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers,
      body: JSON.stringify({ version, input }),
    }, rateLimitAttempts);
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
  const raw = extractEmbedding(prediction.output);
  if (!raw) throw new Error("Unrecognized Replicate embedding output shape");
  const embedding = normalizeEmbedding(raw);
  if (
    embedding.length !== VISUAL_EMBEDDING_DIMENSION ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(`Embedding model returned an invalid ${embedding.length}-dimension vector`);
  }
  return { embedding, model };
}
