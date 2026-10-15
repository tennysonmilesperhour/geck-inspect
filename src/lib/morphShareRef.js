// Which Morph ID share card brought a visitor here.
//
// The public card page (api/morph-share.js) links to Morph ID and to the
// sign-up form with ?ms=<card id>. This file keeps that id for 30 days so
// a visitor who looks around, comes back the next evening and signs up is
// still credited to the card. On the new account's first session
// recordSignupIfNew (src/lib/activation.js) sends it to the database,
// which counts the sign-up on the card (once per account) and logs
// morph_share_signup. The id is forgotten only once that call goes
// through, so a call that failed is tried again on the next session.
//
// Only the card id is kept. Nothing here identifies a person.
import { isShareId, SHARE_REF_PARAM } from '@/lib/morphShareCard';

const STORAGE_KEY = 'geck_morph_share_ref_v1';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Read ?ms= off the address bar, keep it, and remove it from the URL. */
export function captureMorphShareRef(now = Date.now()) {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const id = url.searchParams.get(SHARE_REF_PARAM);
    if (!id) return null;
    url.searchParams.delete(SHARE_REF_PARAM);
    const search = url.searchParams.toString();
    window.history.replaceState(window.history.state, '', url.pathname + (search ? `?${search}` : '') + url.hash);
    if (!isShareId(id)) return null;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, at: now }));
    return id;
  } catch {
    return null;
  }
}

/** The card id this browser arrived from, if it is recent enough. */
export function getMorphShareRef(now = Date.now()) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isShareId(parsed?.id) || !Number.isFinite(parsed?.at) || now - parsed.at > MAX_AGE_MS) return null;
    return parsed.id;
  } catch {
    return null;
  }
}

export function clearMorphShareRef() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private window: nothing was stored
  }
}

/**
 * Credit a brand-new account to the card it came from. The database
 * decides whether it counts (new account, not the card's owner, once per
 * account). Best effort: a failure never blocks sign-up.
 */
export async function creditMorphShareSignup(client, shareId = getMorphShareRef()) {
  if (!client || !isShareId(shareId)) return false;
  try {
    const { data, error } = await client.rpc('record_morph_id_share_signup', { p_share_id: shareId });
    if (error) return false;
    clearMorphShareRef();
    return data === true;
  } catch {
    return false;
  }
}
