// Supabase Edge Function: resend-webhook
//
// Resend calls this after each email it handles: sent, delivered,
// delivery delayed, opened, clicked, bounced, complained (marked as spam).
// Each event becomes a row in public.email_deliveries through
// record_email_event(), which also puts an address on
// public.email_suppressions after a hard bounce or a complaint, so
// send-email stops sending it notifications, digests, reminders and
// lifecycle emails. Before this, a bounce only reached a console line and
// the next email went to the same dead address.
//
// Security: Resend signs every webhook the Svix way. The function checks
// the signature against RESEND_WEBHOOK_SECRET (the "whsec_..." value from
// the Resend dashboard) and refuses anything unsigned, wrongly signed or
// more than five minutes old, so nobody can forge a bounce to switch off
// someone's email. Without the secret it refuses everything.
//
// Retries: Resend sends the same event again until it gets a 2xx. The
// svix-id header is the row's unique key, so a repeat is a no-op, and a
// database error answers 500 so the event is retried, not lost.
//
// Set up (Tennyson, in the Resend dashboard): Webhooks, add endpoint
//   https://<project>.supabase.co/functions/v1/resend-webhook
// with the email events, then save its signing secret as the
// RESEND_WEBHOOK_SECRET function secret. Opens and clicks are recorded
// only when open and click tracking are on for the sending domain.
//
// Deploy: supabase functions deploy resend-webhook --no-verify-jwt

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const WEBHOOK_SECRET = (Deno.env.get("RESEND_WEBHOOK_SECRET") || "").trim();

// Svix rejects anything older than five minutes, which stops a captured
// request from being replayed later.
const TOLERANCE_SECONDS = 5 * 60;

const EVENTS: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Returns a plain ArrayBuffer, which crypto.subtle accepts under every
// TypeScript version Deno ships.
function base64ToBuffer(value: string): ArrayBuffer | null {
  try {
    const bin = atob(value);
    const out = new ArrayBuffer(bin.length);
    const view = new Uint8Array(out);
    for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Svix signatures: HMAC-SHA256 over "<id>.<timestamp>.<body>" with the
// secret's bytes (the part after "whsec_", base64), sent as one or more
// space-separated "v1,<base64>" entries. Any one matching is enough, which
// is how Svix rotates secrets without dropping events.
async function verifySvix(
  secret: string,
  id: string,
  timestamp: string,
  signatureHeader: string,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!secret || !id || !timestamp || !signatureHeader) return false;
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;
  const keyBytes = base64ToBuffer(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  if (!keyBytes || keyBytes.byteLength === 0) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = bytesToBase64(new Uint8Array(mac));

  return signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .some((part) => constantTimeEq(part.slice(3), expected));
}

// Resend sends tags as an object ({"type": "weekly_digest"}); older
// payloads used a list of {name, value}. Either way, the "type" tag that
// send-email sets says which email this was.
function typeFromTags(tags: unknown): string | null {
  let value: unknown = null;
  if (Array.isArray(tags)) {
    value = tags.find((t) => t && typeof t === "object" && (t as Record<string, unknown>).name === "type")?.value;
  } else if (tags && typeof tags === "object") {
    value = (tags as Record<string, unknown>).type;
  }
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}

function firstRecipient(to: unknown): string | null {
  const value = Array.isArray(to) ? to[0] : to;
  if (typeof value !== "string") return null;
  // "Name <a@b.c>" or "a@b.c"
  const match = /<([^<>\s]+@[^<>\s]+)>/.exec(value) || /^\s*([^<>\s]+@[^<>\s]+)\s*$/.exec(value);
  return match ? match[1].toLowerCase().slice(0, 320) : null;
}

const cut = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : undefined);

// The clicked link without its query string or fragment. Those can carry
// a member's signed unsubscribe token or other per-member values, and the
// address and path are enough to say which button worked.
function linkWithoutQuery(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.split(/[?#]/, 1)[0].slice(0, 500);
}

// Only what is needed to act on the event: the bounce type decides whether
// the address is suppressed, the message says why, and the clicked link
// (without its query string) says which button worked. Never the whole
// payload.
function detailFor(event: string, data: Record<string, unknown>): Record<string, unknown> {
  if (event === "bounced") {
    const bounce = (data.bounce && typeof data.bounce === "object" ? data.bounce : {}) as Record<string, unknown>;
    return {
      bounce_type: cut(bounce.type, 40),
      bounce_subtype: cut(bounce.subType, 40),
      message: cut(bounce.message, 300),
    };
  }
  if (event === "clicked") {
    const click = (data.click && typeof data.click === "object" ? data.click : {}) as Record<string, unknown>;
    return { link: linkWithoutQuery(click.link) };
  }
  return {};
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!WEBHOOK_SECRET || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.warn("resend-webhook: RESEND_WEBHOOK_SECRET or Supabase settings are missing");
    return json({ error: "not configured" }, 500);
  }

  // The signature covers the exact bytes Resend sent, so read the body as
  // text before parsing it.
  const raw = await req.text();
  const id = req.headers.get("svix-id") || req.headers.get("webhook-id") || "";
  const timestamp = req.headers.get("svix-timestamp") || req.headers.get("webhook-timestamp") || "";
  const signature = req.headers.get("svix-signature") || req.headers.get("webhook-signature") || "";
  if (!(await verifySvix(WEBHOOK_SECRET, id, timestamp, signature, raw))) {
    return json({ error: "invalid signature" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "invalid json body" }, 400);
  }

  const event = EVENTS[String(payload.type || "")];
  if (!event) return json({ ignored: String(payload.type || "unknown").slice(0, 60) });

  const data = (payload.data && typeof payload.data === "object" ? payload.data : {}) as Record<string, unknown>;
  const resendId = typeof data.email_id === "string" ? data.email_id.slice(0, 200) : null;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: recorded, error } = await supabase.rpc("record_email_event", {
    p_event: event,
    p_event_key: id.slice(0, 200),
    p_resend_email_id: resendId,
    p_email: firstRecipient(data.to),
    p_email_type: typeFromTags(data.tags),
    p_occurred_at: isoOrNull(payload.created_at) || isoOrNull(data.created_at),
    p_detail: detailFor(event, data),
  });
  if (error) {
    // 500 makes Resend retry later instead of dropping a bounce.
    console.warn("resend-webhook: record_email_event failed", error.message);
    return json({ error: "could not record" }, 500);
  }
  return json({ recorded: recorded === true, event });
});
