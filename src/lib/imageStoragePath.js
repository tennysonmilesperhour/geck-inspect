const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export function imageStoragePath(ownerId, mimeType, folder) {
  if (typeof ownerId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(ownerId)) {
    throw new Error('Sign in before uploading images.');
  }
  if (folder !== undefined && (typeof folder !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(folder))) {
    throw new Error('Invalid upload folder name.');
  }
  const extension = Object.hasOwn(EXTENSIONS, mimeType) ? EXTENSIONS[mimeType] : null;
  if (!extension) throw new Error('Unsupported image type. Use JPEG, PNG, WebP, GIF, or AVIF.');
  const key = `${ownerId}/${crypto.randomUUID()}.${extension}`;
  return folder === undefined ? key : `${folder}/${key}`;
}
