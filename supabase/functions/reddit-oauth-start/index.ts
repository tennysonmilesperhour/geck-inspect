// Supabase Edge Function: reddit-oauth-start
//
// Returns a Reddit OAuth authorization URL the client can redirect to.
// State is an HMAC-signed (user_id, ts) tuple so the callback is
// stateless, same pattern as meta-oauth-start.
//
// Scopes:
//   identity   - read /api/v1/me to grab the username for the connection row
//   submit     - submit posts to subreddits and the user's own profile
//
// Required env vars:
//   REDDIT_CLIENT_ID
//   REDDIT_OAUTH_REDIRECT          full URL of reddit-oauth-callback
//   REDDIT_OAUTH_STATE_SECRET      any random 32+ byte string
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for JWT verification)
//
// Setup notes (one-time, by the operator):
//   - Reddit Developer Portal: https://www.reddit.com/prefs/apps
//   - "create another app" -> Web App type
//   - redirect URI = https://<project>.supabase.co/functions/v1/reddit-oauth-callback
//   - the resulting client id + secret go into Supabase Edge Function secrets

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID") || "";
const REDDIT_OAUTH_REDIRECT = Deno.env.get("REDDIT_OAUTH_REDIRECT") || "";
const STATE_SECRET = Deno.env.get("REDDIT_OAUTH_STATE_SECRET") || "";

const SCOPES = "identity submit";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const arr = Array.from(new Uint8Array(sig)).map((b) => String.fromCharCode(b)).join("");
  return b64urlEncode(arr);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!REDDIT_CLIENT_ID || !REDDIT_OAUTH_REDIRECT || !STATE_SECRET) {
    return json({
      error: "reddit_not_configured",
      missing: [
        !REDDIT_CLIENT_ID && "REDDIT_CLIENT_ID",
        !REDDIT_OAUTH_REDIRECT && "REDDIT_OAUTH_REDIRECT",
        !STATE_SECRET && "REDDIT_OAUTH_STATE_SECRET",
      ].filter(Boolean),
    }, 500);
  }

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "no_jwt" }, 401);

  const supaAuth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: userData, error: userErr } = await supaAuth.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "auth_failed" }, 401);
  const userId = userData.user.id;

  const ts = Date.now();
  const payload = `${userId}:${ts}`;
  const sig = await hmacSign(payload, STATE_SECRET);
  const state = `${b64urlEncode(payload)}.${sig}`;

  const params = new URLSearchParams({
    client_id: REDDIT_CLIENT_ID,
    response_type: "code",
    state,
    redirect_uri: REDDIT_OAUTH_REDIRECT,
    duration: "permanent",   // returns a refresh_token so the connection stays alive
    scope: SCOPES,
  });

  const url = `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
  return json({ url });
});
