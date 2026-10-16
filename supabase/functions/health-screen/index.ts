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
// Keep the two in sync when changing quotas. Admins bypass. A screen
// that fails after the credit was taken gives it back (refunded: true).
//
// Model: Claude Sonnet 5.5 (claude-sonnet-5-5, $2 / $10 per million tokens)
// since 16 Oct 2026, replacing Sonnet 4.6 ($3 / $15). It stays in the same
// class of model on purpose: this is a welfare check on a photo, a cheaper
// model has not been graded on it, and a missed sign of metabolic bone
// disease costs more than the screen. Sonnet 5.5 thinks before answering
// by default and that thinking is paid out of max_tokens, so the call sets
// low effort and leaves room for it. Claude Haiku 5.5 ($0.10 / $0.50) is
// the next step once it has been checked on a few dozen labelled photos;
// try it with the HEALTH_SCREEN_MODEL secret, no deploy needed.
//
// Every screen is logged (tokens and cost, never the photo) to
// geck_data.model_invocations with surface "health_screen".
//
// POST { image_url: string, context?: { name, hatch_date, weight_grams, morphs } }
// 200 -> { observations: [{ area, finding, severity, note }], overall_note,
//          disclaimer, credits_remaining }
// 402 -> { code: 'health_screen_credits_exhausted', ... }
// 422 -> { code: 'refused' } when the model declines (credit given back)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { costCentsFromUsage } from "../_shared/model-cost.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("HEALTH_SCREEN_MODEL") || "claude-sonnet-5-5";
// Models that think first take an effort level and need room for the
// thinking on top of the answer (about 1,200 tokens of JSON).
const THINKING_MODELS = new Set(["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]);
const ANSWER_TOKENS = 1200;
const THINKING_ROOM = 3000;

const VET_LINE = "This is a photo check, not a veterinary diagnosis. A photo cannot rule out early metabolic bone disease or illness, so if your gecko is eating less, losing weight or moving oddly, see an exotics vet.";

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
- "looks_typical": nothing concerning is visible in this area of this photo (a photo cannot rule out early illness)
- "worth_watching": not urgent, recheck or adjust husbandry
- "see_a_vet": visible sign that warrants a professional opinion

Respond with ONLY a JSON object: {"observations":[{"area":string,"finding":string,"severity":"looks_typical"|"worth_watching"|"see_a_vet","note":string}],"overall_note":string}. Plain language. Never use em dashes. Never claim a diagnosis; say "signs that can be associated with" instead.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // The credit is taken before the AI call so two quick requests cannot
  // both slip under the monthly limit. If the screen then fails (the AI
  // call errors, its answer cannot be read, or anything throws), the
  // credit is given back with refund_feature_credit, the same way the
  // assistant (invoke-llm) does it. Only the service role may run that
  // function, so a member cannot refund screens they really used.
  let charged = false;
  let chargedUserId: string | null = null;
  let isAdmin = false;
  const startedAt = Date.now();
  // One row per screen that reached the model: tokens and cost only.
  const logCall = async (usage: Record<string, number> | null, httpStatus: number, errorCode: string | null) => {
    try {
      const sink = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: "geck_data" } });
      const { error } = await sink.from("model_invocations").insert({
        surface: "health_screen",
        model: MODEL,
        input_tokens: usage?.input_tokens ?? null,
        output_tokens: usage?.output_tokens ?? null,
        cache_read_tokens: usage?.cache_read_input_tokens ?? null,
        cache_creation_tokens: usage?.cache_creation_input_tokens ?? null,
        est_cost_cents: costCentsFromUsage(MODEL, usage),
        user_id: chargedUserId,
        is_admin: isAdmin,
        photo_count: 1,
        http_status: httpStatus,
        error_code: errorCode,
        duration_ms: Date.now() - startedAt,
      });
      if (error) console.warn("health-screen: call log failed", error.message);
    } catch (logThrew) {
      console.warn("health-screen: call log threw", logThrew);
    }
  };
  const fail = async (body: Record<string, unknown>, status: number) => {
    if (charged && chargedUserId) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        const { error: refundErr } = await admin.rpc("refund_feature_credit", {
          p_user_id: chargedUserId,
          p_feature: "health_screen",
        });
        if (!refundErr) {
          charged = false;
          return json({ ...body, refunded: true }, status);
        }
        console.warn("health-screen: refund failed", refundErr.message);
      } catch (refundThrew) {
        console.warn("health-screen: refund threw", refundThrew);
      }
      return json({ ...body, refunded: false }, status);
    }
    return json(body, status);
  };
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
    chargedUserId = user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: prof } = await admin.from("profiles")
      .select("membership_tier, subscription_status, role")
      .eq("email", user.email).maybeSingle();
    const { data: verifiedTier, error: tierError } = await userClient.rpc("effective_tier_for_current_user");
    if (tierError) return json({ error: "Could not verify membership access." }, 503);
    const tier = verifiedTier && TIER_SCREENS[verifiedTier] != null ? verifiedTier : "free";
    isAdmin = prof?.role === "admin";

    // Read and check the request before taking a credit, so a malformed
    // request does not cost the member a screen.
    const { image_url, context } = await req.json().catch(() => ({}));
    if (!image_url || typeof image_url !== "string") {
      return json({ error: "image_url is required", code: "bad_request" }, 400);
    }

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
      charged = true;
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
        max_tokens: ANSWER_TOKENS + (THINKING_MODELS.has(MODEL) ? THINKING_ROOM : 0),
        ...(THINKING_MODELS.has(MODEL) ? { output_config: { effort: "low" } } : {}),
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
      await logCall(null, resp.status, `upstream_${resp.status}`);
      return await fail({ error: `vision call failed (${resp.status})`, code: "vision_error", detail: detail.slice(0, 300) }, 502);
    }
    const payload = await resp.json();
    if (payload?.stop_reason === "refusal") {
      await logCall(payload?.usage ?? null, 200, "refusal");
      return await fail({ error: "The health check could not review this photo. Try a different photo of the gecko.", code: "refused" }, 422);
    }
    const text = (payload?.content || []).filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join("\n");
    let parsed: { observations?: unknown[]; overall_note?: string } = {};
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    } catch {
      await logCall(payload?.usage ?? null, 200, "parse_error");
      return await fail({ error: "could not parse screening result", code: "parse_error" }, 502);
    }
    await logCall(payload?.usage ?? null, 200, null);

    return json({
      observations: parsed.observations || [],
      overall_note: parsed.overall_note || "",
      // Always the vet line: a photo that shows nothing wrong cannot rule out
      // early metabolic bone disease or illness, so the screen never reads
      // as an all-clear on its own.
      disclaimer: VET_LINE,
      credits_remaining: creditsRemaining,
    });
  } catch (err) {
    return await fail({ error: String((err as Error)?.message || err), code: "server_error" }, 500);
  }
});
