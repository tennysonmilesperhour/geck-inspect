// Carries an email from "Use my existing account" (AddEmailGate) to the
// sign-in form across the page load between them. Session storage, not
// the address bar, so the email stays out of page-view analytics.
const KEY = 'geck_signin_email';

export function keepSignInEmail(email) {
  try { sessionStorage.setItem(KEY, email); } catch { /* storage blocked: the form starts empty */ }
}

export function readSignInEmail() {
  try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function clearSignInEmail() {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

// Supabase's answer when an email change names an address another
// account already uses.
export function isEmailTaken(error) {
  if (!error) return false;
  return error.code === 'email_exists' || /already (been )?registered/i.test(error.message || '');
}
