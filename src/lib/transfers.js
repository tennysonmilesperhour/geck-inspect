import { supabase } from '@/lib/supabaseClient';

/**
 * Ownership transfers: the owner creates a QR or email claim link, and the
 * recipient accepts it on /claim/:token.
 *
 * The rows live in transfer_requests. Only the animal's owner can start or
 * change one (RLS plus the guard_transfer_request trigger); the seller can
 * read, cancel and delete their own rows. The claim itself runs server side
 * in claim_transfer(), which checks again that the seller still owns the
 * animal.
 */

export const TRANSFER_TTL_HOURS = 72;

// Simple shape check. The server is the real judge (the claim only works for
// someone signed in with this exact address); this catches typos early.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim());
}

/**
 * Parse the sale price box. Blank means "no price". Returns
 * { ok: true, value } or { ok: false }.
 */
export function parseSalePrice(raw) {
  const text = String(raw ?? '').trim().replace(/[$,\s]/g, '');
  if (text === '') return { ok: true, value: null };
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export function claimUrlFor(token, origin) {
  // A native WebView's capacitor://localhost or https://localhost address
  // cannot be opened by a recipient. QR links must leave the native app.
  const native = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
  const base = origin || (!native && typeof window !== 'undefined' ? window.location.origin : 'https://geckinspect.com');
  return `${base}/claim/${token}`;
}

/**
 * Normalize the get_transfer_preview() result into the shape the claim page
 * renders, for a gecko or another reptile. The preview carries the name,
 * first photo and morph, so this works even when the animal is private.
 */
export function animalFromPreview(tr) {
  if (!tr) return null;
  const isReptile = tr.animal_type === 'other_reptile';
  return {
    isReptile,
    name: tr.animal_name || (isReptile ? 'Your new reptile' : 'Your new gecko'),
    subtitle: tr.animal_subtitle || (isReptile ? 'Reptile' : 'Crested Gecko'),
    image_urls: tr.animal_image ? [tr.animal_image] : [],
    passport_code: isReptile ? null : (tr.passport_code || null),
    emoji: '🦎',
    collectionPath: isReptile ? '/OtherReptiles' : '/MyGeckos',
    successHeading: isReptile ? 'Welcome to your new reptile!' : 'Welcome to your new gecko!',
  };
}

/**
 * Turn a claim_transfer() error into the claim page's message key. The
 * server raises short fixed phrases; matching on them keeps the page in
 * step with the database without parsing codes.
 */
export function claimErrorKind(error) {
  const msg = String(error?.message || '').toLowerCase();
  const hint = String(error?.hint || '').toLowerCase();
  if (msg.includes('verif') || msg.includes('confirmed email')) return 'verify_email';
  if (msg.includes('own animal') || msg.includes('your own') || msg.includes('yourself')) return 'own_animal';
  if (msg.includes('sign in') || msg.includes('not authenticated')) return 'sign_in';
  if (msg.includes('already claimed')) return 'already_claimed';
  if (msg.includes('cancelled')) return 'cancelled';
  if (msg.includes('expired')) return 'expired';
  if (msg.includes('no longer owns')) return 'seller_changed';
  // The buyer's plan is full (the same check as adding a gecko).
  if (hint === 'gecko_limit_reached' || /holds up to \d+ active geckos/.test(msg)) return 'gecko_limit';
  if (msg.includes('not found')) return 'not_found';
  if (msg.includes('intended recipient')) return 'wrong_account';
  return 'claim_failed';
}

/** A pending transfer whose link has run out counts as expired. */
export function effectiveTransferStatus(transfer, now = new Date()) {
  if (!transfer) return 'pending';
  if (transfer.status === 'pending' && transfer.expires_at && new Date(transfer.expires_at) <= now) {
    return 'expired';
  }
  return transfer.status || 'pending';
}

/**
 * Build the transfer_requests row. Kept separate from the insert so the
 * shape can be tested without a database.
 */
export function buildTransferRow({ animalId, animalType = 'gecko', userId, userEmail, toEmail, salePrice, message, token, now = Date.now() }) {
  return {
    animal_id: animalId,
    animal_type: animalType,
    from_user_id: userId,
    to_email: String(toEmail || '').trim().toLowerCase(),
    token,
    sale_price: salePrice ?? null,
    message: String(message || '').trim() || null,
    // The insert rule needs created_by to be the signed-in user, and the
    // database also checks that this user owns the animal (collaborators
    // cannot transfer it). The buyer's claim checks ownership again.
    created_by: userEmail,
    expires_at: new Date(now + TRANSFER_TTL_HOURS * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Ask the server to email the buyer their claim link. Never throws: the
 * transfer row is the source of truth, and the seller can always copy the
 * link by hand. Returns { delivered: boolean, reason? }.
 */
export async function sendTransferEmail(token) {
  try {
    const { data, error } = await supabase.functions.invoke('send-collection-invite', {
      body: { kind: 'transfer', token },
    });
    if (error) return { delivered: false, reason: error.message };
    if (data?.delivered === 1) return { delivered: true };
    return { delivered: false, reason: data?.skipped || data?.error || 'unknown' };
  } catch (e) {
    return { delivered: false, reason: e?.message || 'network' };
  }
}

/**
 * Create a server-issued transfer, optionally emailing the buyer. Throws on failure;
 * returns { token, claimUrl, emailed }.
 */
export async function startTransfer({ animalId, animalType = 'gecko', toEmail, salePrice, message }) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.id) {
    throw new Error('You need to be signed in to transfer ownership.');
  }
  const { data, error } = await supabase.rpc('create_transfer', {
    p_animal_id: animalId,
    p_animal_type: animalType,
    p_to_email: String(toEmail || '').trim().toLowerCase() || null,
    p_sale_price: salePrice ?? null,
    p_message: String(message || '').trim() || null,
  });
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    throw new Error('Transfer links are temporarily unavailable. Please try again later.');
  }
  if (error) throw error;
  if (!data?.token) throw new Error('The transfer link could not be created. Please try again.');
  const email = toEmail ? await sendTransferEmail(data.token) : { delivered: false };
  return { ...data, claimUrl: claimUrlFor(data.token), emailed: email.delivered };

}

/** Cancel a pending transfer the signed-in user sent. */
export async function cancelTransfer(transferId) {
  const { error } = await supabase.rpc('revoke_transfer', { p_transfer_id: transferId });
  if (error) throw error;
}

/** Copy text to the clipboard; resolves true when it worked. */
export async function copyText(text) {
  try {
    if (!navigator?.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
