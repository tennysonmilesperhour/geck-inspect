// Supabase Edge Function: delete-my-account
//
// The signed-in member erases their own account from Settings. Apple and
// Google require account deletion inside the app. This is that action.
// It is not the admin tool: the target is always the caller from the JWT.
// A body email is ignored so one member cannot name another.
//
// Order:
//   1. Require a signed-in user and body.confirm === "DELETE".
//   2. Refuse admin accounts (the founder wipes those from the admin tool).
//   3. If a website (Stripe) subscription is still charging, cancel it
//      first. If that cancel fails, nothing is deleted.
//   4. Call public.admin_erase_account (service role only), then remove
//      Storage files, delete the login, and close deletion-request tickets.
//      Store subscriptions cannot be cancelled from here. The response says
//      so, and the Settings screen says so before the member confirms.
//
// Contract:
//   POST /delete-my-account
//   Headers: Authorization: Bearer <session JWT>
//   Body: { confirm: "DELETE" }
//
// Deploy: supabase functions deploy delete-my-account
// verify_jwt = true (supabase/config.toml).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const DELETION_SUBJECT = "Account deletion request";
const LIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

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

function fail(status: number, error: string, message: string, extra: Record<string, unknown> = {}) {
  return json({ error, message, ...extra }, status);
}

function bearerToken(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
}

function likeLiteral(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function normEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function tombstoneEmail(): string {
  return `deleted-${crypto.randomUUID().replace(/-/g, "")}@deleted.geckinspect.invalid`;
}

type TargetProfile = {
  role: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
};

type ErasureResult = {
  email: string;
  auth_user_id: string | null;
  geckos_deleted: number;
  geckos_anonymised: number;
  photos_deleted: number;
  messages_deleted: number;
  files: { bucket: string; path: string }[];
};

async function cancelStripeSubscription(subscriptionId: string, apiKey: string) {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || "Stripe could not cancel the subscription.";
    throw new Error(message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return fail(500, "not_configured", "The function is missing its Supabase settings.");
  }

  let body: { confirm?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (body.confirm !== "DELETE") {
    return fail(400, "confirm_required", "Confirm account deletion to continue. Nothing was deleted.");
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const token = bearerToken(req);
  if (!token) return fail(401, "unauthenticated", "Sign in again and retry. Nothing was deleted.");
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  const email = normEmail(authData?.user?.email);
  if (authErr || !email || !email.includes("@")) {
    return fail(401, "unauthenticated", "Sign in again and retry. Nothing was deleted.");
  }
  if (email.endsWith("@deleted.geckinspect.invalid")) {
    return fail(400, "already_erased", "This account has already been erased.");
  }

  const { data: targetProfiles, error: targetErr } = await admin
    .from("profiles")
    .select("role, subscription_status, stripe_subscription_id")
    .ilike("email", likeLiteral(email));
  if (targetErr) return fail(500, "lookup_failed", `Could not read the profile: ${targetErr.message}`);
  const profiles = (targetProfiles || []) as TargetProfile[];
  if (profiles.some((profile) => profile.role === "admin")) {
    return fail(400, "target_is_admin", "Admin accounts are deleted by support, not from this screen. Nothing was deleted.");
  }

  const liveStripeIds = [...new Set(profiles
    .filter((profile) =>
      profile.stripe_subscription_id &&
      LIVE_SUBSCRIPTION_STATUSES.has(String(profile.subscription_status || "").toLowerCase())
    )
    .map((profile) => String(profile.stripe_subscription_id)))];

  let stripeCancelled = false;
  if (liveStripeIds.length) {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeKey) {
      return fail(
        409,
        "active_subscription",
        "This account still has a website subscription, and it could not be cancelled from the app. Email support and we will cancel it, then delete the account. Nothing was deleted.",
      );
    }
    try {
      for (const subscriptionId of liveStripeIds) {
        await cancelStripeSubscription(subscriptionId, stripeKey);
      }
      stripeCancelled = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe could not cancel the subscription.";
      return fail(
        409,
        "active_subscription",
        `The website subscription could not be cancelled (${message}). Nothing was deleted. Email support and we will finish it.`,
      );
    }
  }

  const { data: erased, error: rpcErr } = await admin.rpc("admin_erase_account", { p_email: email });
  if (rpcErr) {
    const missing = rpcErr.code === "PGRST202" || rpcErr.code === "42883";
    console.error("delete-my-account: admin_erase_account failed", rpcErr);
    return fail(
      missing ? 503 : 500,
      missing ? "erasure_not_installed" : "erasure_failed",
      missing
        ? "Account deletion is not installed on the database yet. Nothing else was changed."
        : `The account was not deleted: ${rpcErr.message}${stripeCancelled ? " The website subscription was cancelled." : ""}`,
      { stripe_cancelled: stripeCancelled },
    );
  }
  const result = erased as ErasureResult;

  const byBucket = new Map<string, string[]>();
  for (const file of result.files || []) {
    if (!file?.bucket || !file?.path) continue;
    if (!byBucket.has(file.bucket)) byBucket.set(file.bucket, []);
    byBucket.get(file.bucket)!.push(file.path);
  }
  let filesRemoved = 0;
  const filesFailed: string[] = [];
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { data, error } = await admin.storage.from(bucket).remove(batch);
      if (error) {
        console.warn(`delete-my-account: storage remove failed in ${bucket}`, error);
        filesFailed.push(...batch.map((path) => `${bucket}/${path}`));
      } else {
        filesRemoved += Array.isArray(data) ? data.length : batch.length;
      }
    }
  }

  let authUserDeleted = false;
  if (result.auth_user_id) {
    const { error: delErr } = await admin.auth.admin.deleteUser(result.auth_user_id);
    if (delErr && !/not.?found/i.test(delErr.message || "")) {
      console.error("delete-my-account: auth delete failed", delErr);
      return fail(
        500,
        "login_not_deleted",
        `Your records were removed but the login could not be deleted: ${delErr.message}. Try again to finish.`,
        { files_removed: filesRemoved, files_failed: filesFailed, stripe_cancelled: stripeCancelled },
      );
    }
    authUserDeleted = true;
  }

  const today = new Date().toISOString().slice(0, 10);
  const note = [
    `Account erased on ${today} by the member from Settings.`,
    `Geckos deleted: ${result.geckos_deleted}. Geckos kept anonymised for other members' lineage: ${result.geckos_anonymised}.`,
    `Photos deleted: ${result.photos_deleted}. Messages deleted: ${result.messages_deleted}.`,
    `Files removed: ${filesRemoved}.${filesFailed.length ? ` Files that could not be removed: ${filesFailed.join(", ")}.` : ""}`,
    `Login deleted: ${authUserDeleted ? "yes" : "no login found"}.`,
    `Website subscription cancelled: ${stripeCancelled ? "yes" : "none"}.`,
  ].join("\n");
  const { data: tickets } = await admin
    .from("support_messages")
    .select("id, user_email")
    .eq("subject", DELETION_SUBJECT);
  const ticketIds = (tickets || [])
    .filter((ticket: { user_email: string | null }) => normEmail(ticket.user_email) === email)
    .map((ticket: { id: string }) => ticket.id);
  let ticketsClosed = 0;
  if (ticketIds.length) {
    const { data: closed, error: closeErr } = await admin
      .from("support_messages")
      .update({
        status: "resolved",
        resolved_by: "self-service",
        resolved_date: new Date().toISOString(),
        user_email: tombstoneEmail(),
        created_by: null,
        body: "Account deletion request. The member deleted the account from Settings.",
        admin_notes: note,
      })
      .in("id", ticketIds)
      .select("id");
    if (closeErr) console.warn("delete-my-account: closing tickets failed", closeErr);
    ticketsClosed = closed?.length || 0;
  }

  return json({
    ok: true,
    auth_user_deleted: authUserDeleted,
    files_removed: filesRemoved,
    files_failed: filesFailed,
    tickets_closed: ticketsClosed,
    geckos_deleted: result.geckos_deleted,
    geckos_anonymised: result.geckos_anonymised,
    photos_deleted: result.photos_deleted,
    messages_deleted: result.messages_deleted,
    stripe_cancelled: stripeCancelled,
    store_billing_continues: true,
  });
});
