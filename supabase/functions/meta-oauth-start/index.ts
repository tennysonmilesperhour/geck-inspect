// Supabase Edge Function: meta-oauth-start
//
// Returns a Facebook OAuth dialog URL the client can redirect to.
// State is an HMAC-signed (user_id, ts) tuple so the callback is
// stateless — no DB row needed to remember who started the flow.
//
// Required scopes:
//   pages_show_list             - list user's Facebook Pages
//   pages_read_engagement       - read page basic info (for IG link)
//   pages_manage_posts          - publish posts to Pages
//   instagram_basic             - read IG Business account info
//   instagram_content_publish   - publish to IG (needs Meta App Review)
//
// In Meta's "Development mode" the developer + added test users can
// authenticate without app review. instagram_content_publish requires
// approved review before it works for non-test users.
//
// Required env vars:
//   META_APP_ID
//   META_OAUTH_REDIRECT          full URL of meta-oauth-callback
//   META_OAUTH_STATE_SECRET      any random 32+ byte string
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for JWT verification)

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const META_APP_ID = Deno.env.get("META_APP_ID") || "";
const META_OAUTH_REDIRECT = Deno.env.get("META_OAUTH_REDIRECT") || "";
const STATE_SECRET = Deno.env.get("META_OAUTH_STATE_SECRET") || "";

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

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

  if (!META_APP_ID || !META_OAUTH_REDIRECT || !STATE_SECRET) {
    return json({ error: "meta_not_configured", missing: [
      !META_APP_ID && "META_APP_ID",
      !META_OAUTH_REDIRECT && "META_OAUTH_REDIRECT",
      !STATE_SECRET && "META_OAUTH_STATE_SECRET",
    ].filter(Boolean) }, 500);
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
    client_id: META_APP_ID,
    redirect_uri: META_OAUTH_REDIRECT,
    state,
    scope: SCOPES,
    response_type: "code",
    auth_type: "rerequest",
  });

  const url = `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  return json({ url });
});
