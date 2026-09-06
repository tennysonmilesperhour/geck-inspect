// Supabase Edge Function: recognize-import-data
//
// Calls Anthropic Claude vision to extract gecko, breeding, or egg data
// from photos of notecards, screenshots, or handwritten records.
//
// Access: Breeder and Enterprise members (plus admins). Every call costs
// one import_scan credit from the feature_usage ledger, consumed through
// the consume_feature_credit RPC with the caller's own JWT so auth.uid()
// inside the function is the real user. The RPC reads the tier from the
// profile itself, so a client cannot claim a higher tier. Allotments per
// tier live in feature_credit_allotments (free 0, keeper 0, breeder 20,
// enterprise 200 per month) and are seeded by
// supabase/migrations/20260905001000_import_scan_allotments.sql.
//
// Before this the function ran with no auth and no metering, so anyone
// who found the URL could spend Anthropic API budget for free.
//
// Secrets (required):
//   ANTHROPIC_API_KEY     Anthropic API key
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
//                         provided automatically by the platform
//
// Optional:
//   CLAUDE_MODEL          Model id (default: claude-sonnet-4-6)
//
// Responses:
//   200 -> { success, mode, records, image_count, record_count, model,
//            credits_remaining }   (credits_remaining null for admins)
//   401 -> { error, code: "unauthenticated" }
//   402 -> { error, code: "import_scan_credits_exhausted", tier }
//   403 -> { error, code: "plan_required", tier }
//
// Deploy with JWT verification on (the default):
//   supabase functions deploy recognize-import-data

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_MODEL = Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-4-6";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Tiers that may use image import at all. Mirrors the image_import entry
// in TIER_LIMITS (src/components/subscription/PlanLimitChecker.jsx).
const IMPORT_TIERS = new Set(["breeder", "enterprise"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

const GECKO_SPECIES = [
  "Crested Gecko", "Gargoyle Gecko", "Giant Day Gecko", "Gold Dust Day Gecko",
  "Leachianus Gecko", "Mourning Gecko", "Chahoua Gecko", "Pictus Gecko",
  "Tokay Gecko", "Leopard Gecko", "African Fat-Tailed Gecko", "Other",
];

const GECKO_STATUSES = [
  "Pet", "Future Breeder", "Holdback", "Ready to Breed", "Proven", "For Sale", "Sold",
];

const EGG_STATUSES = ["Incubating", "Hatched", "Slug", "Infertile", "Stillbirth"];
const EGG_GRADES = ["A+", "A", "B", "C", "D"];

function buildPrompt(mode: string, imageCount: number) {
  const multi = imageCount > 1
    ? `\n\nYou are given ${imageCount} images. Each image may contain data about one or more records. Extract ALL records from ALL images. Use the source_image field (1-indexed) to indicate which image each record came from.`
    : "";

  const base = `You are an expert data extraction assistant for a gecko breeding management application. Your job is to read handwritten notecards, screenshots, spreadsheets, printed records, or any visual data source and extract structured gecko breeding data from them.

Be thorough: capture every piece of information visible. For any data that doesn't have a specific field, put it in the notes field. Dates should be in YYYY-MM-DD format. If a date format is ambiguous (e.g., 03/04/2025), interpret it as MM/DD/YYYY (US format) unless context clearly indicates otherwise.

If text is partially illegible, make your best guess and note the uncertainty in the notes field.${multi}`;

  if (mode === "geckos") {
    return `${base}

Extract GECKO records. Each gecko/animal should be a separate record. Look for: names, ID codes, sex, species, hatch dates, morph/trait descriptions, weight, status, parentage (sire/dam names), asking prices, breeder info, and any other notes.`;
  }

  if (mode === "breeding") {
    return `${base}

Extract BREEDING PAIR records. Look for: sire (male) and dam (female) names or IDs, pairing dates, breeding season info, breeding IDs, copulation events, status, and any notes about the pairing.`;
  }

  if (mode === "eggs") {
    return `${base}

Extract EGG/CLUTCH records. Look for: which breeding pair the eggs belong to (sire × dam names), lay dates, expected hatch dates, actual hatch dates, egg status (incubating, hatched, slug, infertile, stillbirth), egg grades, clutch numbers, and any notes.`;
  }

  // auto mode
  return `${base}

Extract ALL types of records you can find: gecko records, breeding pair records, and egg/clutch records. Categorize each appropriately. A single image may contain multiple types of records.`;
}

const TOOLS = {
  geckos: {
    name: "submit_gecko_records",
    description: "Submit extracted gecko records from the images.",
    input_schema: {
      type: "object" as const,
      required: ["records"],
      properties: {
        records: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              source_image: { type: "integer" as const, description: "Which image this record came from (1-indexed)" },
              name: { type: "string" as const },
              gecko_id_code: { type: "string" as const },
              sex: { type: "string" as const, enum: ["Male", "Female", "Unsexed"] },
              species: { type: "string" as const },
              hatch_date: { type: "string" as const, description: "YYYY-MM-DD" },
              morphs_traits: { type: "string" as const },
              weight_grams: { type: "number" as const },
              status: { type: "string" as const },
              sire_name: { type: "string" as const },
              dam_name: { type: "string" as const },
              asking_price: { type: "number" as const },
              breeder_name: { type: "string" as const },
              notes: { type: "string" as const, description: "Any extra info that doesn't fit other fields" },
            },
          },
        },
      },
    },
  },
  breeding: {
    name: "submit_breeding_records",
    description: "Submit extracted breeding pair records from the images.",
    input_schema: {
      type: "object" as const,
      required: ["records"],
      properties: {
        records: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              source_image: { type: "integer" as const },
              sire_name: { type: "string" as const },
              dam_name: { type: "string" as const },
              sire_id_code: { type: "string" as const },
              dam_id_code: { type: "string" as const },
              pairing_date: { type: "string" as const, description: "YYYY-MM-DD" },
              breeding_id: { type: "string" as const },
              breeding_season: { type: "string" as const },
              status: { type: "string" as const, enum: ["Planned", "Active", "Successful", "Failed"] },
              notes: { type: "string" as const },
            },
          },
        },
      },
    },
  },
  eggs: {
    name: "submit_egg_records",
    description: "Submit extracted egg/clutch records from the images.",
    input_schema: {
      type: "object" as const,
      required: ["records"],
      properties: {
        records: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              source_image: { type: "integer" as const },
              sire_name: { type: "string" as const },
              dam_name: { type: "string" as const },
              lay_date: { type: "string" as const, description: "YYYY-MM-DD" },
              hatch_date_expected: { type: "string" as const, description: "YYYY-MM-DD" },
              hatch_date_actual: { type: "string" as const, description: "YYYY-MM-DD" },
              status: { type: "string" as const, enum: EGG_STATUSES },
              grade: { type: "string" as const, enum: EGG_GRADES },
              clutch_number: { type: "integer" as const },
              egg_count: { type: "integer" as const, description: "Number of eggs in this clutch entry" },
              notes: { type: "string" as const },
            },
          },
        },
      },
    },
  },
};

function sanitizeGeckoRecords(raw: Record<string, unknown>[]) {
  return raw.map((r) => ({
    source_image: typeof r.source_image === "number" ? r.source_image : 1,
    name: typeof r.name === "string" ? r.name : "",
    gecko_id_code: typeof r.gecko_id_code === "string" ? r.gecko_id_code : "",
    sex: ["Male", "Female", "Unsexed"].includes(r.sex as string) ? r.sex : "Unsexed",
    species: typeof r.species === "string" ? r.species : "Crested Gecko",
    hatch_date: typeof r.hatch_date === "string" ? r.hatch_date : "",
    morphs_traits: typeof r.morphs_traits === "string" ? r.morphs_traits : "",
    weight_grams: typeof r.weight_grams === "number" ? r.weight_grams : null,
    status: GECKO_STATUSES.includes(r.status as string) ? r.status : "Pet",
    sire_name: typeof r.sire_name === "string" ? r.sire_name : "",
    dam_name: typeof r.dam_name === "string" ? r.dam_name : "",
    asking_price: typeof r.asking_price === "number" ? r.asking_price : null,
    breeder_name: typeof r.breeder_name === "string" ? r.breeder_name : "",
    notes: typeof r.notes === "string" ? r.notes : "",
  }));
}

function sanitizeBreedingRecords(raw: Record<string, unknown>[]) {
  return raw.map((r) => ({
    source_image: typeof r.source_image === "number" ? r.source_image : 1,
    sire_name: typeof r.sire_name === "string" ? r.sire_name : "",
    dam_name: typeof r.dam_name === "string" ? r.dam_name : "",
    sire_id_code: typeof r.sire_id_code === "string" ? r.sire_id_code : "",
    dam_id_code: typeof r.dam_id_code === "string" ? r.dam_id_code : "",
    pairing_date: typeof r.pairing_date === "string" ? r.pairing_date : "",
    breeding_id: typeof r.breeding_id === "string" ? r.breeding_id : "",
    breeding_season: typeof r.breeding_season === "string" ? r.breeding_season : "",
    status: ["Planned", "Active", "Successful", "Failed"].includes(r.status as string) ? r.status : "Planned",
    notes: typeof r.notes === "string" ? r.notes : "",
  }));
}

function sanitizeEggRecords(raw: Record<string, unknown>[]) {
  return raw.map((r) => ({
    source_image: typeof r.source_image === "number" ? r.source_image : 1,
    sire_name: typeof r.sire_name === "string" ? r.sire_name : "",
    dam_name: typeof r.dam_name === "string" ? r.dam_name : "",
    lay_date: typeof r.lay_date === "string" ? r.lay_date : "",
    hatch_date_expected: typeof r.hatch_date_expected === "string" ? r.hatch_date_expected : "",
    hatch_date_actual: typeof r.hatch_date_actual === "string" ? r.hatch_date_actual : "",
    status: EGG_STATUSES.includes(r.status as string) ? r.status : "Incubating",
    grade: EGG_GRADES.includes(r.grade as string) ? r.grade : null,
    clutch_number: typeof r.clutch_number === "number" ? r.clutch_number : null,
    egg_count: typeof r.egg_count === "number" ? r.egg_count : 1,
    notes: typeof r.notes === "string" ? r.notes : "",
  }));
}

async function callClaude(imageUrls: string[], mode: string) {
  const imageBlocks = imageUrls.map((url) => ({
    type: "image",
    source: { type: "url", url },
  }));

  const tool = TOOLS[mode as keyof typeof TOOLS] || TOOLS.geckos;
  const prompt = buildPrompt(mode, imageUrls.length);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [
        {
          role: "user",
          content: [...imageBlocks, { type: "text", text: prompt }],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Anthropic ${res.status}: ${(await res.text()).slice(0, 500)}`
    );
  }

  const body = await res.json();
  const toolBlock = (body.content || []).find(
    (b: { type: string }) => b.type === "tool_use"
  );
  if (!toolBlock?.input) {
    throw new Error("Claude did not return a tool_use block");
  }
  return toolBlock.input as { records: Record<string, unknown>[] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!ANTHROPIC_API_KEY)
    return json({ error: "ANTHROPIC_API_KEY not set", code: "config_error" }, 500);

  try {
    // 1. Who is calling? The user's JWT rides in the Authorization header.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ error: "Sign in to use image import.", code: "unauthenticated" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user?.email) {
      return json({ error: "Sign in to use image import.", code: "unauthenticated" }, 401);
    }

    // 2. Which plan? Read as the service role so RLS on profiles can never
    //    hide the billing columns from us.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: prof } = await admin
      .from("profiles")
      .select("membership_tier, subscription_status, role")
      .eq("email", user.email)
      .maybeSingle();
    const isAdmin = prof?.role === "admin";
    const { data: tier, error: tierError } = await userClient.rpc("effective_tier_for_current_user");
    if (tierError) return json({ error: "Could not verify membership access." }, 503);

    if (!isAdmin && !IMPORT_TIERS.has(tier)) {
      return json({
        error: "AI Image Import is included with the Breeder and Enterprise plans.",
        code: "plan_required",
        tier,
      }, 403);
    }

    // 3. Validate the request body.
    const body = await req.json().catch(() => ({}));

    let imageUrls: string[] = [];
    if (Array.isArray(body?.imageUrls)) {
      imageUrls = body.imageUrls.filter(
        (u: unknown) => typeof u === "string" && /^https?:\/\//i.test(u)
      );
    }
    if (imageUrls.length === 0) {
      return json({ error: "imageUrls (string[]) is required", code: "bad_request" }, 400);
    }
    imageUrls = imageUrls.slice(0, 10);

    const mode = ["geckos", "breeding", "eggs"].includes(body?.mode)
      ? body.mode
      : "geckos";

    // 4. Spend one import_scan credit, only once the request is valid so a
    //    malformed call never costs the member anything. The RPC re-derives
    //    the tier from the profile, so p_tier and p_included are
    //    informational only.
    let creditsRemaining: number | null = null;
    if (!isAdmin) {
      const { data: usage, error: rpcErr } = await userClient.rpc("consume_feature_credit", {
        p_feature: "import_scan",
        p_tier: tier,
        p_included: null,
        p_cost: 1,
      });
      if (rpcErr) {
        if ((rpcErr.message || "").includes("feature_credits_exhausted")) {
          return json({
            error: "Monthly image import limit reached for your plan.",
            code: "import_scan_credits_exhausted",
            tier,
          }, 402);
        }
        return json({ error: `credit check failed: ${rpcErr.message}`, code: "credit_error" }, 500);
      }
      creditsRemaining = usage?.credits_included == null
        ? null
        : Math.max(0, usage.credits_included - usage.credits_consumed);
    }

    // 5. Do the work.
    const raw = await callClaude(imageUrls, mode);
    const records = Array.isArray(raw.records) ? raw.records : [];

    let sanitized;
    if (mode === "breeding") {
      sanitized = sanitizeBreedingRecords(records);
    } else if (mode === "eggs") {
      sanitized = sanitizeEggRecords(records);
    } else {
      sanitized = sanitizeGeckoRecords(records);
    }

    return json({
      success: true,
      mode,
      records: sanitized,
      image_count: imageUrls.length,
      record_count: sanitized.length,
      model: CLAUDE_MODEL,
      credits_remaining: creditsRemaining,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message, code: "internal_error" }, 500);
  }
});
