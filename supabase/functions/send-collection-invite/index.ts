// Supabase Edge Function: send-collection-invite
//
// Sends a transactional email when a Geck Inspect user invites someone
// to collaborate on one of their collections. Unlike `send-email`, this
// function does NOT gate on the recipient's notification preferences.
// Invites are transactional (the user explicitly took an action that
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
// Ownership transfers (added 3 Oct 2026). The same function also mails a
// buyer the claim link for a gecko transfer, so the transactional mail
// lives in one place:
//
//   Body: { kind: 'transfer', token: string }
//
// The function looks the transfer up itself: the caller must be the
// seller who created it, it must still be pending, and the link it mails
// is always https://geckinspect.com/claim/<token>. Nothing else from the
// request ends up in the email. Calls without `kind` are collection
// invites, exactly as before.
//
// Deploy: supabase functions deploy send-collection-invite --no-verify-jwt
//
// JWT verification is off at the gateway, so the function verifies the
// caller itself: the bearer must be a valid user session, that user must
// be the inviter, the target address must already have a pending
// collection_members row in a collection the caller owns, and the link
// must point at our own /collection-invite/ route. Anything else is 401,
// 403 or 400. Before this check the endpoint was an open email relay.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Geck Inspect <invites@geckinspect.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const SITE_URL = "https://geckinspect.com";
// A seller who starts more than this many transfers in a day stops
// getting transfer emails sent (keeps this from becoming a bulk mailer).
const TRANSFER_EMAILS_PER_DAY = 25;

// Only links into our own claim route may be mailed out.
const ALLOWED_INVITE_PREFIXES = [
  "https://geckinspect.com/collection-invite/",
  "https://www.geckinspect.com/collection-invite/",
];

function bearerToken(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
}

// Escape the two LIKE wildcards so an ilike equality check stays exact.
function likeLiteral(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

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
            This invitation expires in 30 days. If you weren&rsquo;t expecting this email, you can safely ignore it. Nothing happens until you click the link.
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

type TransferEmail = {
  sellerName: string;
  animalName: string;
  message: string;
  salePrice: number | null;
  expiresAt: string | null;
  claimUrl: string;
};

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "in 72 hours";
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return "in 72 hours";
  return `on ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
}

function formatPrice(price: number | null): string {
  if (price == null || !Number.isFinite(price)) return "";
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderTransferHtml(t: TransferEmail): string {
  const seller = escapeHtml(t.sellerName);
  const animal = escapeHtml(t.animalName);
  const url = escapeHtml(t.claimUrl);
  const price = formatPrice(t.salePrice);
  const messageBlock = t.message
    ? `<p style="margin:0 0 8px 0;color:#6ee7b7;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Message from the seller</p>
          <p style="margin:0 0 20px 0;color:#d1fae5;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(t.message)}</p>`
    : "";
  const priceBlock = price
    ? `<p style="margin:0 0 20px 0;color:#a7f3d0;font-size:15px;line-height:1.6;">Sale price: <strong>${escapeHtml(price)}</strong></p>`
    : "";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0d1f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1f17;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#163026;border:1px solid rgba(134,239,172,0.2);border-radius:12px;">
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px 0;color:#86efac;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Geck Inspect</p>
          <h1 style="margin:0 0 16px 0;color:#d1fae5;font-size:24px;font-weight:700;line-height:1.3;">${seller} is transferring ${animal} to you</h1>
          <p style="margin:0 0 20px 0;color:#a7f3d0;font-size:15px;line-height:1.6;">
            Claim ${animal} to add it to your Geck Inspect collection with its full history: weights, feedings, sheds, lineage and passport.
          </p>
          ${messageBlock}
          ${priceBlock}
          <p style="margin:0 0 28px 0;">
            <a href="${url}" style="display:inline-block;background:#10b981;color:#022c22;padding:14px 24px;border-radius:8px;font-weight:600;text-decoration:none;font-size:15px;">Claim ${animal}</a>
          </p>
          <p style="margin:0 0 8px 0;color:#6ee7b7;font-size:12px;line-height:1.6;">
            Or paste this link into your browser:
          </p>
          <p style="margin:0 0 24px 0;color:#86efac;font-size:12px;word-break:break-all;">
            <a href="${url}" style="color:#86efac;">${url}</a>
          </p>
          <p style="margin:0;color:#6ee7b7;font-size:12px;line-height:1.5;">
            The link expires ${escapeHtml(formatExpiry(t.expiresAt))}. Sign in or create a free account with this email address to claim it. If you weren&rsquo;t expecting this email, you can safely ignore it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderTransferText(t: TransferEmail): string {
  const price = formatPrice(t.salePrice);
  return [
    `${t.sellerName} is transferring ${t.animalName} to you on Geck Inspect.`,
    "",
    "Claim it to add it to your collection with its full history:",
    t.claimUrl,
    "",
    t.message ? `Message from the seller:\n${t.message}\n` : null,
    price ? `Sale price: ${price}\n` : null,
    `The link expires ${formatExpiry(t.expiresAt)}. Sign in or create a free account with this email address to claim it. If you weren't expecting this email, you can safely ignore it.`,
  ].filter((line) => line !== null).join("\n");
}

// Ownership transfer email. Everything that goes into the mail is read
// from the database by token; the request only says which transfer.
async function handleTransfer(req: Request, payload: Record<string, unknown>): Promise<Response> {
  const transferToken = String(payload.token || "").trim();
  if (transferToken.length < 8 || !/^[A-Za-z0-9-]+$/.test(transferToken)) {
    return json({ error: "invalid token" }, 400);
  }

  const bearer = bearerToken(req);
  if (!bearer || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return json({ error: "unauthorized" }, 401);
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const callerId = userData?.user?.id || "";
  const callerEmail = String(userData?.user?.email || "").trim().toLowerCase();
  if (userErr || !callerId || !callerEmail) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: tr, error: trErr } = await admin
    .from("transfer_requests")
    .select("id, animal_id, animal_type, from_user_id, created_by, to_email, status, expires_at, message, sale_price")
    .eq("token", transferToken)
    .maybeSingle();
  if (trErr) {
    console.warn("send-collection-invite: transfer lookup failed", trErr);
    return json({ error: "lookup failed" }, 500);
  }
  if (!tr) return json({ error: "transfer not found" }, 404);

  const isSeller = tr.from_user_id === callerId ||
    String(tr.created_by || "").trim().toLowerCase() === callerEmail;
  if (!isSeller) {
    return json({ error: "only the seller can email this transfer" }, 403);
  }
  if (tr.status !== "pending" || (tr.expires_at && new Date(tr.expires_at) < new Date())) {
    return json({ error: "transfer is not pending" }, 409);
  }
  const toEmail = String(tr.to_email || "").trim().toLowerCase();
  if (!toEmail || !toEmail.includes("@")) {
    return json({ error: "transfer has no recipient" }, 400);
  }

  // Keep this from becoming a bulk mailer: a seller who started more than
  // a day's worth of transfers gets the copy-link fallback instead.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recent } = await admin
    .from("transfer_requests")
    .select("id", { count: "exact", head: true })
    .eq("from_user_id", callerId)
    .gte("created_date", since);
  if ((recent || 0) > TRANSFER_EMAILS_PER_DAY) {
    return json({ error: "too many transfers today" }, 429);
  }

  const animalTable = tr.animal_type === "other_reptile" ? "other_reptiles" : "geckos";
  const { data: animal } = await admin
    .from(animalTable)
    .select("name")
    .eq("id", tr.animal_id)
    .maybeSingle();
  const animalName = String(animal?.name || "").trim() ||
    (tr.animal_type === "other_reptile" ? "a reptile" : "a crested gecko");

  // Display name only. The seller's email address is never put in the mail.
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, breeder_name, business_name")
    .ilike("email", likeLiteral(callerEmail))
    .limit(1)
    .maybeSingle();
  const sellerName = [profile?.full_name, profile?.breeder_name, profile?.business_name]
    .map((v) => String(v || "").trim())
    .find(Boolean) || "A Geck Inspect keeper";

  const t: TransferEmail = {
    sellerName,
    animalName,
    message: String(tr.message || "").trim(),
    salePrice: tr.sale_price == null ? null : Number(tr.sale_price),
    expiresAt: tr.expires_at || null,
    claimUrl: `${SITE_URL}/claim/${encodeURIComponent(transferToken)}`,
  };

  try {
    const result = await sendEmail(
      toEmail,
      `${sellerName} is transferring ${animalName} to you`,
      renderTransferText(t),
      renderTransferHtml(t),
    );
    return json({ delivered: 1, id: result?.id });
  } catch (err) {
    console.warn("send-collection-invite: transfer delivery failed", err);
    return json({ delivered: 0, skipped: "delivery-failed", error: String(err) }, 200);
  }
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

  if (payload.kind === "transfer") {
    return await handleTransfer(req, payload);
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
  if (!ALLOWED_INVITE_PREFIXES.some((p) => inviteUrl.startsWith(p))) {
    return json({ error: "invite_url must point at geckinspect.com/collection-invite" }, 400);
  }

  // Who is calling? The bearer must be a real user session and that user
  // must be the inviter named in the payload.
  const token = bearerToken(req);
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return json({ error: "unauthorized" }, 401);
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const callerEmail = String(userData?.user?.email || "").trim().toLowerCase();
  if (userErr || !callerEmail) {
    return json({ error: "unauthorized" }, 401);
  }
  if (callerEmail !== inviterEmail) {
    return json({ error: "inviter does not match the signed-in user" }, 403);
  }

  // Does the caller own a collection with a pending invite for this
  // address? The pending row is created by the client under RLS before
  // this function is called, so its absence means the request is forged.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: owned, error: ownedErr } = await admin
    .from("collections")
    .select("id")
    .ilike("owner_email", likeLiteral(callerEmail));
  if (ownedErr) {
    console.warn("send-collection-invite: collections lookup failed", ownedErr);
    return json({ error: "lookup failed" }, 500);
  }
  const ownedIds = (owned || []).map((c: { id: string }) => c.id);
  if (ownedIds.length === 0) {
    return json({ error: "no collection owned by caller" }, 403);
  }
  const { data: pending, error: pendingErr } = await admin
    .from("collection_members")
    .select("id")
    .in("collection_id", ownedIds)
    .ilike("member_email", likeLiteral(toEmail))
    .eq("status", "pending")
    .limit(1);
  if (pendingErr) {
    console.warn("send-collection-invite: members lookup failed", pendingErr);
    return json({ error: "lookup failed" }, 500);
  }
  if (!pending || pending.length === 0) {
    return json({ error: "no pending invite for that address" }, 403);
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
