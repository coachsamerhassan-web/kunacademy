-- 0011: Service marketplace — coach service opt-in, custom pricing, discount codes

-- 1. Add columns to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS coach_control text NOT NULL DEFAULT 'mandatory';
ALTER TABLE services ADD COLUMN IF NOT EXISTS allows_coach_pricing boolean NOT NULL DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS min_price_aed integer NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS min_price_egp integer NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS min_price_eur integer NOT NULL DEFAULT 0;

-- 2. Create coach_services junction table
CREATE TABLE IF NOT EXISTS coach_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  assigned_by text NOT NULL DEFAULT 'auto',
  custom_price_aed integer,
  custom_price_egp integer,
  custom_price_eur integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, service_id)
);

-- 3. Create discount_codes table
CREATE TABLE IF NOT EXISTS discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value integer NOT NULL,
  currency text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  applicable_service_ids uuid[],
  provider_id uuid REFERENCES providers(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Add CHECK constraints
ALTER TABLE services ADD CONSTRAINT chk_coach_control CHECK (coach_control IN ('optional', 'mandatory', 'admin_only'));
ALTER TABLE coach_services ADD CONSTRAINT chk_assigned_by CHECK (assigned_by IN ('auto', 'coach', 'admin'));
ALTER TABLE discount_codes ADD CONSTRAINT chk_discount_type CHECK (discount_type IN ('percentage', 'fixed_amount'));
ALTER TABLE discount_codes ADD CONSTRAINT chk_discount_value_positive CHECK (discount_value > 0);

-- 5. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_coach_services_provider ON coach_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_coach_services_service ON coach_services(service_id);
CREATE INDEX IF NOT EXISTS idx_coach_services_active ON coach_services(provider_id, service_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_discount_codes_provider ON discount_codes(provider_id) WHERE provider_id IS NOT NULL;

-- 6. RLS policies
ALTER TABLE coach_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated reads on coach_services (for booking flow)
CREATE POLICY coach_services_select ON coach_services FOR SELECT USING (true);
-- Allow coach to update their own rows
CREATE POLICY coach_services_update ON coach_services FOR UPDATE USING (
  provider_id IN (SELECT id FROM providers WHERE profile_id = auth.uid())
);

-- Discount codes: public read for validation, restricted write
CREATE POLICY discount_codes_select ON discount_codes FOR SELECT USING (true);
