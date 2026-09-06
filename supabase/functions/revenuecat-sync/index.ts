/** Refresh only the signed-in customer's access after purchase/restore. */
import { createClient } from "jsr:@supabase/supabase-js@2.103.0";
import { fetchMembershipEntitlements, PRO_ENTITLEMENT } from "../_shared/revenuecat.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const apiKey = Deno.env.get("REVENUECAT_API_KEY") || "";
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("authorization") || "" } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return json({ error: "unauthorized" }, 401);
  if (!apiKey) return json({ error: "server_misconfigured" }, 503);
  try {
    // One upstream request per account per 10 seconds. A failed lookup can be
    // retried after that window; no receipt is committed until the write succeeds.
    const { data: allowed, error: limitError } = await admin.rpc("reserve_revenuecat_sync", { p_user_id: user.id });
    if (limitError) throw limitError;
    if (!allowed) return json({ error: "Please wait a few seconds before refreshing again." }, 429);
    const event = { id: `sync:${crypto.randomUUID()}`, type: "CUSTOMER_SYNC", app_user_id: user.id };
    const rows = await fetchMembershipEntitlements(user.id, event, apiKey);
    const { error: writeError } = await admin.rpc("apply_revenuecat_event", {
      p_event: { event }, p_rows: rows,
    });
    if (writeError) throw writeError;
    // A newer webhook may have won the race. Return the persisted result.
    const { data: saved, error: readError } = await admin.from("revenuecat_entitlements")
      .select("entitlement_identifier, is_active, expires_at").eq("app_user_id", user.id);
    if (readError) throw readError;
    const active = new Set(saved.filter((r) => r.is_active && (!r.expires_at || Date.parse(r.expires_at) > Date.now()))
      .map((r) => r.entitlement_identifier));
    const tier = active.has("breeder") || active.has(PRO_ENTITLEMENT) ? "breeder" : active.has("keeper") ? "keeper" : "free";
    return json({ tier, isProMember: tier === "breeder" });
  } catch (error) {
    console.error("[revenuecat-sync] reconciliation failed", error instanceof Error ? error.message : "database error");
    return json({ error: "Could not refresh store access. Please try again." }, 503);
  }
});
