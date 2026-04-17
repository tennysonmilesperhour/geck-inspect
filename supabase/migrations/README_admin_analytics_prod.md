# Admin Analytics — prod setup

Apply this SQL **manually** in the Supabase SQL editor against production.
It is not wired into the auto-applied migrations because preview branches
don't have the dashboard-managed tables this script extends
(`support_messages`, `page_config`) and because the RLS policies depend
on the `profiles.role` column that only exists in prod.

One-time copy/paste — idempotent, safe to re-run.

```sql
-- ============================================================================
-- 1. New tables: error_logs + user_events
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

ALTER TABLE public.error_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. RLS policies: anyone can write telemetry; admins can read.
-- ============================================================================
DROP POLICY IF EXISTS "anyone can report errors" ON public.error_logs;
CREATE POLICY "anyone can report errors" ON public.error_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anyone can record events" ON public.user_events;
CREATE POLICY "anyone can record events" ON public.user_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admins can read error logs" ON public.error_logs;
CREATE POLICY "admins can read error logs" ON public.error_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "admins can update error logs" ON public.error_logs;
CREATE POLICY "admins can update error logs" ON public.error_logs
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "admins can delete error logs" ON public.error_logs;
CREATE POLICY "admins can delete error logs" ON public.error_logs
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "admins can read events" ON public.user_events;
CREATE POLICY "admins can read events" ON public.user_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role = 'admin'
  ));

-- ============================================================================
-- 3. support_messages — source / page / rating so the feedback widget
--    can tag and the admin inbox can filter.
-- ============================================================================
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'support';
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS page TEXT;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS rating INTEGER;

ALTER TABLE support_messages
  DROP CONSTRAINT IF EXISTS support_messages_source_check;
ALTER TABLE support_messages
  ADD CONSTRAINT support_messages_source_check
    CHECK (source IN ('support', 'feedback', 'bug_report', 'feature_request'));

ALTER TABLE support_messages
  DROP CONSTRAINT IF EXISTS support_messages_rating_check;
ALTER TABLE support_messages
  ADD CONSTRAINT support_messages_rating_check
    CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5));

CREATE INDEX IF NOT EXISTS support_messages_source_idx
  ON support_messages (source, created_date DESC);

-- ============================================================================
-- 4. page_config — backfill defaults.
-- ============================================================================
UPDATE page_config SET category = 'public' WHERE category IS NULL OR category = '';
UPDATE page_config SET order_position = 999 WHERE order_position IS NULL;

-- ============================================================================
-- 5. Daily-activity convenience view for the analytics dashboard.
-- ============================================================================
CREATE OR REPLACE VIEW v_daily_activity AS
SELECT
  date_trunc('day', created_date)::date AS day,
  COUNT(DISTINCT user_email) AS active_users,
  COUNT(*) AS event_count
FROM user_events
WHERE created_date > now() - interval '90 days'
  AND user_email IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;
```
