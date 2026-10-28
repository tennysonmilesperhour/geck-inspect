/**
 * Two-factor sign-in with an authenticator app (TOTP), for the admin
 * account (comprehensive review, Part E item E1 10).
 *
 * How it fits together:
 *   - Settings, Security (src/components/settings/SecurityCard.jsx, shown
 *     to admins) adds an authenticator with Supabase's mfa.enroll, shows
 *     the QR code and the secret key, and turns it on once a code checks
 *     out (mfa.challenge, then mfa.verify).
 *   - At sign-in the session is "aal1" (password or sign-in link only).
 *     When the account has a verified authenticator, Supabase reports
 *     nextLevel "aal2", and MfaStepUpGate (in the app shell, with its own
 *     needsCodeStep so the shell does not load this file) asks for the
 *     code before any page, admin screens included. A correct code raises
 *     the session to "aal2".
 *   - In the database, public.is_admin() also requires aal2 once the
 *     app_settings switch 'admin_requires_mfa' is on
 *     (supabase/migrations/20261028020200_admin_mfa.sql).
 *
 * Members without an authenticator never see any of this.
 */

export const CODE_LENGTH = 6;

/** Digits only, at most six, so "123 456" pasted from an app still works. */
export function cleanCode(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, CODE_LENGTH);
}

/**
 * An <img> source for the QR code from mfa.enroll. Supabase sends an SVG,
 * either as a data: address or as bare markup, depending on the version.
 * The markup is encoded again so a character such as # cannot cut the
 * picture short. Anything that is not an SVG gives ''.
 */
export function qrImageSrc(qr) {
  const text = String(qr ?? '').trim();
  let svg = text;
  const head = /^data:image\/svg\+xml([^,]*),/i.exec(text);
  if (head) {
    if (/;base64$/i.test(head[1])) return text;
    svg = text.slice(head[0].length);
    try {
      svg = decodeURIComponent(svg);
    } catch {
      // Bare markup with a stray %: use it as it is.
    }
  }
  svg = svg.trim();
  if (!svg.startsWith('<')) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The secret key in groups of four, easier to type: "JBSW Y3DP EHPK 3PXP". */
export function groupSecret(secret) {
  return String(secret ?? '').replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 ');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A short date in the member's time zone: "28 Oct 2026". */
export function shortDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * The name a new authenticator gets, "Authenticator app, 28 Oct 2026
 * 02:14". Supabase refuses two factors with the same name on one account,
 * so it carries the minute it was added.
 */
export function authenticatorName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `Authenticator app, ${shortDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Authenticator-app factors from mfa.listFactors(), split by status. */
export function totpFactors(list) {
  const all = (list?.all ?? []).filter((f) => f?.factor_type === 'totp');
  return {
    verified: all.filter((f) => f.status === 'verified'),
    unverified: all.filter((f) => f.status !== 'verified'),
  };
}

/** Plain words for an error from mfa.challenge or mfa.verify. */
export function codeErrorMessage(error) {
  const code = error?.code || '';
  const status = error?.status;
  if (code === 'mfa_verification_failed' || /invalid totp/i.test(error?.message || '')) {
    return 'That code did not work. Codes change every 30 seconds, so type the one your app shows now.';
  }
  if (code === 'over_request_rate_limit' || status === 429) {
    return 'Too many tries. Wait a minute, then type the newest code.';
  }
  if (code === 'mfa_challenge_expired') {
    return 'That took too long. Type the code your app shows now.';
  }
  return 'Could not check the code. Check your connection and try again.';
}

/**
 * Checks a code against one authenticator: mfa.challenge, then
 * mfa.verify. On success Supabase stores a session at aal2 and announces
 * MFA_CHALLENGE_VERIFIED. Resolves to { error: null } or { error: '<plain
 * message>' }; never rejects.
 */
export async function verifyCode(supabase, factorId, code) {
  const clean = cleanCode(code);
  if (clean.length !== CODE_LENGTH) {
    return { error: 'Type the 6-digit code from your authenticator app.' };
  }
  try {
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) return { error: codeErrorMessage(challenge.error) };
    const verified = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: clean });
    if (verified.error) return { error: codeErrorMessage(verified.error) };
    return { error: null };
  } catch (error) {
    return { error: codeErrorMessage(error) };
  }
}
