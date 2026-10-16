// Supabase Edge Function: invoke-llm
//
// Server-side proxy to Anthropic's Messages API so the app can call an
// LLM without exposing the API key to the browser. Two kinds of caller:
//
//   - Admin tools (changelog summaries, mass-messaging drafts, blog
//     drafting, training analysis). Admins may pick any allowlisted
//     model and use up to ADMIN_MAX_TOKENS.
//   - GeckoGenius, the keeper-facing assistant (BreederConsultant). Every
//     member call consumes one `assistant_message` credit from the feature
//     ledger (consume_feature_credit, keyed by the caller's real tier),
//     runs on the default model, and is capped at USER_MAX_TOKENS.
//
// Two request shapes:
//
//   { mode: "consultant", question, history?, gecko_names?, facts? }
//     The chat page. The system prompt (who GeckoGenius is, the care,
//     genetics and price rules, and the record actions) is built here in
//     consultant.ts; the browser sends only data. Since 16 Oct 2026.
//
//   { prompt, response_json_schema?, model?, max_tokens? }
//     The plain path, kept for the admin tools and for copies of the chat
//     page that were open before the consultant mode shipped. A member's
//     call on this path still gets the GeckoGenius rules as its system
//     prompt, so skipping the consultant mode does not skip the rules.
//
// Model: Claude Haiku 5.5 (claude-haiku-5-5, $0.10 / $0.50 per million
// tokens), the current Haiku. It replaced the dated Haiku 4.5 id ($1 / $5)
// on 16 Oct 2026. To roll back without a deploy, set the function secret
// INVOKE_LLM_MODEL=claude-haiku-4-5. Haiku 5.5 thinks before it answers by
// default, and that thinking counts toward max_tokens, so models that do
// get room for it on top of the answer budget and an explicit effort level.
//
// Every call is logged (tokens and cost, never the text) to
// geck_data.model_invocations with surface "assistant", so the monthly
// cost on the scoreboard includes it. Logging can fail without failing
// the call.
//
// Env vars required:
//   ANTHROPIC_API_KEY  set via Supabase dashboard or `supabase secrets set`
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY  injected
// Optional:
//   INVOKE_LLM_MODEL   one of KNOWN_MODELS, to change the default model
//
// Output (JSON)     : { text?: string, json?: object, raw?: object, credits?: { included, remaining } }
// Errors            : 400 bad request, 401 unauthenticated, 402 feature_credits_exhausted,
//                     413 too long, 422 the model declined (code "refused"),
//                     502/500 when the AI call fails. A failed call gives the credit back
//                     (refund_feature_credit) and says so with `refunded: true`, so the
//                     member's monthly count is unchanged.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { buildConsultantRequest, KEEPER_RULES } from "./consultant.ts";
import { costCentsFromUsage } from "../_shared/model-cost.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Models this function knows how to call. Admins may request any of them;
// members always get the default.
const KNOWN_MODELS = new Set([
  "claude-haiku-5-5",
  "claude-sonnet-5-5",
  "claude-haiku-4-5",
]);
const ENV_MODEL = Deno.env.get("INVOKE_LLM_MODEL") || "";
const DEFAULT_MODEL = KNOWN_MODELS.has(ENV_MODEL) ? ENV_MODEL : "claude-haiku-5-5";

// Models that think before answering unless told otherwise. They take an
// effort level, and their thinking is paid out of max_tokens, so they get
// THINKING_ROOM extra tokens on top of the answer budget.
const THINKING_MODELS = new Set(["claude-haiku-5-5", "claude-sonnet-5-5"]);
const THINKING_ROOM = 3000;

const DEFAULT_MAX_TOKENS = 1500;
const USER_MAX_TOKENS = 2000;
const ADMIN_MAX_TOKENS = 8192;
const USER_MAX_PROMPT_CHARS = 40_000;
const ADMIN_MAX_PROMPT_CHARS = 200_000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function bearerToken(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
}

type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse(
      { error: "ANTHROPIC_API_KEY not set on the edge function." },
      500,
    );
  }

  // Who is calling? The gateway verified the JWT is signed, but the anon
  // key is a valid JWT too, so require an actual user session.
  const token = bearerToken(req);
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "unauthenticated" }, 401);
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const callerEmail = String(userData?.user?.email || "").trim().toLowerCase();
  if (userErr || !callerEmail) {
    return jsonResponse({ error: "unauthenticated" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("email", callerEmail)
    .maybeSingle();
  const isAdmin = profile?.role === "admin";

  let body: {
    mode?: string;
    prompt?: string;
    response_json_schema?: Record<string, unknown>;
    model?: string;
    max_tokens?: number;
    question?: string;
    history?: unknown;
    gecko_names?: unknown;
    facts?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  // Build the request before any credit is taken, so a malformed request
  // costs the member nothing.
  const consultant = body.mode === "consultant";
  const wantsJson = !consultant && !!body.response_json_schema;
  let system: string;
  let messages: Array<{ role: "user" | "assistant"; content: string }>;
  let model: string;
  let answerTokens: number;
  let effort: "low" | "medium";
  if (consultant) {
    const built = buildConsultantRequest(body as Record<string, unknown>);
    if (!built.ok) return jsonResponse({ error: built.error }, built.status);
    system = built.system;
    messages = built.messages;
    model = DEFAULT_MODEL;
    answerTokens = USER_MAX_TOKENS;
    // Medium (the model's own default, set explicitly): the chat carries
    // care and welfare rules it must follow, which low effort follows less
    // reliably, and at Haiku 5.5 prices the extra thinking costs about a
    // tenth of a cent.
    effort = "medium";
  } else {
    const prompt = (body.prompt || "").trim();
    if (!prompt) {
      return jsonResponse({ error: "prompt is required" }, 400);
    }
    const maxPromptChars = isAdmin ? ADMIN_MAX_PROMPT_CHARS : USER_MAX_PROMPT_CHARS;
    if (prompt.length > maxPromptChars) {
      return jsonResponse({ error: "prompt too long" }, 413);
    }
    // Model and token budget are decided here, not by the caller.
    const requestedModel = String(body.model || "");
    model = isAdmin && KNOWN_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;
    const requestedTokens = Number(body.max_tokens) || DEFAULT_MAX_TOKENS;
    answerTokens = Math.max(
      1,
      Math.min(requestedTokens, isAdmin ? ADMIN_MAX_TOKENS : USER_MAX_TOKENS),
    );
    // Admins get a plain assistant. Members get the GeckoGenius rules: an
    // older copy of the chat page sends its whole prompt this way, and
    // nobody else should be able to reach the model without them.
    const base = isAdmin ? "You are a helpful assistant." : KEEPER_RULES;
    system = wantsJson
      ? `${base}\n\nReturn ONLY a valid JSON object that matches this JSON schema, with no preamble, no markdown fences, no explanation:\n${JSON.stringify(body.response_json_schema)}`
      : base;
    messages = [{ role: "user", content: prompt }];
    // Drafting and summarizing: low effort is enough and keeps it quick.
    effort = "low";
  }

  // Keeper-facing calls consume one assistant credit, with the allotment
  // resolved server-side from the caller's tier.
  let credits: { included: number | null; remaining: number | null } | undefined;
  let charged = false;
  if (!isAdmin) {
    const { data: usage, error: rpcErr } = await userClient.rpc("consume_feature_credit", {
      p_feature: "assistant_message",
      p_tier: null,
      p_included: null,
      p_cost: 1,
    });
    if (rpcErr) {
      const msg = String(rpcErr.message || "");
      if (msg.includes("feature_credits_exhausted")) {
        return jsonResponse({ error: "feature_credits_exhausted" }, 402);
      }
      if (msg.includes("not_authenticated")) {
        return jsonResponse({ error: "unauthenticated" }, 401);
      }
      console.warn("invoke-llm: credit consumption failed", rpcErr);
      return jsonResponse({ error: "credit check failed" }, 500);
    }
    const included = usage?.credits_included ?? null;
    const consumed = Number(usage?.credits_consumed ?? 0);
    credits = {
      included,
      remaining: included == null ? null : Math.max(0, included - consumed),
    };
    charged = true;
  }

  // One row per call in geck_data.model_invocations: tokens and cost only,
  // never the question or the answer.
  const startedAt = Date.now();
  const logCall = async (
    usage: AnthropicUsage | null,
    httpStatus: number,
    errorCode: string | null,
  ) => {
    try {
      const sink = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
        db: { schema: "geck_data" },
      });
      const { error } = await sink.from("model_invocations").insert({
        surface: "assistant",
        model,
        input_tokens: usage?.input_tokens ?? null,
        output_tokens: usage?.output_tokens ?? null,
        cache_read_tokens: usage?.cache_read_input_tokens ?? null,
        cache_creation_tokens: usage?.cache_creation_input_tokens ?? null,
        est_cost_cents: costCentsFromUsage(model, usage),
        user_id: userData.user!.id,
        tier: null,
        is_admin: isAdmin,
        http_status: httpStatus,
        error_code: errorCode,
        duration_ms: Date.now() - startedAt,
      });
      if (error) console.warn("invoke-llm: call log failed", error.message);
    } catch (err) {
      console.warn("invoke-llm: call log threw", err);
    }
  };

  // The credit is taken before the AI call (so two quick messages cannot
  // both slip under the limit). When the call then fails, give it back.
  // Only the service role may run refund_feature_credit.
  const failWithRefund = async (body: Record<string, unknown>, status: number) => {
    if (charged) {
      const { error: refundErr } = await admin.rpc("refund_feature_credit", {
        p_user_id: userData.user!.id,
        p_feature: "assistant_message",
      });
      if (refundErr) {
        console.warn("invoke-llm: refund failed", refundErr);
      } else {
        charged = false;
        const remaining = credits?.remaining == null ? null : credits.remaining + 1;
        return jsonResponse({ ...body, refunded: true, credits: credits ? { ...credits, remaining } : undefined }, status);
      }
    }
    return jsonResponse({ ...body, refunded: false }, status);
  };

  const thinks = THINKING_MODELS.has(model);
  const request: Record<string, unknown> = {
    model,
    max_tokens: answerTokens + (thinks ? THINKING_ROOM : 0),
    system,
    messages,
  };
  if (thinks) request.output_config = { effort };

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(request),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      await logCall(null, anthropicRes.status, `upstream_${anthropicRes.status}`);
      return await failWithRefund(
        { error: `Anthropic API error (${anthropicRes.status}): ${errText.slice(0, 500)}` },
        502,
      );
    }

    const data = await anthropicRes.json();
    const usage: AnthropicUsage | null = data?.usage ?? null;

    // A declined request comes back as a normal answer with this stop
    // reason and no text. Retrying the same question will not help, so it
    // gets its own code; the credit still goes back.
    if (data?.stop_reason === "refusal") {
      await logCall(usage, 200, "refusal");
      return await failWithRefund(
        { error: "The assistant could not help with that question.", code: "refused" },
        422,
      );
    }

    // The answer is every text block, in order. Thinking blocks come first
    // and carry no text for the member.
    const text = Array.isArray(data?.content)
      ? data.content
        .filter((b: { type?: string; text?: string }) => b?.type === "text" && typeof b.text === "string")
        .map((b: { text: string }) => b.text)
        .join("\n\n")
        .trim()
      : "";
    if (!text) {
      await logCall(usage, 200, data?.stop_reason === "max_tokens" ? "empty_max_tokens" : "empty");
      return await failWithRefund({ error: "The AI returned an empty answer." }, 502);
    }

    if (wantsJson) {
      // Strip markdown fences if the model added them despite instructions.
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      try {
        const parsed = JSON.parse(cleaned);
        await logCall(usage, 200, null);
        return jsonResponse({ json: parsed, text, raw: data, credits });
      } catch (err) {
        await logCall(usage, 200, "bad_json");
        return await failWithRefund(
          {
            error: `LLM returned non-JSON content: ${(err as Error).message}`,
            text,
          },
          502,
        );
      }
    }

    await logCall(usage, 200, null);
    // The chat page needs only the words; the plain path keeps `raw` for
    // the admin tools that were written against it.
    return jsonResponse(consultant ? { text, credits } : { text, raw: data, credits });
  } catch (err) {
    return await failWithRefund(
      { error: `Edge function crash: ${(err as Error).message}` },
      500,
    );
  }
});
