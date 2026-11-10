// Supabase Edge Function: apple-token
//
// Right after a member signs in with Apple on the iPhone, the app sends the
// one-time authorization code Apple gave it. This swaps the code for Apple's
// refresh token and stores it (public.apple_sign_in_tokens, service role
// only), so that deleting the account can revoke it, as App Store Review
// Guideline 5.1.1(v) asks. The token never goes back to the app.
//
// The code is only accepted when Apple says it belongs to an Apple identity
// on the caller's own login, so one member cannot attach their Apple token
// to someone else's account.
//
// Contract:
//   POST /apple-token
//   Headers: Authorization: Bearer <session JWT>
//   Body: { authorization_code: string }
//   200 { ok: true } | 400 bad_request | 401 unauthenticated
//   403 not_your_apple_id | 502 apple_refused | 503 not_configured
//
// Secrets: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (see
// _shared/apple-auth.ts). verify_jwt = true (supabase/config.toml).
import { createClient } from "../_shared/supabase.ts";
import { CORS_HEADERS, json as jsonWith, preflight } from "../_shared/http.ts";
import { signedInCaller } from "../_shared/caller.ts";
import { APPLE_TOKENS_TABLE, appleConfigFromEnv, exchangeAppleCode } from "../_shared/apple-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const json = (body: unknown, status = 200) => jsonWith(body, status, CORS_HEADERS);

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const caller = await signedInCaller(req, { supabaseUrl: SUPABASE_URL, apiKey: SERVICE_KEY });
  if (!caller) return json({ error: "unauthenticated", message: "Sign in again to continue." }, 401);

  let body: { authorization_code?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const code = typeof body.authorization_code === "string" ? body.authorization_code.trim() : "";
  if (!code || code.length > 2048) return json({ error: "bad_request", message: "No Apple authorization code." }, 400);

  const config = appleConfigFromEnv((name) => Deno.env.get(name));
  if (!config) {
    console.error("apple-token: APPLE_TEAM_ID, APPLE_KEY_ID or APPLE_PRIVATE_KEY is not set");
    return json({ error: "not_configured", message: "Apple sign-in tokens are not set up yet." }, 503);
  }

  let exchanged: { refreshToken: string; sub: string };
  try {
    exchanged = await exchangeAppleCode(code, config);
  } catch (error) {
    console.warn("apple-token: exchange failed", error);
    return json({ error: "apple_refused", message: "Apple did not accept the sign-in code." }, 502);
  }

  // The user from the auth server, so an identity linked a moment ago counts.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(caller.user.id);
  if (userError || !userData?.user) return json({ error: "failed", message: "Could not check this account." }, 500);
  const appleIds = (userData.user.identities || [])
    .filter((identity) => identity.provider === "apple")
    .flatMap((identity) => [identity.id, (identity.identity_data as { sub?: string } | undefined)?.sub, (identity as { provider_id?: string }).provider_id])
    .filter(Boolean);
  if (!exchanged.sub || !appleIds.includes(exchanged.sub)) {
    return json({ error: "not_your_apple_id", message: "This Apple ID is not linked to your account." }, 403);
  }

  const { error: saveError } = await admin.from(APPLE_TOKENS_TABLE).upsert({
    user_id: caller.user.id,
    apple_sub: exchanged.sub,
    refresh_token: exchanged.refreshToken,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (saveError) {
    console.error("apple-token: could not save the token", saveError);
    return json({ error: "failed", message: "Could not save the Apple sign-in." }, 500);
  }
  return json({ ok: true });
});
