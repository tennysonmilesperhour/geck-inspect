// Supabase Edge Function: invoke-llm
//
// Server-side proxy to Anthropic's Messages API so the app can call an
// LLM without exposing the API key to the browser. Two kinds of caller:
//
//   - Admin tools (changelog summaries, mass-messaging drafts, blog
//     drafting, training analysis). Admins may pick any allowlisted
//     model and use up to ADMIN_MAX_TOKENS.
//   - GeckoGenius, the keeper-facing assistant (BreederConsultant). Every
//     call consumes one `assistant_message` credit from the feature
//     ledger (consume_feature_credit, keyed by the caller's real tier),
//     runs on the default model, and is capped at USER_MAX_TOKENS.
//
// Before this version any signed-in user could pick the model and token
// budget and there was no metering at all, so the monthly assistant limit
// only existed in the browser.
//
// Env vars required:
//   ANTHROPIC_API_KEY  set via Supabase dashboard or `supabase secrets set`
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY  injected
//
// Input  (POST JSON): { prompt: string, response_json_schema?: object, model?: string, max_tokens?: number }
// Output (JSON)     : { text?: string, json?: object, raw?: object, credits?: { included, remaining } }
// Errors            : 401 unauthenticated, 402 feature_credits_exhausted, 413 prompt too long

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
// Models admins may request. Anything else falls back to the default.
const ADMIN_MODELS = new Set([
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
]);
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
    prompt?: string;
    response_json_schema?: Record<string, unknown>;
    model?: string;
    max_tokens?: number;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

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
  const model = isAdmin && ADMIN_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;
  const requestedTokens = Number(body.max_tokens) || DEFAULT_MAX_TOKENS;
  const maxTokens = Math.max(
    1,
    Math.min(requestedTokens, isAdmin ? ADMIN_MAX_TOKENS : USER_MAX_TOKENS),
  );

  // Keeper-facing calls consume one assistant credit, with the allotment
  // resolved server-side from the caller's tier.
  let credits: { included: number | null; remaining: number | null } | undefined;
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
  }

  // When a response schema is provided, instruct the model to return pure
  // JSON and we'll parse it ourselves.
  const wantsJson = !!body.response_json_schema;
  const systemPrompt = wantsJson
    ? `You are a helpful assistant. Return ONLY a valid JSON object that matches this JSON schema, with no preamble, no markdown fences, no explanation:\n${JSON.stringify(body.response_json_schema)}`
    : "You are a helpful assistant.";

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return jsonResponse(
        { error: `Anthropic API error (${anthropicRes.status}): ${errText}` },
        502,
      );
    }

    const data = await anthropicRes.json();
    const textBlock = Array.isArray(data?.content)
      ? data.content.find((b: { type: string }) => b.type === "text")
      : null;
    const text = textBlock?.text || "";

    if (wantsJson) {
      // Strip markdown fences if the model added them despite instructions.
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      try {
        const parsed = JSON.parse(cleaned);
        return jsonResponse({ json: parsed, text, raw: data, credits });
      } catch (err) {
        return jsonResponse(
          {
            error: `LLM returned non-JSON content: ${(err as Error).message}`,
            text,
          },
          502,
        );
      }
    }

    return jsonResponse({ text, raw: data, credits });
  } catch (err) {
    return jsonResponse(
      { error: `Edge function crash: ${(err as Error).message}` },
      500,
    );
  }
});
