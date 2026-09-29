// Supabase Edge Function: send-breeder-inquiry
//
// Public endpoint called by the buyer-inquiry form on the breeder
// storefront page (/Breeder/<slug>). Unlike send-email (which respects
// the recipient's email_notification preferences), this function ALWAYS
// delivers the email. The breeder explicitly published a public
// storefront, so direct buyer contact is the whole point.
//
// Flow:
//   1. Validate payload + light spam guard (length caps, basic email
//      regex, honeypot field).
//   2. Resolve the recipient from the storefront slug (breeder_profiles).
//      The caller never chooses who gets the email: an earlier version
//      took breeder_email from the request, which let anyone send mail
//      from our domain to any address. A breeder who switched off
//      accepts_inquiries gets nothing.
//   3. Rate limits: per buyer email, per network (a keyed hash of the
//      IP, never the IP itself) and per breeder.
//   4. Insert a row into `breeder_inquiries` so the breeder has a
//      durable record they can read in-app later.
//   5. Send an email to the breeder via Resend with the buyer's contact
//      info and message.
//   6. Return { ok: true } so the form can render a thank-you state.
//
// Secrets (required, shared with send-email):
//   RESEND_API_KEY       starts with "re_"
//   EMAIL_FROM           e.g. "Geck Inspect <alerts@geckinspect.com>"
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Deploy: supabase functions deploy send-breeder-inquiry --no-verify-jwt

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Geck Inspect <alerts@geckinspect.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://geckinspect.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

// Limits per rolling window. A real buyer sends one or two inquiries;
// these only stop scripts.
const LIMIT_PER_BUYER_PER_HOUR = 5;
const LIMIT_PER_NETWORK_PER_HOUR = 10;
const LIMIT_PER_BREEDER_PER_DAY = 30;

// A keyed hash of the caller's IP, so repeat senders can be counted
// without storing the address itself.
async function networkKey(req: Request): Promise<string | null> {
  const raw = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    (req.headers.get("x-real-ip") || "").trim();
  if (!raw || !SERVICE_ROLE_KEY) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SERVICE_ROLE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function renderHtml(opts: {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  geckoName: string;
  geckoUrl: string;
  message: string;
  storefrontUrl: string;
}): string {
  const {
    buyerName, buyerEmail, buyerPhone, geckoName, geckoUrl, message, storefrontUrl,
  } = opts;
  const subjectLine = geckoName
    ? `Inquiry about ${escapeHtml(geckoName)}`
    : "New buyer inquiry";
  const buyerLine = buyerName
    ? `${escapeHtml(buyerName)} &lt;${escapeHtml(buyerEmail)}&gt;`
    : escapeHtml(buyerEmail);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0d1f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1f17;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#163026;border:1px solid rgba(134,239,172,0.2);border-radius:12px;">
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 8px 0;color:#86efac;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Geck Inspect &middot; Storefront</p>
          <h1 style="margin:0 0 16px 0;color:#d1fae5;font-size:22px;font-weight:700;line-height:1.3;">${subjectLine}</h1>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0;border-radius:8px;background:rgba(16,185,129,0.08);">
            <tr><td style="padding:12px 14px;color:#a7f3d0;font-size:13px;line-height:1.5;">
              <strong style="color:#d1fae5;">From:</strong> ${buyerLine}<br>
              ${buyerPhone ? `<strong style="color:#d1fae5;">Phone:</strong> ${escapeHtml(buyerPhone)}<br>` : ""}
              ${geckoName ? `<strong style="color:#d1fae5;">About:</strong> <a href="${escapeHtml(geckoUrl)}" style="color:#86efac;">${escapeHtml(geckoName)}</a>` : ""}
            </td></tr>
          </table>

          <p style="margin:0 0 16px 0;color:#a7f3d0;font-size:14px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(message)}</p>

          <a href="mailto:${escapeHtml(buyerEmail)}" style="display:inline-block;background:#10b981;color:#022c22;padding:12px 20px;border-radius:8px;font-weight:600;text-decoration:none;margin-right:8px;">Reply to ${escapeHtml(buyerName || "buyer")}</a>
          <a href="${escapeHtml(storefrontUrl)}" style="display:inline-block;color:#86efac;padding:12px 20px;font-weight:600;text-decoration:none;">View storefront</a>

          <p style="margin:32px 0 0 0;color:#6ee7b7;font-size:12px;line-height:1.5;">You received this because someone submitted an inquiry on your Geck Inspect storefront. The full inquiry is also saved in your Geck Inspect inbox.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendEmail(to: string, subject: string, text: string, html: string, replyTo?: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const body: Record<string, unknown> = { from: EMAIL_FROM, to, subject, text, html };
  if (replyTo) body.reply_to = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Resend ${res.status}: ${msg}`);
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json body" }, 400);
  }

  // Honeypot: bots fill every field including invisible ones; real
  // buyers leave it empty. Return ok to confuse the bot.
  if (typeof payload.website === "string" && payload.website.length > 0) {
    return json({ ok: true });
  }

  // payload.breeder_email is ignored on purpose; see the header comment.
  const breederSlug = String(payload.breeder_slug || "").trim().toLowerCase().slice(0, 120);
  const buyerEmail = String(payload.buyer_email || "").trim().toLowerCase();
  const buyerName = String(payload.buyer_name || "").trim().slice(0, 120);
  const buyerPhone = String(payload.buyer_phone || "").trim().slice(0, 40);
  const geckoId = String(payload.gecko_id || "").trim().slice(0, 80) || null;
  const geckoName = String(payload.gecko_name || "").trim().slice(0, 120);
  const geckoPassport = String(payload.gecko_passport_code || "").trim().slice(0, 120) || null;
  const message = String(payload.message || "").trim();

  if (!breederSlug) {
    return json({ error: "breeder_slug is required" }, 400);
  }
  if (!isPlausibleEmail(buyerEmail)) {
    return json({ error: "buyer_email must be a valid email" }, 400);
  }
  if (message.length < 4) {
    return json({ error: "message is too short" }, 400);
  }
  if (message.length > 4000) {
    return json({ error: "message is too long" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Who receives it comes from the storefront, not from the request.
  const { data: breeder, error: breederErr } = await supabase
    .from("breeder_profiles")
    .select("created_by, accepts_inquiries")
    .eq("custom_slug", breederSlug)
    .maybeSingle();
  if (breederErr) {
    console.warn("send-breeder-inquiry: breeder lookup failed", breederErr);
    return json({ error: "failed to look up breeder" }, 500);
  }
  const breederEmail = String(breeder?.created_by || "").trim().toLowerCase();
  if (!breeder || !isPlausibleEmail(breederEmail)) {
    return json({ error: "This storefront is not taking inquiries." }, 404);
  }
  if (breeder.accepts_inquiries === false) {
    return json({ error: "This breeder is not taking inquiries right now." }, 403);
  }

  // Rate limits. Counting fails closed: an inquiry is not worth an
  // unlimited relay if the database is having a moment.
  const ipKey = await networkKey(req);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const countSince = async (column: string, value: string, since: string) => {
    const { count, error } = await supabase
      .from("breeder_inquiries")
      .select("id", { count: "exact", head: true })
      .eq(column, value)
      .gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
  };
  try {
    const [byBuyer, byNetwork, byBreeder] = await Promise.all([
      countSince("buyer_email", buyerEmail, hourAgo),
      ipKey ? countSince("sender_ip_hash", ipKey, hourAgo) : Promise.resolve(0),
      countSince("breeder_email", breederEmail, dayAgo),
    ]);
    if (
      byBuyer >= LIMIT_PER_BUYER_PER_HOUR ||
      byNetwork >= LIMIT_PER_NETWORK_PER_HOUR ||
      byBreeder >= LIMIT_PER_BREEDER_PER_DAY
    ) {
      return json({ error: "Too many inquiries were sent recently. Please try again later." }, 429);
    }
  } catch (err) {
    console.warn("send-breeder-inquiry: rate-limit check failed", err);
    return json({ error: "failed to record inquiry" }, 500);
  }

  // Persist the inquiry so the breeder has a durable record even if
  // the email bounces or gets filtered.
  const { error: insertErr } = await supabase
    .from("breeder_inquiries")
    .insert({
      breeder_email: breederEmail,
      sender_ip_hash: ipKey,
      breeder_slug: breederSlug || null,
      buyer_email: buyerEmail,
      buyer_name: buyerName || null,
      buyer_phone: buyerPhone || null,
      gecko_id: geckoId,
      gecko_name: geckoName || null,
      gecko_passport_code: geckoPassport,
      message,
    });

  if (insertErr) {
    console.warn("send-breeder-inquiry: insert failed", insertErr);
    return json({ error: "failed to record inquiry" }, 500);
  }

  // Send email to breeder. Skip cleanly if Resend isn't configured.
  // The inquiry row is still saved.
  if (!RESEND_API_KEY) {
    return json({ ok: true, delivered: 0, skipped: "no-resend-key" });
  }

  const storefrontUrl = breederSlug
    ? `${SITE_URL}/Breeder/${breederSlug}`
    : SITE_URL;
  const geckoUrl = geckoPassport
    ? `${SITE_URL}/passport/${geckoPassport}`
    : geckoId
      ? `${SITE_URL}/GeckoDetail?id=${geckoId}`
      : storefrontUrl;

  const subject = geckoName
    ? `Inquiry about ${geckoName} on Geck Inspect`
    : "New buyer inquiry on your Geck Inspect storefront";

  const text = [
    geckoName ? `Buyer inquiry about ${geckoName}` : "New buyer inquiry",
    "",
    `From: ${buyerName ? `${buyerName} <${buyerEmail}>` : buyerEmail}`,
    buyerPhone ? `Phone: ${buyerPhone}` : "",
    geckoName ? `About: ${geckoName} (${geckoUrl})` : "",
    "",
    message,
    "",
    `Reply directly to this email or open the storefront: ${storefrontUrl}`,
  ].filter(Boolean).join("\n");

  const html = renderHtml({
    buyerName, buyerEmail, buyerPhone, geckoName, geckoUrl, message, storefrontUrl,
  });

  try {
    const result = await sendEmail(breederEmail, subject, text, html, buyerEmail);
    return json({ ok: true, delivered: 1, id: result?.id });
  } catch (err) {
    console.warn("send-breeder-inquiry: delivery failed", err);
    // Inquiry is recorded, so email failure is non-fatal.
    return json({ ok: true, delivered: 0, skipped: "delivery-failed", error: String(err) });
  }
});
