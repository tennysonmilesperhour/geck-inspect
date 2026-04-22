// Supabase Edge Function — send-push
//
// Delivers a web-push notification to every active subscription for a
// given user. Called by a Postgres trigger on notifications.INSERT (see
// the migration shipped alongside this function) OR directly from
// application code via a fetch() with the service-role key.
//
// Contract:
//   POST /send-push
//   Headers: Authorization: Bearer <service-role-key>
//   Body: {
//     user_email: string,        // required — target user
//     type: string,              // required — matches Notification.type;
//                                //   used to check per-user allowlist
//     title: string,             // required — short line shown in the OS
//     body: string,              // required — longer line shown below
//     url?: string,              // optional — deep-link opened on click
//                                //   (default: "/")
//     icon?: string,             // optional — absolute HTTPS URL
//     tag?: string,              // optional — collapse-key on device
//   }
//
// Response:
//   200 { delivered, pruned }  always. Failures are logged, not raised,
//                              because the caller (DB trigger or app) has
//                              no useful recovery path.
//
// Dead subscriptions: any push service that returns 404/410 Gone is
// removed from push_subscriptions so we stop wasting quota on it.
//
// Secrets (required):
//   VAPID_PUBLIC_KEY      urlsafe base64, matches VITE_VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY     urlsafe base64 (raw, 32 bytes)
//   VAPID_SUBJECT         mailto:<your-real-email>
//   SUPABASE_URL          injected automatically
//   SUPABASE_SERVICE_ROLE_KEY  injected automatically
//
// Deploy: supabase functions deploy send-push --no-verify-jwt

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
// Node library via Deno's npm compat — more reliable than esm.sh because
// Deno handles Node's `crypto` / `Buffer` polyfills natively on Edge.
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@example.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: "server missing VAPID keys" }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json body" }, 400);
  }

  const userEmail = String(payload.user_email || "").trim().toLowerCase();
  const type = String(payload.type || "").trim();
  const title = String(payload.title || "").trim() || "Geck Inspect";
  const body = String(payload.body || "").trim();
  const url = String(payload.url || "/");
  const icon = payload.icon ? String(payload.icon) : undefined;
  const tag = payload.tag ? String(payload.tag) : undefined;

  if (!userEmail || !type) {
    return json({ error: "user_email and type are required" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Fetch preferences. If master toggle is off or the type isn't in the
  // allowlist, bail silently — it's not an error, the user just opted
  // out of this specific thing.
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("push_notifications_enabled, push_notification_types")
    .eq("email", userEmail)
    .maybeSingle();
  if (profileErr) {
    console.warn("send-push: profile lookup failed", profileErr);
    return json({ delivered: 0, pruned: 0, skipped: "profile-lookup-failed" });
  }
  if (!profile || profile.push_notifications_enabled !== true) {
    return json({ delivered: 0, pruned: 0, skipped: "master-off" });
  }
  const allowed: string[] = Array.isArray(profile.push_notification_types)
    ? profile.push_notification_types
    : [];
  if (!allowed.includes(type)) {
    return json({ delivered: 0, pruned: 0, skipped: "type-not-allowed" });
  }

  // Fetch all subscriptions for this user.
  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_email", userEmail);
  if (subsErr) {
    console.warn("send-push: subs lookup failed", subsErr);
    return json({ delivered: 0, pruned: 0, skipped: "subs-lookup-failed" });
  }
  if (!subs || subs.length === 0) {
    return json({ delivered: 0, pruned: 0, skipped: "no-subs" });
  }

  const notificationPayload = JSON.stringify({
    title,
    body,
    url,
    icon,
    tag,
    data: { type },
  });

  let delivered = 0;
  const pruneIds: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          notificationPayload,
          { TTL: 60 * 60 * 24 }, // 1 day — matches typical session cadence
        );
        delivered++;
      } catch (err: unknown) {
        // web-push throws with a `.statusCode` set to the response code.
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is permanently gone — prune it so we stop
          // hitting this endpoint on every future push.
          pruneIds.push(s.id);
        } else {
          console.warn(
            `send-push: delivery failed for sub ${s.id} (status=${statusCode}):`,
            err,
          );
        }
      }
    }),
  );

  if (pruneIds.length > 0) {
    try {
      await supabase.from("push_subscriptions").delete().in("id", pruneIds);
    } catch (err) {
      console.warn("send-push: prune failed", err);
    }
  }

  // Also bump last_seen_at on every live subscription so we can prune
  // silent subscriptions (iOS 8-week expiry) separately from 410s.
  const liveIds = subs
    .map((s) => s.id)
    .filter((id) => !pruneIds.includes(id));
  if (liveIds.length > 0) {
    try {
      await supabase
        .from("push_subscriptions")
        .update({ last_seen_at: new Date().toISOString() })
        .in("id", liveIds);
    } catch {
      // non-fatal
    }
  }

  return json({ delivered, pruned: pruneIds.length });
});
