// Streams the verified training corpus as newline-delimited JSON (JSONL).
// Designed to be piped into a Hugging Face Datasets loader, a fine-tuning
// pipeline, or curl'd to disk:
//
//   curl -H "Authorization: Bearer $SUPABASE_TOKEN" \
//     "$SUPABASE_URL/functions/v1/export-training-corpus?verified_only=true" \
//     > corpus.jsonl
//
// Each line is one sample with every label the ML pipeline cares about,
// using canonical taxonomy ids — so downstream training code never has to
// reason about legacy free-text values.
//
// Query params:
//   verified_only=true|false   (default true)
//   since=2026-01-01            optional ISO date, only export rows created after
//   limit=1000                  optional cap for smoke tests
//
// Auth: requires a Supabase JWT. Admins + expert_reviewers get the full
// corpus. Anyone else gets a 403 — exporting the whole labeled dataset is
// privileged because it contains provenance / contributor emails.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function toSample(row: Record<string, unknown>) {
  const meta = (row.training_meta || {}) as Record<string, unknown>;
  return {
    id: row.id,
    image_url: row.image_url,
    labels: {
      primary_morph: row.primary_morph,
      genetic_traits: (meta.genetic_traits as string[]) || [],
      secondary_traits: row.secondary_traits || [],
      base_color: row.base_color,
      pattern_intensity: row.pattern_intensity,
      white_amount: row.white_amount,
      fired_state: row.fired_state,
    },
    context: {
      age_estimate: row.age_estimate,
      genetics: meta.genetics || {},
      photo: meta.photo || {},
    },
    provenance: {
      source: meta.provenance || "community",
      ai_original: meta.ai_original || null,
      reviewer_verdict: meta.reviewer_verdict || null,
      contributor_confidence: row.confidence_score,
      taxonomy_version: meta.taxonomy_version || null,
    },
    verified: row.verified === true,
    created_date: row.created_date,
  };
}

async function isAuthorized(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email) return null;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile } = await admin.from("profiles")
    .select("role").eq("email", user.email).maybeSingle();
  const role = profile?.role as string | undefined;
  if (role === "admin" || role === "expert_reviewer") return user.email;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET") return err(405, "GET only");

  const email = await isAuthorized(req.headers.get("Authorization"));
  if (!email) return err(403, "admin or expert_reviewer role required");

  const url = new URL(req.url);
  const verifiedOnly = url.searchParams.get("verified_only") !== "false";
  const since = url.searchParams.get("since");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 0, 50000);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let query = admin.from("gecko_images").select("*").order("created_date", { ascending: true });
  if (verifiedOnly) query = query.eq("verified", true);
  if (since) query = query.gte("created_date", since);
  if (limit) query = query.limit(limit);

  // Stream in pages so we don't materialize the whole table in memory.
  const PAGE = 500;
  const body = new ReadableStream({
    async start(controller) {
      let offset = 0;
      const enc = new TextEncoder();
      try {
        while (true) {
          const { data, error } = await query.range(offset, offset + PAGE - 1);
          if (error) {
            controller.error(error);
            return;
          }
          if (!data || data.length === 0) break;
          for (const row of data) {
            controller.enqueue(enc.encode(JSON.stringify(toSample(row)) + "\n"));
          }
          if (data.length < PAGE) break;
          offset += PAGE;
          if (limit && offset >= limit) break;
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": 'attachment; filename="geck-inspect-training.jsonl"',
      ...CORS,
    },
  });
});
