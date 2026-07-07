// Supabase Edge Function: invoke-llm
//
// Server-side proxy to Anthropic's Messages API so admin tools
// (changelog AI summarize, mass-messaging auto-generate) can call an
// LLM without exposing the API key to the browser.
//
// Env vars required:
//   ANTHROPIC_API_KEY — set via Supabase dashboard or `supabase secrets set`
//
// Input  (POST JSON): { prompt: string, response_json_schema?: object, model?: string, max_tokens?: number }
// Output (JSON)     : { text?: string, json?: object, raw?: object }
//
// JWT is required (verify_jwt=true). Only admins should reach this —
// enforce that at the database RLS / calling surface level if you want
// additional hardening.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 1500;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
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

  // When a response schema is provided, instruct the model to return pure
  // JSON and we'll parse it ourselves. This mirrors the old Base44 contract.
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
        model: body.model || DEFAULT_MODEL,
        max_tokens: body.max_tokens || DEFAULT_MAX_TOKENS,
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
        return jsonResponse({ json: parsed, text, raw: data });
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

    return jsonResponse({ text, raw: data });
  } catch (err) {
    return jsonResponse(
      { error: `Edge function crash: ${(err as Error).message}` },
      500,
    );
  }
});
