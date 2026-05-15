// Supabase Edge Function: recognize-gecko-morph
//
// Calls Anthropic Claude vision to identify crested gecko morphs from an
// image URL. Uses tool-use to force structured JSON that conforms to the
// canonical taxonomy (taxonomy.ts). Every field the UI consumes is clamped
// to a known id by the server so the model can't leak free-text that would
// break downstream training pipelines.
//
// Note: an earlier version of this file (#55) shipped a few-shot bank of
// verified examples prepended to the prompt. That version was reverted
// because Anthropic's image-prefetch threw 500s on ~84% of calls when the
// bank stacked multiple base44-prefixed PNG screenshots with the user's
// photo. Production accuracy dropped from 27% to 0% on the few that did
// succeed, and the cost was an 84% incident rate. Re-introduce only after
// the gecko_images verified rows are pruned to small (~256 KB) well-formed
// JPEGs and tested at a small N before redeploy.
//
// Secrets (required):
//   ANTHROPIC_API_KEY     Anthropic API key (starts with sk-ant-...)
//
// Optional:
//   CLAUDE_MODEL          Model id (default: claude-sonnet-4-6)
//
// Deploy:   supabase functions deploy recognize-gecko-morph --no-verify-jwt

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import {
  PRIMARY_MORPH_IDS,
  GENETIC_TRAIT_IDS,
  SECONDARY_TRAIT_IDS,
  BASE_COLOR_IDS,
  PATTERN_INTENSITY_IDS,
  WHITE_AMOUNT_IDS,
  FIRED_STATE_IDS,
  AGE_STAGE_IDS,
  TAXONOMY_VERSION,
} from "./taxonomy.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_MODEL = Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-4-6";

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

const AGE_STAGE_HINTS: Record<string, string> = {
  hatchling:
    "The keeper says this is a HATCHLING (under 3 months). Hatchling whites can look extremely bright and \"painted on\" with hard edges that soften with age; high pattern intensity at this stage is normal and is not by itself evidence of an extreme adult morph. Treat dramatic white sides / fringe / kneecaps as expected and weigh them at hatchling baseline, not adult baseline.",
  juvenile:
    "The keeper says this is a JUVENILE (3-12 months). Pattern and trait expression are usually at their most legible at this stage; baseline coloration is mostly settled but white edges may still soften.",
  subadult:
    "The keeper says this is a SUBADULT (12-18 months). Trait expression is mostly mature but can continue to develop; expect near-adult coloration with minor pattern shifts still possible.",
  adult:
    "The keeper says this is an ADULT (18 months or older). Trait expression is fully developed; coloration and pattern intensity reflect the animal's true morph rather than developmental changes.",
};

function buildInstructions(ageStage: string | null) {
  const ageHint = ageStage && AGE_STAGE_HINTS[ageStage]
    ? `\n\nLife-stage context: ${AGE_STAGE_HINTS[ageStage]}`
    : "";
  return `You are a world-expert crested gecko (Correlophus ciliatus) morph identifier. Analyze
the attached photograph and call the \`submit_morph_analysis\` tool with your best
assessment. Use ONLY the ids provided in the tool's schema for each field, do not
invent ids; if unsure, pick the closest and lower your confidence score.

Rules:
- primary_morph is the single best pattern-class id. Don't call "harlequin" for a
  flame, or "extreme_harlequin" without >60% leg pattern.
- genetic_traits is ONLY for named/proven heritable traits (lily_white, axanthic,
  cappuccino, etc.). Leave empty if you don't see clear evidence.
- secondary_traits is observational modifiers. Multiple allowed.
- If the photo is blurry, oddly lit, or shows multiple animals, lower
  confidence_score substantially and explain why in the explanation field.

Taxonomy version: ${TAXONOMY_VERSION}.${ageHint}`;
}

const TOOL = {
  name: "submit_morph_analysis",
  description: "Submit the structured morph analysis for this crested gecko photo.",
  input_schema: {
    type: "object",
    required: ["primary_morph", "confidence_score", "explanation"],
    properties: {
      primary_morph:     { type: "string", enum: PRIMARY_MORPH_IDS },
      genetic_traits:    { type: "array", items: { type: "string", enum: GENETIC_TRAIT_IDS } },
      secondary_traits:  { type: "array", items: { type: "string", enum: SECONDARY_TRAIT_IDS } },
      base_color:        { type: "string", enum: BASE_COLOR_IDS },
      pattern_intensity: { type: "string", enum: PATTERN_INTENSITY_IDS },
      white_amount:      { type: "string", enum: WHITE_AMOUNT_IDS },
      fired_state:       { type: "string", enum: FIRED_STATE_IDS },
      confidence_score:  { type: "integer", minimum: 0, maximum: 100 },
      explanation:       { type: "string", description: "1-2 sentences citing visual evidence." },
    },
  },
};

function clampToTaxonomy(raw: Record<string, unknown>) {
  const pick = (v: unknown, allowed: string[]) =>
    typeof v === "string" && allowed.includes(v) ? v : null;
  const pickMany = (v: unknown, allowed: string[]) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string" && allowed.includes(x)) : [];

  return {
    primary_morph:     pick(raw.primary_morph, PRIMARY_MORPH_IDS),
    genetic_traits:    pickMany(raw.genetic_traits, GENETIC_TRAIT_IDS),
    secondary_traits:  pickMany(raw.secondary_traits, SECONDARY_TRAIT_IDS),
    base_color:        pick(raw.base_color, BASE_COLOR_IDS),
    pattern_intensity: pick(raw.pattern_intensity, PATTERN_INTENSITY_IDS) || "medium",
    white_amount:      pick(raw.white_amount, WHITE_AMOUNT_IDS) || "medium",
    fired_state:       pick(raw.fired_state, FIRED_STATE_IDS) || "unknown",
    confidence_score:  Math.max(0, Math.min(100, Number(raw.confidence_score) || 0)),
    explanation:       typeof raw.explanation === "string" ? raw.explanation : "",
    taxonomy_version:  TAXONOMY_VERSION,
    model:             CLAUDE_MODEL,
  };
}

async function callClaude(imageUrls: string[], ageStage: string | null) {
  const imageBlocks = imageUrls.map((url) => ({
    type: "image",
    source: { type: "url", url },
  }));
  const multiNote = imageUrls.length > 1
    ? `\n\nNOTE: ${imageUrls.length} photos of the SAME animal are attached (different angles / fired states / lighting). Synthesize across them, e.g. compare fired-up vs fired-down color, check pattern continuity from multiple sides. Don't treat them as different geckos.`
    : "";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: buildInstructions(ageStage) + multiNote },
        ],
      }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const body = await res.json();
  const toolBlock = (body.content || []).find(
    (b: { type: string }) => b.type === "tool_use",
  );
  if (!toolBlock?.input) {
    throw new Error("Claude did not return a tool_use block");
  }
  return toolBlock.input as Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not set" }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    let imageUrls: string[] = [];
    if (Array.isArray(body?.imageUrls)) {
      imageUrls = body.imageUrls.filter((u: unknown) => typeof u === "string" && u);
    } else if (typeof body?.imageUrl === "string") {
      imageUrls = [body.imageUrl];
    }
    if (imageUrls.length === 0) {
      return json({ error: "imageUrls (string[]) or imageUrl (string) is required" }, 400);
    }
    imageUrls = imageUrls.slice(0, 5);

    const rawAgeStage = typeof body?.age_stage === "string" ? body.age_stage : null;
    const ageStage = rawAgeStage && AGE_STAGE_IDS.includes(rawAgeStage) ? rawAgeStage : null;

    const raw = await callClaude(imageUrls, ageStage);
    const analysis = clampToTaxonomy(raw);
    return json({
      success: true,
      analysis: { ...analysis, age_stage: ageStage || "unknown" },
      model: CLAUDE_MODEL,
      photo_count: imageUrls.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
