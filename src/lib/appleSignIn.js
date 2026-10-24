import { getSupabase } from './supabaseLazy';

// Sign in with Apple, iPhone app only. Apple's own sheet returns an
// identity token (native/apple-sign-in), which Supabase turns into a
// session. No browser hop and no callback URL.
let plugin;
async function applePlugin() {
  if (!plugin) {
    const { registerPlugin } = await import('@capacitor/core');
    plugin = registerPlugin('AppleSignIn');
  }
  return plugin;
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isAppleCancel(error) {
  return error?.code === 'CANCELED';
}

// Apple hands over the person's name only on their very first sign-in,
// and never inside the token, so it is saved here or not at all.
export function appleFullName({ givenName, familyName } = {}) {
  return [givenName, familyName].map((part) => (part || '').trim()).filter(Boolean).join(' ').slice(0, 60);
}

export async function signInWithApple() {
  const nonce = randomNonce();
  // Apple puts the hashed nonce in the token; Supabase hashes the raw one
  // and checks they match, so a stolen token cannot be replayed.
  const result = await (await applePlugin()).authorize({ nonce: await sha256Hex(nonce) });
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: result.identityToken, nonce });
  if (error) throw error;
  const fullName = appleFullName(result);
  if (fullName && data?.user) {
    // Best effort: the profile row already exists (created at signup with
    // no name). Only fill it when it is still empty.
    await supabase.auth.updateUser({ data: { full_name: fullName } }).catch(() => {});
    if (data.user.email) {
      await supabase.from('profiles').update({ full_name: fullName }).eq('email', data.user.email).is('full_name', null).then(() => {}, () => {});
    }
  }
  return data;
}
