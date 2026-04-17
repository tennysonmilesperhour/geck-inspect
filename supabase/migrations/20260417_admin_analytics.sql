-- Admin Analytics: error logs + feature-event telemetry tables.
-- Kept minimal and self-contained so Supabase preview branches apply it
-- cleanly. Modifications to the existing `support_messages` and
-- `page_config` tables live in 20260417_admin_analytics_prod_only.sql
-- which is applied manually against prod (not picked up by preview).

-- ============================================================================
-- error_logs — global client error capture
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_email TEXT,
  user_agent TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  resolved_by TEXT,
  resolved_date TIMESTAMPTZ,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_logs_created_date_idx
  ON public.error_logs (created_date DESC);
CREATE INDEX IF NOT EXISTS error_logs_resolved_idx
  ON public.error_logs (resolved, created_date DESC);
CREATE INDEX IF NOT EXISTS error_logs_user_email_idx
  ON public.error_logs (user_email);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can report errors" ON public.error_logs;
CREATE POLICY "anyone can report errors" ON public.error_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated can read own errors" ON public.error_logs;
CREATE POLICY "authenticated can read own errors" ON public.error_logs
  FOR SELECT TO authenticated
  USING (user_email = auth.jwt() ->> 'email');

-- ============================================================================
-- user_events — lightweight feature-usage telemetry
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  user_email TEXT,
  page TEXT,
  session_id TEXT,
  properties JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_events_created_date_idx
  ON public.user_events (created_date DESC);
CREATE INDEX IF NOT EXISTS user_events_event_name_idx
  ON public.user_events (event_name, created_date DESC);
CREATE INDEX IF NOT EXISTS user_events_user_email_idx
  ON public.user_events (user_email, created_date DESC);
CREATE INDEX IF NOT EXISTS user_events_page_idx
  ON public.user_events (page, created_date DESC);

ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can record events" ON public.user_events;
CREATE POLICY "anyone can record events" ON public.user_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated can read own events" ON public.user_events;
CREATE POLICY "authenticated can read own events" ON public.user_events
  FOR SELECT TO authenticated
  USING (user_email = auth.jwt() ->> 'email');
