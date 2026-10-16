/**
 * Photo thumbnails: a small copy of every member photo, stored beside it.
 *
 * Why: gecko cards, lists and lineage nodes show photos 40 to 240 pixels
 * wide, but they were loading the full photo (up to 1600 pixels, and
 * several megabytes for photos from before the in-browser resize). That
 * cost members data and slowed every collection page on a phone.
 *
 * How (the free route): uploadFile() makes a second, small copy in the
 * member's browser right after the photo itself uploads, and stores it at
 * `thumbs/<the photo's own path>` in the same public bucket. Because the
 * thumbnail's address follows from the photo's address, no database
 * column records it: thumbnailUrl() works it out. Photos uploaded before
 * thumbnails existed get theirs from the admin panel (Photo thumbnails),
 * which does the same resize in the admin's browser.
 *
 * A missing thumbnail is never shown as broken: SmartImage and GeckoImage
 * try the thumbnail first and quietly fall back to the photo itself.
 */

/**
 * The thumbnail size. 480 pixels on the long side covers the largest
 * card the app shows on a phone (about 240 CSS pixels wide) at twice the
 * pixel density, and WebP at 0.75 keeps one to about 20 to 40 KB.
 *
 * Supabase's paid image transformations would resize on request instead
 * of storing a copy. Tennyson chose the free route in October 2026, when
 * the bucket held about 800 member photos. Revisit paid resizing once it
 * passes about 5,000 member photos: by then the stored copies, the
 * backfill and the single fixed size start to cost more than the add-on.
 */
export const THUMBNAIL = Object.freeze({ maxEdge: 480, quality: 0.75 });

/** The public bucket every member photo is uploaded to (uploadFile.js). */
export const MEDIA_BUCKET = 'geck-inspect-media';

/** Folder, inside MEDIA_BUCKET, that holds every thumbnail. */
export const THUMBNAIL_PREFIX = 'thumbs/';

const PUBLIC_PREFIX = `/storage/v1/object/public/${MEDIA_BUCKET}/`;

// Animated GIFs get no thumbnail: a canvas keeps only the first frame,
// and a still in a card would look broken next to the moving original.
// Their small displays load the GIF itself.
const NO_THUMBNAIL = /\.gif$/i;

/**
 * Storage path of the thumbnail for a photo's storage path, or null when
 * that photo has no thumbnail (a GIF, an empty or unsafe path, or a path
 * that is itself a thumbnail).
 *
 *   uploads/<member>/<id>.webp  ->  thumbs/uploads/<member>/<id>.webp
 *
 * The name keeps the photo's extension even when the thumbnail is WebP:
 * the stored content type, not the name, is what browsers go by, and an
 * unchanged name means two photos can never share a thumbnail.
 */
export function thumbnailStoragePath(path) {
  if (typeof path !== 'string') return null;
  const clean = path.replace(/^\/+/, '');
  if (!clean || clean.startsWith(THUMBNAIL_PREFIX) || NO_THUMBNAIL.test(clean)) return null;
  if (clean.split('/').some((part) => part === '' || part === '.' || part === '..')) return null;
  return `${THUMBNAIL_PREFIX}${clean}`;
}

function configuredOrigin(supabaseUrl) {
  try {
    return supabaseUrl ? new URL(supabaseUrl).origin : null;
  } catch {
    return null;
  }
}

/**
 * Public address of a photo's thumbnail, worked out from the photo's
 * public address. Returns null for anything that has no thumbnail: other
 * buckets, other hosts, data: and blob: addresses, the bundled gecko
 * placeholders, GIFs, and addresses that already point at a thumbnail.
 *
 * @param {string} originalUrl: a public URL returned by uploadFile()
 * @param {{ supabaseUrl?: string }} [opts]: the project URL (defaults to
 *   VITE_SUPABASE_URL; tests pass their own)
 * @returns {string|null}
 */
export function thumbnailUrl(originalUrl, { supabaseUrl = import.meta.env?.VITE_SUPABASE_URL } = {}) {
  if (typeof originalUrl !== 'string' || !originalUrl) return null;
  const origin = configuredOrigin(supabaseUrl);
  if (!origin) return null;
  let url;
  try {
    url = new URL(originalUrl);
  } catch {
    return null; // relative paths, such as the bundled placeholders
  }
  if (url.origin !== origin) return null;
  if (!url.pathname.startsWith(PUBLIC_PREFIX)) return null;
  // The path stays percent-encoded exactly as the photo's URL had it.
  const thumbPath = thumbnailStoragePath(url.pathname.slice(PUBLIC_PREFIX.length));
  return thumbPath ? `${origin}${PUBLIC_PREFIX}${thumbPath}` : null;
}

/**
 * The addresses a small photo slot should try, in order: the thumbnail
 * (when the slot needs no more than THUMBNAIL.maxEdge image pixels and
 * the photo has one), then the photo itself. Callers show their
 * placeholder after the last one fails. A slot with no width, or a wider
 * one, gets the photo only, so full-size views never load a thumbnail.
 *
 * @param {string} src: the photo's URL
 * @param {number} [width]: image pixels the slot needs across, the same
 *   number SmartImage's `width` prop takes (about twice the slot's CSS
 *   width, so it stays sharp on a phone screen)
 * @returns {string[]}
 */
export function thumbnailFirst(src, width) {
  if (typeof src !== 'string' || !src.trim()) return [];
  const small = Number.isFinite(width) && width > 0 && width <= THUMBNAIL.maxEdge;
  const thumb = small ? thumbnailUrl(src) : null;
  return thumb ? [thumb, src] : [src];
}
