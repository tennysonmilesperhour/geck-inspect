// Supabase Edge Function: admin-delete-account
//
// Erases one member's account (feature-completeness audit step 3, D16).
// An admin runs it from the Support inbox (on an "Account deletion
// request" ticket) or from Admin Panel > Users > Delete User.
//
// What it does, in order:
//   1. Checks the caller is a signed-in admin (profiles.role = 'admin').
//   2. Works out whose account it is: from the ticket, the profile id or
//      the email in the body. It refuses the caller's own account, admin
//      accounts, and members with a live Stripe subscription (cancel it in
//      Stripe first, or the card keeps being charged with no account).
//   3. Calls public.admin_erase_account(email). That SQL function, in one
//      transaction, deletes the member's own data and anonymises the rows
//      other members depend on (claimed transfers, lineage parents, the
//      chain of custody, forum threads, reviews). The full per-table list
//      and the reasons are in
//      supabase/migrations/20261002120000_account_erasure.sql.
//   4. Removes the member's Storage files that the SQL function listed.
//      Storage refuses direct SQL deletes, so this has to go through the
//      Storage API. Files still used by a surviving row (for example a
//      photo on a gecko the member sold) are never in the list.
//   5. Deletes the login through the Auth admin API. The cascade removes
//      sessions, identities, and the rows keyed to the login.
//   6. Closes every "Account deletion request" ticket from that member:
//      status resolved, the email replaced, the body and notes replaced by
//      a short erasure record. Until this step succeeds the tickets keep
//      the member's email, so a failed run can simply be run again.
//
// Contract:
//   POST /admin-delete-account
//   Headers: Authorization: Bearer <admin session JWT>
//   Body: { support_message_id?: string, profile_id?: string, email?: string }
//   (at least one; when more than one is given they must name the same
//   member)
//
//   200 { ok: true, email, auth_user_deleted, files_removed, files_failed,
//         tickets_closed, geckos_deleted, geckos_anonymised, photos_deleted,
//         messages_deleted }
//   4xx/5xx { error: <code>, message: <plain sentence> }
//
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (set automatically).
//
// Deploy: supabase functions deploy admin-delete-account
// (verify_jwt = true, see supabase/config.toml: every caller is a signed-in
// admin, so the gateway can reject anonymous calls before they get here.)

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

// Escape the two LIKE wildcards so an ilike equality check stays exact.
function likeLiteral(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function normEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function tombstoneEmail(): string {
  return `deleted-${crypto.randomUUID().replace(/-/g, "")}@deleted.geckinspect.invalid`;
}

type ErasureResult = {
  email: string;
  auth_user_id: string | null;
  profile_deleted: boolean;
  geckos_deleted: number;
  geckos_anonymised: number;
  photos_deleted: number;
  messages_deleted: number;
  files: { bucket: string; path: string }[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return fail(500, "not_configured", "The function is missing its Supabase settings.");
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // 1. Caller must be a signed-in admin.
  const token = bearerToken(req);
  if (!token) return fail(401, "unauthenticated", "Sign in again and retry.");
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  const callerEmail = normEmail(authData?.user?.email);
  if (authErr || !callerEmail) return fail(401, "unauthenticated", "Sign in again and retry.");
  const { data: callerProfiles } = await admin
    .from("profiles")
    .select("role")
    .ilike("email", likeLiteral(callerEmail));
  if (!(callerProfiles || []).some((p: { role: string | null }) => p.role === "admin")) {
    return fail(403, "forbidden", "Only admins can erase accounts.");
  }

  // 2. Whose account?
  let body: { support_message_id?: unknown; profile_id?: unknown; email?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_request", "The request body must be JSON.");
  }

  const candidates: string[] = [];
  if (typeof body.support_message_id === "string" && body.support_message_id) {
    const { data: ticket, error } = await admin
      .from("support_messages")
      .select("id, user_email, subject")
      .eq("id", body.support_message_id)
      .maybeSingle();
    if (error || !ticket) return fail(404, "ticket_not_found", "That support ticket no longer exists.");
    if (ticket.subject !== DELETION_SUBJECT) {
      return fail(400, "not_a_deletion_request", "Only an Account deletion request ticket can start an erasure.");
    }
    candidates.push(normEmail(ticket.user_email));
  }
  if (typeof body.profile_id === "string" && body.profile_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", body.profile_id)
      .maybeSingle();
    if (!profile) return fail(404, "profile_not_found", "That member profile no longer exists.");
    candidates.push(normEmail(profile.email));
  }
  if (typeof body.email === "string" && body.email) candidates.push(normEmail(body.email));

  const targets = [...new Set(candidates)];
  if (targets.length === 0 || !targets[0]) {
    return fail(400, "no_target", "Name the account to erase (ticket, profile or email).");
  }
  if (targets.length > 1) {
    return fail(400, "target_mismatch", "The ticket, profile and email point at different accounts.");
  }
  const email = targets[0];
  if (!email.includes("@") || email.endsWith("@deleted.geckinspect.invalid")) {
    return fail(400, "already_erased", "This account has already been erased.");
  }
  if (email === callerEmail) {
    return fail(400, "self", "You cannot erase your own account from the admin tools.");
  }

  // A member can have more than one profile row with the same email, so
  // check them all.
  type TargetProfile = { role: string | null; subscription_status: string | null; stripe_subscription_id: string | null };
  const { data: targetProfiles, error: targetErr } = await admin
    .from("profiles")
    .select("role, subscription_status, stripe_subscription_id")
    .ilike("email", likeLiteral(email));
  if (targetErr) return fail(500, "lookup_failed", `Could not read the member's profile: ${targetErr.message}`);
  const profiles = (targetProfiles || []) as TargetProfile[];
  if (profiles.some((p) => p.role === "admin")) {
    return fail(400, "target_is_admin", "Remove the admin role first, then erase the account.");
  }
  if (profiles.some((p) =>
    p.stripe_subscription_id &&
    LIVE_SUBSCRIPTION_STATUSES.has(String(p.subscription_status || "").toLowerCase())
  )) {
    return fail(
      409,
      "active_subscription",
      "This member still has a live Stripe subscription. Cancel it in Stripe first, then run the erasure again.",
    );
  }

  // 3. Delete and anonymise the rows.
  const { data: erased, error: rpcErr } = await admin.rpc("admin_erase_account", { p_email: email });
  if (rpcErr) {
    const missing = rpcErr.code === "PGRST202" || rpcErr.code === "42883";
    console.error("admin-delete-account: admin_erase_account failed", rpcErr);
    return fail(
      missing ? 503 : 500,
      missing ? "erasure_not_installed" : "erasure_failed",
      missing
        ? "The database part of account erasure is not installed yet (migration 20261002120000_account_erasure)."
        : `The database erasure failed and nothing was changed: ${rpcErr.message}`,
    );
  }
  const result = erased as ErasureResult;

  // 4. Storage files, in batches per bucket.
  const byBucket = new Map<string, string[]>();
  for (const f of result.files || []) {
    if (!f?.bucket || !f?.path) continue;
    if (!byBucket.has(f.bucket)) byBucket.set(f.bucket, []);
    byBucket.get(f.bucket)!.push(f.path);
  }
  let filesRemoved = 0;
  const filesFailed: string[] = [];
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { data, error } = await admin.storage.from(bucket).remove(batch);
      if (error) {
        console.warn(`admin-delete-account: storage remove failed in ${bucket}`, error);
        filesFailed.push(...batch.map((p) => `${bucket}/${p}`));
      } else {
        filesRemoved += Array.isArray(data) ? data.length : batch.length;
      }
    }
  }

  // 5. The login.
  let authUserDeleted = false;
  if (result.auth_user_id) {
    const { error: delErr } = await admin.auth.admin.deleteUser(result.auth_user_id);
    if (delErr && !/not.?found/i.test(delErr.message || "")) {
      console.error("admin-delete-account: auth delete failed", delErr);
      return fail(
        500,
        "login_not_deleted",
        `The member's data was erased but their login was not: ${delErr.message}. Run the erasure again to finish.`,
        { files_removed: filesRemoved, files_failed: filesFailed },
      );
    }
    authUserDeleted = true;
  }

  // 6. Close and anonymise the deletion request tickets. The subject filter
  //    keeps this to a handful of rows; the email is matched in code so an
  //    underscore in an address cannot match someone else.
  const today = new Date().toISOString().slice(0, 10);
  const note = [
    `Account erased on ${today} by ${callerEmail}.`,
    `Geckos deleted: ${result.geckos_deleted}. Geckos kept anonymised for other members' lineage: ${result.geckos_anonymised}.`,
    `Photos deleted: ${result.photos_deleted}. Messages deleted: ${result.messages_deleted}.`,
    `Files removed: ${filesRemoved}.${filesFailed.length ? ` Files that could not be removed: ${filesFailed.join(", ")}.` : ""}`,
    `Login deleted: ${authUserDeleted ? "yes" : "no login found"}.`,
  ].join("\n");
  const { data: tickets } = await admin
    .from("support_messages")
    .select("id, user_email")
    .eq("subject", DELETION_SUBJECT);
  const ticketIds = (tickets || [])
    .filter((t: { user_email: string | null }) => normEmail(t.user_email) === email)
    .map((t: { id: string }) => t.id);
  let ticketsClosed = 0;
  if (ticketIds.length) {
    const { data: closed, error: closeErr } = await admin
      .from("support_messages")
      .update({
        status: "resolved",
        resolved_by: callerEmail,
        resolved_date: new Date().toISOString(),
        user_email: tombstoneEmail(),
        created_by: null,
        body: "Account deletion request. The account and its personal data were erased; see the admin notes.",
        admin_notes: note,
      })
      .in("id", ticketIds)
      .select("id");
    if (closeErr) console.warn("admin-delete-account: closing tickets failed", closeErr);
    ticketsClosed = closed?.length || 0;
  }

  return json({
    ok: true,
    email,
    auth_user_deleted: authUserDeleted,
    files_removed: filesRemoved,
    files_failed: filesFailed,
    tickets_closed: ticketsClosed,
    ticket_ids: ticketIds,
    geckos_deleted: result.geckos_deleted,
    geckos_anonymised: result.geckos_anonymised,
    photos_deleted: result.photos_deleted,
    messages_deleted: result.messages_deleted,
  });
});
