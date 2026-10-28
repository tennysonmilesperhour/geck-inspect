import { supabase } from '@/lib/supabaseClient';
import { captureEvent } from '@/lib/posthog';

/**
 * Ownership transfers: the owner creates a QR or email claim link, and the
 * recipient accepts it on /claim/:token. A buyer can also ask for one from
 * the gecko's passport page (requestPassportTransfer).
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

/**
 * What the transfer form's sale price box starts with: the price the gecko
 * was archived as sold for, else its asking price, else blank. The sold
 * price matters most: when the buyer accepts, the gecko row (and its sold
 * price) moves to them, so the transfer's sale price is the seller's only
 * record of the sale in Business Tools.
 */
export function transferPriceDefault(animal) {
  for (const value of [animal?.sold_price, animal?.asking_price]) {
    if (value === null || value === undefined || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return String(n);
  }
  return '';
}

const sameEmail = (a, b) =>
  Boolean(a) && Boolean(b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/**
 * Whether to offer "Send <name> to the buyer" right after a gecko is
 * archived as sold. Only the owner can transfer (the database refuses
 * anyone else, including collection editors), and the guest demo cannot
 * save anything.
 */
export function shouldOfferSoldTransfer({ gecko, user, reason, guest = false } = {}) {
  if (guest || reason !== 'sold' || !gecko?.id || !user?.email || user.is_guest) return false;
  return sameEmail(gecko.created_by, user.email);
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

/**
 * What a transfer preview means for the claim page: 'open' (it can be
 * accepted), 'claimed_by_you', or the error key for a closed link
 * ('already_claimed', 'cancelled', 'expired').
 */
export function claimViewState(data, now = new Date()) {
  if (data?.claimed_by_you) return 'claimed_by_you';
  if (data?.status === 'claimed') return 'already_claimed';
  if (data?.status === 'cancelled') return 'cancelled';
  if (data?.status === 'expired' || (data?.expires_at && new Date(data.expires_at) <= now)) return 'expired';
  return 'open';
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
 *
 * surface says where the seller started it, for the passport and transfer
 * funnel: 'record' (the gecko record's Transfer button, the default),
 * 'request' (a buyer asked from the passport page) or 'sold_step' (the
 * step shown right after archiving a gecko as sold).
 */
export async function startTransfer({ animalId, animalType = 'gecko', toEmail, salePrice, message, surface = 'record' }) {
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
  // No address, name, price or message goes into the event: only how it
  // was sent and whether a price was set.
  captureEvent('transfer_started', {
    method: toEmail ? 'email' : 'link',
    has_price: salePrice !== null && salePrice !== undefined,
    animal_type: animalType,
    surface,
    ...(toEmail ? { emailed: email.delivered } : {}),
  });
  return { ...data, claimUrl: claimUrlFor(data.token), emailed: email.delivered };
}

/**
 * A buyer on a passport page asks the owner to start a transfer. The server
 * (request_passport_transfer) sends the owner a chat message and a
 * transfer_request notification, which also goes out by email and push and
 * opens the transfer form with the buyer's email filled in.
 *
 * Never throws. Returns { status } where status is 'sent',
 * 'already_requested', 'unavailable' (the database function is not live
 * yet), or 'failed' with a message the page can show.
 */
export async function requestPassportTransfer(passportCode) {
  const result = await askForPassportTransfer(passportCode);
  // The outcome only: the passport code, the buyer and the owner stay out.
  captureEvent('passport_transfer_requested', { outcome: result.status });
  return result;
}

async function askForPassportTransfer(passportCode) {
  try {
    const { data, error } = await supabase.rpc('request_passport_transfer', { p_passport_code: passportCode });
    if (error) {
      // PGRST202: the function does not exist yet (the site deployed first).
      if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) {
        return { status: 'unavailable' };
      }
      return { status: 'failed', message: error.message || 'The request could not be sent.' };
    }
    return { status: data?.status === 'already_requested' ? 'already_requested' : 'sent' };
  } catch (e) {
    return { status: 'failed', message: e?.message || 'The request could not be sent.' };
  }
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
