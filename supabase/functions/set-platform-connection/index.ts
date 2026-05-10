// Supabase Edge Function: set-platform-connection
//
// Writes a social platform connection (Bluesky app password, eventually
// OAuth tokens for other platforms) with the access token encrypted at
// rest. Replaces direct DB writes from the client; RLS on the table
// no longer permits authenticated INSERT/UPDATE.
//
// Encryption: AES-256-GCM with a 32-byte key supplied via the
// PLATFORM_CONNECTIONS_KEY secret. The IV is generated per write and
// stored alongside the ciphertext.
//
// Body shape:
//   { platform, account_handle, access_token, refresh_token?, expires_at? }
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   PLATFORM_CONNECTIONS_KEY    base64-encoded 32-byte AES-256 key
//
// Deploy:
//   supabase functions deploy set-platform-connection

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KEY_BASE64 = Deno.env.get("PLATFORM_CONNECTIONS_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_PLATFORMS = new Set([
  "bluesky", "threads", "reddit", "facebook_page", "instagram", "x", "tiktok",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
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

async function importKey(): Promise<CryptoKey> {
  if (!KEY_BASE64) throw new Error("PLATFORM_CONNECTIONS_KEY not configured");
  const raw = b64decode(KEY_BASE64);
  if (raw.byteLength !== 32) throw new Error("PLATFORM_CONNECTIONS_KEY must decode to 32 bytes");
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptString(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { ciphertext: b64encode(new Uint8Array(ct)), iv: b64encode(iv) };
}

interface Body {
  platform: string;
  account_handle: string;
  account_id?: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "no_jwt" }, 401);

  const supaAuth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: userData, error: userErr } = await supaAuth.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "auth_failed" }, 401);
  const user = userData.user;

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  if (!ALLOWED_PLATFORMS.has(body.platform)) return json({ error: "unknown_platform" }, 400);
  if (!body.account_handle?.trim()) return json({ error: "account_handle_required" }, 400);
  if (!body.access_token?.trim()) return json({ error: "access_token_required" }, 400);

  let access_token_ciphertext: string;
  let access_token_iv: string;
  let refresh_token_ciphertext: string | null = null;
  let refresh_token_iv: string | null = null;
  try {
    const enc = await encryptString(body.access_token.trim());
    access_token_ciphertext = enc.ciphertext;
    access_token_iv = enc.iv;
    if (body.refresh_token) {
      const r = await encryptString(body.refresh_token.trim());
      refresh_token_ciphertext = r.ciphertext;
      refresh_token_iv = r.iv;
    }
  } catch (e) {
    return json({ error: "encryption_failed", detail: (e as Error).message }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const handle = body.account_handle.trim();
  const { data: existing } = await supabase
    .from("social_platform_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("platform", body.platform)
    .eq("account_handle", handle)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    platform: body.platform,
    account_handle: handle,
    account_id: body.account_id || null,
    access_token: null,
    access_token_ciphertext,
    access_token_iv,
    refresh_token: null,
    refresh_token_ciphertext,
    refresh_token_iv,
    expires_at: body.expires_at || null,
    metadata: body.metadata || {},
    is_active: true,
    updated_date: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("social_platform_connections")
      .update(payload)
      .eq("id", existing.id);
    if (error) return json({ error: "db_update_failed", detail: error.message }, 500);
    return json({ ok: true, id: existing.id });
  } else {
    const { data, error } = await supabase
      .from("social_platform_connections")
      .insert(payload)
      .select("id")
      .single();
    if (error) return json({ error: "db_insert_failed", detail: error.message }, 500);
    return json({ ok: true, id: data.id });
  }
});
