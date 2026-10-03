// Shared, side-effect-free helpers for the Promote publish path
// (publish-social-post). Kept here so vitest can cover them.
//
// Decision D8 (feature-completeness audit): Promote is Bluesky direct
// posting plus copy-out for every other platform. Facebook and Instagram
// direct posting stays off until Meta's App Review passes, and Reddit
// posting stays off with it. The server code for those platforms is kept
// so turning them back on is a one-line change here, not a rewrite.

export const DIRECT_POST_PLATFORMS: ReadonlySet<string> = new Set(["bluesky"]);

export function isDirectPlatform(platform: string): boolean {
  return DIRECT_POST_PLATFORMS.has(platform);
}

// A copy-out never spends a post credit or a monthly included post: the
// member only copied text, nothing was posted for them.
export function shouldChargePublish(
  { statusOnSuccess, isAdmin }: { statusOnSuccess: "published" | "copied"; isAdmin: boolean },
): boolean {
  return statusOnSuccess === "published" && !isAdmin;
}

export interface ConnectionRow {
  id: string;
  updated_date?: string | null;
  created_date?: string | null;
  last_used_at?: string | null;
  [key: string]: unknown;
}

// A member can hold several active rows for one platform (two Facebook
// Pages, or two Bluesky handles). The old code read them with maybeSingle,
// which errors on more than one row, so publishing reported "not
// connected". Pick the requested connection when the client names one,
// otherwise the most recently updated row.
export function pickConnection<T extends ConnectionRow>(
  rows: T[] | null | undefined,
  connectionId?: string | null,
): T | null {
  const list = (rows || []).filter(Boolean);
  if (list.length === 0) return null;
  if (connectionId) {
    return list.find((r) => r.id === connectionId) || null;
  }
  const stamp = (r: T) => Date.parse(String(r.updated_date || r.created_date || "")) || 0;
  return [...list].sort((a, b) => stamp(b) - stamp(a))[0];
}

// Members paste handles as "@name.bsky.social", "name.bsky.social" or a
// full profile link. createSession wants the bare handle (or an email).
export function normalizeBlueskyHandle(raw: string): string {
  let h = String(raw || "").trim();
  h = h.replace(/^https?:\/\/(www\.)?bsky\.app\/profile\//i, "");
  h = h.replace(/\/.*$/, "");
  h = h.replace(/^@/, "");
  return h.toLowerCase();
}

export const BLUESKY_MAX_GRAPHEMES = 300;

function graphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    return Array.from(new Seg("en", { granularity: "grapheme" }).segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

// Bluesky counts its 300 limit in graphemes (what a person sees as one
// character, so an emoji counts once). Trim on a word boundary when one
// is close, and end with an ellipsis so the cut is visible.
export function trimForBluesky(text: string, max = BLUESKY_MAX_GRAPHEMES): string {
  const g = graphemes(text);
  if (g.length <= max) return text;
  let cut = g.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > max - 40) cut = cut.slice(0, lastSpace);
  return cut.join("").trimEnd() + "…";
}

interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: Array<Record<string, string>>;
}

const encoder = new TextEncoder();
function byteOffset(text: string, charIndex: number): number {
  return encoder.encode(text.slice(0, charIndex)).length;
}

// Rich text facets make hashtags and links clickable on Bluesky. Without
// them they show as plain text. Offsets are UTF-8 byte positions.
export function blueskyFacets(text: string): Facet[] {
  const facets: Facet[] = [];
  const urlRe = /https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g;
  const linkRanges: Array<[number, number]> = [];
  for (const m of text.matchAll(urlRe)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    linkRanges.push([start, end]);
    facets.push({
      index: { byteStart: byteOffset(text, start), byteEnd: byteOffset(text, end) },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }],
    });
  }
  const tagRe = /(^|\s)#([\p{L}\p{N}_]*[\p{L}_][\p{L}\p{N}_]*)/gu;
  for (const m of text.matchAll(tagRe)) {
    const start = (m.index ?? 0) + m[1].length;
    const end = start + 1 + m[2].length;
    if (linkRanges.some(([a, b]) => start >= a && start < b)) continue;
    if (m[2].length > 64) continue;
    facets.push({
      index: { byteStart: byteOffset(text, start), byteEnd: byteOffset(text, end) },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: m[2] }],
    });
  }
  return facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
}

export function blueskyPostRecord(text: string, now = new Date()) {
  const trimmed = trimForBluesky(text);
  const facets = blueskyFacets(trimmed);
  return {
    $type: "app.bsky.feed.post",
    text: trimmed,
    createdAt: now.toISOString(),
    langs: ["en"],
    ...(facets.length > 0 ? { facets } : {}),
  };
}
