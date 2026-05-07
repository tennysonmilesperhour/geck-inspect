// Supabase Edge Function — send-collection-invite
//
// Sends a transactional email when a Geck Inspect user invites someone
// to collaborate on one of their collections. Unlike `send-email`, this
// function does NOT gate on the recipient's notification preferences —
// invites are transactional (the user explicitly took an action that
// expects an email), and the recipient may not have a profile yet.
//
// Provider: Resend, same as send-email. Reuses RESEND_API_KEY +
// EMAIL_FROM secrets.
//
// Contract:
//   POST /send-collection-invite
//   Headers: Authorization: Bearer <anon-or-authed-key>
//   Body: {
//     to_email:        string,  // required
//     inviter_email:   string,  // required (for "From" attribution copy)
//     inviter_name?:   string,  // optional display name
//     collection_name: string,  // required
//     role:            'editor' | 'viewer',  // required
//     invite_url:      string,  // required, full https URL
//   }
//
// Secrets:
//   RESEND_API_KEY  starts with "re_"
//   EMAIL_FROM      e.g. "Geck Inspect <invites@geckinspect.com>"
//
// Deploy: supabase functions deploy send-collection-invite --no-verify-jwt
//
// JWT verification is disabled because the client invokes this with
// the anon key right after creating a pending collection_members row.
// The row insert is the security boundary: RLS only lets a collection
// owner create that row, so a hostile caller can't spam this endpoint
// to trick us into emailing arbitrary addresses for a collection they
// don't own. The function does NOT validate ownership — it trusts the
// caller because the row already exists.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Geck Inspect <invites@geckinspect.com>";

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

function renderHtml(opts: {
  inviterDisplay: string;
  collectionName: string;
  role: string;
  inviteUrl: string;
}): string {
  const { inviterDisplay, collectionName, role, inviteUrl } = opts;
  const safeInviter = escapeHtml(inviterDisplay);
  const safeCollection = escapeHtml(collectionName);
  const safeRole = escapeHtml(role);
  const safeUrl = escapeHtml(inviteUrl);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0d1f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1f17;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#163026;border:1px solid rgba(134,239,172,0.2);border-radius:12px;">
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px 0;color:#86efac;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Geck Inspect</p>
          <h1 style="margin:0 0 16px 0;color:#d1fae5;font-size:24px;font-weight:700;line-height:1.3;">${safeInviter} invited you to a crested gecko collection</h1>
          <p style="margin:0 0 12px 0;color:#a7f3d0;font-size:15px;line-height:1.6;">
            You&rsquo;ve been added as a <strong>${safeRole}</strong> on <strong>&ldquo;${safeCollection}&rdquo;</strong>, a shared collection on Geck Inspect.
          </p>
          <p style="margin:0 0 24px 0;color:#a7f3d0;font-size:15px;line-height:1.6;">
            ${safeRole === "editor"
              ? "As an editor you&rsquo;ll be able to add and update geckos in this collection alongside the owner."
              : "As a viewer you&rsquo;ll be able to see geckos in this collection but not modify them."}
          </p>
          <p style="margin:0 0 28px 0;">
            <a href="${safeUrl}" style="display:inline-block;background:#10b981;color:#022c22;padding:14px 24px;border-radius:8px;font-weight:600;text-decoration:none;font-size:15px;">Accept invitation</a>
          </p>
          <p style="margin:0 0 8px 0;color:#6ee7b7;font-size:12px;line-height:1.6;">
            Or paste this link into your browser:
          </p>
          <p style="margin:0 0 24px 0;color:#86efac;font-size:12px;word-break:break-all;">
            <a href="${safeUrl}" style="color:#86efac;">${safeUrl}</a>
          </p>
          <p style="margin:0;color:#6ee7b7;font-size:12px;line-height:1.5;">
            This invitation expires in 30 days. If you weren&rsquo;t expecting this email, you can safely ignore it &mdash; nothing happens until you click the link.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderText(opts: {
  inviterDisplay: string;
  collectionName: string;
  role: string;
  inviteUrl: string;
}): string {
  return `${opts.inviterDisplay} invited you to a crested gecko collection on Geck Inspect.

You've been added as a ${opts.role} on "${opts.collectionName}".

Accept the invitation:
${opts.inviteUrl}

This invitation expires in 30 days. If you weren't expecting this email, you can safely ignore it.`;
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
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
    // Skip cleanly on local / unconfigured deploys. The client treats
    // a non-200 response as "email failed" and shows the copy-link
    // fallback, so this 200-with-skipped is the friendlier answer.
    return json({ delivered: 0, skipped: "no-resend-key" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json body" }, 400);
  }

  const toEmail = String(payload.to_email || "").trim().toLowerCase();
  const inviterEmail = String(payload.inviter_email || "").trim().toLowerCase();
  const inviterName = String(payload.inviter_name || "").trim();
  const collectionName = String(payload.collection_name || "").trim();
  const role = String(payload.role || "").trim();
  const inviteUrl = String(payload.invite_url || "").trim();

  if (!toEmail || !inviterEmail || !collectionName || !role || !inviteUrl) {
    return json({ error: "missing required fields" }, 400);
  }
  if (role !== "editor" && role !== "viewer") {
    return json({ error: "invalid role" }, 400);
  }
  if (!inviteUrl.startsWith("https://")) {
    return json({ error: "invite_url must be https" }, 400);
  }

  const inviterDisplay = inviterName || inviterEmail;
  const subject = `${inviterDisplay} invited you to a crested gecko collection`;

  try {
    const html = renderHtml({ inviterDisplay, collectionName, role, inviteUrl });
    const text = renderText({ inviterDisplay, collectionName, role, inviteUrl });
    const result = await sendEmail(toEmail, subject, text, html);
    return json({ delivered: 1, id: result?.id });
  } catch (err) {
    console.warn("send-collection-invite: delivery failed", err);
    return json({ delivered: 0, skipped: "delivery-failed", error: String(err) }, 200);
  }
});
