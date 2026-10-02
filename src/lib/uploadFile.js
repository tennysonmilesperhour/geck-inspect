/**
 * uploadFile, client wrapper for Supabase Storage.
 *
 * Supabase Storage upload helper. Every image upload in
 * the app (profile photos, cover photos, gecko photos, reptile photos)
 * ultimately calls this, so it's the single source of truth for:
 *
 *   - which bucket we write to
 *   - how we name the key
 *   - what the returned object looks like
 *
 * Public API intentionally matches the original contract so no
 * caller has to change:
 *
 *   const { file_url } = await uploadFile({ file });
 *
 * Also exported as a named `uploadFile` and is re-exported by
 * src/integrations/Core.js as `UploadFile` for backwards compatibility.
 */
import { supabase } from '@/lib/supabaseClient';
import { getTierLimits, formatBytes } from '@/lib/tierLimits';
import { convertHeicForUpload, downscaleImage, isHeicFile } from '@/lib/imageResize';
import { imageStoragePath } from '@/lib/imageStoragePath';
import { loadUserProfile } from '@/lib/userProfile';

const BUCKET = 'geck-inspect-media';

/**
 * Best-effort fetch of the current user's total storage bytes. Returns
 * null on any failure (RPC missing, network, permissions), callers
 * must treat null as "unknown" and skip quota enforcement rather than
 * blocking the upload. This keeps client uploads working even when the
 * 20260507_storage_quota.sql migration hasn't been applied yet.
 */
export async function getUserStorageBytes() {
  try {
    const { data, error } = await supabase.rpc('get_user_storage_bytes');
    if (error) return null;
    return Number(data) || 0;
  } catch {
    return null;
  }
}

// The same signed-in user shape AuthContext builds (profile plus app
// store entitlements), so the storage quota uses the one plan resolver
// (resolveTier) and an app store subscriber is not held to the Free cap.
async function fetchCurrentUserProfile(authUser) {
  try {
    return (await loadUserProfile(authUser)) || {};
  } catch {
    return null;
  }
}

// Only allow real image types, SVG is excluded because it's scriptable.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

// The stored photo must be 10 MB or less. That is checked AFTER the
// resize below, because a large phone photo (often 12 MB or more) shrinks
// to well under 1 MB, so refusing the original turned away photos that
// would have fit. The original only has to pass a generous sanity cap so
// the browser is never asked to decode something absurd.
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB, after resizing
export const MAX_ORIGINAL_SIZE = 50 * 1024 * 1024; // 50 MB, before resizing

/**
 * Upload a File/Blob to the geck-inspect-media bucket and return a
 * public URL.
 *
 * @param {object} opts
 * @param {File|Blob} opts.file - the file to upload
 * @param {string}   [opts.folder='uploads'] - optional subfolder
 * @returns {Promise<{ file_url: string, path: string }>}
 */
export async function uploadFile({ file, folder = 'uploads' } = {}) {
  if (!file) {
    throw new Error('uploadFile: no file provided');
  }

  // HEIC/HEIF is converted to JPEG below. Some iOS pickers report an empty
  // MIME type, so the filename extension is also accepted for this format.
  if (!ALLOWED_MIME_TYPES.has(file.type) && !isHeicFile(file)) {
    throw new Error(
      `Unsupported file type "${file.type || 'unknown'}". Allowed: JPEG, PNG, WebP, GIF, AVIF, HEIC, HEIF.`
    );
  }

  if (file.size > MAX_ORIGINAL_SIZE) {
    throw new Error(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Choose a photo under 50 MB.`
    );
  }

  // Validate folder, must be a simple alphanumeric slug, no path traversal.
  if (!/^[a-zA-Z0-9_-]+$/.test(folder)) {
    throw new Error('Invalid upload folder name.');
  }

  // Convert iPhone HEIC/HEIF photos first, then downscale + WebP-encode
  // client-side before doing anything else with
  // the bytes. Everything past this point (quota math, key, upload) uses
  // the browser-safe resized file.
  const browserSafeFile = await convertHeicForUpload(file);
  const upload = await downscaleImage(browserSafeFile);

  // Size limit on what is actually stored. Resizing falls back to the
  // original when it cannot help (an animated GIF, a decode error), so a
  // file can still be too big here.
  if (upload.size > MAX_FILE_SIZE) {
    throw new Error(
      `Photo is too large (${(upload.size / 1024 / 1024).toFixed(1)} MB even after resizing). Maximum allowed: 10 MB.`
    );
  }

  // Namespace by user ID (UUID) so public URLs don't leak emails.
  const { data: { user } } = await supabase.auth.getUser();
  const path = imageStoragePath(user?.id, upload.type, folder);

  // Tier-based storage quota. Best effort, if either query fails we
  // fall through to the upload rather than block the user (the
  // migration may not yet be applied, or the network may be flaky).
  if (user) {
    const [profile, usedBytes] = await Promise.all([
      fetchCurrentUserProfile(user),
      getUserStorageBytes(),
    ]);
    const limits = getTierLimits(profile);
    const limit = limits.maxStorageBytes;
    if (limit != null && usedBytes != null && usedBytes + upload.size > limit) {
      throw new Error(
        `Storage quota reached: this upload would put you at ${formatBytes(usedBytes + upload.size)} of your ${formatBytes(limit)} (${limits.label}) limit. Upgrade your plan or delete some photos to continue.`,
      );
    }
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, upload, {
      contentType: upload.type || undefined,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(
      `Image upload failed: ${uploadError.message || 'unknown error'}`
    );
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const file_url = publicData?.publicUrl;
  if (!file_url) {
    throw new Error('Image uploaded but could not resolve public URL.');
  }

  return { file_url, path };
}

/**
 * Rewrite a stored public image URL to a width-constrained thumbnail via
 * Supabase Storage image transformations, for use in grids and feeds
 * that don't need the full-resolution original.
 *
 * Gated behind VITE_SUPABASE_IMAGE_TRANSFORM because image
 * transformations are a paid Supabase feature: if it isn't enabled on
 * the project, the /render/image/ URL 404s. With the flag unset (the
 * default) this returns the original URL unchanged, so it is safe to
 * adopt in components now and switch on later by flipping the env var.
 *
 * @param {string} url - a public URL previously returned by uploadFile
 * @param {{ width?: number, quality?: number }} [opts]
 * @returns {string} the (possibly transformed) URL
 */
export function transformImageUrl(url, { width, quality = 75 } = {}) {
  if (!url || typeof url !== 'string') return url;
  const enabled = import.meta?.env?.VITE_SUPABASE_IMAGE_TRANSFORM === 'true';
  if (!enabled || !width || !url.includes('/storage/v1/object/public/')) {
    return url;
  }
  const rendered = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = rendered.includes('?') ? '&' : '?';
  return `${rendered}${sep}width=${Math.round(width)}&quality=${quality}&resize=contain`;
}

// Default export too, in case someone does `import uploadFile from ...`
export default uploadFile;
