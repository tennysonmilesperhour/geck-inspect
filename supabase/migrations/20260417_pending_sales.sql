-- Pending Sales: reserve price system for gecko marketplace
-- Tracks geckos with a reserve price that have been reserved by a buyer,
-- with optional payment schedules, weight/temperature shipping requirements,
-- and projected ship dates.

CREATE TABLE IF NOT EXISTS pending_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  gecko_id UUID,
  gecko_name TEXT NOT NULL,
  buyer_name TEXT,
  reserve_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- JSONB array of scheduled payments: [{amount, due_date, paid, paid_date, note}]
  payment_schedule JSONB DEFAULT '[]'::jsonb,
  -- Shipping requirements (all optional, toggled by seller)
  target_weight_grams NUMERIC(6,1),
  current_weight_grams NUMERIC(6,1),
  temp_change_from TEXT,
  temp_change_to TEXT,
  projected_ship_date DATE,
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  completed_date TIMESTAMPTZ,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_sales_user ON pending_sales(user_email);
CREATE INDEX IF NOT EXISTS idx_pending_sales_status ON pending_sales(status);
CREATE INDEX IF NOT EXISTS idx_pending_sales_gecko ON pending_sales(gecko_id);

ALTER TABLE pending_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pending sales"
  ON pending_sales FOR ALL
  USING (user_email = (auth.jwt() ->> 'email'))
  WITH CHECK (user_email = (auth.jwt() ->> 'email'));

-- Store policy field on user profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS store_policy TEXT;
