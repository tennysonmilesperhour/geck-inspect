// Notification links come from database rows. A member could once write
// their own notification rows, and the database guard only checked that a
// link started with "/". A protocol-relative link such as "//other-site.com"
// passes that check, and both the router and the browser treat it as a
// different website. Only a single leading slash followed by something
// other than "/" or "\" is a path inside Geck Inspect.
const INTERNAL_PATH = /^\/(?![/\\])[^\s]*$/;

export function safeInternalPath(link, fallback = '/') {
  if (typeof link !== 'string') return fallback;
  const trimmed = link.trim();
  return INTERNAL_PATH.test(trimmed) ? trimmed : fallback;
}
