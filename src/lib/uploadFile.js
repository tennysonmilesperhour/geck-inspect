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

const BUCKET = 'geck-inspect-media';

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

  // Namespace by user email (if signed in) so policies + accounting
  // can tell who owns what. Falls back to "public" for anon uploads.
  const { data: { user } } = await supabase.auth.getUser();
  const ownerSlug = user?.email
    ? user.email.split('@')[0].replace(/[^a-zA-Z0-9._-]+/g, '-')
    : 'public';

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
