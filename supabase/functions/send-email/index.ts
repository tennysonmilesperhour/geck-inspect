// Supabase Edge Function: send-email
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
// Provider: Resend (resend.com). Simplest DX, no SDK needed, 3k
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
//     facts?:     object,  // lifecycle_* types only, see below
//   }
//
// Lifecycle emails (lifecycle_day0, _day1, _day3, _day7, _day14) come from
// enqueue_lifecycle_emails() with the member's own facts instead of a
// title and body. The words are built here by _shared/lifecycle-copy.ts,
// so the database never holds email copy. They ride the announcements
// preference (day 0, 1, 3) or the care updates one (day 7, 14).
//
// Delivery log: every email handed to Resend is tagged with its type and
// recorded as 'sent' in email_deliveries (record_email_event); the
// resend-webhook function adds delivered, opened, clicked, bounced and
// complained. An address that hard bounced or complained is in
// email_suppressions and is skipped here with "suppressed".
//
// Secrets (required):
//   RESEND_API_KEY       starts with "re_"
//   EMAIL_FROM           e.g. "Geck Inspect <alerts@geckinspect.com>"
// Optional:
//   EMAIL_POSTAL_ADDRESS the sender's postal address for the footer, which
//                        US law (CAN-SPAM) expects in commercial email
//   UNSUBSCRIBE_MAILTO   an address that handles unsubscribe requests by
//                        hand, added to the List-Unsubscribe header only
//                        when no signed link could be made
//
// Unsubscribe: every email carries a signed per-member token
// (email_unsubscribe_token, service role only). The footer links to
// SITE_URL/Unsubscribe?t=<token>, which works signed out, and the
// List-Unsubscribe header points at the email-unsubscribe function for
// one-click unsubscribe from the mail app (RFC 8058). If the token cannot
// be made even on a second try, the email still carries a working route:
// the header and footer point at the email switches in Settings, which
// every recipient can reach because addresses with no login are skipped.
//
// Recipients without a sign-in account (profiles imported from the old
// platform, no auth.users row) are skipped with "no-login".
//
// Deploy: supabase functions deploy send-email --no-verify-jwt

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { isLifecycleType, lifecycleEmail, lifecycleReason } from "../_shared/lifecycle-copy.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Geck Inspect <alerts@geckinspect.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://geckinspect.com";
const EMAIL_POSTAL_ADDRESS = (Deno.env.get("EMAIL_POSTAL_ADDRESS") || "").trim();
const UNSUBSCRIBE_MAILTO = (Deno.env.get("UNSUBSCRIBE_MAILTO") || "").trim();

// Notification.type -> legacy email preference key.
// See src/pages/Settings.jsx notificationTypes list for the keys the
// user has been toggling in the Email Notifications card. If a type
// isn't mapped, we fall back to the raw key, meaning the user can
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
  weighin_reminder: "breeding_updates",
  // Daily from enqueue_vet_followups() on a vet visit's follow-up date.
  vet_followup: "breeding_updates",
  // Daily from enqueue_season_planner_reminders() on a Season Planner task's due date.
  task_reminder: "breeding_updates",
  announcement: "announcements",
  // Sunday summary from enqueue_weekly_digest(); rides the announcements preference.
  weekly_digest: "announcements",
  // A buyer joining a waitlist or asking about a listing is a message to
  // the breeder. Before these lines both were dropped for every member,
  // because no one can switch on a key with those names.
  waitlist_signup: "new_message",
  marketplace_inquiry: "new_message",
  referral_reward: "announcements",
  referral_grant_ended: "announcements",
  submission_approved: "level_up",
  submission_rejected: "level_up",
  // An admin answered the member's support ticket. Rides the messages
  // preference, since it is a reply to something they wrote.
  support_reply: "new_message",
  // New-member emails in the first two weeks. Welcome, "add a gecko" and
  // the lineage email are product news to a new member; the two weigh-in
  // emails are care reminders, so they follow the care switch.
  lifecycle_day0: "announcements",
  lifecycle_day1: "announcements",
  lifecycle_day3: "announcements",
  lifecycle_day7: "breeding_updates",
  lifecycle_day14: "breeding_updates",
};

// Alerts for the admin team. They go to admins whatever their email
// settings say (a deletion request has a 30-day legal clock), and never to
// anyone who is not an admin.
const ADMIN_ALERT_TYPES = new Set(["account_deletion_request"]);

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

// Caller authentication. JWT verification is off at the gateway (the DB
// trigger is not a user), so the function checks the bearer itself. Two
// callers are trusted: application code holding the service-role key,
// and the notifications dispatcher trigger, which sends the Vault secret
// `notification_service_role_key`. The secret never leaves the database:
// verify_notification_dispatch_secret() compares it server-side and only
// the service role may call that RPC.
function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bearerToken(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
}

async function isAuthorizedCaller(provided: string): Promise<boolean> {
  if (!provided) return false;
  if (SERVICE_ROLE_KEY && constantTimeEq(provided, SERVICE_ROLE_KEY)) return true;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return false;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data, error } = await admin.rpc("verify_notification_dispatch_secret", {
      p_secret: provided,
    });
    if (error) {
      console.warn("send-email: dispatch secret check failed", error);
      return false;
    }
    return data === true;
  } catch (err) {
    console.warn("send-email: dispatch secret check threw", err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Where a member can stop these emails. With a signed token: the page
// link works signed out, and the one-click address takes the POST a mail
// app sends. Without one (the Vault secret is missing or the database did
// not answer twice) the email must still carry a route that works, because
// an email with no way out is the fastest way to be marked as spam: the
// email switches in Settings, plus a hand-handled mailbox if one is set.
// The old code dropped the header and the footer link entirely here.
type UnsubscribeLinks = { page: string; oneClick: string | null };

const SETTINGS_EMAIL_URL = `${SITE_URL}/Settings#email-notifications`;

function unsubscribeLinks(token: string | null | undefined): UnsubscribeLinks {
  if (!token) return { page: SETTINGS_EMAIL_URL, oneClick: null };
  const t = encodeURIComponent(token);
  return {
    page: `${SITE_URL}/Unsubscribe?t=${t}`,
    oneClick: `${SUPABASE_URL}/functions/v1/email-unsubscribe?t=${t}`,
  };
}

async function unsubscribeTokenOnce(
  supabase: RpcClient,
  profileId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("email_unsubscribe_token", { p_profile_id: profileId });
    if (error) {
      console.warn("send-email: unsubscribe token failed", error);
      return null;
    }
    return typeof data === "string" && data ? data : null;
  } catch (err) {
    console.warn("send-email: unsubscribe token threw", err);
    return null;
  }
}

// One retry covers a dropped connection; a missing secret fails both
// times and the caller falls back to the Settings route.
async function unsubscribeToken(
  supabase: RpcClient,
  profileId: string | null | undefined,
): Promise<string | null> {
  if (!profileId) return null;
  const first = await unsubscribeTokenOnce(supabase, profileId);
  if (first) return first;
  const second = await unsubscribeTokenOnce(supabase, profileId);
  if (!second) console.warn("send-email: no unsubscribe token, using the Settings link");
  return second;
}

// Whether the address belongs to an account that can sign in
// (email_has_login, service role only). null means "could not tell": the
// lookup failed or the migration that adds the function is not applied
// yet. The caller then sends as before, so a database hiccup never drops
// mail to a real member.
type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

// Has this address hard bounced or complained (email_is_suppressed)? null
// means "could not tell", and the email goes out as before.
async function isSuppressed(supabase: RpcClient, email: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.rpc("email_is_suppressed", { p_email: email });
    if (error) {
      console.warn("send-email: suppression check failed", error.message);
      return null;
    }
    return typeof data === "boolean" ? data : null;
  } catch (err) {
    console.warn("send-email: suppression check threw", err);
    return null;
  }
}

// The 'sent' row in the delivery log. Best effort: a failed write is
// logged and never stops or repeats the email.
async function recordSent(supabase: RpcClient, resendId: unknown, email: string, type: string) {
  if (typeof resendId !== "string" || !resendId) return;
  try {
    const { error } = await supabase.rpc("record_email_event", {
      p_event: "sent",
      p_event_key: `sent:${resendId}`,
      p_resend_email_id: resendId,
      p_email: email,
      p_email_type: type,
    });
    if (error) console.warn("send-email: delivery log write failed", error.message);
  } catch (err) {
    console.warn("send-email: delivery log write threw", err);
  }
}

async function hasLogin(supabase: RpcClient, email: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.rpc("email_has_login", { p_email: email });
    if (error) {
      console.warn("send-email: login check failed", error.message);
      return null;
    }
    return typeof data === "boolean" ? data : null;
  } catch (err) {
    console.warn("send-email: login check threw", err);
    return null;
  }
}

// The button's address. Notification links are in-app paths (the
// database's safe_internal_link makes sure of it); this checks again so a
// bad row can never send a reader to another website: an in-app path or
// a full Geck Inspect address is kept, anything else opens the home page.
function absoluteLink(linkUrl: string): string {
  const link = String(linkUrl || "/").trim();
  if (/^\/(?![\/\\])/.test(link)) return `${SITE_URL}${link}`;
  if (link.startsWith(`${SITE_URL}/`)) return link;
  return `${SITE_URL}/`;
}

// The same address for the plain-text part: anything outside the usual
// URL characters (quotes, angle brackets, spaces, backticks, backslashes,
// control characters) is percent-encoded, so a mail app cannot read part
// of it as text or markup.
function textLink(url: string): string {
  return url.replace(/[^A-Za-z0-9\-._~:/?#@!$&()*+,;=%]/g, (c) => {
    const encoded = encodeURIComponent(c);
    return encoded === c ? `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}` : encoded;
  });
}

type RenderOptions = {
  // The button's words. Notifications say "Open in Geck Inspect".
  cta?: string;
  // Why this email came. Defaults to the notification-settings line.
  reason?: string;
};

const DEFAULT_REASON = "You\u2019re getting this because email notifications are enabled in your Geck Inspect settings.";

function renderHtml(
  title: string,
  body: string,
  linkUrl: string,
  unsubscribe: UnsubscribeLinks,
  options: RenderOptions = {},
): string {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replace(/\n/g, "<br>");
  const safeCta = escapeHtml(options.cta || "Open in Geck Inspect");
  const safeReason = escapeHtml(options.reason || DEFAULT_REASON);
  const unsubscribeWords = unsubscribe.oneClick ? "unsubscribe from these emails" : "turn these emails off";
  const postal = EMAIL_POSTAL_ADDRESS
    ? `<br>Geck Inspect, ${escapeHtml(EMAIL_POSTAL_ADDRESS)}`
    : "";
  // Escaped for the href attribute: a quote or bracket in the link can
  // never end the attribute and add markup to the email.
  const safeUrl = escapeHtml(absoluteLink(linkUrl));
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0d1f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1f17;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#163026;border:1px solid rgba(134,239,172,0.2);border-radius:12px;">
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 8px 0;color:#86efac;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Geck Inspect</p>
          <h1 style="margin:0 0 16px 0;color:#d1fae5;font-size:22px;font-weight:700;line-height:1.3;">${safeTitle}</h1>
          <p style="margin:0 0 24px 0;color:#a7f3d0;font-size:15px;line-height:1.55;">${safeBody}</p>
          <a href="${safeUrl}" style="display:inline-block;background:#10b981;color:#022c22;padding:12px 20px;border-radius:8px;font-weight:600;text-decoration:none;">${safeCta}</a>
          <p style="margin:32px 0 0 0;color:#6ee7b7;font-size:12px;line-height:1.5;">${safeReason} <a href="${SETTINGS_EMAIL_URL}" style="color:#86efac;">Change preferences</a> or <a href="${escapeHtml(unsubscribe.page)}" style="color:#86efac;">${unsubscribeWords}</a>.${postal}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

class RateLimited extends Error {
  retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}

// List-Unsubscribe plus List-Unsubscribe-Post makes Gmail, Yahoo and
// Apple Mail show their own Unsubscribe button, which POSTs to the
// one-click address. Bulk senders are expected to include both.
// Without a signed link there is no one-click address, so the header
// names the Settings page (and the hand-handled mailbox when one is set)
// and leaves out List-Unsubscribe-Post, which promises one-click.
function unsubscribeHeaders(unsubscribe: UnsubscribeLinks): Record<string, string> {
  if (unsubscribe.oneClick) {
    return {
      "List-Unsubscribe": `<${unsubscribe.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }
  const targets = [`<${unsubscribe.page}>`];
  if (/^[^\s@<>]+@[^\s@<>]+$/.test(UNSUBSCRIBE_MAILTO)) {
    targets.push(`<mailto:${UNSUBSCRIBE_MAILTO}?subject=unsubscribe>`);
  }
  return { "List-Unsubscribe": targets.join(", ") };
}

// Resend tags must be letters, digits, underscores or dashes. The type
// tag comes back on every webhook, which is how the delivery log knows
// which email an open or a bounce belongs to.
function typeTag(type: string): string {
  return type.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64) || "other";
}

async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
  headers?: Record<string, string>,
  tags?: Array<{ name: string; value: string }>,
) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html,
      ...(headers ? { headers } : {}),
      ...(tags ? { tags } : {}),
    }),
  });
  if (!res.ok) {
    const msg = await res.text();
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after")) || 1;
      throw new RateLimited(`Resend 429: ${msg}`, retryAfter * 1000);
    }
    throw new Error(`Resend ${res.status}: ${msg}`);
  }
  return await res.json();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Resend accepts about two requests per second per account. The Sunday
// digest and the reminder jobs insert dozens of notifications in one go, and
// each one calls this function at the same moment, so on 27 Sep 21 of the
// digest emails failed with 429 and were dropped. Spread each burst over a
// few seconds, then retry on 429 with growing, jittered waits.
async function sendWithRetry(
  to: string,
  subject: string,
  text: string,
  html: string,
  headers?: Record<string, string>,
  tags?: Array<{ name: string; value: string }>,
) {
  await sleep(Math.random() * 8_000);
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await sendEmail(to, subject, text, html, headers, tags);
    } catch (err) {
      if (!(err instanceof RateLimited) || attempt >= 6) throw err;
      await sleep(Math.max(err.retryAfterMs, 1_000 * 2 ** attempt) + Math.random() * 2_000);
    }
  }
}

// Supabase keeps a function running for work handed to waitUntil after the
// response is sent, so the database trigger that calls this is not held open
// while a burst drains.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  if (!(await isAuthorizedCaller(bearerToken(req)))) {
    return json({ error: "unauthorized" }, 401);
  }

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
  let title = String(payload.title || "Geck Inspect").trim();
  let body = String(payload.body || "").trim();
  let url = String(payload.url || "/");
  const render: RenderOptions = {};

  if (!userEmail || !type) {
    return json({ error: "user_email and type are required" }, 400);
  }

  // Lifecycle emails arrive as facts; the words are made here.
  if (isLifecycleType(type)) {
    const facts = payload.facts && typeof payload.facts === "object"
      ? payload.facts as Record<string, unknown>
      : {};
    const email = lifecycleEmail(type, facts);
    if (!email) return json({ delivered: 0, skipped: "lifecycle-not-applicable" });
    title = email.title;
    body = email.body;
    url = email.url;
    render.cta = email.cta;
    render.reason = lifecycleReason(facts);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, role, email_notifications_enabled, email_notification_types")
    .eq("email", userEmail)
    .maybeSingle();

  if (profileErr) {
    console.warn("send-email: profile lookup failed", profileErr);
    return json({ delivered: 0, skipped: "profile-lookup-failed" });
  }
  if (ADMIN_ALERT_TYPES.has(type)) {
    if (!profile || profile.role !== "admin") {
      return json({ delivered: 0, skipped: "not-admin" });
    }
  } else {
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

    // Profiles imported from the old platform have no sign-in account, so
    // they cannot open the app or change these settings. More than half of
    // notification mail was going to them. Admin alerts above always go to
    // real admin accounts and skip this check.
    if ((await hasLogin(supabase, userEmail)) === false) {
      return json({ delivered: 0, skipped: "no-login" });
    }

    // A hard bounce or a spam complaint stops every email that is not an
    // admin alert. Mailing those addresses again is what gets a sending
    // domain blocked, and then reminders stop reaching everyone.
    if ((await isSuppressed(supabase, userEmail)) === true) {
      return json({ delivered: 0, skipped: "suppressed" });
    }
  }

  const unsubscribe = unsubscribeLinks(await unsubscribeToken(supabase, profile?.id));
  const html = renderHtml(title, body, url, unsubscribe, render);
  const text = `${body}\n\n${render.cta ? `${render.cta}: ` : ""}${textLink(absoluteLink(url))}` +
    `\n\n${render.reason || DEFAULT_REASON}` +
    (unsubscribe.oneClick
      ? `\nUnsubscribe from these emails: ${unsubscribe.page}`
      : `\nTurn these emails off in Settings: ${unsubscribe.page}`) +
    (EMAIL_POSTAL_ADDRESS ? `\nGeck Inspect, ${EMAIL_POSTAL_ADDRESS}` : "");
  const tags = [{ name: "type", value: typeTag(type) }];
  const delivery = sendWithRetry(userEmail, title, text, html, unsubscribeHeaders(unsubscribe), tags)
    .then(async (result) => {
      await recordSent(supabase, result?.id, userEmail, typeTag(type));
      return { delivered: 1, id: result?.id };
    })
    .catch((err) => {
      console.warn("send-email: delivery failed", err);
      return { delivered: 0, skipped: "delivery-failed", error: String(err) };
    });

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(delivery);
    return json({ queued: 1 }, 202);
  }
  return json(await delivery);
});
