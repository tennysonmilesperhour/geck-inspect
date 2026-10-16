// The share card id format and the query parameter a card link carries.
//
// Kept apart from morphShareCard.js because every page reads ?ms= on
// load (src/lib/morphShareRef.js), and importing the card module for
// these three lines also pulled the whole Morph ID taxonomy (about 26 KB)
// into the script every visitor downloads first. morphShareCard.js
// re-exports them, so its callers (and api/morph-share.js) are unchanged.
export const SHARE_ID_PATTERN = /^[0-9a-f]{16}$/;
// The query parameter a share link carries to the sign-up form.
export const SHARE_REF_PARAM = 'ms';

export function isShareId(value) {
  return typeof value === 'string' && SHARE_ID_PATTERN.test(value);
}
