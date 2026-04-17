# Admin Analytics — prod-only steps

The `20260417_admin_analytics.sql` migration creates `error_logs` and
`user_events`, which Supabase branch previews apply cleanly.

The steps below **modify existing prod tables** (`support_messages`,
`page_config`) that aren't in our migration history (they were created
via the dashboard). Run them directly against **production** in the SQL
editor after the preview migration lands.

```sql
-- Admin read/update/delete on error_logs + user_events (prod only —
-- depends on the `profiles` table with a `role` column).
DROP POLICY IF EXISTS "admins can read error logs" ON public.error_logs;
CREATE POLICY "admins can read error logs" ON public.error_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.email = auth.jwt() ->> 'email' AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "admins can update error logs" ON public.error_logs;
CREATE POLICY "admins can update error logs" ON public.error_logs
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.email = auth.jwt() ->> 'email' AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "admins can delete error logs" ON public.error_logs;
CREATE POLICY "admins can delete error logs" ON public.error_logs
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.email = auth.jwt() ->> 'email' AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "admins can read events" ON public.user_events;
CREATE POLICY "admins can read events" ON public.user_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.email = auth.jwt() ->> 'email' AND profiles.role = 'admin'));

-- Extend support_messages so the feedback widget can tag + filter.
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'support';
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS page TEXT;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS rating INTEGER;

ALTER TABLE support_messages
  DROP CONSTRAINT IF EXISTS support_messages_source_check,
  ADD CONSTRAINT support_messages_source_check
    CHECK (source IN ('support', 'feedback', 'bug_report', 'feature_request'));

ALTER TABLE support_messages
  DROP CONSTRAINT IF EXISTS support_messages_rating_check,
  ADD CONSTRAINT support_messages_rating_check
    CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5));

CREATE INDEX IF NOT EXISTS support_messages_source_idx
  ON support_messages (source, created_date DESC);

-- page_config backfill.
UPDATE page_config SET category = 'public' WHERE category IS NULL OR category = '';
UPDATE page_config SET order_position = 999 WHERE order_position IS NULL;

-- Convenience view.
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
