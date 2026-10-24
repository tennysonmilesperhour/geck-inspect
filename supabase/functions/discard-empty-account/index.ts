// Supabase Edge Function: discard-empty-account
//
// A member who signs in with a Facebook account that has no email lands on
// "Add your email" (src/components/auth/AddEmailGate.jsx). If the email they
// type already has a Geck Inspect account, they choose "Use my existing
// account": this deletes the empty login they just made, so they can sign
// in to the real one with their password.
//
// The target is always the caller from the session, never a body field,
// and only an empty social login qualifies (isEmptySocialLogin). Such a
// login has no profile, geckos or purchases, so nothing else is erased.
//
// Contract:
//   POST /discard-empty-account
//   Headers: Authorization: Bearer <session JWT>
//   Body: {}
//   200 { ok: true } | 401 unauthenticated | 409 not_empty | 500 failed
//
// verify_jwt = true (supabase/config.toml).
import { createClient } from "../_shared/supabase.ts";
import { CORS_HEADERS, json as jsonWith, preflight } from "../_shared/http.ts";
import { signedInCaller } from "../_shared/caller.ts";
import { isEmptySocialLogin } from "../_shared/empty-account.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const json = (body: unknown, status = 200) => jsonWith(body, status, CORS_HEADERS);

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const caller = await signedInCaller(req, { supabaseUrl: SUPABASE_URL, apiKey: SERVICE_KEY });
  if (!caller) return json({ error: "unauthenticated", message: "Sign in again to continue." }, 401);

  // The user from the auth server, not the token: a pending email change
  // or a linked identity added since the token was issued still counts.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.getUserById(caller.user.id);
  if (error || !data?.user) return json({ error: "failed", message: "Could not check this account." }, 500);
  if (!isEmptySocialLogin(data.user)) {
    return json({ error: "not_empty", message: "This account has an email, so it can only be deleted from Settings." }, 409);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) return json({ error: "failed", message: "Could not remove the empty sign-in. Try again." }, 500);
  return json({ ok: true });
});
