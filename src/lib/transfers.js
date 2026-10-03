import { supabase } from '@/lib/supabaseClient';

/**
 * Ownership transfers: the seller starts one, the buyer gets an email with a
 * claim link, and the buyer claims it on /claim/:token.
 *
 * The rows live in transfer_requests. The seller can read, update and delete
 * their own rows (RLS keys on created_by); the claim itself runs server side
 * in claim_transfer().
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
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://geckinspect.com');
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

/** A pending transfer whose link has run out counts as expired. */
export function effectiveTransferStatus(transfer, now = new Date()) {
  if (!transfer) return 'pending';
  if (transfer.status === 'pending' && transfer.expires_at && new Date(transfer.expires_at) < now) {
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
    // The insert rule needs created_by to be the signed-in user; the
    // animal's creator may be a collaborator.
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
 * Create the transfer and email the buyer. Throws on a failed insert;
 * returns { token, claimUrl, emailed }.
 */
export async function startTransfer({ animalId, animalType = 'gecko', toEmail, salePrice, message }) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.id) {
    throw new Error('You need to be signed in to transfer ownership.');
  }
  const token = crypto.randomUUID();
  const row = buildTransferRow({
    animalId,
    animalType,
    userId: authData.user.id,
    userEmail: authData.user.email,
    toEmail,
    salePrice,
    message,
    token,
  });
  const { error } = await supabase.from('transfer_requests').insert(row);
  if (error) throw error;
  const email = await sendTransferEmail(token);
  return { token, claimUrl: claimUrlFor(token), emailed: email.delivered };
}

/** Cancel a pending transfer the signed-in user sent. */
export async function cancelTransfer(transferId) {
  const { error } = await supabase
    .from('transfer_requests')
    .update({ status: 'cancelled', updated_date: new Date().toISOString() })
    .eq('id', transferId)
    .eq('status', 'pending');
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
