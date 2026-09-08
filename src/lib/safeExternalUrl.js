// External navigation must never interpret a stored URL as executable code.
export function safeExternalUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function openExternalUrl(value, features = 'noopener,noreferrer') {
  const url = safeExternalUrl(value);
  if (url) window.open(url, '_blank', features);
}
