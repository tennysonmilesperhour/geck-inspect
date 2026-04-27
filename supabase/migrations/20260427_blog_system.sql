-- =============================================================================
-- AI-Powered Blog System
-- =============================================================================
--
-- Adds the data layer for the admin blog feature. Creates five tables:
--
--   blog_settings    one row per admin user — site-wide blog configuration
--   blog_categories  per-admin category taxonomy (name + slug + active flag)
--   blog_tags        per-admin tag taxonomy
--   blog_posts       the posts themselves (draft / scheduled / published / archived)
--   blog_logs        append-only audit trail (post created, AI-generated,
--                    scheduled, published, archive, publishing failed, etc.)
--
-- A pg_cron job runs once a minute, calling process_scheduled_blog_posts()
-- to promote any post whose scheduled_at has elapsed from 'scheduled' to
-- 'published'. The function logs every promotion into blog_logs.
--
-- RLS rules:
--
--   Admins (profiles.role = 'admin') have full read/write access to every
--   blog_* table. Public (anon + authenticated non-admins) can SELECT
--   published posts and the categories/tags they reference. Drafts,
--   scheduled posts, and archived posts are invisible publicly.
--
-- The created_by / created_date / updated_date columns match the
-- convention used by every other table in this app (the supabaseEntities
-- compatibility layer auto-populates them on INSERT/UPDATE).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- helper: is the current request from an admin?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_blog_admin() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
     WHERE email = auth.jwt() ->> 'email'
       AND role  = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_blog_admin() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- blog_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_settings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL DEFAULT auth.uid()
                              REFERENCES auth.users(id) ON DELETE CASCADE,
  blog_enabled                BOOLEAN NOT NULL DEFAULT TRUE,
  blog_name                   TEXT NOT NULL DEFAULT 'Geck Inspect Blog',
  blog_description            TEXT NOT NULL DEFAULT '',
  default_author_name         TEXT,
  default_author_bio          TEXT,
  default_author_avatar_url   TEXT,
  default_blog_route          TEXT NOT NULL DEFAULT '/blog',
  posts_per_page              INTEGER NOT NULL DEFAULT 12
                              CHECK (posts_per_page > 0 AND posts_per_page <= 100),
  show_author_box             BOOLEAN NOT NULL DEFAULT TRUE,
  show_related_posts          BOOLEAN NOT NULL DEFAULT TRUE,
  enable_ai_generation        BOOLEAN NOT NULL DEFAULT TRUE,
  enable_scheduled_publishing BOOLEAN NOT NULL DEFAULT TRUE,
  created_by                  TEXT,
  created_date                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT blog_settings_user_unique UNIQUE (user_id)
);

-- ---------------------------------------------------------------------------
-- blog_categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL DEFAULT auth.uid()
               REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT blog_categories_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS blog_categories_active_idx
  ON public.blog_categories (is_active);

-- ---------------------------------------------------------------------------
-- blog_tags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_tags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL DEFAULT auth.uid()
               REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT blog_tags_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS blog_tags_active_idx
  ON public.blog_tags (is_active);

-- ---------------------------------------------------------------------------
-- blog_posts
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_post_status') THEN
    CREATE TYPE blog_post_status AS ENUM
      ('draft', 'scheduled', 'published', 'archived');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL DEFAULT auth.uid()
                       REFERENCES auth.users(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  slug                 TEXT NOT NULL,
  excerpt              TEXT,
  content_markdown     TEXT,
  content_html         TEXT,
  status               blog_post_status NOT NULL DEFAULT 'draft',
  target_keyword       TEXT,
  category_id          UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  tag_ids              UUID[] NOT NULL DEFAULT '{}'::UUID[],
  author_name          TEXT,
  author_bio           TEXT,
  author_avatar_url    TEXT,
  featured_image_url   TEXT,
  featured_image_alt   TEXT,
  meta_title           TEXT,
  meta_description     TEXT,
  canonical_url        TEXT,
  reading_time_minutes INTEGER NOT NULL DEFAULT 0,
  word_count           INTEGER NOT NULL DEFAULT 0,
  scheduled_at         TIMESTAMPTZ,
  published_at         TIMESTAMPTZ,
  created_by           TEXT,
  created_date         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS blog_posts_status_published_idx
  ON public.blog_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_category_idx
  ON public.blog_posts (category_id);
CREATE INDEX IF NOT EXISTS blog_posts_scheduled_idx
  ON public.blog_posts (scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS blog_posts_tag_ids_idx
  ON public.blog_posts USING GIN (tag_ids);

-- ---------------------------------------------------------------------------
-- blog_logs (append-only audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID DEFAULT auth.uid()
                  REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  related_post_id UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  status          TEXT,
  message         TEXT,
  created_by      TEXT,
  created_date    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_logs_recent_idx
  ON public.blog_logs (created_date DESC);
CREATE INDEX IF NOT EXISTS blog_logs_post_idx
  ON public.blog_logs (related_post_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.blog_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_logs       ENABLE ROW LEVEL SECURITY;

-- blog_settings: admin-only.
DROP POLICY IF EXISTS blog_settings_admin_all ON public.blog_settings;
CREATE POLICY blog_settings_admin_all ON public.blog_settings
  FOR ALL TO authenticated
  USING      (public.is_blog_admin())
  WITH CHECK (public.is_blog_admin());

-- blog_categories: admins manage, public reads active categories.
DROP POLICY IF EXISTS blog_categories_admin_all     ON public.blog_categories;
DROP POLICY IF EXISTS blog_categories_public_read   ON public.blog_categories;
CREATE POLICY blog_categories_admin_all ON public.blog_categories
  FOR ALL TO authenticated
  USING      (public.is_blog_admin())
  WITH CHECK (public.is_blog_admin());
CREATE POLICY blog_categories_public_read ON public.blog_categories
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

-- blog_tags: same pattern as categories.
DROP POLICY IF EXISTS blog_tags_admin_all   ON public.blog_tags;
DROP POLICY IF EXISTS blog_tags_public_read ON public.blog_tags;
CREATE POLICY blog_tags_admin_all ON public.blog_tags
  FOR ALL TO authenticated
  USING      (public.is_blog_admin())
  WITH CHECK (public.is_blog_admin());
CREATE POLICY blog_tags_public_read ON public.blog_tags
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

-- blog_posts: admins manage all; public reads only published posts whose
-- published_at is in the past (scheduled posts that haven't flipped yet
-- still hide).
DROP POLICY IF EXISTS blog_posts_admin_all   ON public.blog_posts;
DROP POLICY IF EXISTS blog_posts_public_read ON public.blog_posts;
CREATE POLICY blog_posts_admin_all ON public.blog_posts
  FOR ALL TO authenticated
  USING      (public.is_blog_admin())
  WITH CHECK (public.is_blog_admin());
CREATE POLICY blog_posts_public_read ON public.blog_posts
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    AND (published_at IS NULL OR published_at <= now())
  );

-- blog_logs: admin-only. No UPDATE / DELETE — append-only.
DROP POLICY IF EXISTS blog_logs_admin_select ON public.blog_logs;
DROP POLICY IF EXISTS blog_logs_admin_insert ON public.blog_logs;
CREATE POLICY blog_logs_admin_select ON public.blog_logs
  FOR SELECT TO authenticated
  USING (public.is_blog_admin());
CREATE POLICY blog_logs_admin_insert ON public.blog_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_blog_admin());

-- ---------------------------------------------------------------------------
-- Scheduled-publishing automation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_scheduled_blog_posts()
  RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, extensions
AS $$
DECLARE
  promoted_count INTEGER := 0;
BEGIN
  WITH promoted AS (
    UPDATE public.blog_posts
       SET status       = 'published',
           published_at = COALESCE(published_at, scheduled_at, now()),
           updated_date = now()
     WHERE status = 'scheduled'
       AND scheduled_at IS NOT NULL
       AND scheduled_at <= now()
    RETURNING id, user_id
  )
  INSERT INTO public.blog_logs (user_id, event_type, related_post_id, status, message)
  SELECT user_id, 'post_published', id, 'success',
         'Scheduled post auto-published by process_scheduled_blog_posts()'
    FROM promoted;

  GET DIAGNOSTICS promoted_count = ROW_COUNT;
  RETURN promoted_count;
END;
$$;

COMMENT ON FUNCTION public.process_scheduled_blog_posts() IS
  'Promotes any blog_posts row with status=scheduled and scheduled_at<=now() to status=published. Logs each promotion into blog_logs. Returns the count promoted. Called every minute by pg_cron.';

GRANT EXECUTE ON FUNCTION public.process_scheduled_blog_posts() TO authenticated;

-- ---------------------------------------------------------------------------
-- pg_cron schedule (idempotent)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule('process-scheduled-blog-posts');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'process-scheduled-blog-posts',
  '* * * * *',
  $$ SELECT public.process_scheduled_blog_posts(); $$
);

-- ---------------------------------------------------------------------------
-- updated_date keep-alive trigger (matches the convention used elsewhere)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._blog_touch_updated_date()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_date := now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER blog_settings_touch BEFORE UPDATE ON public.blog_settings
    FOR EACH ROW EXECUTE FUNCTION public._blog_touch_updated_date();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER blog_categories_touch BEFORE UPDATE ON public.blog_categories
    FOR EACH ROW EXECUTE FUNCTION public._blog_touch_updated_date();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER blog_tags_touch BEFORE UPDATE ON public.blog_tags
    FOR EACH ROW EXECUTE FUNCTION public._blog_touch_updated_date();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER blog_posts_touch BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW EXECUTE FUNCTION public._blog_touch_updated_date();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
