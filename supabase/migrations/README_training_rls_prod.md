# Training-data RLS — prod setup

Apply this SQL **manually** in the Supabase SQL editor against production.
Not wired into the auto-applied migrations because the policies reference
`profiles.role`, which only exists in prod (preview branches don't have
the dashboard-managed profile table).

One-time copy/paste — idempotent, safe to re-run.

Introduces an **`expert_reviewer`** role on `profiles.role` and locks
the `gecko_images.verified = true` transition to admins + expert
reviewers. Any authenticated user can still contribute new samples
(`verified=false`) and edit their own contributions; promoting a
sample into the training corpus requires an expert.

```sql
-- ============================================================================
-- 1. Allow 'expert_reviewer' as a valid profiles.role value.
-- ============================================================================
-- profiles.role is TEXT without a CHECK constraint in prod, so nothing to
-- alter at the column level. This is here as documentation of the allowed
-- values: 'user' (default), 'admin', 'expert_reviewer'.
--
-- To grant the role to a specific user:
--   UPDATE profiles SET role = 'expert_reviewer' WHERE email = 'them@example.com';

-- ============================================================================
-- 2. RLS on gecko_images
-- ============================================================================
ALTER TABLE public.gecko_images ENABLE ROW LEVEL SECURITY;

-- Everyone (including anon, e.g. for the public Morph ID widget) can read
-- gecko images. If you later want to hide unverified samples from anon,
-- add `USING (verified IS TRUE)` and a second policy for authenticated.
DROP POLICY IF EXISTS "gecko_images public read" ON public.gecko_images;
CREATE POLICY "gecko_images public read" ON public.gecko_images
  FOR SELECT TO anon, authenticated
  USING (true);

-- Authenticated users can insert samples. They cannot mark them verified
-- at insert time (guarded in the WITH CHECK clause below).
DROP POLICY IF EXISTS "gecko_images authenticated insert" ON public.gecko_images;
CREATE POLICY "gecko_images authenticated insert" ON public.gecko_images
  FOR INSERT TO authenticated
  WITH CHECK (verified IS NOT TRUE);

-- Contributors can update their OWN samples (e.g. edit labels, add notes)
-- but cannot flip verified on themselves.
DROP POLICY IF EXISTS "gecko_images owner update" ON public.gecko_images;
CREATE POLICY "gecko_images owner update" ON public.gecko_images
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.jwt() ->> 'email'
    AND (verified IS NOT TRUE OR verified IS NULL)
  )
  WITH CHECK (
    created_by = auth.jwt() ->> 'email'
    AND verified IS NOT TRUE
  );

-- Admins + expert reviewers can update anything (incl. flipping verified).
DROP POLICY IF EXISTS "gecko_images reviewer update" ON public.gecko_images;
CREATE POLICY "gecko_images reviewer update" ON public.gecko_images
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role IN ('admin', 'expert_reviewer')
  ));

-- Only admins can hard-delete training samples. Rejections in the UI
-- currently mark rows as unverified + annotate notes; outright DELETE is
-- a last resort for abuse / duplicate cleanup.
DROP POLICY IF EXISTS "gecko_images admin delete" ON public.gecko_images;
CREATE POLICY "gecko_images admin delete" ON public.gecko_images
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role = 'admin'
  ));

-- ============================================================================
-- 3. Helper view: am I an expert reviewer?
-- ============================================================================
-- The /training UI calls this to decide whether to show the Approve button.
-- Kept as a SECURITY DEFINER function so anon / unauthenticated calls get
-- a clean false instead of permission errors.
CREATE OR REPLACE FUNCTION public.is_expert_reviewer()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role IN ('admin', 'expert_reviewer')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_expert_reviewer() TO anon, authenticated;
```

## Promoting a user

```sql
UPDATE profiles SET role = 'expert_reviewer' WHERE email = 'reviewer@example.com';
```

Revoke by setting it back to `'user'` (or any non-privileged value).

## Testing

```sql
-- Act as a specific user for a single query (psql only):
SET LOCAL request.jwt.claims TO '{"email":"reviewer@example.com"}';
UPDATE gecko_images SET verified = true WHERE id = '...';
-- Should succeed for reviewer, fail for regular users.
```
