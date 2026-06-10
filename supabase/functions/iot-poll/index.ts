// Supabase Edge Function: iot-poll
//
// On-demand read of a user's Govee thermo-hygrometer sensors. The
// user's Govee API key lives in iot_connections (owner-only RLS table,
// never on profiles; see DECISIONS.md entry 25). The client never sees
// or sends the key; this function loads it server-side, calls Govee,
// caches readings on the row, and returns them.
//
// Metering: hard monthly cap per tier via feature_usage
// (consume_feature_credit with the user's JWT). Allotments mirror
// src/lib/tierLimits.js monthlyIotPolls: free=0, keeper=200,
// breeder=2000, enterprise=10000. One poll = 1 credit regardless of
// device count. Free tier gets a 402 with an upgrade code.
//
// POST {} -> { devices: [{ device, model, name, readings: { temp_f?, temp_c?, humidity? }, supported }],
//              polled_at, credits_remaining }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GOVEE_BASE = "https://developer-api.govee.com/v1";

const TIER_POLLS: Record<string, number> = {
  free: 0, keeper: 200, breeder: 2000, enterprise: 10000,
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in to read sensors.", code: "unauthenticated" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sign in to read sensors.", code: "unauthenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: prof } = await admin.from("profiles")
      .select("membership_tier, subscription_status, role")
      .eq("email", user.email).maybeSingle();
    const tier = prof?.subscription_status === "grandfathered"
      ? "breeder"
      : (prof?.membership_tier && TIER_POLLS[prof.membership_tier] != null ? prof.membership_tier : "free");
    const isAdmin = prof?.role === "admin";

    if (!isAdmin && TIER_POLLS[tier] === 0) {
      return json({
        error: "Enclosure sensors are a paid feature. Upgrade to Keeper to connect your Govee devices.",
        code: "iot_polls_credits_exhausted", tier, included: 0,
      }, 402);
    }

    // The connection row is loaded with the SERVICE role (key never
    // leaves the server) after confirming it belongs to the caller.
    const { data: conn } = await admin.from("iot_connections")
      .select("*").eq("user_id", user.id).eq("provider", "govee")
      .eq("is_active", true).maybeSingle();
    if (!conn) return json({ error: "No active Govee connection. Add your API key in Settings.", code: "no_connection" }, 404);

    let creditsRemaining: number | null = null;
    if (!isAdmin) {
      const { data: usage, error: rpcErr } = await userClient.rpc("consume_feature_credit", {
        p_feature: "iot_poll", p_tier: tier, p_included: TIER_POLLS[tier], p_cost: 1,
      });
      if (rpcErr) {
        if ((rpcErr.message || "").includes("feature_credits_exhausted")) {
          return json({
            error: "Monthly sensor read limit reached for your plan.",
            code: "iot_polls_credits_exhausted", tier, included: TIER_POLLS[tier],
          }, 402);
        }
        return json({ error: `credit check failed: ${rpcErr.message}`, code: "credit_error" }, 500);
      }
      creditsRemaining = usage?.credits_included == null
        ? null : Math.max(0, usage.credits_included - usage.credits_consumed);
    }

    const goveeHeaders = { "Govee-API-Key": conn.api_key };
    const devResp = await fetch(`${GOVEE_BASE}/devices`, { headers: goveeHeaders });
    if (devResp.status === 401 || devResp.status === 403) {
      return json({ error: "Govee rejected the API key. Re-check it in Settings.", code: "bad_provider_key" }, 422);
    }
    if (devResp.status === 429) {
      return json({ error: "Govee rate limit hit. Try again in a minute.", code: "provider_rate_limited" }, 429);
    }
    if (!devResp.ok) {
      return json({ error: `Govee devices call failed (${devResp.status})`, code: "provider_error" }, 502);
    }
    const devPayload = await devResp.json();
    const devices: Array<{ device: string; model: string; deviceName?: string; supportCmds?: string[] }> =
      devPayload?.data?.devices || [];

    const results = [];
    for (const d of devices.slice(0, 10)) {
      let readings: Record<string, number> | null = null;
      let supported = false;
      try {
        const stResp = await fetch(
          `${GOVEE_BASE}/devices/state?device=${encodeURIComponent(d.device)}&model=${encodeURIComponent(d.model)}`,
          { headers: goveeHeaders },
        );
        if (stResp.ok) {
          const st = await stResp.json();
          const props: Array<Record<string, unknown>> = st?.data?.properties || [];
          readings = {};
          for (const p of props) {
            if (typeof p.temperature === "number") readings.temp_f = p.temperature as number;
            if (p.temperature && typeof p.temperature === "object") {
              const t = p.temperature as { value?: number };
              if (typeof t.value === "number") readings.temp_f = t.value;
            }
            if (typeof p.humidity === "number") readings.humidity = p.humidity as number;
            if (p.humidity && typeof p.humidity === "object") {
              const h = p.humidity as { value?: number };
              if (typeof h.value === "number") readings.humidity = h.value;
            }
          }
          supported = Object.keys(readings).length > 0;
          if (readings.temp_f != null) readings.temp_c = Math.round(((readings.temp_f - 32) * 5 / 9) * 10) / 10;
        }
      } catch { /* leave readings null; device reported as unsupported */ }
      results.push({
        device: d.device, model: d.model, name: d.deviceName || d.model,
        readings: readings || {}, supported,
      });
    }

    const polledAt = new Date().toISOString();
    await admin.from("iot_connections")
      .update({ last_polled_at: polledAt, last_readings: results, updated_date: polledAt })
      .eq("id", conn.id);

    return json({ devices: results, polled_at: polledAt, credits_remaining: creditsRemaining });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err), code: "server_error" }, 500);
  }
});
