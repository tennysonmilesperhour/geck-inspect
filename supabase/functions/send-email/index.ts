// Supabase Edge Function — send-email
//
// Sibling to send-push. Called by the same notifications-INSERT trigger
// (the trigger POSTs to both functions in parallel). This function
// respects the existing email preferences on `profiles`:
//   - email_notifications_enabled (bool, master toggle)
//   - email_notification_types    (text[], legacy grouping keys)
//
// The legacy email list uses friendly grouping keys ("forum_replies",
// "following_activity", "gecko_of_day", "announcements") that don't
// always match Notification.type verbatim. We map them inside this
// function so the trigger can pass the raw Notification.type through
// just like it does for push, and the user's existing email
// preferences keep working without migration.
//
// Provider: Resend (resend.com) — simplest DX, no SDK needed, 3k
// free sends/month for solo projects. Swap the fetch in `sendEmail`
// if you want to go with SendGrid/SES later.
//
// Contract (same shape as send-push for symmetry):
//   POST /send-email
//   Headers: Authorization: Bearer <service-role-key>
//   Body: {
//     user_email: string,  // required
//     type:       string,  // required (Notification.type)
//     title:      string,  // used as subject line
//     body:       string,  // used as the plain-text body
//     url?:       string,  // link rendered in the CTA button
//   }
//
// Secrets (required):
//   RESEND_API_KEY       starts with "re_"
//   EMAIL_FROM           e.g. "Geck Inspect <alerts@geckinspect.com>"
//
// Deploy: supabase functions deploy send-email --no-verify-jwt

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Geck Inspect <alerts@geckinspect.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://geckinspect.com";

// Notification.type -> legacy email preference key.
// See src/pages/Settings.jsx notificationTypes list for the keys the
// user has been toggling in the Email Notifications card. If a type
// isn't mapped, we fall back to the raw key — meaning the user can
// still allowlist new types directly without a code change.
const TYPE_TO_EMAIL_KEY: Record<string, string> = {
  level_up: "level_up",
  expert_status: "expert_status",
  new_message: "new_message",
  new_follower: "new_follower",
  new_gecko_listing: "following_activity",
  new_breeding_plan: "following_activity",
  new_comment: "forum_replies",
  new_reply: "forum_replies",
  gecko_of_the_day: "gecko_of_day",
  future_breeding_ready: "breeding_updates",
  hatch_alert: "breeding_updates",
  feeding_due: "breeding_updates",
  announcement: "announcements",
};

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

function renderHtml(title: string, body: string, linkUrl: string): string {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replace(/\n/g, "<br>");
  const safeUrl = linkUrl.startsWith("http") ? linkUrl : `${SITE_URL}${linkUrl}`;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0d1f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1f17;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#163026;border:1px solid rgba(134,239,172,0.2);border-radius:12px;">
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 8px 0;color:#86efac;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Geck Inspect</p>
          <h1 style="margin:0 0 16px 0;color:#d1fae5;font-size:22px;font-weight:700;line-height:1.3;">${safeTitle}</h1>
          <p style="margin:0 0 24px 0;color:#a7f3d0;font-size:15px;line-height:1.55;">${safeBody}</p>
          <a href="${safeUrl}" style="display:inline-block;background:#10b981;color:#022c22;padding:12px 20px;border-radius:8px;font-weight:600;text-decoration:none;">Open in Geck Inspect</a>
          <p style="margin:32px 0 0 0;color:#6ee7b7;font-size:12px;line-height:1.5;">You&rsquo;re getting this because email notifications are enabled in your Geck Inspect settings. <a href="${SITE_URL}/Settings#email-notifications" style="color:#86efac;">Change preferences</a>.</p>
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

  if (!RESEND_API_KEY) {
    // Skip cleanly on local / unconfigured deploys.
    return json({ delivered: 0, skipped: "no-resend-key" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json body" }, 400);
  }

  const userEmail = String(payload.user_email || "").trim().toLowerCase();
  const type = String(payload.type || "").trim();
  const title = String(payload.title || "Geck Inspect").trim();
  const body = String(payload.body || "").trim();
  const url = String(payload.url || "/");

  if (!userEmail || !type) {
    return json({ error: "user_email and type are required" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("email_notifications_enabled, email_notification_types")
    .eq("email", userEmail)
    .maybeSingle();

  if (profileErr) {
    console.warn("send-email: profile lookup failed", profileErr);
    return json({ delivered: 0, skipped: "profile-lookup-failed" });
  }
  if (!profile || profile.email_notifications_enabled !== true) {
    return json({ delivered: 0, skipped: "master-off" });
  }

  const allowed: string[] = Array.isArray(profile.email_notification_types)
    ? profile.email_notification_types
    : [];
  const prefKey = TYPE_TO_EMAIL_KEY[type] || type;
  if (!allowed.includes(prefKey)) {
    return json({ delivered: 0, skipped: "type-not-allowed" });
  }

  try {
    const html = renderHtml(title, body, url);
    const result = await sendEmail(userEmail, title, `${body}\n\n${url.startsWith("http") ? url : `${SITE_URL}${url}`}`, html);
    return json({ delivered: 1, id: result?.id });
  } catch (err) {
    console.warn("send-email: delivery failed", err);
    return json({ delivered: 0, skipped: "delivery-failed", error: String(err) });
  }
});
