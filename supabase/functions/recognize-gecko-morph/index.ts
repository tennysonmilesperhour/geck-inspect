// Supabase Edge Function — recognize-gecko-morph
//
// Calls Anthropic Claude vision to identify crested gecko morphs from an
// image URL. Uses tool-use to force structured JSON that conforms to the
// canonical taxonomy (taxonomy.ts). Every field the UI consumes is clamped
// to a known id by the server so the model can't leak free-text that would
// break downstream training pipelines.
//
// As of 2026-05-15: ships a few-shot bank of verified examples from
// gecko_images. At cold start we read up to N verified rows per
// primary_morph and prepend them as labeled image blocks before the
// caller's photo. The model gets explicit visual anchors for each label
// instead of inferring them from prior knowledge alone — boosting
// accuracy on the hard pairs (harlequin vs extreme_harlequin, dalmatian
// vs red_dalmatian, etc.). The bank is cached in module memory for the
// life of the warm instance.
//
// Secrets (required):
//   ANTHROPIC_API_KEY     Anthropic API key (starts with sk-ant-...)
//
// Optional:
//   CLAUDE_MODEL          Model id (default: claude-sonnet-4-6)
//   FEW_SHOT_PER_MORPH    Examples to load per primary_morph (default 2,
//                         max 4). Set to 0 to disable few-shot.
//
// Deploy:   supabase functions deploy recognize-gecko-morph --no-verify-jwt

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_MODEL = Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-4-6";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FEW_SHOT_PER_MORPH = Math.min(
  4,
  Math.max(0, Number(Deno.env.get("FEW_SHOT_PER_MORPH") ?? "2") || 0),
);

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

// ---------------------------------------------------------------------------
// Few-shot bank
// ---------------------------------------------------------------------------

type FewShotExample = {
  image_url: string;
  primary_morph: string;
  base_color: string | null;
};

let fewShotCache: Promise<FewShotExample[]> | null = null;

async function loadFewShotBank(): Promise<FewShotExample[]> {
  if (FEW_SHOT_PER_MORPH === 0) return [];
  // Use the cached promise so concurrent first-call requests share one
  // database round-trip.
  if (!fewShotCache) {
    fewShotCache = (async (): Promise<FewShotExample[]> => {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data, error } = await admin
        .from("gecko_images")
        .select("image_url, primary_morph, base_color, verified, created_date")
        .eq("verified", true)
        .not("primary_morph", "is", null)
        .not("image_url", "is", null)
        .in("primary_morph", PRIMARY_MORPH_IDS)
        .order("created_date", { ascending: false })
        .limit(500);
      if (error) {
        console.error("few-shot bank load failed:", error.message);
        return [];
      }
      // Bucket per primary_morph, keep the N most recent per bucket.
      const buckets = new Map<string, FewShotExample[]>();
      for (const r of data ?? []) {
        const m = r.primary_morph as string;
        const arr = buckets.get(m) ?? [];
        if (arr.length < FEW_SHOT_PER_MORPH) {
          arr.push({
            image_url: r.image_url as string,
            primary_morph: m,
            base_color: (r.base_color as string | null) ?? null,
          });
          buckets.set(m, arr);
        }
      }
      // Flatten alphabetically by morph so the prompt order is stable;
      // helps Claude treat the bank as a reference rather than a sequence.
      const flat: FewShotExample[] = [];
      for (const morph of [...buckets.keys()].sort()) {
        flat.push(...(buckets.get(morph) ?? []));
      }
      console.log(
        `few-shot bank: ${flat.length} examples across ${buckets.size} morphs`,
      );
      return flat;
    })();
  }
  return fewShotCache;
}

function buildInstructions(fewShotBank: FewShotExample[]) {
  const bankIntro = fewShotBank.length === 0
    ? ""
    : `\n\nFew-shot reference: the first ${fewShotBank.length} attached image(s) are EXPERT-VERIFIED examples from the geck-inspect training corpus, each labeled with its canonical primary_morph. Use them to anchor your visual definitions BEFORE evaluating the user's photo (the final image). The mapping, in order:\n${fewShotBank
        .map((ex, i) => `  ${i + 1}. ${ex.primary_morph}${ex.base_color ? ` (base ${ex.base_color})` : ""}`)
        .join("\n")}`;

  return `You are a world-expert crested gecko (Correlophus ciliatus) morph identifier. Analyze
the user's photograph(s) and call the \`submit_morph_analysis\` tool with your best
assessment. Use ONLY the ids provided in the tool's schema for each field — do not
invent ids; if unsure, pick the closest and lower your confidence score.

Rules:
- primary_morph is the single best pattern-class id. Don't call "harlequin" for a
  flame, or "extreme_harlequin" without >60% leg pattern.
- genetic_traits is ONLY for named/proven heritable traits (lily_white, axanthic,
  cappuccino, etc.). Leave empty if you don't see clear evidence.
- secondary_traits is observational modifiers. Multiple allowed.
- If the photo is blurry, oddly lit, or shows multiple animals, lower
  confidence_score substantially and explain why in the explanation field.

Taxonomy version: ${TAXONOMY_VERSION}.${bankIntro}`;
}

// Tool schema — Claude will call this tool with arguments conforming to it,
// which is how we get guaranteed-structured output.
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

async function callClaude(imageUrls: string[]): Promise<{
  raw: Record<string, unknown>;
  few_shot_count: number;
}> {
  const fewShotBank = await loadFewShotBank();
  const fewShotBlocks = fewShotBank.map((ex) => ({
    type: "image",
    source: { type: "url", url: ex.image_url },
  }));
  const userImageBlocks = imageUrls.map((url) => ({
    type: "image",
    source: { type: "url", url },
  }));
  const multiNote = imageUrls.length > 1
    ? `\n\nNOTE: the LAST ${imageUrls.length} photos are of the SAME user-submitted animal (different angles / fired states / lighting). Synthesize across them — e.g. compare fired-up vs fired-down color, check pattern continuity from multiple sides. Don't treat them as different geckos.`
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
          ...fewShotBlocks,
          ...userImageBlocks,
          { type: "text", text: buildInstructions(fewShotBank) + multiNote },
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
  return {
    raw: toolBlock.input as Record<string, unknown>,
    few_shot_count: fewShotBank.length,
  };
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

    const { raw, few_shot_count } = await callClaude(imageUrls);
    const analysis = clampToTaxonomy(raw);
    return json({
      success: true,
      analysis,
      model: CLAUDE_MODEL,
      photo_count: imageUrls.length,
      few_shot_count,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
