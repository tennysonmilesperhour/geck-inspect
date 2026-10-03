// Supabase Edge Function: email-unsubscribe
//
// One-click unsubscribe for notification emails (RFC 8058). send-email puts
// this address in every email's List-Unsubscribe header with a signed
// token, and mail apps (Gmail, Yahoo, Apple Mail) POST to it when the
// reader taps their Unsubscribe button:
//
//   POST /email-unsubscribe?t=<profile id>.<signature>
//   Body: List-Unsubscribe=One-Click
//
// The database checks the signature (unsubscribe_email_by_token) and turns
// email notifications off for that member. No sign-in: the signature is the
// proof. A GET (someone opening the address in a browser) is sent on to the
// friendly page, SITE_URL/Unsubscribe?t=..., which does the same thing and
// says so.
//
// Deploy: supabase functions deploy email-unsubscribe --no-verify-jwt

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://geckinspect.com";

function text(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

serve(async (req) => {
  const url = new URL(req.url);
  const token = (url.searchParams.get("t") || "").slice(0, 200);

  if (req.method === "GET" || req.method === "HEAD") {
    const target = `${SITE_URL}/Unsubscribe${token ? `?t=${encodeURIComponent(token)}` : ""}`;
    return new Response(null, { status: 302, headers: { location: target, "cache-control": "no-store" } });
  }
  if (req.method !== "POST") return text("Method not allowed", 405);
  if (!token) return text("Missing token", 400);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return text("Not configured", 500);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.rpc("unsubscribe_email_by_token", { p_token: token });
  if (error) {
    console.warn("email-unsubscribe: rpc failed", error);
    return text("Could not unsubscribe right now", 500);
  }
  if (data !== true) return text("This unsubscribe link is not valid", 400);
  return text("You are unsubscribed from Geck Inspect notification emails.");
});
