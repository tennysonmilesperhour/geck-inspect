// Supabase Edge Function: reddit-oauth-callback
//
// Receives Reddit's OAuth redirect with `code` and `state`, verifies
// the HMAC-signed state, exchanges the code for an access + refresh
// token pair, fetches the user's Reddit username via /api/v1/me, and
// writes a single social_platform_connections row.
//
// verify_jwt MUST be false; Reddit redirects the user's browser
// without our app's bearer token.
//
// Required env vars:
//   REDDIT_CLIENT_ID
//   REDDIT_CLIENT_SECRET
//   REDDIT_OAUTH_REDIRECT
//   REDDIT_OAUTH_STATE_SECRET
//   REDDIT_USER_AGENT              ex: "web:com.geckinspect:v1 (by /u/geckinspect)"
//   PLATFORM_CONNECTIONS_KEY        AES-256 key for token encryption at rest
//   REDDIT_OAUTH_SUCCESS_URL       defaults to https://geckinspect.com/Promote

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID") || "";
const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET") || "";
const REDDIT_OAUTH_REDIRECT = Deno.env.get("REDDIT_OAUTH_REDIRECT") || "";
const STATE_SECRET = Deno.env.get("REDDIT_OAUTH_STATE_SECRET") || "";
const USER_AGENT = Deno.env.get("REDDIT_USER_AGENT") || "web:com.geckinspect:v1";
const KEY_BASE64 = Deno.env.get("PLATFORM_CONNECTIONS_KEY") || "";
const SUCCESS_URL = Deno.env.get("REDDIT_OAUTH_SUCCESS_URL") || "https://geckinspect.com/Promote";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
  return btoa(arr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importAesKey(): Promise<CryptoKey> {
  const raw = b64decode(KEY_BASE64);
  if (raw.byteLength !== 32) throw new Error("PLATFORM_CONNECTIONS_KEY must decode to 32 bytes");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
}

async function encryptString(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await importAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return { ciphertext: b64encode(new Uint8Array(ct)), iv: b64encode(iv) };
}

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

serve(async (req) => {
  if (req.method !== "GET") return new Response("method_not_allowed", { status: 405 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthErr = url.searchParams.get("error");

  if (oauthErr) return redirect(`${SUCCESS_URL}?reddit_err=${encodeURIComponent(oauthErr)}`);
  if (!code || !state) return redirect(`${SUCCESS_URL}?reddit_err=missing_code_or_state`);
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_OAUTH_REDIRECT || !STATE_SECRET || !KEY_BASE64) {
    return redirect(`${SUCCESS_URL}?reddit_err=server_not_configured`);
  }

  // Verify HMAC state.
  const [encodedPayload, sig] = state.split(".");
  if (!encodedPayload || !sig) return redirect(`${SUCCESS_URL}?reddit_err=bad_state`);
  let payload: string;
  try { payload = b64urlDecode(encodedPayload); }
  catch { return redirect(`${SUCCESS_URL}?reddit_err=bad_state_b64`); }
  const expected = await hmacSign(payload, STATE_SECRET);
  if (expected !== sig) return redirect(`${SUCCESS_URL}?reddit_err=bad_state_sig`);

  const [userId, tsStr] = payload.split(":");
  const ts = Number(tsStr || 0);
  if (!userId || !ts) return redirect(`${SUCCESS_URL}?reddit_err=bad_state_payload`);
  if (Date.now() - ts > STATE_MAX_AGE_MS) return redirect(`${SUCCESS_URL}?reddit_err=state_expired`);

  // Exchange the code for tokens. Reddit uses Basic auth with
  // client_id:client_secret on this endpoint.
  const basic = btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`);
  const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDDIT_OAUTH_REDIRECT,
    }).toString(),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    console.error("reddit_token_exchange_failed", t);
    return redirect(`${SUCCESS_URL}?reddit_err=token_exchange_failed`);
  }
  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  // Fetch the Reddit username for a nice account_handle.
  const meRes = await fetch("https://oauth.reddit.com/api/v1/me", {
    headers: {
      "Authorization": `Bearer ${tokens.access_token}`,
      "User-Agent": USER_AGENT,
    },
  });
  if (!meRes.ok) {
    const t = await meRes.text();
    console.error("reddit_me_failed", t);
    return redirect(`${SUCCESS_URL}?reddit_err=me_failed`);
  }
  const me = await meRes.json() as { name: string; id: string };

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  try {
    const accessEnc = await encryptString(tokens.access_token);
    const refreshEnc = tokens.refresh_token ? await encryptString(tokens.refresh_token) : null;

    const { data: existing } = await supabase
      .from("social_platform_connections")
      .select("id, metadata")
      .eq("user_id", userId)
      .eq("platform", "reddit")
      .maybeSingle();

    // Default subreddit = the user's own profile (u_<username>) which
    // is the safest target. Subreddit-specific posting can be added
    // later in the composer. Preserve any existing override.
    const existingMeta = (existing?.metadata as Record<string, unknown> | null) || {};
    const defaultSubreddit = (existingMeta.default_subreddit as string) || `u_${me.name}`;

    const row = {
      user_id: userId,
      platform: "reddit",
      account_handle: me.name,
      account_id: me.id,
      access_token: null,
      access_token_ciphertext: accessEnc.ciphertext,
      access_token_iv: accessEnc.iv,
      refresh_token: null,
      refresh_token_ciphertext: refreshEnc?.ciphertext || null,
      refresh_token_iv: refreshEnc?.iv || null,
      expires_at: expiresAt,
      metadata: {
        default_subreddit: defaultSubreddit,
        scope: tokens.scope || "",
      },
      is_active: true,
      updated_date: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from("social_platform_connections").update(row).eq("id", existing.id);
    } else {
      await supabase.from("social_platform_connections").insert(row);
    }
  } catch (e) {
    console.error("reddit_upsert_failed", (e as Error).message);
    return redirect(`${SUCCESS_URL}?reddit_err=upsert_failed`);
  }

  const sep = SUCCESS_URL.includes("?") ? "&" : "?";
  return redirect(`${SUCCESS_URL}${sep}reddit=connected`);
});
