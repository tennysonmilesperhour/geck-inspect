// Supabase Edge Function: meta-oauth-callback
//
// Receives Meta's redirect with `code` and `state`, verifies the
// HMAC-signed state, exchanges the code for a long-lived token, and
// writes one social_platform_connections row per Facebook Page +
// per linked Instagram Business account.
//
// verify_jwt MUST be false for this function — Meta does the GET
// redirect from the user's browser without our app's bearer token.
//
// Required env vars (same as meta-oauth-start, plus secret):
//   META_APP_ID
//   META_APP_SECRET
//   META_OAUTH_REDIRECT
//   META_OAUTH_STATE_SECRET
//   PLATFORM_CONNECTIONS_KEY        AES-256 key for token encryption at rest
//   META_OAUTH_SUCCESS_URL          where to redirect on success (eg geckinspect.com/Promote)

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const META_APP_ID = Deno.env.get("META_APP_ID") || "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
const META_OAUTH_REDIRECT = Deno.env.get("META_OAUTH_REDIRECT") || "";
const STATE_SECRET = Deno.env.get("META_OAUTH_STATE_SECRET") || "";
const KEY_BASE64 = Deno.env.get("PLATFORM_CONNECTIONS_KEY") || "";
const SUCCESS_URL = Deno.env.get("META_OAUTH_SUCCESS_URL") || "https://geckinspect.com/Promote";

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

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

interface PageRow {
  id: string;
  name: string;
  access_token: string;        // page-specific token
  instagram_business_account?: { id: string } | null;
}

serve(async (req) => {
  if (req.method !== "GET") return new Response("method_not_allowed", { status: 405 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthErr = url.searchParams.get("error");

  if (oauthErr) {
    return redirect(`${SUCCESS_URL}?meta_err=${encodeURIComponent(oauthErr)}`);
  }
  if (!code || !state) {
    return redirect(`${SUCCESS_URL}?meta_err=missing_code_or_state`);
  }
  if (!META_APP_ID || !META_APP_SECRET || !META_OAUTH_REDIRECT || !STATE_SECRET || !KEY_BASE64) {
    return redirect(`${SUCCESS_URL}?meta_err=server_not_configured`);
  }

  // Verify state: <b64url(user_id:ts)>.<hmac>
  const [encodedPayload, sig] = state.split(".");
  if (!encodedPayload || !sig) return redirect(`${SUCCESS_URL}?meta_err=bad_state`);
  let payload: string;
  try {
    payload = b64urlDecode(encodedPayload);
  } catch {
    return redirect(`${SUCCESS_URL}?meta_err=bad_state_b64`);
  }
  const expected = await hmacSign(payload, STATE_SECRET);
  if (expected !== sig) return redirect(`${SUCCESS_URL}?meta_err=bad_state_sig`);

  const [userId, tsStr] = payload.split(":");
  const ts = Number(tsStr || 0);
  if (!userId || !ts) return redirect(`${SUCCESS_URL}?meta_err=bad_state_payload`);
  if (Date.now() - ts > STATE_MAX_AGE_MS) {
    return redirect(`${SUCCESS_URL}?meta_err=state_expired`);
  }

  // Exchange code for short-lived user access token.
  const tokenParams = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    redirect_uri: META_OAUTH_REDIRECT,
    code,
  });
  const tokenRes = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?${tokenParams.toString()}`,
  );
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    console.error("short_token_exchange_failed", t);
    return redirect(`${SUCCESS_URL}?meta_err=token_exchange_failed`);
  }
  const shortToken = await tokenRes.json() as { access_token: string };

  // Exchange short-lived for long-lived (~60 day) user token.
  const llParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: shortToken.access_token,
  });
  const llRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${llParams.toString()}`);
  if (!llRes.ok) {
    const t = await llRes.text();
    console.error("long_token_exchange_failed", t);
    return redirect(`${SUCCESS_URL}?meta_err=long_token_failed`);
  }
  const longToken = await llRes.json() as { access_token: string; expires_in?: number };

  // List the user's Facebook Pages. Each page has its own (long-lived
  // when fetched with a long-lived user token) access token we use for
  // posting. IG Business accounts are surfaced via the page record.
  const pagesRes = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${longToken.access_token}`,
  );
  if (!pagesRes.ok) {
    const t = await pagesRes.text();
    console.error("pages_list_failed", t);
    return redirect(`${SUCCESS_URL}?meta_err=pages_list_failed`);
  }
  const pagesBody = await pagesRes.json() as { data: PageRow[] };
  const pages = pagesBody.data || [];

  if (pages.length === 0) {
    return redirect(`${SUCCESS_URL}?meta_err=no_pages_found`);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const expiresAt = longToken.expires_in
    ? new Date(Date.now() + longToken.expires_in * 1000).toISOString()
    : null;

  let writeErrors = 0;
  for (const page of pages) {
    // 1. Facebook Page connection
    try {
      const enc = await encryptString(page.access_token);
      await upsertConnection(supabase, {
        user_id: userId,
        platform: "facebook_page",
        account_handle: page.name,
        account_id: page.id,
        access_token_ciphertext: enc.ciphertext,
        access_token_iv: enc.iv,
        expires_at: expiresAt,
        metadata: { page_id: page.id, page_name: page.name },
      });
    } catch (e) {
      writeErrors++;
      console.error("page_upsert_failed", page.id, (e as Error).message);
    }

    // 2. Instagram Business connection (if the Page has one linked)
    if (page.instagram_business_account?.id) {
      try {
        // Fetch IG username for a friendlier account_handle.
        const igRes = await fetch(
          `https://graph.facebook.com/v18.0/${page.instagram_business_account.id}?fields=username&access_token=${page.access_token}`,
        );
        const igBody = igRes.ok ? await igRes.json() as { username?: string } : {};

        const enc = await encryptString(page.access_token);
        await upsertConnection(supabase, {
          user_id: userId,
          platform: "instagram",
          account_handle: igBody.username || page.instagram_business_account.id,
          account_id: page.instagram_business_account.id,
          access_token_ciphertext: enc.ciphertext,
          access_token_iv: enc.iv,
          expires_at: expiresAt,
          metadata: {
            ig_business_account_id: page.instagram_business_account.id,
            ig_username: igBody.username || null,
            page_id: page.id,
            page_name: page.name,
          },
        });
      } catch (e) {
        writeErrors++;
        console.error("ig_upsert_failed", page.instagram_business_account.id, (e as Error).message);
      }
    }
  }

  const connected = pages.length + pages.filter((p) => p.instagram_business_account?.id).length;
  const sep = SUCCESS_URL.includes("?") ? "&" : "?";
  const params = new URLSearchParams({
    meta: "connected",
    count: String(connected),
  });
  if (writeErrors > 0) params.set("partial_errors", String(writeErrors));
  return redirect(`${SUCCESS_URL}${sep}${params.toString()}`);
});

async function upsertConnection(
  supabase: ReturnType<typeof createClient>,
  payload: {
    user_id: string;
    platform: string;
    account_handle: string;
    account_id: string;
    access_token_ciphertext: string;
    access_token_iv: string;
    expires_at: string | null;
    metadata: Record<string, unknown>;
  },
) {
  const { data: existing } = await supabase
    .from("social_platform_connections")
    .select("id")
    .eq("user_id", payload.user_id)
    .eq("platform", payload.platform)
    .eq("account_id", payload.account_id)
    .maybeSingle();

  const row = {
    ...payload,
    access_token: null,
    refresh_token: null,
    refresh_token_ciphertext: null,
    refresh_token_iv: null,
    is_active: true,
    updated_date: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from("social_platform_connections").update(row).eq("id", existing.id);
  } else {
    await supabase.from("social_platform_connections").insert(row);
  }
}
