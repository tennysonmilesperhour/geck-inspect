// Supabase Edge Function — recognize-gecko-morph
//
// Accepts { imageUrl } and returns a structured morph analysis, constrained
// to the canonical taxonomy ids. Calls an open-weights VLM hosted on
// Replicate (Qwen2.5-VL by default) via the synchronous prediction API.
//
// Secrets (set via `supabase secrets set`):
//   REPLICATE_API_TOKEN   required
//   REPLICATE_MODEL       optional — defaults to "lucataco/qwen2-vl-7b-instruct"
//                         override to swap in a fine-tuned model later.
//
// Deploy:   supabase functions deploy recognize-gecko-morph --no-verify-jwt
// (The `--no-verify-jwt` flag lets anon users hit it; swap off if you gate it.)

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import {
  PRIMARY_MORPH_IDS,
  GENETIC_TRAIT_IDS,
  SECONDARY_TRAIT_IDS,
  BASE_COLOR_IDS,
  PATTERN_INTENSITY_IDS,
  WHITE_AMOUNT_IDS,
  FIRED_STATE_IDS,
  TAXONOMY_VERSION,
} from "./taxonomy.ts";

const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
const REPLICATE_MODEL = Deno.env.get("REPLICATE_MODEL") || "lucataco/qwen2-vl-7b-instruct";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function buildPrompt() {
  return `You are a world-expert crested gecko (Correlophus ciliatus) morph identifier.

Analyze the attached photograph and return a single JSON object. Use ONLY the ids
listed below for each field. If you are unsure, pick the closest id and lower the
confidence_score — do NOT invent ids.

Schema (respond with exactly this shape, no prose, no markdown fences):
{
  "primary_morph": one of [${PRIMARY_MORPH_IDS.join(", ")}],
  "genetic_traits": subset of [${GENETIC_TRAIT_IDS.join(", ")}],
  "secondary_traits": subset of [${SECONDARY_TRAIT_IDS.join(", ")}],
  "base_color": one of [${BASE_COLOR_IDS.join(", ")}],
  "pattern_intensity": one of [${PATTERN_INTENSITY_IDS.join(", ")}],
  "white_amount": one of [${WHITE_AMOUNT_IDS.join(", ")}],
  "fired_state": one of [${FIRED_STATE_IDS.join(", ")}],
  "confidence_score": integer 0-100,
  "explanation": 1-2 sentence plain-English reasoning citing visual evidence
}

Rules:
- primary_morph is the single best pattern-class id. Do not guess "harlequin" for
  a flame, or "extreme_harlequin" without >60% leg pattern.
- genetic_traits is ONLY for named/proven heritable traits (lily_white, axanthic,
  cappuccino, etc.). Leave empty if you do not see clear evidence.
- secondary_traits is observational modifiers. Multiple allowed.
- If the photo is blurry, oddly lit, or shows multiple animals, lower confidence_score
  substantially and explain why.

Taxonomy version: ${TAXONOMY_VERSION}.`;
}

function extractJson(text: string): unknown {
  if (!text) return null;
  // Model might wrap in markdown fences or add prose before/after.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first < 0 || last < 0 || last <= first) return null;
  try {
    return JSON.parse(candidate.slice(first, last + 1));
  } catch {
    return null;
  }
}

function clampToTaxonomy(raw: Record<string, unknown>) {
  const pick = (v: unknown, allowed: string[]) =>
    typeof v === "string" && allowed.includes(v) ? v : null;
  const pickMany = (v: unknown, allowed: string[]) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string" && allowed.includes(x)) : [];

  return {
    primary_morph: pick(raw.primary_morph, PRIMARY_MORPH_IDS),
    genetic_traits: pickMany(raw.genetic_traits, GENETIC_TRAIT_IDS),
    secondary_traits: pickMany(raw.secondary_traits, SECONDARY_TRAIT_IDS),
    base_color: pick(raw.base_color, BASE_COLOR_IDS),
    pattern_intensity: pick(raw.pattern_intensity, PATTERN_INTENSITY_IDS) || "medium",
    white_amount: pick(raw.white_amount, WHITE_AMOUNT_IDS) || "medium",
    fired_state: pick(raw.fired_state, FIRED_STATE_IDS) || "unknown",
    confidence_score: Math.max(0, Math.min(100, Number(raw.confidence_score) || 0)),
    explanation: typeof raw.explanation === "string" ? raw.explanation : "",
    taxonomy_version: TAXONOMY_VERSION,
    model: REPLICATE_MODEL,
  };
}

async function resolveVersion(model: string): Promise<string | null> {
  // If the caller already pinned a version (owner/name:hash), use it.
  const colon = model.indexOf(":");
  if (colon !== -1) return model.slice(colon + 1);

  // Otherwise look up the latest published version.
  const res = await fetch(
    `https://api.replicate.com/v1/models/${model}`,
    { headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` } },
  );
  if (!res.ok) return null;
  const body = await res.json();
  return body?.latest_version?.id || null;
}

async function callReplicate(imageUrl: string, prompt: string) {
  const modelSpec = REPLICATE_MODEL;
  const modelPath = modelSpec.includes(":") ? modelSpec.split(":")[0] : modelSpec;

  // Try the official /models endpoint first — works for models with an
  // "official" version set. Falls back to the version-pinned /predictions
  // endpoint for community models that don't have one.
  const input = { image: imageUrl, prompt, max_new_tokens: 600 };
  const headers = {
    Authorization: `Token ${REPLICATE_API_TOKEN}`,
    "Content-Type": "application/json",
    Prefer: "wait=60",
  };

  const primary = await fetch(
    `https://api.replicate.com/v1/models/${modelPath}/predictions`,
    { method: "POST", headers, body: JSON.stringify({ input }) },
  );
  if (primary.ok) return primary.json();

  if (primary.status !== 404 && primary.status !== 422) {
    throw new Error(`Replicate ${primary.status}: ${(await primary.text()).slice(0, 500)}`);
  }

  const version = await resolveVersion(modelSpec);
  if (!version) {
    throw new Error(
      `Replicate ${primary.status}: model "${modelSpec}" has no official version and a latest_version could not be resolved`,
    );
  }

  const fallback = await fetch(
    `https://api.replicate.com/v1/predictions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ version, input }),
    },
  );
  if (!fallback.ok) {
    throw new Error(`Replicate ${fallback.status}: ${(await fallback.text()).slice(0, 500)}`);
  }
  return fallback.json();
}

async function pollUntilDone(getUrl: string, deadlineMs: number) {
  while (Date.now() < deadlineMs) {
    const r = await fetch(getUrl, {
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
    });
    const p = await r.json();
    if (p.status === "succeeded") return p;
    if (p.status === "failed" || p.status === "canceled") {
      throw new Error(`Replicate prediction ${p.status}: ${p.error || ""}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Replicate prediction timed out");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!REPLICATE_API_TOKEN) return json({ error: "REPLICATE_API_TOKEN not set" }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const imageUrl = body?.imageUrl;
    if (!imageUrl || typeof imageUrl !== "string") {
      return json({ error: "imageUrl (string) is required" }, 400);
    }

    let prediction = await callReplicate(imageUrl, buildPrompt());

    if (prediction.status !== "succeeded") {
      const getUrl: string | undefined = prediction.urls?.get;
      if (!getUrl) throw new Error("Replicate did not return a prediction URL");
      prediction = await pollUntilDone(getUrl, Date.now() + 45_000);
    }

    const output = Array.isArray(prediction.output)
      ? prediction.output.join("")
      : String(prediction.output || "");
    const raw = extractJson(output) as Record<string, unknown> | null;
    if (!raw) {
      return json({
        error: "Could not parse model output as JSON",
        raw_output: output.slice(0, 2000),
      }, 502);
    }

    const analysis = clampToTaxonomy(raw);
    return json({ success: true, analysis, model: REPLICATE_MODEL });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
