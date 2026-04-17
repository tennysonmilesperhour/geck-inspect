-- Admin Analytics, Error Logging, Feature Telemetry, Feedback
-- Fully self-contained: guards all references to dashboard-managed tables
-- (profiles, support_messages, page_config) so preview branches with no
-- migration history still apply cleanly.

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

-- ============================================================================
-- 3. RLS policies — anyone can insert; reads are admin-only.
--     Policies referencing `profiles` are only created when that table
--     exists. On preview branches without profiles, the admin-read
--     policies are skipped (no harm — RLS with no SELECT policy simply
--     denies reads, matching the intent).
-- ============================================================================
DO $$
DECLARE
  has_profiles BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) INTO has_profiles;

  -- Anyone may insert an error or event. Telemetry is a signal; PII is
  -- masked by the client already.
  EXECUTE 'DROP POLICY IF EXISTS "anyone can report errors" ON error_logs';
  EXECUTE $p$CREATE POLICY "anyone can report errors" ON error_logs
    FOR INSERT TO anon, authenticated WITH CHECK (true)$p$;

  EXECUTE 'DROP POLICY IF EXISTS "anyone can record events" ON user_events';
  EXECUTE $p$CREATE POLICY "anyone can record events" ON user_events
    FOR INSERT TO anon, authenticated WITH CHECK (true)$p$;

  IF has_profiles THEN
    EXECUTE 'DROP POLICY IF EXISTS "admins can read error logs" ON error_logs';
    EXECUTE $p$CREATE POLICY "admins can read error logs" ON error_logs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.email = auth.jwt() ->> 'email'
          AND profiles.role = 'admin'
        )
      )$p$;

    EXECUTE 'DROP POLICY IF EXISTS "admins can update error logs" ON error_logs';
    EXECUTE $p$CREATE POLICY "admins can update error logs" ON error_logs
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.email = auth.jwt() ->> 'email'
          AND profiles.role = 'admin'
        )
      )$p$;

    EXECUTE 'DROP POLICY IF EXISTS "admins can delete error logs" ON error_logs';
    EXECUTE $p$CREATE POLICY "admins can delete error logs" ON error_logs
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.email = auth.jwt() ->> 'email'
          AND profiles.role = 'admin'
        )
      )$p$;

    EXECUTE 'DROP POLICY IF EXISTS "admins can read events" ON user_events';
    EXECUTE $p$CREATE POLICY "admins can read events" ON user_events
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.email = auth.jwt() ->> 'email'
          AND profiles.role = 'admin'
        )
      )$p$;
  END IF;
END
$$;

-- ============================================================================
-- 4. support_messages — add source / page / rating for the feedback widget.
--     Guarded so preview branches without the table skip cleanly.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'support_messages'
  ) THEN
    ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'support';
    ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS page TEXT;
    ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS rating INTEGER;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'support_messages_source_check'
    ) THEN
      ALTER TABLE support_messages
        ADD CONSTRAINT support_messages_source_check
        CHECK (source IN ('support', 'feedback', 'bug_report', 'feature_request'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'support_messages_rating_check'
    ) THEN
      ALTER TABLE support_messages
        ADD CONSTRAINT support_messages_rating_check
        CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5));
    END IF;

    CREATE INDEX IF NOT EXISTS support_messages_source_idx
      ON support_messages (source, created_date DESC);
  END IF;
END
$$;

-- ============================================================================
-- 5. page_config — default category / order_position backfill.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'page_config'
  ) THEN
    UPDATE page_config SET category = 'public' WHERE category IS NULL OR category = '';
    UPDATE page_config SET order_position = 999 WHERE order_position IS NULL;
  END IF;
END
$$;

-- ============================================================================
-- 6. Daily-activity view for the analytics dashboard.
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
