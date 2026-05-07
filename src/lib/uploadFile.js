/**
 * uploadFile — client wrapper for Supabase Storage.
 *
 * Replaces the dead Base44 `UploadFile` shim. Every image upload in
 * the app (profile photos, cover photos, gecko photos, reptile photos)
 * ultimately calls this, so it's the single source of truth for:
 *
 *   - which bucket we write to
 *   - how we name the key
 *   - what the returned object looks like
 *
 * Public API intentionally matches the old Base44 contract so no
 * caller has to change:
 *
 *   const { file_url } = await uploadFile({ file });
 *
 * Also exported as a named `uploadFile` and is re-exported by
 * src/integrations/Core.js as `UploadFile` for backwards compatibility.
 */
import { supabase } from '@/lib/supabaseClient';
import { getTierLimits, formatBytes } from '@/lib/tierLimits';

const BUCKET = 'geck-inspect-media';

/**
 * Best-effort fetch of the current user's total storage bytes. Returns
 * null on any failure (RPC missing, network, permissions) — callers
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

async function fetchCurrentUserProfile() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('membership_tier, subscription_status')
      .eq('id', user.id)
      .maybeSingle();
    return profile || {};
  } catch {
    return null;
  }
}

// Only allow real image types — SVG is excluded because it's scriptable.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Turn a filename into a safe storage key fragment.
function safeFileName(name) {
  return (name || 'upload')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'upload';
}

function extensionFor(file) {
  const name = file?.name || '';
  const match = name.match(/\.([a-zA-Z0-9]+)$/);
  if (match) return match[1].toLowerCase();
  if (file?.type?.startsWith('image/')) {
    return file.type.slice(6).split('+')[0].toLowerCase() || 'jpg';
  }
  return 'bin';
}

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

  // Validate MIME type — reject anything that isn't an allowed image format.
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported file type "${file.type || 'unknown'}". Allowed: JPEG, PNG, WebP, GIF, AVIF.`
    );
  }

  // Validate file size — reject uploads larger than 10 MB.
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed: 10 MB.`
    );
  }

  // Validate folder — must be a simple alphanumeric slug, no path traversal.
  if (!/^[a-zA-Z0-9_-]+$/.test(folder)) {
    throw new Error('Invalid upload folder name.');
  }

  // Namespace by user ID (UUID) so public URLs don't leak emails.
  const { data: { user } } = await supabase.auth.getUser();
  const ownerSlug = user?.id || 'public';

  // Tier-based storage quota. Best effort — if either query fails we
  // fall through to the upload rather than block the user (the
  // migration may not yet be applied, or the network may be flaky).
  if (user) {
    const [profile, usedBytes] = await Promise.all([
      fetchCurrentUserProfile(),
      getUserStorageBytes(),
    ]);
    const limits = getTierLimits(profile);
    const limit = limits.maxStorageBytes;
    if (limit != null && usedBytes != null && usedBytes + file.size > limit) {
      throw new Error(
        `Storage quota reached: this upload would put you at ${formatBytes(usedBytes + file.size)} of your ${formatBytes(limit)} (${limits.label}) limit. Upgrade your plan or delete some photos to continue.`,
      );
    }
  }

  const ext = extensionFor(file);
  const baseName = safeFileName((file.name || 'upload').replace(/\.[a-zA-Z0-9]+$/, ''));
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${folder}/${ownerSlug}/${stamp}-${baseName}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || undefined,
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

// Default export too, in case someone does `import uploadFile from ...`
export default uploadFile;
