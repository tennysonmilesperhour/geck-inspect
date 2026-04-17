-- Admin Analytics, Error Logging, Feature Telemetry, Feedback
-- Run this against your Supabase project to enable the polished admin panel.

-- ============================================================================
-- 1. error_logs — global client error capture
-- ============================================================================
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'error' CHECK (level IN ('error', 'warning', 'info')),
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
  ON error_logs (created_date DESC);
CREATE INDEX IF NOT EXISTS error_logs_resolved_idx
  ON error_logs (resolved, created_date DESC);
CREATE INDEX IF NOT EXISTS error_logs_user_email_idx
  ON error_logs (user_email);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anonymous) may report an error — they're a useful signal.
DROP POLICY IF EXISTS "anyone can report errors" ON error_logs;
CREATE POLICY "anyone can report errors" ON error_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Only admins can read or modify error logs.
DROP POLICY IF EXISTS "admins can read error logs" ON error_logs;
CREATE POLICY "admins can read error logs" ON error_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "admins can update error logs" ON error_logs;
CREATE POLICY "admins can update error logs" ON error_logs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "admins can delete error logs" ON error_logs;
CREATE POLICY "admins can delete error logs" ON error_logs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 2. user_events — lightweight feature-usage telemetry
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_events (
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
  ON user_events (created_date DESC);
CREATE INDEX IF NOT EXISTS user_events_event_name_idx
  ON user_events (event_name, created_date DESC);
CREATE INDEX IF NOT EXISTS user_events_user_email_idx
  ON user_events (user_email, created_date DESC);
CREATE INDEX IF NOT EXISTS user_events_page_idx
  ON user_events (page, created_date DESC);

ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can record events" ON user_events;
CREATE POLICY "anyone can record events" ON user_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admins can read events" ON user_events;
CREATE POLICY "admins can read events" ON user_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 3. support_messages — add 'source' so feedback widget can be filtered
-- ============================================================================
ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'support'
    CHECK (source IN ('support', 'feedback', 'bug_report', 'feature_request'));

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS page TEXT;

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS support_messages_source_idx
  ON support_messages (source, created_date DESC);

-- ============================================================================
-- 4. page_config — ensure the 'public' category is supported and any new pages
--    get a default order_position.
-- ============================================================================
-- Backfill any pages currently missing a category — set them to 'public'.
UPDATE page_config
SET category = 'public'
WHERE category IS NULL OR category = '';

-- Ensure order_position is non-null for sorting.
UPDATE page_config
SET order_position = 999
WHERE order_position IS NULL;

-- ============================================================================
-- 5. Convenience view — daily active users last 90 days
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
