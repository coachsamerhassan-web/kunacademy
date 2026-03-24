-- ============================================================================
-- Kun Academy — V2 Remaining Tables Migration
-- Created: 2026-03-24
-- Adds: 11 tables (ratings, referrals, credits, digital products, commissions,
--        earnings, payouts, payment schedules, blog_posts)
-- Alters: products (product_type, creator_id, commission_override)
--         services (commission_override)
-- All prices are INTEGER in minor units (250 AED = 25000)
-- ============================================================================

-- ============================================================================
-- 1. COACH RATINGS
-- ============================================================================
CREATE TABLE coach_ratings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text    TEXT,
  testimonial_id UUID REFERENCES testimonials(id) ON DELETE SET NULL,
  booking_id     UUID REFERENCES bookings(id) ON DELETE SET NULL,
  is_published   BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, coach_id, booking_id)
);

ALTER TABLE coach_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_ratings_public_select" ON coach_ratings
  FOR SELECT USING (is_published = true);
CREATE POLICY "coach_ratings_own_select" ON coach_ratings
  FOR SELECT USING (user_id = auth.uid() OR coach_id = auth.uid());
CREATE POLICY "coach_ratings_own_insert" ON coach_ratings
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.customer_id = auth.uid()
        AND b.status = 'completed'
    )
  );
CREATE POLICY "coach_ratings_admin" ON coach_ratings
  FOR ALL USING (is_admin());

-- ============================================================================
-- 2. COACH BADGES (materialized view — updated by trigger)
-- ============================================================================
CREATE TABLE coach_badges (
  coach_id     UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  badge_tier   TEXT NOT NULL CHECK (badge_tier IN ('bronze','silver','gold','platinum')),
  avg_rating   NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE coach_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_badges_public_select" ON coach_badges
  FOR SELECT USING (true);
CREATE POLICY "coach_badges_admin" ON coach_badges
  FOR ALL USING (is_admin());

-- Auto-update badge on new rating
CREATE OR REPLACE FUNCTION update_coach_badge()
RETURNS TRIGGER AS $$
DECLARE
  v_avg NUMERIC(3,2);
  v_count INTEGER;
  v_tier TEXT;
BEGIN
  SELECT AVG(rating)::NUMERIC(3,2), COUNT(*)
  INTO v_avg, v_count
  FROM coach_ratings
  WHERE coach_id = NEW.coach_id AND is_published = true;

  v_tier := CASE
    WHEN v_count >= 50 AND v_avg >= 4.8 THEN 'platinum'
    WHEN v_count >= 25 AND v_avg >= 4.5 THEN 'gold'
    WHEN v_count >= 10 AND v_avg >= 4.0 THEN 'silver'
    ELSE 'bronze'
  END;

  INSERT INTO coach_badges (coach_id, badge_tier, avg_rating, review_count, updated_at)
  VALUES (NEW.coach_id, v_tier, v_avg, v_count, now())
  ON CONFLICT (coach_id) DO UPDATE SET
    badge_tier = v_tier,
    avg_rating = v_avg,
    review_count = v_count,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_coach_rating_change
  AFTER INSERT OR UPDATE ON coach_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_coach_badge();

-- ============================================================================
-- 3. REFERRAL CODES
-- ============================================================================
CREATE TABLE referral_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code       TEXT UNIQUE NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_codes_own_select" ON referral_codes
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "referral_codes_admin" ON referral_codes
  FOR ALL USING (is_admin());

-- ============================================================================
-- 4. CREDIT TRANSACTIONS
-- ============================================================================
CREATE TABLE credit_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('earn','spend','payout')),
  source_type   TEXT, -- 'referral', 'promo', 'admin_grant', 'service_booking', etc.
  source_id     UUID,
  balance_after INTEGER NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credits_own_select" ON credit_transactions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "credits_admin" ON credit_transactions
  FOR ALL USING (is_admin());

-- ============================================================================
-- 5. BLOG POSTS (separate from legacy `posts` — full CMS-connected blog)
-- ============================================================================
CREATE TABLE blog_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  title_ar      TEXT NOT NULL,
  title_en      TEXT,
  body_ar       TEXT,
  body_en       TEXT,
  excerpt_ar    TEXT,
  excerpt_en    TEXT,
  author_id     UUID REFERENCES profiles(id),
  category      TEXT,
  tags          TEXT[],
  featured_image TEXT,
  content_doc_id TEXT, -- Google Doc ID for rich content
  is_published  BOOLEAN DEFAULT false,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_posts_public_select" ON blog_posts
  FOR SELECT USING (is_published = true);
CREATE POLICY "blog_posts_author_select" ON blog_posts
  FOR SELECT USING (author_id = auth.uid());
CREATE POLICY "blog_posts_admin" ON blog_posts
  FOR ALL USING (is_admin());

-- ============================================================================
-- 6. DIGITAL ASSETS (linked to products)
-- ============================================================================
CREATE TABLE digital_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  file_type       TEXT NOT NULL, -- 'pdf', 'video', 'audio', 'zip'
  file_size_bytes INTEGER,
  display_name    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE digital_assets ENABLE ROW LEVEL SECURITY;

-- Only purchasers can see asset URLs (enforced via download_tokens)
CREATE POLICY "digital_assets_admin" ON digital_assets
  FOR ALL USING (is_admin());

-- ============================================================================
-- 7. DOWNLOAD TOKENS (secure, time-limited file access)
-- ============================================================================
CREATE TABLE download_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id  UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_id       UUID NOT NULL REFERENCES digital_assets(id) ON DELETE CASCADE,
  token          UUID UNIQUE DEFAULT gen_random_uuid(),
  expires_at     TIMESTAMPTZ NOT NULL,
  download_count INTEGER DEFAULT 0,
  max_downloads  INTEGER DEFAULT 3,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "download_tokens_own_select" ON download_tokens
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "download_tokens_admin" ON download_tokens
  FOR ALL USING (is_admin());

-- ============================================================================
-- 8. COMMISSION RATES
-- ============================================================================
CREATE TABLE commission_rates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope      TEXT NOT NULL CHECK (scope IN ('global','level','profile','item')),
  scope_id   TEXT, -- NULL for global, profile_id/item_id for others
  category   TEXT NOT NULL CHECK (category IN ('services','products')),
  rate_pct   NUMERIC(5,2) NOT NULL CHECK (rate_pct >= 0 AND rate_pct <= 100),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_rates_admin" ON commission_rates
  FOR ALL USING (is_admin());
-- Coaches can see their own commission rates
CREATE POLICY "commission_rates_own_select" ON commission_rates
  FOR SELECT USING (
    scope = 'profile' AND scope_id = auth.uid()::TEXT
  );

-- ============================================================================
-- 9. EARNINGS
-- ============================================================================
CREATE TABLE earnings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_type       TEXT NOT NULL CHECK (source_type IN ('service_booking','product_sale','referral')),
  source_id         UUID,
  gross_amount      INTEGER NOT NULL,
  commission_pct    NUMERIC(5,2) NOT NULL,
  commission_amount INTEGER NOT NULL,
  net_amount        INTEGER NOT NULL,
  currency          VARCHAR(3) NOT NULL DEFAULT 'AED',
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','available','paid_out')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "earnings_own_select" ON earnings
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "earnings_admin" ON earnings
  FOR ALL USING (is_admin());

-- ============================================================================
-- 10. PAYOUT REQUESTS
-- ============================================================================
CREATE TABLE payout_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount         INTEGER NOT NULL CHECK (amount > 0),
  currency       VARCHAR(3) NOT NULL DEFAULT 'AED',
  status         TEXT DEFAULT 'requested' CHECK (status IN ('requested','approved','processed','rejected')),
  processed_by   UUID REFERENCES profiles(id),
  processed_at   TIMESTAMPTZ,
  payment_method TEXT, -- 'bank_transfer', 'stripe_payout'
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payouts_own_select" ON payout_requests
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "payouts_own_insert" ON payout_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "payouts_admin" ON payout_requests
  FOR ALL USING (is_admin());

-- ============================================================================
-- 11. PAYMENT SCHEDULES (installments, deposit+balance)
-- ============================================================================
CREATE TABLE payment_schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id       UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount     INTEGER NOT NULL,
  paid_amount      INTEGER DEFAULT 0,
  remaining_amount INTEGER NOT NULL,
  schedule_type    TEXT NOT NULL CHECK (schedule_type IN ('deposit_balance','installment')),
  installments     JSONB NOT NULL DEFAULT '[]',
  -- Each installment: {due_date, amount, status: pending|paid|overdue, paid_at}
  currency         VARCHAR(3) NOT NULL DEFAULT 'AED',
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules_own_select" ON payment_schedules
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "schedules_admin" ON payment_schedules
  FOR ALL USING (is_admin());


-- ============================================================================
-- ALTER EXISTING TABLES — products and services
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'physical'
    CHECK (product_type IN ('physical','digital','hybrid')),
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS commission_override_pct NUMERIC(5,2);

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS commission_override_pct NUMERIC(5,2);


-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX idx_coach_ratings_coach ON coach_ratings(coach_id) WHERE is_published = true;
CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_earnings_user_status ON earnings(user_id, status);
CREATE INDEX idx_blog_posts_published ON blog_posts(published_at DESC) WHERE is_published = true;
CREATE INDEX idx_download_tokens_token ON download_tokens(token) WHERE download_count < max_downloads;
CREATE INDEX idx_payment_schedules_user ON payment_schedules(user_id);


-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Default global commission rates
INSERT INTO commission_rates (scope, scope_id, category, rate_pct) VALUES
  ('global', NULL, 'services', 30.00),
  ('global', NULL, 'products', 20.00);
