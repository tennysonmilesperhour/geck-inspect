// Produces a visual embedding for a gecko image and, optionally, persists it
// on the matching gecko_images row. The embedding unlocks "closest verified
// samples" retrieval on /recognition — an independent second signal beside
// the VLM morph call.
//
// Default encoder: SigLIP2-base (768-dim unit-norm vectors) on Replicate.
// Swap via SIGLIP_MODEL env var to plug in a different encoder; if the
// dimension changes, also update the vector(N) column and HNSW index.
//
// Request shape:
//   { imageUrl: string, geckoImageId?: UUID }
// Response:
//   { embedding: number[], model: string, persisted: boolean }

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
const SIGLIP_MODEL = Deno.env.get("SIGLIP_MODEL") ||
  "krthr/clip-embeddings"; // placeholder — swap to a SigLIP2 model id on Replicate
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function normalize(vec: number[]): number[] {
  let n = 0;
  for (const v of vec) n += v * v;
  n = Math.sqrt(n);
  if (!n) return vec;
  return vec.map((v) => v / n);
}

async function resolveVersion(model: string): Promise<string | null> {
  const colon = model.indexOf(":");
  if (colon !== -1) return model.slice(colon + 1);
  const res = await fetch(
    `https://api.replicate.com/v1/models/${model}`,
    { headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` } },
  );
  if (!res.ok) return null;
  const body = await res.json();
  return body?.latest_version?.id || null;
}

async function callReplicate(imageUrl: string) {
  const modelPath = SIGLIP_MODEL.includes(":") ? SIGLIP_MODEL.split(":")[0] : SIGLIP_MODEL;
  const headers = {
    Authorization: `Token ${REPLICATE_API_TOKEN}`,
    "Content-Type": "application/json",
    Prefer: "wait=60",
  };
  const input = { image: imageUrl };

  let pred: Record<string, unknown>;
  const primary = await fetch(
    `https://api.replicate.com/v1/models/${modelPath}/predictions`,
    { method: "POST", headers, body: JSON.stringify({ input }) },
  );
  if (primary.ok) {
    pred = await primary.json();
  } else if (primary.status === 404 || primary.status === 422) {
    const version = await resolveVersion(SIGLIP_MODEL);
    if (!version) {
      throw new Error(
        `Replicate ${primary.status}: model "${SIGLIP_MODEL}" has no official version and latest_version was not resolvable`,
      );
    }
    const fallback = await fetch(
      `https://api.replicate.com/v1/predictions`,
      { method: "POST", headers, body: JSON.stringify({ version, input }) },
    );
    if (!fallback.ok) {
      throw new Error(`Replicate ${fallback.status}: ${(await fallback.text()).slice(0, 400)}`);
    }
    pred = await fallback.json();
  } else {
    throw new Error(`Replicate ${primary.status}: ${(await primary.text()).slice(0, 400)}`);
  }

  // Different encoder containers return embeddings in slightly different
  // shapes. Accept any of:
  //   { output: [0.01, 0.02, ...] }
  //   { output: { embedding: [...] } }
  //   { output: [{ embedding: [...] }] }
  const out = pred.output;
  if (Array.isArray(out) && typeof out[0] === "number") return out as number[];
  if (Array.isArray(out) && out[0]?.embedding) return out[0].embedding as number[];
  if (out?.embedding) return out.embedding as number[];
  throw new Error("Unrecognized Replicate output shape for embedding model");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!REPLICATE_API_TOKEN) return json({ error: "REPLICATE_API_TOKEN not set" }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const imageUrl = body?.imageUrl;
    const geckoImageId = body?.geckoImageId;
    if (!imageUrl || typeof imageUrl !== "string") {
      return json({ error: "imageUrl (string) is required" }, 400);
    }

    const raw = await callReplicate(imageUrl);
    const embedding = normalize(raw);

    let persisted = false;
    if (geckoImageId) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await admin.from("gecko_images")
        .update({
          image_embedding: embedding,
          embedding_model: SIGLIP_MODEL,
          embedding_date: new Date().toISOString(),
        })
        .eq("id", geckoImageId);
      if (!error) persisted = true;
    }

    return json({ embedding, model: SIGLIP_MODEL, persisted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
