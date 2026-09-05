// Produces a visual embedding for a gecko image and, optionally, persists it
// on the matching gecko_images row. The embedding unlocks "closest verified
// samples" retrieval on /recognition, an independent second signal beside
// the VLM morph call.
//
// Default encoder: CLIP ViT-L/14 (768-dim vectors) on Replicate.
// Swap via SIGLIP_MODEL env var to plug in a morph-specific encoder; if the
// dimension changes, also update the vector(N) column and HNSW index.
//
// Request shape:
//   { imageUrl: string, geckoImageId?: UUID }
// Response:
//   { embedding: number[], model: string, persisted: boolean }

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createVisualEmbedding,
  DEFAULT_VISUAL_EMBEDDING_MODEL,
} from "../_shared/visual-embedding.ts";

const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
const SIGLIP_MODEL = Deno.env.get("SIGLIP_MODEL") ||
  DEFAULT_VISUAL_EMBEDDING_MODEL;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MORPH_EMBED_BACKFILL_KEY = Deno.env.get("MORPH_EMBED_BACKFILL_KEY") || "";
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-morph-embed-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let targetId: string | null = null;
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const backfillKey = req.headers.get("x-morph-embed-key") || "";
    const isBackfill = Boolean(
      MORPH_EMBED_BACKFILL_KEY && backfillKey === MORPH_EMBED_BACKFILL_KEY,
    );
    if (!token && !isBackfill) {
      return json({ error: "auth required", code: "auth_required" }, 401);
    }
    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
    let userEmail: string | null = null;
    if (!isServiceRole && !isBackfill) {
      const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await authClient.auth.getUser();
      if (!user) return json({ error: "auth required", code: "auth_required" }, 401);
      userEmail = user.email || null;
    }
    if (!REPLICATE_API_TOKEN) {
      return json({ error: "Image similarity is not configured", code: "config_error" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const imageUrl = body?.imageUrl;
    const geckoImageId = body?.geckoImageId;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return json({ error: "A valid HTTPS imageUrl is required", code: "bad_request" }, 400);
    }
    if (parsedUrl.protocol !== "https:" || String(imageUrl).length > 2048) {
      return json({ error: "A valid HTTPS imageUrl is required", code: "bad_request" }, 400);
    }

    if (geckoImageId) {
      targetId = String(geckoImageId);
      if (!isServiceRole && !isBackfill) {
        const { data: profile } = await admin.from("profiles")
          .select("role")
          .eq("email", userEmail || "")
          .maybeSingle();
        if (!profile || !["admin", "expert_reviewer"].includes(profile.role)) {
          return json({ error: "expert role required to persist embeddings", code: "forbidden" }, 403);
        }
      }
      const { data: target } = await admin.from("gecko_images")
        .select("embedding_attempts")
        .eq("id", targetId)
        .maybeSingle();
      await admin.from("gecko_images")
        .update({
          embedding_status: "processing",
          embedding_attempts: Number(target?.embedding_attempts || 0) + 1,
          embedding_error: null,
        })
        .eq("id", targetId);
    }

    const { embedding, model } = await createVisualEmbedding(imageUrl, {
      token: REPLICATE_API_TOKEN,
      model: SIGLIP_MODEL,
    });

    let persisted = false;
    if (targetId) {
      const { error } = await admin.from("gecko_images")
        .update({
          image_embedding: embedding,
          embedding_model: model,
          embedding_date: new Date().toISOString(),
          embedding_status: "ready",
          embedding_error: null,
        })
        .eq("id", targetId);
      if (error) throw new Error(`Embedding persistence failed: ${error.message}`);
      persisted = true;
    }

    return json({ embedding, model, persisted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (targetId) {
      await admin.from("gecko_images")
        .update({ embedding_status: "failed", embedding_error: message.slice(0, 500) })
        .eq("id", targetId);
    }
    return json({ error: message }, 500);
  }
});
