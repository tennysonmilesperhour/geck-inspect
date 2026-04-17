-- Admin Analytics: error logs + feature-event telemetry tables.
-- Bare CREATE TABLE statements only so Supabase branch previews apply
-- cleanly. RLS policies and extensions to dashboard-managed tables
-- (profiles, support_messages, page_config) live in
-- README_admin_analytics_prod.md and are applied manually to prod.

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
