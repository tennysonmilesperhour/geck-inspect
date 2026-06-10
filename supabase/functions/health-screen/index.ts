// Supabase Edge Function: health-screen
//
// Photo-based husbandry screening for crested geckos using Claude
// vision. This is OBSERVATIONAL ONLY: it surfaces things worth watching
// or showing a vet (body condition, possible MBD signs like kinks,
// retained shed, eye issues), it never diagnoses. The system prompt and
// the response schema both enforce that framing.
//
// Metering: hard monthly cap per tier via the feature_usage ledger
// (consume_feature_credit RPC, called with the USER's JWT so auth.uid()
// resolves). Tier allotments mirror src/lib/tierLimits.js
// monthlyHealthScreens: free=1, keeper=5, breeder=15, enterprise=40.
// Keep the two in sync when changing quotas. Admins bypass.
//
// POST { image_url: string, context?: { name, hatch_date, weight_grams, morphs } }
// 200 -> { observations: [{ area, finding, severity, note }], overall_note,
//          disclaimer, credits_remaining }
// 402 -> { code: 'health_screen_credits_exhausted', ... }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("HEALTH_SCREEN_MODEL") || "claude-sonnet-4-6";

const TIER_SCREENS: Record<string, number> = {
  free: 1, keeper: 5, breeder: 15, enterprise: 40,
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const SYSTEM = `You are a husbandry observation assistant for crested gecko (Correlophus ciliatus) keepers on Geck Inspect. You review a photo and report OBSERVATIONS a keeper can act on. You are not a veterinarian and you never diagnose.

Look for: body condition (underweight, healthy, overweight), tail and spine appearance (kinks or waviness can be worth a vet visit), retained shed (toes, tail tip, eyes), eye appearance, skin condition, hydration signs, and obvious injuries. If the photo quality or angle prevents assessment of an area, say so rather than guessing.

Severity scale, use EXACTLY these values:
- "looks_typical": nothing concerning visible in this area
- "worth_watching": not urgent, recheck or adjust husbandry
- "see_a_vet": visible sign that warrants a professional opinion

Respond with ONLY a JSON object: {"observations":[{"area":string,"finding":string,"severity":"looks_typical"|"worth_watching"|"see_a_vet","note":string}],"overall_note":string}. Plain language. Never use em dashes. Never claim a diagnosis; say "signs that can be associated with" instead.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not set", code: "config_error" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in to use health screening.", code: "unauthenticated" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sign in to use health screening.", code: "unauthenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: prof } = await admin.from("profiles")
      .select("membership_tier, subscription_status, role")
      .eq("email", user.email).maybeSingle();
    const tier = prof?.subscription_status === "grandfathered"
      ? "breeder"
      : (prof?.membership_tier && TIER_SCREENS[prof.membership_tier] != null ? prof.membership_tier : "free");
    const isAdmin = prof?.role === "admin";

    let creditsRemaining: number | null = null;
    if (!isAdmin) {
      // Called with the user's JWT so auth.uid() inside the RPC is the caller.
      const { data: usage, error: rpcErr } = await userClient.rpc("consume_feature_credit", {
        p_feature: "health_screen",
        p_tier: tier,
        p_included: TIER_SCREENS[tier],
        p_cost: 1,
      });
      if (rpcErr) {
        if ((rpcErr.message || "").includes("feature_credits_exhausted")) {
          return json({
            error: "Monthly health screen limit reached for your plan.",
            code: "health_screen_credits_exhausted",
            tier, included: TIER_SCREENS[tier],
          }, 402);
        }
        return json({ error: `credit check failed: ${rpcErr.message}`, code: "credit_error" }, 500);
      }
      creditsRemaining = usage?.credits_included == null
        ? null
        : Math.max(0, usage.credits_included - usage.credits_consumed);
    }

    const { image_url, context } = await req.json();
    if (!image_url || typeof image_url !== "string") {
      return json({ error: "image_url is required", code: "bad_request" }, 400);
    }

    const contextLines = context
      ? `Animal context: name ${context.name || "unknown"}, hatch date ${context.hatch_date || "unknown"}, last weight ${context.weight_grams != null ? context.weight_grams + "g" : "unknown"}, morphs: ${(context.morphs || []).join(", ") || "unknown"}.`
      : "No additional animal context provided.";

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: image_url } },
            { type: "text", text: `${contextLines}\nReview this crested gecko photo and respond with the JSON object only.` },
          ],
        }],
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: `vision call failed (${resp.status})`, code: "vision_error", detail: detail.slice(0, 300) }, 502);
    }
    const payload = await resp.json();
    const text = (payload?.content || []).filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join("\n");
    let parsed: { observations?: unknown[]; overall_note?: string } = {};
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    } catch {
      return json({ error: "could not parse screening result", code: "parse_error" }, 502);
    }

    return json({
      observations: parsed.observations || [],
      overall_note: parsed.overall_note || "",
      disclaimer: "This is an observational husbandry screen, not a veterinary diagnosis. When in doubt, see an exotics vet.",
      credits_remaining: creditsRemaining,
    });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err), code: "server_error" }, 500);
  }
});
