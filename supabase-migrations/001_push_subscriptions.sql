-- Push notification subscriptions table
-- Run this in the Supabase SQL editor to create the table

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  endpoint text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  user_agent text,
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now(),
  UNIQUE(user_email, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_email ON push_subscriptions(user_email);

-- RLS: users can manage their own subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscriptions" ON push_subscriptions
  FOR ALL USING (user_email = (auth.jwt() ->> 'email'));

CREATE POLICY "Service role full access" ON push_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Add push_notifications_enabled column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'push_notifications_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN push_notifications_enabled boolean DEFAULT true;
  END IF;
END $$;
