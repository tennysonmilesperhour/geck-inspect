// Supabase Edge Function: waitlist-signup
//
// Public waitlist signups with email confirmation (audit step 33).
// Before this, join_waitlist() put any email address on a breeder's list
// with no check that its owner asked, and the buyer got no record of
// their place or the deposit terms they agreed to.
//
// Contract (no sign-in needed; JWT verification is off at the gateway):
//
//   POST { action: 'join', slug, name, email, wanted?, notes?, accept_terms? }
//     Records the signup as unconfirmed (waitlist_join_pending) and emails
//     a confirmation link to that address. The response never says
//     whether the address was already on the list or where it stands, so
//     the endpoint cannot be used to look people up:
//       { status: 'check_email' }
//
//   POST { action: 'confirm', token }
//     Opens the emailed link: marks the signup confirmed, tells the
//     breeder, emails the buyer their place in line and the terms they
//     agreed to, and returns what the page shows:
//       { status: 'confirmed', already_confirmed, position, title,
//         terms, terms_accepted_at, wanted }
//
// Every email address in a mail comes from the database, never from the
// request, and the link always points at https://geckinspect.com.
// Limits: one confirmation email per signup every 2 minutes and 5 in
// total; waitlist_join_pending() caps unconfirmed signups at 30 an hour
// per list.
//
// Secrets: RESEND_API_KEY, EMAIL_FROM (same as send-collection-invite).
// Deploy: supabase functions deploy waitlist-signup --no-verify-jwt

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Geck Inspect <invites@geckinspect.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const SITE_URL = "https://geckinspect.com";
const RESEND_GAP_MS = 2 * 60 * 1000;
const MAX_SENDS = 5;

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

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return await res.json();
}

function shell(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0d1f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1f17;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#163026;border:1px solid rgba(134,239,172,0.2);border-radius:12px;">
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px 0;color:#86efac;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Geck Inspect waitlist</p>
          <h1 style="margin:0 0 16px 0;color:#d1fae5;font-size:24px;font-weight:700;line-height:1.3;">${heading}</h1>
          ${bodyHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const P = (s: string) => `<p style="margin:0 0 16px 0;color:#a7f3d0;font-size:15px;line-height:1.6;">${s}</p>`;
const SMALL = (s: string) => `<p style="margin:0;color:#6ee7b7;font-size:12px;line-height:1.5;">${s}</p>`;

type Details = {
  signup_id: string;
  name: string;
  email: string;
  wanted: string | null;
  position: number | null;
  terms: string | null;
  terms_accepted_at: string | null;
  title: string;
  slug: string;
  deposit_amount: number | null;
  deposit_instructions: string | null;
  currency: string | null;
  already_confirmed?: boolean;
};

export function confirmationEmail(title: string, url: string) {
  const subject = `Confirm your spot on "${title}"`;
  const text = [
    `Someone (hopefully you) asked to join the waitlist "${title}" on Geck Inspect with this email address.`,
    "",
    "Confirm your spot:",
    url,
    "",
    "You are not on the list until you open this link. It works for 7 days. If you did not ask to join, ignore this email and nothing happens.",
  ].join("\n");
  const safeUrl = escapeHtml(url);
  const html = shell(
    `Confirm your spot on &ldquo;${escapeHtml(title)}&rdquo;`,
    P(`Someone (hopefully you) asked to join this crested gecko waitlist on Geck Inspect with this email address.`) +
      `<p style="margin:0 0 24px 0;"><a href="${safeUrl}" style="display:inline-block;background:#10b981;color:#022c22;padding:14px 24px;border-radius:8px;font-weight:600;text-decoration:none;font-size:15px;">Confirm my spot</a></p>` +
      SMALL(`Or paste this link into your browser:<br><a href="${safeUrl}" style="color:#86efac;word-break:break-all;">${safeUrl}</a>`) +
      `<div style="height:16px"></div>` +
      SMALL("You are not on the list until you open this link. It works for 7 days. If you did not ask to join, ignore this email and nothing happens."),
  );
  return { subject, text, html };
}

function money(amount: number | null, currency: string | null): string | null {
  if (amount == null || !(Number(amount) > 0)) return null;
  const symbol = !currency || currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${Number(amount).toFixed(2).replace(/\.00$/, "")}`;
}

export function placeEmail(d: Details) {
  const url = `${SITE_URL}/waitlist/${encodeURIComponent(d.slug)}`;
  const place = d.position ? `You are number ${d.position} in line.` : "You are on the list.";
  const deposit = money(d.deposit_amount, d.currency);
  const agreed = d.terms_accepted_at
    ? new Date(d.terms_accepted_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;
  const subject = d.position ? `You're number ${d.position} on "${d.title}"` : `You're on "${d.title}"`;
  const textParts = [
    `Hi ${d.name},`,
    "",
    `Your spot on the waitlist "${d.title}" is confirmed. ${place}`,
    d.wanted ? `You said you are hoping for: ${d.wanted}` : null,
    deposit ? `\nDeposit: ${deposit}. Pay the breeder directly.${d.deposit_instructions ? `\nHow to pay: ${d.deposit_instructions}` : ""}` : null,
    d.terms ? `\nThe deposit terms you agreed to${agreed ? ` on ${agreed}` : ""}:\n${d.terms}` : null,
    "",
    `The waitlist page: ${url}`,
    "",
    "Keep this email as your record. The breeder has been told you joined and will contact you at this address.",
  ].filter((l) => l !== null);
  const html = shell(
    escapeHtml(place),
    P(`Hi ${escapeHtml(d.name)}, your spot on <strong>&ldquo;${escapeHtml(d.title)}&rdquo;</strong> is confirmed.`) +
      (d.wanted ? P(`You said you are hoping for: <strong>${escapeHtml(d.wanted)}</strong>`) : "") +
      (deposit
        ? P(`Deposit: <strong>${escapeHtml(deposit)}</strong>. Pay the breeder directly.${d.deposit_instructions ? `<br>How to pay: ${escapeHtml(d.deposit_instructions)}` : ""}`)
        : "") +
      (d.terms
        ? `<p style="margin:0 0 6px 0;color:#6ee7b7;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">The deposit terms you agreed to${agreed ? ` on ${escapeHtml(agreed)}` : ""}</p>
           <p style="margin:0 0 20px 0;color:#d1fae5;font-size:14px;line-height:1.6;white-space:pre-wrap;border-left:3px solid #10b981;padding-left:12px;">${escapeHtml(d.terms)}</p>`
        : "") +
      P(`<a href="${escapeHtml(url)}" style="color:#86efac;">Open the waitlist page</a>`) +
      SMALL("Keep this email as your record. The breeder has been told you joined and will contact you at this address."),
  );
  return { subject, text: textParts.join("\n"), html };
}

// deno-lint-ignore no-explicit-any
type Admin = any;

async function handleJoin(admin: Admin, payload: Record<string, unknown>): Promise<Response> {
  const slug = String(payload.slug || "").trim();
  if (!slug || slug.length > 200) return json({ error: "This waitlist link is invalid." }, 400);

  const { data: joined, error } = await admin.rpc("waitlist_join_pending", {
    p_slug: slug,
    p_name: String(payload.name || ""),
    p_email: String(payload.email || ""),
    p_wanted: payload.wanted ? String(payload.wanted) : null,
    p_notes: payload.notes ? String(payload.notes) : null,
    p_accept_terms: payload.accept_terms === true,
  });
  if (error) {
    // The database raises plain-language messages for the buyer.
    return json({ error: error.message || "Signup failed." }, 400);
  }
  const signupId = String(joined?.signup_id || "");
  if (!signupId) return json({ error: "Signup failed." }, 500);

  const { data: row } = await admin
    .from("gecko_waitlist_signups")
    .select("id, confirmation_sent_at, confirmation_send_count")
    .eq("id", signupId)
    .maybeSingle();
  const lastSent = row?.confirmation_sent_at ? new Date(row.confirmation_sent_at).getTime() : 0;
  const tooSoon = lastSent && Date.now() - lastSent < RESEND_GAP_MS;
  const usedUp = (row?.confirmation_send_count || 0) >= MAX_SENDS;
  // Same answer either way, so the response does not reveal who is listed.
  if (tooSoon || usedUp || !RESEND_API_KEY) {
    if (!RESEND_API_KEY) console.warn("waitlist-signup: RESEND_API_KEY missing, no email sent");
    return json({ status: "check_email" });
  }

  const details: Details | null = (await admin.rpc("waitlist_signup_details", { p_signup_id: signupId })).data;
  if (!details?.email) return json({ status: "check_email" });

  try {
    if (joined.confirmed) {
      // Already confirmed: send their place and terms again instead of a
      // new link.
      const mail = placeEmail(details);
      await sendEmail(details.email, mail.subject, mail.text, mail.html);
      await admin.from("gecko_waitlist_signups").update({
        confirmation_sent_at: new Date().toISOString(),
        confirmation_send_count: (row?.confirmation_send_count || 0) + 1,
      }).eq("id", signupId);
    } else {
      const token = newToken();
      await admin.from("gecko_waitlist_signups").update({
        confirm_token_hash: await sha256Hex(token),
        confirmation_sent_at: new Date().toISOString(),
        confirmation_send_count: (row?.confirmation_send_count || 0) + 1,
      }).eq("id", signupId);
      const url = `${SITE_URL}/waitlist/${encodeURIComponent(details.slug)}?confirm=${token}`;
      const mail = confirmationEmail(details.title, url);
      await sendEmail(details.email, mail.subject, mail.text, mail.html);
    }
  } catch (err) {
    console.warn("waitlist-signup: delivery failed", err);
    return json({ error: "We could not send the confirmation email. Please try again in a few minutes." }, 502);
  }
  return json({ status: "check_email" });
}

async function handleConfirm(admin: Admin, payload: Record<string, unknown>): Promise<Response> {
  const token = String(payload.token || "").trim();
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return json({ error: "This confirmation link is invalid or has expired." }, 400);
  }
  const { data, error } = await admin.rpc("confirm_waitlist_signup", { p_token_hash: await sha256Hex(token) });
  if (error) return json({ error: error.message || "Could not confirm." }, 400);
  const d = data as Details | null;
  if (!d) return json({ error: "This confirmation link is invalid or has expired." }, 404);

  if (!d.already_confirmed && RESEND_API_KEY) {
    try {
      const mail = placeEmail(d);
      await sendEmail(d.email, mail.subject, mail.text, mail.html);
    } catch (err) {
      // The signup is confirmed either way; the page shows the same facts.
      console.warn("waitlist-signup: place email failed", err);
    }
  }
  return json({
    status: "confirmed",
    already_confirmed: Boolean(d.already_confirmed),
    position: d.position,
    title: d.title,
    terms: d.terms,
    terms_accepted_at: d.terms_accepted_at,
    wanted: d.wanted,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "not configured" }, 500);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json body" }, 400);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  if (payload.action === "join") return await handleJoin(admin, payload);
  if (payload.action === "confirm") return await handleConfirm(admin, payload);
  return json({ error: "unknown action" }, 400);
});
