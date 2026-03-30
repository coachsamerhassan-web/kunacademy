-- ============================================================================
-- Kun Academy — ALL PENDING MIGRATIONS (consolidated)
-- Run this ONCE in the Supabase SQL Editor or via psql
-- Order: v2_remaining → ems_schema → instapay → book_access →
--        commission_fix → commission_rls → lms_sections → seed_sti
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: v2_remaining (coach ratings, referrals, commissions, blog, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS coach_ratings (
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
CREATE POLICY "coach_ratings_public_select" ON coach_ratings FOR SELECT USING (is_published = true);
CREATE POLICY "coach_ratings_own_select" ON coach_ratings FOR SELECT USING (user_id = auth.uid() OR coach_id = auth.uid());
CREATE POLICY "coach_ratings_own_insert" ON coach_ratings FOR INSERT WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.customer_id = auth.uid() AND b.status = 'completed'
  )
);
CREATE POLICY "coach_ratings_admin" ON coach_ratings FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS coach_badges (
  coach_id     UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  badge_tier   TEXT NOT NULL CHECK (badge_tier IN ('bronze','silver','gold','platinum')),
  avg_rating   NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE coach_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_badges_public_select" ON coach_badges FOR SELECT USING (true);
CREATE POLICY "coach_badges_admin" ON coach_badges FOR ALL USING (is_admin());

CREATE OR REPLACE FUNCTION update_coach_badge()
RETURNS TRIGGER AS $$
DECLARE
  v_avg NUMERIC(3,2);
  v_count INTEGER;
  v_tier TEXT;
BEGIN
  SELECT AVG(rating)::NUMERIC(3,2), COUNT(*) INTO v_avg, v_count
  FROM coach_ratings WHERE coach_id = NEW.coach_id AND is_published = true;
  v_tier := CASE
    WHEN v_count >= 50 AND v_avg >= 4.8 THEN 'platinum'
    WHEN v_count >= 25 AND v_avg >= 4.5 THEN 'gold'
    WHEN v_count >= 10 AND v_avg >= 4.0 THEN 'silver'
    ELSE 'bronze'
  END;
  INSERT INTO coach_badges (coach_id, badge_tier, avg_rating, review_count, updated_at)
  VALUES (NEW.coach_id, v_tier, v_avg, v_count, now())
  ON CONFLICT (coach_id) DO UPDATE SET
    badge_tier = v_tier, avg_rating = v_avg, review_count = v_count, updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_coach_rating_change ON coach_ratings;
CREATE TRIGGER on_coach_rating_change
  AFTER INSERT OR UPDATE ON coach_ratings
  FOR EACH ROW EXECUTE FUNCTION update_coach_badge();

CREATE TABLE IF NOT EXISTS referral_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code       TEXT UNIQUE NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_codes_own_select" ON referral_codes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "referral_codes_admin" ON referral_codes FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS credit_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('earn','spend','payout')),
  source_type   TEXT,
  source_id     UUID,
  balance_after INTEGER NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credits_own_select" ON credit_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "credits_admin" ON credit_transactions FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS blog_posts (
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
  content_doc_id TEXT,
  is_published  BOOLEAN DEFAULT false,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_posts_public_select" ON blog_posts FOR SELECT USING (is_published = true);
CREATE POLICY "blog_posts_author_select" ON blog_posts FOR SELECT USING (author_id = auth.uid());
CREATE POLICY "blog_posts_admin" ON blog_posts FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS digital_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  file_type       TEXT NOT NULL,
  file_size_bytes INTEGER,
  display_name    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE digital_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "digital_assets_admin" ON digital_assets FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS download_tokens (
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
CREATE POLICY "download_tokens_own_select" ON download_tokens FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "download_tokens_admin" ON download_tokens FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS commission_rates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope      TEXT NOT NULL CHECK (scope IN ('global','level','profile','item')),
  scope_id   TEXT,
  category   TEXT NOT NULL CHECK (category IN ('services','products')),
  rate_pct   NUMERIC(5,2) NOT NULL CHECK (rate_pct >= 0 AND rate_pct <= 100),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE commission_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commission_rates_admin" ON commission_rates FOR ALL USING (is_admin());
CREATE POLICY "commission_rates_own_select" ON commission_rates FOR SELECT USING (
  scope = 'profile' AND scope_id = auth.uid()::TEXT
);

CREATE TABLE IF NOT EXISTS earnings (
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
CREATE POLICY "earnings_own_select" ON earnings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "earnings_admin" ON earnings FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS payout_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount         INTEGER NOT NULL CHECK (amount > 0),
  currency       VARCHAR(3) NOT NULL DEFAULT 'AED',
  status         TEXT DEFAULT 'requested' CHECK (status IN ('requested','approved','processed','rejected')),
  processed_by   UUID REFERENCES profiles(id),
  processed_at   TIMESTAMPTZ,
  payment_method TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts_own_select" ON payout_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "payouts_own_insert" ON payout_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "payouts_admin" ON payout_requests FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS payment_schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id       UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount     INTEGER NOT NULL,
  paid_amount      INTEGER DEFAULT 0,
  remaining_amount INTEGER NOT NULL,
  schedule_type    TEXT NOT NULL CHECK (schedule_type IN ('deposit_balance','installment')),
  installments     JSONB NOT NULL DEFAULT '[]',
  currency         VARCHAR(3) NOT NULL DEFAULT 'AED',
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_own_select" ON payment_schedules FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "schedules_admin" ON payment_schedules FOR ALL USING (is_admin());

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS commission_override_pct NUMERIC(5,2);
-- Add check constraint separately to avoid IF NOT EXISTS issues
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_product_type_check CHECK (product_type IN ('physical','digital','hybrid'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE services ADD COLUMN IF NOT EXISTS commission_override_pct NUMERIC(5,2);

CREATE INDEX IF NOT EXISTS idx_coach_ratings_coach ON coach_ratings(coach_id) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_user_status ON earnings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON download_tokens(token) WHERE download_count < max_downloads;
CREATE INDEX IF NOT EXISTS idx_payment_schedules_user ON payment_schedules(user_id);

INSERT INTO commission_rates (scope, scope_id, category, rate_pct)
SELECT 'global', NULL, 'services', 30.00
WHERE NOT EXISTS (SELECT 1 FROM commission_rates WHERE scope = 'global' AND category = 'services');
INSERT INTO commission_rates (scope, scope_id, category, rate_pct)
SELECT 'global', NULL, 'products', 20.00
WHERE NOT EXISTS (SELECT 1 FROM commission_rates WHERE scope = 'global' AND category = 'products');


-- ============================================================================
-- MIGRATION 2: ems_schema (lesson_progress, certificates, community, etc.)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE TABLE IF NOT EXISTS lesson_progress (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id                UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  playback_position_seconds INTEGER DEFAULT 0,
  completed                BOOLEAN DEFAULT false,
  completed_at             TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_progress_own_select" ON lesson_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "lesson_progress_own_upsert" ON lesson_progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "lesson_progress_own_update" ON lesson_progress FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "lesson_progress_admin" ON lesson_progress FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL,
  session_number  INTEGER,
  status          TEXT NOT NULL CHECK (status IN ('present','absent','excused','late')),
  notes           TEXT,
  marked_by       UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_own_select" ON attendance FOR SELECT USING (
  EXISTS (SELECT 1 FROM enrollments e WHERE e.id = enrollment_id AND e.user_id = auth.uid())
);
CREATE POLICY "attendance_admin" ON attendance FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS materials (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id            UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title_ar             TEXT NOT NULL,
  title_en             TEXT NOT NULL,
  type                 TEXT NOT NULL CHECK (type IN ('pdf','video','link','audio','image')),
  url                  TEXT NOT NULL,
  access_duration_days INTEGER,
  display_order        INTEGER DEFAULT 0,
  is_published         BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials_enrolled_select" ON materials FOR SELECT USING (
  is_published = true AND (
    EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = materials.course_id AND e.user_id = auth.uid())
    OR is_admin()
  )
);
CREATE POLICY "materials_admin" ON materials FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS certificates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrollment_id     UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  template_id       TEXT,
  credential_type   TEXT,
  issued_at         TIMESTAMPTZ DEFAULT now(),
  pdf_url           TEXT,
  verification_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex')
);
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificates_own_select" ON certificates FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "certificates_admin" ON certificates FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS coach_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  timezone    TEXT DEFAULT 'Asia/Dubai',
  is_active   BOOLEAN DEFAULT true,
  CHECK (end_time > start_time)
);
ALTER TABLE coach_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_schedules_public_select" ON coach_schedules FOR SELECT USING (is_active = true);
CREATE POLICY "coach_schedules_own_manage" ON coach_schedules FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "coach_schedules_admin" ON coach_schedules FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS coach_time_off (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (end_date >= start_date)
);
ALTER TABLE coach_time_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_time_off_public_select" ON coach_time_off FOR SELECT USING (true);
CREATE POLICY "coach_time_off_own_manage" ON coach_time_off FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "coach_time_off_admin" ON coach_time_off FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS service_categories (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,
  name_ar        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  audience       TEXT NOT NULL CHECK (audience IN ('seeker','student','corporate')),
  display_order  INTEGER DEFAULT 0
);
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_categories_public" ON service_categories FOR SELECT USING (true);
CREATE POLICY "service_categories_admin" ON service_categories FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS board_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id  UUID NOT NULL,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      TEXT DEFAULT 'member' CHECK (role IN ('member','moderator','admin')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, user_id)
);
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "board_members_select" ON board_members FOR SELECT USING (true);
CREATE POLICY "board_members_admin" ON board_members FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS community_boards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,
  name_ar        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  type           TEXT NOT NULL CHECK (type IN ('general','cohort','announcements')),
  is_admin_only  BOOLEAN DEFAULT false,
  course_id      UUID REFERENCES courses(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE community_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boards_general_select" ON community_boards FOR SELECT USING (
  type IN ('general', 'announcements')
  OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = community_boards.id AND bm.user_id = auth.uid())
  OR is_admin()
);
CREATE POLICY "boards_admin" ON community_boards FOR ALL USING (is_admin());

-- Add FK to board_members now that community_boards exists
ALTER TABLE board_members ADD CONSTRAINT board_members_board_id_fkey
  FOREIGN KEY (board_id) REFERENCES community_boards(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS community_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES community_boards(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id),
  parent_id  UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  is_pinned  BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_board_member_select" ON community_posts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM community_boards b WHERE b.id = board_id AND (
      b.type IN ('general', 'announcements')
      OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.user_id = auth.uid())
    )
  ) OR is_admin()
);
CREATE POLICY "posts_member_insert" ON community_posts FOR INSERT WITH CHECK (
  author_id = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM community_boards b WHERE b.id = board_id AND (
        (b.type IN ('general', 'announcements') AND NOT b.is_admin_only)
        OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.user_id = auth.uid())
      )
    ) OR is_admin()
  )
);
CREATE POLICY "posts_own_update" ON community_posts FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "posts_admin" ON community_posts FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS community_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction   TEXT NOT NULL CHECK (reaction IN ('heart','hands','lightbulb')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id, reaction)
);
ALTER TABLE community_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_select" ON community_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_own_manage" ON community_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions_own_delete" ON community_reactions FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "reactions_admin" ON community_reactions FOR ALL USING (is_admin());

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'enrolled',
  ADD COLUMN IF NOT EXISTS enrollment_type TEXT DEFAULT 'recorded',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
DO $$ BEGIN
  ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_check CHECK (status IN ('enrolled','in_progress','completed','dropped'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE enrollments ADD CONSTRAINT enrollments_enrollment_type_check CHECK (enrollment_type IN ('recorded','live','retreat','coaching_package'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES service_categories(id),
  ADD COLUMN IF NOT EXISTS sessions_count INTEGER,
  ADD COLUMN IF NOT EXISTS validity_days INTEGER;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS meeting_url TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

INSERT INTO service_categories (slug, name_ar, name_en, audience, display_order)
SELECT 'personal-growth', 'النمو الشخصي', 'Personal Growth', 'seeker', 1
WHERE NOT EXISTS (SELECT 1 FROM service_categories WHERE slug = 'personal-growth');
INSERT INTO service_categories (slug, name_ar, name_en, audience, display_order)
SELECT 'coach-development', 'تطوير الكوتش', 'Coach Development', 'student', 2
WHERE NOT EXISTS (SELECT 1 FROM service_categories WHERE slug = 'coach-development');
INSERT INTO service_categories (slug, name_ar, name_en, audience, display_order)
SELECT 'corporate-solutions', 'حلول مؤسسية', 'Corporate Solutions', 'corporate', 3
WHERE NOT EXISTS (SELECT 1 FROM service_categories WHERE slug = 'corporate-solutions');

INSERT INTO community_boards (slug, name_ar, name_en, type)
SELECT 'suhba-kun', 'صحبة كُنْ', 'Kun Community', 'general'
WHERE NOT EXISTS (SELECT 1 FROM community_boards WHERE slug = 'suhba-kun');
INSERT INTO community_boards (slug, name_ar, name_en, type)
SELECT 'coaching-practice', 'ممارسة الكوتشينج', 'Coaching Practice', 'general'
WHERE NOT EXISTS (SELECT 1 FROM community_boards WHERE slug = 'coaching-practice');
INSERT INTO community_boards (slug, name_ar, name_en, type)
SELECT 'announcements', 'إعلانات', 'Announcements', 'announcements'
WHERE NOT EXISTS (SELECT 1 FROM community_boards WHERE slug = 'announcements');


-- ============================================================================
-- MIGRATION 3: add_instapay_gateway
-- ============================================================================

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_gateway_check;
ALTER TABLE payments ADD CONSTRAINT payments_gateway_check
  CHECK (gateway IN ('stripe', 'paytabs', 'tabby', 'instapay'));


-- ============================================================================
-- MIGRATION 4: book_access
-- ============================================================================

CREATE TABLE IF NOT EXISTS book_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_slug TEXT NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by TEXT DEFAULT 'purchase',
  UNIQUE(user_id, book_slug)
);
ALTER TABLE book_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own access" ON book_access FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role insert" ON book_access FOR INSERT WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_book_access_user_id ON book_access(user_id);
CREATE INDEX IF NOT EXISTS idx_book_access_book_slug ON book_access(book_slug);


-- ============================================================================
-- MIGRATION 5: fix_commission_schema
-- ============================================================================

ALTER TABLE earnings ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ DEFAULT (now() + interval '7 days');
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS bank_details JSONB DEFAULT NULL;
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT NULL;

UPDATE payout_requests SET admin_note = notes WHERE admin_note IS NULL AND notes IS NOT NULL;
UPDATE commission_rates SET scope = 'coach' WHERE scope = 'profile';

COMMENT ON COLUMN earnings.user_id IS 'Coach/provider who earned the commission';
COMMENT ON COLUMN earnings.available_at IS 'Date when earning becomes available for payout';
COMMENT ON COLUMN payout_requests.bank_details IS 'JSON: {bank_name, iban, account_name}';
COMMENT ON COLUMN payout_requests.admin_note IS 'Admin notes on the payout request';
COMMENT ON TABLE commission_rates IS 'Commission rates: scope can be global, coach, product, service';


-- ============================================================================
-- MIGRATION 6: fix_commission_rls
-- ============================================================================

DROP POLICY IF EXISTS "commission_rates_own_select" ON commission_rates;
CREATE POLICY "commission_rates_own_select" ON commission_rates
  FOR SELECT USING (scope = 'coach' AND scope_id = auth.uid()::TEXT);
CREATE POLICY "commission_rates_global_select" ON commission_rates
  FOR SELECT USING (scope = 'global');


-- ============================================================================
-- MIGRATION 7: lms_sections_rls (course_sections + lessons RLS fix)
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title_ar    TEXT NOT NULL,
  title_en    TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  "order"     INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE course_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sections_public_select" ON course_sections FOR SELECT USING (
  EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND c.is_published = true)
);
CREATE POLICY "sections_admin" ON course_sections FOR ALL USING (is_admin());

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES course_sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_provider TEXT,
  ADD COLUMN IF NOT EXISTS video_id TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;
DO $$ BEGIN
  ALTER TABLE lessons ADD CONSTRAINT lessons_video_provider_check
    CHECK (video_provider IN ('bunny', 'youtube', 'vimeo', 'direct'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS "Public can read lessons" ON lessons;

CREATE POLICY "lessons_preview_public" ON lessons FOR SELECT USING (
  is_preview = true AND EXISTS (
    SELECT 1 FROM courses c WHERE c.id = course_id AND c.is_published = true
  )
);
CREATE POLICY "lessons_enrolled_select" ON lessons FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.course_id = lessons.course_id
      AND e.user_id = auth.uid()
      AND e.status IN ('enrolled', 'in_progress', 'completed')
  )
);

CREATE OR REPLACE VIEW lesson_syllabus AS
SELECT l.id, l.course_id, l.section_id, l.title_ar, l.title_en,
       l."order", l.duration_minutes, l.is_preview, l.description_ar, l.description_en
FROM lessons l JOIN courses c ON c.id = l.course_id WHERE c.is_published = true;
GRANT SELECT ON lesson_syllabus TO anon, authenticated;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS total_lessons INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_video_minutes INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_course_sections_course ON course_sections(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_section ON lessons(section_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course_order ON lessons(course_id, "order");
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson ON lesson_progress(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_course ON enrollments(user_id, course_id);


-- ============================================================================
-- MIGRATION 8: seed_sti_course
-- ============================================================================

INSERT INTO courses (
  id, title_ar, title_en, slug, description_ar, description_en,
  price_aed, price_egp, price_eur,
  duration_hours, level, nav_group, type, format,
  is_published, is_featured, is_free, is_icf_accredited,
  total_lessons, total_video_minutes
) SELECT
  'c0000001-0000-4000-a000-000000000001',
  'مقدمة في التفكير الحسّي (STI)',
  'Introduction to Somatic Thinking (STI)',
  'somatic-thinking-intro',
  'بوابتك الأولى لعالم التفكير الحسّي® — تعرّف على أساسيات الكوتشينج والمبادئ الأربعة من خلال تمارين عملية. دورة مسجّلة ٦ ساعات يمكنك مشاهدتها في أي وقت.',
  'Your first gateway to Somatic Thinking® — learn the fundamentals of coaching and four core principles through practical exercises. 6-hour recorded course you can watch anytime.',
  35000, 150000, 9500,
  6, 'beginner', 'courses', 'course', 'online',
  true, true, false, false,
  12, 360
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE slug = 'somatic-thinking-intro');

INSERT INTO course_sections (id, course_id, title_ar, title_en, "order")
SELECT * FROM (VALUES
  ('50000001-0ec1-4000-a000-000000000001'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, 'مرحبًا بك', 'Welcome', 0),
  ('50000001-0ec2-4000-a000-000000000002'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, 'تاريخ الكوتشينج', 'History of Coaching', 1),
  ('50000001-0ec3-4000-a000-000000000003'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, 'ما هو التفكير الحسّي®', 'What is Somatic Thinking®', 2),
  ('50000001-0ec4-4000-a000-000000000004'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, 'الكفاءات الجوهرية', 'Core Competencies', 3),
  ('50000001-0ec5-4000-a000-000000000005'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, 'هل الكوتشينج مناسب لك؟', 'Is Coaching Right for You?', 4)
) AS v(id, course_id, title_ar, title_en, "order")
WHERE NOT EXISTS (SELECT 1 FROM course_sections WHERE course_id = 'c0000001-0000-4000-a000-000000000001');

INSERT INTO lessons (id, course_id, section_id, title_ar, title_en, "order", duration_minutes, is_preview, video_provider)
SELECT * FROM (VALUES
  ('10000001-0e01-4000-a000-000000000001'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, '50000001-0ec1-4000-a000-000000000001'::uuid,
   'مرحبًا في رحلة التفكير الحسّي', 'Welcome to the Somatic Thinking Journey', 0, 15, true, 'bunny'),
  ('10000001-0e02-4000-a000-000000000002'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, '50000001-0ec2-4000-a000-000000000002'::uuid,
   'كيف بدأ الكوتشينج كمهنة', 'How Coaching Began as a Profession', 1, 35, false, 'bunny'),
  ('10000001-0e03-4000-a000-000000000003'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, '50000001-0ec2-4000-a000-000000000002'::uuid,
   'تطوّر الكوتشينج عبر العقود', 'Evolution of Coaching Through the Decades', 2, 30, false, 'bunny'),
  ('10000001-0e04-4000-a000-000000000004'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, '50000001-0ec2-4000-a000-000000000002'::uuid,
   'الفرق بين الكوتشينج والإرشاد والعلاج', 'Coaching vs Counseling vs Therapy', 3, 25, false, 'bunny'),
  ('10000001-0e05-4000-a000-000000000005'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, '50000001-0ec3-4000-a000-000000000003'::uuid,
   'ولادة التفكير الحسّي®', 'The Birth of Somatic Thinking®', 4, 40, false, 'bunny'),
  ('10000001-0e06-4000-a000-000000000006'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, '50000001-0ec3-4000-a000-000000000003'::uuid,
   'المبادئ الأربعة', 'The Four Principles', 5, 35, false, 'bunny'),
  ('10000001-0e07-4000-a000-000000000007'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, '50000001-0ec3-4000-a000-000000000003'::uuid,
   'تمرين عملي: الإصغاء الحسّي', 'Practical Exercise: Somatic Listening', 6, 30, false, 'bunny'),
  ('10000001-0e08-4000-a000-000000000008'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, '50000001-0ec4-4000-a000-000000000004'::uuid,
   'الكفاءات الثماني لـ ICF', 'The Eight ICF Competencies', 7, 40, false, 'bunny'),
  ('10000001-0e09-4000-a000-000000000009'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, '50000001-0ec4-4000-a000-000000000004'::uuid,
   'كيف يعزّز التفكير الحسّي كل كفاءة', 'How Somatic Thinking Enhances Each Competency', 8, 35, false, 'bunny'),
  ('10000001-0e10-4000-a000-000000000010'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, '50000001-0ec4-4000-a000-000000000004'::uuid,
   'تمرين عملي: رسم خريطتك الجسدية', 'Practical Exercise: Mapping Your Body', 9, 30, false, 'bunny'),
  ('10000001-0e11-4000-a000-000000000011'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, '50000001-0ec5-4000-a000-000000000005'::uuid,
   'التقييم الذاتي: اكتشف أسلوبك', 'Self-Assessment: Discover Your Style', 10, 25, false, 'bunny'),
  ('10000001-0e12-4000-a000-000000000012'::uuid, 'c0000001-0000-4000-a000-000000000001'::uuid, '50000001-0ec5-4000-a000-000000000005'::uuid,
   'الخطوات التالية في رحلتك', 'Next Steps in Your Journey', 11, 20, false, 'bunny')
) AS v(id, course_id, section_id, title_ar, title_en, "order", duration_minutes, is_preview, video_provider)
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE course_id = 'c0000001-0000-4000-a000-000000000001' AND section_id IS NOT NULL);


-- ============================================================================
-- MIGRATION 9: lms_fixes (enrollment unique constraint + RLS)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_user_course_unique
  ON enrollments(user_id, course_id);

-- Allow self-enrollment (free courses) and progress updates
DO $$ BEGIN
  CREATE POLICY "Users can enroll themselves" ON enrollments FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own enrollment" ON enrollments FOR UPDATE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- DONE! All 9 migrations applied.
-- ============================================================================
SELECT 'ALL MIGRATIONS APPLIED SUCCESSFULLY' as result;
