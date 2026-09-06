// External webhook: verify_jwt is disabled; the exact shared Authorization
// header is required. Setup, verification and retry recovery: docs/BILLING.md.
import { createClient } from "jsr:@supabase/supabase-js@2.103.0";
import { fetchMembershipEntitlements } from "../_shared/revenuecat.ts";
import { createWebhookHandler } from "./handler.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const apiKey = Deno.env.get("REVENUECAT_API_KEY") || "";

Deno.serve(createWebhookHandler({
  authorization: Deno.env.get("REVENUECAT_WEBHOOK_AUTHORIZATION") || "",
  apiKey,
  fetchEntitlements: (id, event) => fetchMembershipEntitlements(id, event, apiKey),
  alreadyReceived: async (id) => {
    const { data, error } = await supabase.from("revenuecat_webhook_events").select("event_id").eq("event_id", id).maybeSingle();
    if (error) throw error;
    return Boolean(data);
  },
  applyEvent: async (payload, rows) => {
    const { data, error } = await supabase.rpc("apply_revenuecat_event", { p_event: payload, p_rows: rows });
    if (error) throw error;
    return data;
  },
}));
