-- Visual-embedding column + ANN index for gecko_images.
--
-- Stores a SigLIP2-style image embedding per gecko image, populated by the
-- `embed-gecko-image` edge function on insert/update. Enables "closest
-- verified samples" retrieval on /recognition as an independent second
-- signal beside the VLM morph call.
--
-- SigLIP2-base produces 768-dim unit-norm vectors. If you swap to a
-- different encoder, adjust the dimension and recreate the index.

-- 1. Extension --------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Column -----------------------------------------------------------------
-- Nullable — backfill happens asynchronously via the edge function or an
-- offline batch job. Missing embeddings just mean the image doesn't show
-- up in kNN results until backfilled.
ALTER TABLE IF EXISTS public.gecko_images
  ADD COLUMN IF NOT EXISTS image_embedding vector(768);

-- 3. Trackers so we know how many rows still need embedding ----------------
ALTER TABLE IF EXISTS public.gecko_images
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_date  TIMESTAMPTZ;

-- 4. HNSW index for cosine-distance ANN search ------------------------------
-- cosine because SigLIP2 embeddings are unit-norm; inner product and cosine
-- are equivalent ranking on unit vectors, and cosine has broader support in
-- the ecosystem.
CREATE INDEX IF NOT EXISTS idx_gecko_images_embedding
  ON public.gecko_images
  USING hnsw (image_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 5. Nearest-neighbours RPC -------------------------------------------------
-- Returns up to `match_count` verified training samples ranked by visual
-- similarity to the query vector. Verified-only by default so /recognition
-- doesn't surface unreviewed labels as "expert matches".
CREATE OR REPLACE FUNCTION public.nearest_training_samples(
  query_embedding vector(768),
  match_count INT DEFAULT 6,
  verified_only BOOLEAN DEFAULT true
) RETURNS TABLE (
  id UUID,
  image_url TEXT,
  primary_morph TEXT,
  secondary_traits TEXT[],
  base_color TEXT,
  similarity FLOAT
)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT
    g.id,
    g.image_url,
    g.primary_morph,
    g.secondary_traits,
    g.base_color,
    1 - (g.image_embedding <=> query_embedding) AS similarity
  FROM public.gecko_images g
  WHERE g.image_embedding IS NOT NULL
    AND (NOT verified_only OR g.verified IS TRUE)
  ORDER BY g.image_embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 24));
$$;

GRANT EXECUTE ON FUNCTION public.nearest_training_samples(vector, INT, BOOLEAN)
  TO anon, authenticated;
