// Supabase Edge Function: subscribe-weekly-notes
//
// The Weekly Gecko Notes form on the public guide pages (Morph Guide, Care
// Guide, Genetics Guide, calculator) posts here, for visitors without an
// account. docs/planning/weekly-notes-2026-10.md, section 9, has the design.
// It:
//   1. Validates the payload (address shape and length, honeypot).
//   2. Asks the database (request_weekly_notes_signup) what to send. That
//      step applies the rate limits (2 emails per address a day, 10 per
//      network an hour, counted by a keyed hash of the IP) and, for a new
//      or unconfirmed address, makes a confirmation link and keeps only
//      its hash.
//   3. Sends one email: the confirmation link, or "you already get them",
//      or, for an address with an account, where the Settings switch is.
//      An address that bounced or marked our email as spam, or a member
//      who turned all email off, gets nothing (status quiet).
//      Nothing is added to the weekly notes until the link is pressed
//      (confirm_weekly_notes_signup, on /WeeklyNotes?t=...).
//
// The reply is the same for all four, so the form cannot be used to learn
// whether an address has an account, is on the list or was suppressed.
//
// Secrets (shared with send-email and subscribe-and-send-guides):
//   RESEND_API_KEY, EMAIL_FROM, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   SITE_URL (default https://geckinspect.com)
//
// Deploy: declared in supabase/config.toml (verify_jwt = false: signed-out
// visitors call it), so a merge to main deploys it.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { clientIp } from "../_shared/client-ip.ts";

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

// A keyed hash of the caller's IP, so repeat senders can be counted
// without storing the address itself (the same as the guide form).
async function networkKey(req: Request): Promise<string | null> {
  const raw = clientIp(req.headers);
  if (!raw || !SERVICE_ROLE_KEY) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SERVICE_ROLE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// A first filter; the database step has the strict rule. Characters a
// real address does not need (angle brackets, quotes, commas and the like)
// are refused, so nothing odd can reach an email header or a log.
function isPlausibleEmail(s: string): boolean {
  return /^[^\s@<>"(),;:\[\]\\]+@[^\s@<>"(),;:\[\]\\]+\.[^\s@<>"(),;:\[\]\\]+$/.test(s) && s.length <= 254;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type FormEmail = { subject: string; paragraphs: string[]; cta: string; url: string; footer: string };

// The three emails the form can send. Plain words, no dashes as punctuation.
function formEmail(kind: string, token?: string): FormEmail | null {
  if (kind === "confirm" && token) {
    return {
      subject: "Confirm your Weekly Gecko Notes",
      paragraphs: [
        "Tap the button to start Weekly Gecko Notes: one short crested gecko tip a week, on heat, weights, feeding, het labels and pairings. Free, and every note has a link that stops them.",
        "If you did not ask for this, ignore this email. Nothing more will come.",
      ],
      cta: "Confirm my email",
      url: `${SITE_URL}/WeeklyNotes?t=${encodeURIComponent(token)}`,
      footer: "The link works for 7 days. Geck Inspect is a record book made for crested gecko keepers and breeders.",
    };
  }
  if (kind === "already") {
    return {
      subject: "You already get Weekly Gecko Notes",
      paragraphs: [
        "This address, or another spelling of it (with or without a plus tag, or dots in a Gmail address), is already signed up for Weekly Gecko Notes, so nothing changes. Each note has a link at the bottom that stops them.",
        "If you did not ask for this, you can ignore this email.",
      ],
      cta: "Open the Care Guide",
      url: `${SITE_URL}/CareGuide`,
      footer: "Geck Inspect is a record book made for crested gecko keepers and breeders.",
    };
  }
  if (kind === "member") {
    return {
      subject: "Weekly Gecko Notes and your Geck Inspect account",
      paragraphs: [
        "This address, or another spelling of it (with or without a plus tag, or dots in a Gmail address), already has a Geck Inspect account. Members get Weekly Gecko Notes after their first two weeks, and the switch for them is in Settings, under Email notifications.",
        "If you did not ask for this, you can ignore this email.",
      ],
      cta: "Open Settings",
      url: `${SITE_URL}/Settings#email-notifications`,
      footer: "Geck Inspect is a record book made for crested gecko keepers and breeders.",
    };
  }
  return null;
}

function renderHtml(email: FormEmail): string {
  const paragraphs = email.paragraphs
    .map((p) => `<p style="margin:0 0 16px 0;color:#a7f3d0;font-size:15px;line-height:1.55;">${escapeHtml(p)}</p>`)
    .join("\n          ");
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0d1f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1f17;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#163026;border:1px solid rgba(134,239,172,0.2);border-radius:12px;">
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 8px 0;color:#86efac;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Geck Inspect</p>
          <h1 style="margin:0 0 16px 0;color:#d1fae5;font-size:22px;font-weight:700;line-height:1.3;">${escapeHtml(email.subject)}</h1>
          ${paragraphs}
          <a href="${escapeHtml(email.url)}" style="display:inline-block;margin-top:8px;background:#10b981;color:#022c22;padding:12px 20px;border-radius:8px;font-weight:600;text-decoration:none;">${escapeHtml(email.cta)}</a>
          <p style="margin:32px 0 0 0;color:#6ee7b7;font-size:12px;line-height:1.5;">${escapeHtml(email.footer)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderText(email: FormEmail): string {
  return [...email.paragraphs, `${email.cta}: ${email.url}`, email.footer].join("\n\n");
}

async function sendEmail(to: string, email: FormEmail, kind: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject: email.subject,
      text: renderText(email),
      html: renderHtml(email),
      // resend-webhook reads the type tag, so a bounce here lands on the
      // suppression list like any other.
      tags: [{ name: "type", value: `weekly_notes_signup_${kind}` }],
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
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
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ error: "invalid json body" }, 400);
  }

  // Honeypot: a script that fills every field gets a normal-looking reply.
  if (typeof payload.website === "string" && payload.website.length > 0) {
    return json({ ok: true });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const source = String(payload.source || "").trim().slice(0, 64);
  if (!isPlausibleEmail(email)) {
    return json({ error: "Please enter a valid email address." }, 400);
  }
  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "Sign-up is not available right now. Please try again later." }, 503);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let result: Record<string, unknown> = {};
  try {
    const { data, error } = await supabase.rpc("request_weekly_notes_signup", {
      p_email: email,
      p_source: source || null,
      p_ip_hash: await networkKey(req),
    });
    if (error) throw new Error(error.message);
    if (data && typeof data === "object" && !Array.isArray(data)) result = data as Record<string, unknown>;
  } catch (err) {
    console.warn("subscribe-weekly-notes: request failed", err);
    return json({ error: "Could not sign you up right now. Please try again later." }, 500);
  }

  const status = typeof result.status === "string" ? result.status : "";
  if (status === "bad-email") {
    return json({ error: "Please enter a valid email address." }, 400);
  }
  if (status === "address-limit") {
    return json({ ok: true, recently_sent: true });
  }
  // Nothing is sent, and the reply looks like any other. The short wait
  // stands in for the email send, so the reply's timing does not give a
  // quiet address away either.
  if (status === "quiet") {
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.floor(Math.random() * 500)));
    return json({ ok: true });
  }
  if (status === "network-limit") {
    return json({
      error: "Too many sign-ups from this network in the last hour. Please try again later.",
      code: "rate_limited",
    }, 429);
  }

  const message = formEmail(status, typeof result.token === "string" ? result.token : undefined);
  if (!message) {
    console.warn("subscribe-weekly-notes: unexpected status", status);
    return json({ error: "Could not sign you up right now. Please try again later." }, 500);
  }
  try {
    await sendEmail(email, message, status);
  } catch (err) {
    console.warn("subscribe-weekly-notes: delivery failed", err);
    return json({ error: "Could not send the email right now. Please try again later." }, 502);
  }
  return json({ ok: true });
});
