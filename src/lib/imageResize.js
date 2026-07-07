/**
 * Client-side image downscaling for uploads.
 *
 * Gecko photos are the app's dominant content and were being stored at
 * full camera resolution (up to the 10 MB cap) and served as-is, which
 * is the biggest storage + egress cost driver and a mobile LCP hazard.
 * This module downscales an image to a sane ceiling and re-encodes it to
 * WebP in the browser before it is ever uploaded.
 *
 * It is deliberately fail-safe: animated GIFs, already-small files,
 * non-DOM contexts (SSR/prerender), and any decode/encode error all fall
 * back to returning the original File untouched. Resizing must never
 * block an upload.
 */

export const RESIZE_DEFAULTS = {
  maxEdge: 1600, // longest side, in CSS pixels
  quality: 0.82, // WebP quality
  skipUnderBytes: 400 * 1024, // don't bother re-encoding small files that are already within maxEdge
};

/**
 * Pure helper: compute the target dimensions so the long edge is at most
 * maxEdge, preserving aspect ratio. Returns `scaled: false` when the
 * image is already within bounds.
 */
export function targetDimensions(width, height, maxEdge) {
  const longEdge = Math.max(width, height);
  if (!longEdge || longEdge <= maxEdge) {
    return { width, height, scaled: false };
  }
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  };
}

/**
 * Downscale + WebP-encode a File/Blob for upload. Returns a new File on
 * success, or the original file unchanged when resizing is skipped or
 * fails.
 *
 * @param {File|Blob} file
 * @param {object} [opts] - overrides for RESIZE_DEFAULTS
 * @returns {Promise<File|Blob>}
 */
export async function downscaleImage(file, opts = {}) {
  const { maxEdge, quality, skipUnderBytes } = { ...RESIZE_DEFAULTS, ...opts };

  // Not an image, or an animated GIF (canvas would flatten it to one
  // frame): leave it alone.
  if (!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  // Browser-only. In prerender/SSR or any environment without the canvas
  // and bitmap APIs, return the original untouched.
  if (
    typeof document === 'undefined' ||
    typeof createImageBitmap === 'undefined' ||
    typeof HTMLCanvasElement === 'undefined'
  ) {
    return file;
  }

  try {
    // `imageOrientation: 'from-image'` bakes in EXIF rotation so portrait
    // phone photos don't upload sideways.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height, scaled } = targetDimensions(bitmap.width, bitmap.height, maxEdge);

    // Already small enough in both dimensions and bytes: keep the original.
    if (!scaled && file.size <= skipUnderBytes) {
      bitmap.close?.();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
    if (!blob) return file;

    // If the re-encode didn't actually shrink an unscaled image, keep the
    // original (avoids bloating tiny PNGs into larger WebPs).
    if (!scaled && blob.size >= file.size) return file;

    const newName = `${(file.name || 'image').replace(/\.[a-zA-Z0-9]+$/, '')}.webp`;
    return new File([blob], newName, {
      type: 'image/webp',
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    // Any decode/encode failure: upload the original rather than fail.
    return file;
  }
}
