// Supabase Edge Function — subscribe-and-send-guides
//
// The homepage lead-magnet form posts to this function. It:
//   1. Validates the payload (email shape, length caps, honeypot).
//   2. Upserts a row in `newsletter_subscribers` (idempotent on email).
//   3. Sends an email via Resend with download links for the Care
//      Guide and Genetics Guide PDFs (hosted as static assets on the
//      site at /downloads/<filename>.pdf).
//
// Secrets (required, shared with send-email + send-breeder-inquiry):
//   RESEND_API_KEY       starts with "re_"
//   EMAIL_FROM           e.g. "Geck Inspect <alerts@geckinspect.com>"
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SITE_URL             e.g. "https://geckinspect.com" (default)
//
// Deploy: supabase functions deploy subscribe-and-send-guides --no-verify-jwt

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Geck Inspect <alerts@geckinspect.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://geckinspect.com";

const CARE_GUIDE_URL = `${SITE_URL}/downloads/geck-inspect-care-guide.pdf`;
const GENETICS_GUIDE_URL = `${SITE_URL}/downloads/geck-inspect-genetics-guide.pdf`;

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

function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0d1f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1f17;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#163026;border:1px solid rgba(134,239,172,0.2);border-radius:12px;">
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 8px 0;color:#86efac;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Geck Inspect</p>
          <h1 style="margin:0 0 12px 0;color:#d1fae5;font-size:22px;font-weight:700;line-height:1.3;">Your free crested gecko guides</h1>
          <p style="margin:0 0 22px 0;color:#a7f3d0;font-size:14px;line-height:1.55;">Welcome — both PDFs are linked below. They cover everything from first-clutch husbandry to multi-generation breeding projections.</p>

          <a href="${escapeHtml(CARE_GUIDE_URL)}" style="display:block;background:#10b981;color:#022c22;padding:14px 18px;border-radius:10px;font-weight:700;text-decoration:none;margin-bottom:10px;">
            Download the Care Guide (PDF)
          </a>
          <a href="${escapeHtml(GENETICS_GUIDE_URL)}" style="display:block;background:#0d7c5a;color:#ecfdf5;padding:14px 18px;border-radius:10px;font-weight:700;text-decoration:none;margin-bottom:22px;">
            Download the Genetics Guide (PDF)
          </a>

          <p style="margin:0 0 12px 0;color:#a7f3d0;font-size:13px;line-height:1.55;">Want the always-current, interactive versions with diagrams and the live multi-trait genetics calculator?</p>
          <a href="${escapeHtml(SITE_URL)}/" style="display:inline-block;color:#86efac;font-weight:600;text-decoration:none;">Open Geck Inspect &rarr;</a>

          <p style="margin:32px 0 0 0;color:#6ee7b7;font-size:12px;line-height:1.5;">Built by a crested gecko breeder, for crested gecko breeders. You can unsubscribe any time — just reply to this email and we'll remove you.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text, html }),
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

  // Honeypot.
  if (typeof payload.website === "string" && payload.website.length > 0) {
    return json({ ok: true });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const source = String(payload.source || "homepage").trim().slice(0, 64);

  if (!isPlausibleEmail(email)) {
    return json({ error: "Please enter a valid email address." }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Idempotent upsert — re-subscribing is fine, just refreshes
  // updated_at and clears any unsubscribed_at flag.
  const { error: upsertErr } = await supabase
    .from("newsletter_subscribers")
    .upsert(
      {
        email,
        source,
        consent_marketing: true,
        unsubscribed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

  if (upsertErr) {
    console.warn("subscribe-and-send-guides: upsert failed", upsertErr);
    return json({ error: "Could not record subscription." }, 500);
  }

  if (!RESEND_API_KEY) {
    return json({ ok: true, delivered: 0, skipped: "no-resend-key" });
  }

  const subject = "Your free crested gecko Care & Genetics Guides";
  const text = [
    "Welcome to Geck Inspect.",
    "",
    "Both guides are below — free, no expiration, share with anyone.",
    "",
    `Care Guide:     ${CARE_GUIDE_URL}`,
    `Genetics Guide: ${GENETICS_GUIDE_URL}`,
    "",
    "For the always-current, interactive versions plus the multi-trait",
    "genetics calculator, AI morph identification, and lineage trees,",
    `open Geck Inspect: ${SITE_URL}/`,
    "",
    "Built by a crested gecko breeder, for crested gecko breeders.",
  ].join("\n");

  try {
    const result = await sendEmail(email, subject, text, renderHtml());
    return json({ ok: true, delivered: 1, id: result?.id });
  } catch (err) {
    console.warn("subscribe-and-send-guides: delivery failed", err);
    return json({ ok: true, delivered: 0, skipped: "delivery-failed" });
  }
});
