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
//     weekly?:    object,  // weekly_notes only, see below
//   }
//
// Lifecycle emails (lifecycle_day0, _day1, _day3, _day7, _day14) come from
// enqueue_lifecycle_emails() with the member's own facts instead of a
// title and body. The words are built here by _shared/lifecycle-copy.ts,
// so the database never holds email copy. They ride the announcements
// preference (day 0, 1, 3) or the care updates one (day 7, 14).
//
// Weekly Gecko Notes (type weekly_notes) come from enqueue_weekly_notes()
// with only { weekly: { run_at } }: the job asks "is a note due for this
// member?", and this function decides, because only it can see the two
// things that decide it: the EMAIL_POSTAL_ADDRESS secret and the catalog of
// written notes (_shared/weekly-notes.generated.ts, built from
// content/weekly-notes). The order matters, and is why a skip never uses up
// a member's next note:
//   1. Every check that can skip comes first: the run marker, the postal
//      address (US law, CAN-SPAM, wants one in commercial email), a
//      non-empty catalog, the master switch, a login, the suppression list
//      and a signed unsubscribe token (a commercial email must carry an
//      unsubscribe that works signed out). Nothing is written by any of them.
//   2. Then claim_weekly_note: under a per-member lock the database checks
//      every rule again (the weekly preference, the 16-day lifecycle window,
//      7 days since the last note, 20 hours since any lifecycle email),
//      picks the first slug the member has not had and writes the ledger row
//      (unique on address and slug). A caught-up member gets no row.
//   3. Only a claimed note is sent.
// A Resend failure after the claim leaves that note spent: never sending a
// member the same note twice wins over always sending. The payload's title,
// body and url are ignored for this type.
//
// Visitors without an account (the sign-up form on the public guide pages,
// confirmed by email; docs/planning/weekly-notes-2026-10.md, section 9)
// come from the same job marked weekly.audience = "visitor". They have no
// profile, login or Settings page, so they take a short path of their own:
// the same postal address and catalog checks, then the suppression list,
// their own signed stop link (weekly_notes_subscriber_token) and the visitor
// claim (claim_weekly_note_subscriber, visitor order, shared ledger). Their
// note carries the visitor button, a footer that says where they signed up,
// and one link that stops these emails (&scope=visitor), with no Settings
// link.
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
// one-click unsubscribe from the mail app (RFC 8058). A weekly note adds
// &scope=weekly to both, so its links stop only Weekly Gecko Notes and keep
// reminders and other email. If the token cannot
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
import { isLifecycleType, LIFECYCLE_SIGNOFF, lifecycleEmail, lifecycleReason } from "../_shared/lifecycle-copy.ts";
import { isWeeklyNotesType, weeklyNoteEmail, weeklyNoteSlugs, weeklyNoteVisitorSlugs, weeklyNoteVisitorSteps, WEEKLY_NOTES_REASON, WEEKLY_NOTES_STOP_WORDS, WEEKLY_NOTES_VISITOR_REASON } from "../_shared/weekly-notes.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Geck Inspect <alerts@geckinspect.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://geckinspect.com";
const EMAIL_POSTAL_ADDRESS = (Deno.env.get("EMAIL_POSTAL_ADDRESS") || "").trim();
const UNSUBSCRIBE_MAILTO = (Deno.env.get("UNSUBSCRIBE_MAILTO") || "").trim();
// The getting-started emails and Weekly Gecko Notes are letters from a
// person, so they can come from one ("Tennyson at Geck Inspect
// <tennyson@geckinspect.com>") with replies going to a mailbox someone
// reads. Both are optional: unset, those emails use EMAIL_FROM and no
// Reply-To, as before. docs/marketing/email-brain.md says why.
const EMAIL_FROM_PERSONAL = (Deno.env.get("EMAIL_FROM_PERSONAL") || "").trim();
const EMAIL_REPLY_TO = (Deno.env.get("EMAIL_REPLY_TO") || "").trim();

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

// scope "weekly" (Weekly Gecko Notes) makes both links stop only those
// emails; scope "visitor" is a visitor's stop link, a different token. The
// token stays the first parameter, so resend-webhook's query stripping and
// the t= redaction in src/lib/ga.js still cover it.
function unsubscribeLinks(token: string | null | undefined, scope?: "weekly" | "visitor"): UnsubscribeLinks {
  if (!token) return { page: SETTINGS_EMAIL_URL, oneClick: null };
  const t = encodeURIComponent(token);
  const s = scope ? `&scope=${scope}` : "";
  return {
    page: `${SITE_URL}/Unsubscribe?t=${t}${s}`,
    oneClick: `${SUPABASE_URL}/functions/v1/email-unsubscribe?t=${t}${s}`,
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
  // The unsubscribe link's words, when the link stops only one kind of
  // email ("stop Weekly Gecko Notes"). Defaults to the all-email words.
  unsubscribeWords?: string;
  // false leaves out "Change preferences" (a visitor has no Settings page).
  settingsLink?: boolean;
  // The line the inbox shows after the subject. Without it, mail apps
  // show the first words of the email instead.
  preheader?: string;
  // A plain letter (light page, no heading, signed by a person) instead
  // of the dark notification card. Used by the getting-started emails and
  // Weekly Gecko Notes, which also come from EMAIL_FROM_PERSONAL.
  letter?: boolean;
  // The letter's sign-off, one line per entry.
  signoff?: string[];
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
  const safeCta = escapeHtml(options.cta || "Open in Geck Inspect");
  const safeReason = escapeHtml(options.reason || DEFAULT_REASON);
  const words = options.unsubscribeWords || (unsubscribe.oneClick ? "unsubscribe from these emails" : "turn these emails off");
  const settings = options.settingsLink !== false;
  const unsubscribeWords = escapeHtml(settings ? words : `${words.charAt(0).toUpperCase()}${words.slice(1)}`);
  const postal = EMAIL_POSTAL_ADDRESS
    ? `<br>Geck Inspect, ${escapeHtml(EMAIL_POSTAL_ADDRESS)}`
    : "";
  // Escaped for the href attribute: a quote or bracket in the link can
  // never end the attribute and add markup to the email.
  const safeUrl = escapeHtml(absoluteLink(linkUrl));
  // Hidden text the inbox shows after the subject, padded with
  // zero-width spaces so the mail app does not pull body text in after it.
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;opacity:0;">${escapeHtml(options.preheader)}${"&#8203;&#160;".repeat(60)}</div>`
    : "";

  if (options.letter) {
    const linkColor = "#047857";
    const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
      .map((p) => `<p style="margin:0 0 16px 0;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("\n          ");
    const signoff = (options.signoff || []).length
      ? `<p style="margin:24px 0 0 0;">${options.signoff!.map(escapeHtml).join("<br>")}</p>`
      : "";
    const preferences = settings
      ? `<a href="${SETTINGS_EMAIL_URL}" style="color:#6b7280;">Change preferences</a> or `
      : "";
    return `<!doctype html>
<html><head><meta name="color-scheme" content="light"><title>${safeTitle}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1f2937;text-align:left;">
          ${paragraphs}
          <p style="margin:8px 0 16px 0;"><a href="${safeUrl}" style="display:inline-block;background:#047857;color:#ffffff;padding:12px 20px;border-radius:6px;font-weight:600;text-decoration:none;">${safeCta}</a></p>
          ${signoff}
          <p style="margin:40px 0 0 0;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;">${safeReason} ${preferences}<a href="${escapeHtml(unsubscribe.page)}" style="color:${linkColor};">${unsubscribeWords}</a>.${postal}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  const safeBody = escapeHtml(body).replace(/\n/g, "<br>");
  const preferences = settings
    ? `<a href="${SETTINGS_EMAIL_URL}" style="color:#86efac;">Change preferences</a> or `
    : "";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0d1f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1f17;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#163026;border:1px solid rgba(134,239,172,0.2);border-radius:12px;">
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 8px 0;color:#86efac;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Geck Inspect</p>
          <h1 style="margin:0 0 16px 0;color:#d1fae5;font-size:22px;font-weight:700;line-height:1.3;">${safeTitle}</h1>
          <p style="margin:0 0 24px 0;color:#a7f3d0;font-size:15px;line-height:1.55;">${safeBody}</p>
          <a href="${safeUrl}" style="display:inline-block;background:#10b981;color:#022c22;padding:12px 20px;border-radius:8px;font-weight:600;text-decoration:none;">${safeCta}</a>
          <p style="margin:32px 0 0 0;color:#6ee7b7;font-size:12px;line-height:1.5;">${safeReason} ${preferences}<a href="${escapeHtml(unsubscribe.page)}" style="color:#86efac;">${unsubscribeWords}</a>.${postal}</p>
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

type Envelope = { from?: string; replyTo?: string };

async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
  headers?: Record<string, string>,
  tags?: Array<{ name: string; value: string }>,
  envelope: Envelope = {},
) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: envelope.from || EMAIL_FROM,
      ...(envelope.replyTo ? { reply_to: envelope.replyTo } : {}),
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
  envelope: Envelope = {},
) {
  await sleep(Math.random() * 8_000);
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await sendEmail(to, subject, text, html, headers, tags, envelope);
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
    // Only enqueue_lifecycle_emails() sends these, and it always sends
    // facts. Anything else with a lifecycle type (a notification row a
    // member wrote for themselves reaches this function through the
    // dispatcher with a title and body, no facts) is skipped, so the
    // master switch and the once-per-step ledger stay the only way in.
    if (!payload.facts || typeof payload.facts !== "object" || Array.isArray(payload.facts)) {
      return json({ delivered: 0, skipped: "lifecycle-without-facts" });
    }
    const facts = payload.facts as Record<string, unknown>;
    const email = lifecycleEmail(type, facts, { canReply: Boolean(EMAIL_REPLY_TO) });
    if (!email) return json({ delivered: 0, skipped: "lifecycle-not-applicable" });
    title = email.title;
    body = email.body;
    url = email.url;
    render.cta = email.cta;
    render.reason = lifecycleReason(facts);
    render.preheader = email.preheader;
    render.letter = true;
    render.signoff = LIFECYCLE_SIGNOFF;
  }

  // Weekly Gecko Notes: see the order in the header. Nothing in this block
  // or the checks after it writes anything; only the claim further down does.
  const weekly = isWeeklyNotesType(type);
  if (weekly) {
    // Only enqueue_weekly_notes() sends this type, always with a run
    // marker. A notification row a member writes for themselves reaches
    // this function through the dispatcher with no weekly field, so it can
    // never send one (the same rule as lifecycle-without-facts).
    if (!payload.weekly || typeof payload.weekly !== "object" || Array.isArray(payload.weekly)) {
      return json({ delivered: 0, skipped: "weekly-notes-without-run" });
    }
    if (!EMAIL_POSTAL_ADDRESS) {
      return json({ delivered: 0, skipped: "weekly-notes-no-postal-address" });
    }
    if (weeklyNoteSlugs().length === 0) {
      return json({ delivered: 0, skipped: "weekly-notes-empty" });
    }
    // The words come from the catalog only, never from the payload.
    title = "Geck Inspect";
    body = "";
    url = "/";
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  if (weekly && (payload.weekly as Record<string, unknown>).audience === "visitor") {
    return await sendVisitorNote(supabase, userEmail);
  }

  // The select stays as it is for every type, weekly included: this
  // function can deploy before the migration that adds
  // email_weekly_notes_enabled, and an unknown column here would skip every
  // email as profile-lookup-failed. claim_weekly_note checks that switch.
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

    // Weekly notes have their own switch (profiles.email_weekly_notes_enabled),
    // which claim_weekly_note checks, not a key in this list. Without this
    // exception the unmapped type would be skipped for everyone.
    if (!weekly) {
      const allowed: string[] = Array.isArray(profile.email_notification_types)
        ? profile.email_notification_types
        : [];
      const prefKey = TYPE_TO_EMAIL_KEY[type] || type;
      if (!allowed.includes(prefKey)) {
        return json({ delivered: 0, skipped: "type-not-allowed" });
      }
    }

    // Profiles imported from the old platform have no sign-in account, so
    // they cannot open the app or change these settings. More than half of
    // notification mail was going to them. Admin alerts above always go to
    // real admin accounts and skip this check.
    const login = await hasLogin(supabase, userEmail);
    if (login === false) {
      return json({ delivered: 0, skipped: "no-login" });
    }

    // A hard bounce or a spam complaint stops every email that is not an
    // admin alert. Mailing those addresses again is what gets a sending
    // domain blocked, and then reminders stop reaching everyone.
    const suppressed = await isSuppressed(supabase, userEmail);
    if (suppressed === true) {
      return json({ delivered: 0, skipped: "suppressed" });
    }

    // A reminder still goes when a check cannot answer (a missed reminder
    // costs the member more than a stray email). A weekly note can wait:
    // the job asks again in about 20 hours.
    if (weekly && (login === null || suppressed === null)) {
      return json({ delivered: 0, skipped: "weekly-notes-check-failed" });
    }
  }

  const token = await unsubscribeToken(supabase, profile?.id);

  if (weekly) {
    // A commercial email must carry an unsubscribe that works without
    // signing in, so a weekly note never falls back to the Settings link.
    // Nothing has been claimed yet, so the member keeps their next note.
    if (!token) {
      return json({ delivered: 0, skipped: "weekly-notes-no-token" });
    }

    // The claim: the last step before sending, after every check that can
    // skip. It is the only write, and it is what makes a note go once.
    let claim: Record<string, unknown> = {};
    try {
      const { data, error } = await supabase.rpc("claim_weekly_note", {
        p_email: userEmail,
        p_slugs: weeklyNoteSlugs(),
      });
      if (error) {
        console.warn("send-email: weekly note claim failed", error.message);
        return json({ delivered: 0, skipped: "weekly-notes-claim-failed" });
      }
      if (data && typeof data === "object" && !Array.isArray(data)) claim = data as Record<string, unknown>;
    } catch (err) {
      console.warn("send-email: weekly note claim threw", err);
      return json({ delivered: 0, skipped: "weekly-notes-claim-failed" });
    }
    const claimedSlug = typeof claim.slug === "string" ? claim.slug : "";
    if (!claimedSlug) {
      // not-eligible, caught-up, already-sent, bad-catalog or no-email.
      const reason = typeof claim.reason === "string" && /^[a-z-]{1,40}$/.test(claim.reason)
        ? claim.reason
        : "not-claimed";
      return json({ delivered: 0, skipped: `weekly-notes-${reason}` });
    }

    // The slugs came from the same catalog, so this is never null in
    // practice; it is checked so a bad answer can never send an empty email.
    const note = weeklyNoteEmail(claimedSlug, { hasGecko: claim.has_gecko === true });
    if (!note) {
      return json({ delivered: 0, skipped: "weekly-notes-unknown-slug" });
    }
    title = note.title;
    body = note.body;
    url = note.url;
    render.cta = note.cta;
    render.reason = WEEKLY_NOTES_REASON;
    render.unsubscribeWords = WEEKLY_NOTES_STOP_WORDS;
    render.preheader = note.preheader;
    render.letter = true;
    render.signoff = LIFECYCLE_SIGNOFF;
  }

  return deliver(supabase, userEmail, type, title, body, url, render, unsubscribeLinks(token, weekly ? "weekly" : undefined));
});

// Builds the email (HTML, plain text, footer, headers, tag) and hands it to
// Resend, after the response when the runtime allows it.
async function deliver(
  supabase: RpcClient,
  userEmail: string,
  type: string,
  title: string,
  body: string,
  url: string,
  render: RenderOptions,
  unsubscribe: UnsubscribeLinks,
): Promise<Response> {
  const html = renderHtml(title, body, url, unsubscribe, render);
  const stopLine = render.unsubscribeWords
    ? `\n${render.unsubscribeWords.charAt(0).toUpperCase()}${render.unsubscribeWords.slice(1)}: ${unsubscribe.page}`
    : unsubscribe.oneClick
    ? `\nUnsubscribe from these emails: ${unsubscribe.page}`
    : `\nTurn these emails off in Settings: ${unsubscribe.page}`;
  const signoff = render.letter && render.signoff?.length ? `\n\n${render.signoff.join("\n")}` : "";
  const text = `${body}\n\n${render.cta ? `${render.cta}: ` : ""}${textLink(absoluteLink(url))}` +
    signoff +
    `\n\n${render.reason || DEFAULT_REASON}` +
    stopLine +
    (EMAIL_POSTAL_ADDRESS ? `\nGeck Inspect, ${EMAIL_POSTAL_ADDRESS}` : "");
  const tags = [{ name: "type", value: typeTag(type) }];
  const envelope: Envelope = render.letter
    ? { from: EMAIL_FROM_PERSONAL || EMAIL_FROM, replyTo: EMAIL_REPLY_TO || undefined }
    : {};
  const delivery = sendWithRetry(userEmail, title, text, html, unsubscribeHeaders(unsubscribe), tags, envelope)
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
}

// A visitor's Weekly Gecko Note (see the header). Every check that can skip
// comes before the claim, and the claim is the only write.
async function sendVisitorNote(supabase: RpcClient, userEmail: string): Promise<Response> {
  const suppressed = await isSuppressed(supabase, userEmail);
  if (suppressed === true) return json({ delivered: 0, skipped: "suppressed" });
  if (suppressed === null) return json({ delivered: 0, skipped: "weekly-notes-check-failed" });

  let token: string | null = null;
  for (let attempt = 0; attempt < 2 && !token; attempt += 1) {
    try {
      const { data, error } = await supabase.rpc("weekly_notes_subscriber_token", { p_email: userEmail });
      if (error) console.warn("send-email: visitor token failed", error.message);
      else if (typeof data === "string" && data) token = data;
    } catch (err) {
      console.warn("send-email: visitor token threw", err);
    }
  }
  if (!token) return json({ delivered: 0, skipped: "weekly-notes-no-token" });

  let claim: Record<string, unknown> = {};
  try {
    const { data, error } = await supabase.rpc("claim_weekly_note_subscriber", {
      p_email: userEmail,
      p_slugs: weeklyNoteVisitorSlugs(),
      // The catalog step of each slug, so the ledger row says the same
      // step a member's would.
      p_steps: weeklyNoteVisitorSteps(),
    });
    if (error) {
      console.warn("send-email: visitor note claim failed", error.message);
      return json({ delivered: 0, skipped: "weekly-notes-claim-failed" });
    }
    if (data && typeof data === "object" && !Array.isArray(data)) claim = data as Record<string, unknown>;
  } catch (err) {
    console.warn("send-email: visitor note claim threw", err);
    return json({ delivered: 0, skipped: "weekly-notes-claim-failed" });
  }
  const claimedSlug = typeof claim.slug === "string" ? claim.slug : "";
  if (!claimedSlug) {
    const reason = typeof claim.reason === "string" && /^[a-z-]{1,40}$/.test(claim.reason)
      ? claim.reason
      : "not-claimed";
    return json({ delivered: 0, skipped: `weekly-notes-${reason}` });
  }
  const note = weeklyNoteEmail(claimedSlug, { hasGecko: true, visitor: true });
  if (!note) return json({ delivered: 0, skipped: "weekly-notes-unknown-slug" });

  return deliver(supabase, userEmail, "weekly_notes", note.title, note.body, note.url, {
    cta: note.cta,
    reason: WEEKLY_NOTES_VISITOR_REASON,
    unsubscribeWords: WEEKLY_NOTES_STOP_WORDS,
    settingsLink: false,
    preheader: note.preheader,
    letter: true,
    signoff: LIFECYCLE_SIGNOFF,
  }, unsubscribeLinks(token, "visitor"));
}
