// Warming the photo-matching model while a member picks photos.
//
// Morph ID embeds the member's top view with krthr/clip-embeddings on
// Replicate. It is a public community model, so Replicate shuts it down when
// nobody has used it for a while, and the next request waits 35 to 75 s for
// it to boot. In October 2026 that boot was behind every Morph ID run of 100 s
// or more (the 6 Oct member, the 13, 15 and 16 Oct canaries).
//
// So the Morph ID page sends { action: "warm" } when it opens and when the
// member picks the top view (src/lib/morphIdWarmup.js), and the function
// asks Replicate to embed a fixed photo the project owns. No member photo
// leaves the browser for this: the AI consent prompt still comes at Identify.
// By the time the member taps Identify, the model is usually awake.
//
// Kept apart from index.ts (Deno URL imports) so vitest can test it
// (src/lib/__tests__/morphWarmup.test.js).
import { PINNED_VISUAL_EMBEDDING_VERSIONS } from "./visual-embedding.ts";

export const WARM_ACTION = "warm";
// The surface the warm-up's zero-cost row is logged under in
// geck_data.model_invocations. The per-network daily cap counts only
// morph_id_production rows, so warm-ups never use it up.
export const WARM_SURFACE = "morph_id_warm";
// At most one warm-up a minute across all members: Replicate keeps a model
// up for a few minutes after a prediction, so more would only add cost.
export const WARM_MIN_GAP_MS = 60_000;
// A Morph Guide demo photo the project owns and serves from public/
// (public/demo-geckos/README.md). Replicate only needs something to embed;
// the answer is thrown away. MORPH_WARM_IMAGE_URL overrides it.
export const DEFAULT_WARM_IMAGE_URL = "https://geckinspect.com/demo-geckos/blush.webp";

export function isWarmRequest(body: unknown): boolean {
  return !!body && typeof body === "object" && (body as { action?: unknown }).action === WARM_ACTION;
}

/** The Replicate version to warm: an explicit "owner/model:version", or the pin. */
export function warmVersionFor(model: string): string | null {
  const colon = model.indexOf(":");
  if (colon !== -1) return model.slice(colon + 1) || null;
  return PINNED_VISUAL_EMBEDDING_VERSIONS[model] ?? null;
}

/**
 * The warm-up request, or null when the body is not a warm-up or the model
 * has no known version. It embeds only `imageUrl`, the project's own photo:
 * nothing in the body (photo URLs included) is read. There is no Prefer
 * header, so Replicate answers as soon as it has queued the prediction
 * instead of holding the request open while the model boots.
 */
export function buildWarmRequest(
  body: unknown,
  options: { token: string; model: string; imageUrl: string },
): { url: string; init: RequestInit } | null {
  if (!isWarmRequest(body)) return null;
  const version = warmVersionFor(options.model);
  if (!version) return null;
  return {
    url: "https://api.replicate.com/v1/predictions",
    init: {
      method: "POST",
      headers: {
        Authorization: `Token ${options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ version, input: { image: options.imageUrl } }),
    },
  };
}

/**
 * Whether to send a warm-up now, given when the newest one went out
 * (called_at of the newest morph_id_warm row, or nothing).
 */
export function shouldWarm(
  lastWarmAt: string | null | undefined,
  now: number,
  minGapMs: number = WARM_MIN_GAP_MS,
): boolean {
  if (!lastWarmAt) return true;
  const last = Date.parse(lastWarmAt);
  if (!Number.isFinite(last)) return true;
  return now - last >= minGapMs;
}
