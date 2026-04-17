-- P1: Animal Passport + Ownership Transfer
-- Run this migration against your Supabase project to add the new tables.
-- The existing `geckos` table is extended with passport fields.

-- 1. Add passport fields to existing geckos table
ALTER TABLE geckos
  ADD COLUMN IF NOT EXISTS passport_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS pattern_grade TEXT CHECK (pattern_grade IN ('pet', 'breeder', 'high_end', 'investment')),
  ADD COLUMN IF NOT EXISTS genetics_notes TEXT,
  ADD COLUMN IF NOT EXISTS breeder_name TEXT,
  ADD COLUMN IF NOT EXISTS breeder_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hatch_facility TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS listing_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS estimated_hatch_year INTEGER;

-- 2. Ownership records — chain of custody
CREATE TABLE IF NOT EXISTS ownership_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES geckos(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES auth.users(id),
  owner_name TEXT NOT NULL,
  owner_avatar_url TEXT,
  acquired_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transfer_method TEXT CHECK (transfer_method IN ('original_breeder', 'purchased', 'gifted', 'breeding_loan_return')),
  sale_price NUMERIC(10,2),
  contributed_to_market_data BOOLEAN DEFAULT false,
  notes TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- 3. Feeding records — per-animal feeding logs
CREATE TABLE IF NOT EXISTS feeding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES geckos(id) ON DELETE CASCADE,
  logged_by UUID REFERENCES auth.users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  food_type TEXT,
  accepted BOOLEAN DEFAULT true,
  notes TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- 4. Shed records
CREATE TABLE IF NOT EXISTS shed_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES geckos(id) ON DELETE CASCADE,
  logged_by UUID REFERENCES auth.users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  quality TEXT CHECK (quality IN ('complete', 'retained_toes', 'retained_eye_caps', 'partial', 'unknown')),
  notes TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- 5. Vet records
CREATE TABLE IF NOT EXISTS vet_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES geckos(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  vet_name TEXT,
  reason TEXT,
  findings TEXT,
  treatment TEXT,
  follow_up DATE,
  attachments TEXT[] DEFAULT '{}',
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- 6. Transfer requests — ownership transfer workflow
CREATE TABLE IF NOT EXISTS transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES geckos(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id),
  to_email TEXT NOT NULL,
  to_user_id UUID REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled')),
  sale_price NUMERIC(10,2),
  message TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '72 hours')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ownership_records_animal ON ownership_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_feeding_records_animal ON feeding_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_shed_records_animal ON shed_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_vet_records_animal ON vet_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_token ON transfer_requests(token);
CREATE INDEX IF NOT EXISTS idx_geckos_passport_code ON geckos(passport_code);

-- RLS policies (enable RLS on new tables)
ALTER TABLE ownership_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeding_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE shed_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vet_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;

-- Public read for passport-visible data
DROP POLICY IF EXISTS "Public can read ownership records" ON ownership_records;
CREATE POLICY "Public can read ownership records" ON ownership_records FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read feeding records" ON feeding_records;
CREATE POLICY "Public can read feeding records" ON feeding_records FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read shed records" ON shed_records;
CREATE POLICY "Public can read shed records" ON shed_records FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read vet records" ON vet_records;
CREATE POLICY "Public can read vet records" ON vet_records FOR SELECT USING (true);

-- Owners can insert/update their own records
DROP POLICY IF EXISTS "Users manage own ownership records" ON ownership_records;
CREATE POLICY "Users manage own ownership records" ON ownership_records FOR ALL USING (created_by = auth.jwt()->>'email');
DROP POLICY IF EXISTS "Users manage own feeding records" ON feeding_records;
CREATE POLICY "Users manage own feeding records" ON feeding_records FOR ALL USING (created_by = auth.jwt()->>'email');
DROP POLICY IF EXISTS "Users manage own shed records" ON shed_records;
CREATE POLICY "Users manage own shed records" ON shed_records FOR ALL USING (created_by = auth.jwt()->>'email');
DROP POLICY IF EXISTS "Users manage own vet records" ON vet_records;
CREATE POLICY "Users manage own vet records" ON vet_records FOR ALL USING (created_by = auth.jwt()->>'email');
DROP POLICY IF EXISTS "Users manage own transfer requests" ON transfer_requests;
CREATE POLICY "Users manage own transfer requests" ON transfer_requests FOR ALL USING (created_by = auth.jwt()->>'email');
-- Anyone can read transfer requests (needed for claim flow)
DROP POLICY IF EXISTS "Public can read transfer requests" ON transfer_requests;
CREATE POLICY "Public can read transfer requests" ON transfer_requests FOR SELECT USING (true);
