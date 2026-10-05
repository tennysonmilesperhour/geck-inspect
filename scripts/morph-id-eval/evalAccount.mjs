// The Morph ID evaluation account, shared by run-ci.mjs (the accuracy test)
// and scripts/canary/run-canary.mjs (the daily health check).
//
// It is a normal account with app_metadata.morph_eval = true. Only the
// service role can set app_metadata, and recognize-gecko-morph reads that
// flag to skip credit use for this account. It grants nothing else: not
// admin, not a tier. Sign-in needs no password: the service role asks for a
// one-time sign-in link and exchanges it for a session on the spot. No email
// is sent.

import { createClient } from '@supabase/supabase-js';

export const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };

export function evalAccount({ supabaseUrl, serviceKey, anonKey, email = 'morph-eval@geckinspect.com' }) {
  const admin = createClient(supabaseUrl, serviceKey, authOptions);
  const EVAL_EMAIL = email;
  const SUPABASE_URL = supabaseUrl;
  const ANON_KEY = anonKey;

  async function findUser(email) {
    for (let page = 1; page <= 50; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(`Could not list accounts: ${error.message}`);
      const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
      if (match) return match;
      if (data.users.length < 1000) return null;
    }
    return null;
  }

  async function ensureEvalAccount() {
    const existing = await findUser(EVAL_EMAIL);
    if (existing) {
      // Never hand the flag to an account this workflow did not create.
      if (existing.app_metadata?.morph_eval !== true) {
        throw new Error(`${EVAL_EMAIL} already exists without the evaluation flag. Refusing to use it.`);
      }
      return existing;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: EVAL_EMAIL,
      email_confirm: true,
      app_metadata: { morph_eval: true },
      user_metadata: { full_name: 'Morph ID evaluation (internal)' },
    });
    if (error) throw new Error(`Could not create the evaluation account: ${error.message}`);
    console.error(`Created evaluation account ${EVAL_EMAIL}.`);
    return data.user;
  }

  async function signIn() {
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: EVAL_EMAIL,
    });
    if (linkError) throw new Error(`Could not create a sign-in link: ${linkError.message}`);
    const client = createClient(SUPABASE_URL, ANON_KEY, authOptions);
    const { data, error } = await client.auth.verifyOtp({
      type: 'magiclink',
      token_hash: link.properties.hashed_token,
    });
    if (error || !data.session) throw new Error(`Could not sign in: ${error?.message || 'no session returned'}`);
    return data.session.access_token;
  }

  return { admin, ensureEvalAccount, signIn };
}
