-- ============================================================================
-- Kun Academy — Initial Schema Migration
-- Created: 2026-03-24
-- 16 tables | RLS on all | Auth trigger
-- All prices are INTEGER in minor units (250 AED = 25000)
-- ============================================================================

-- Enable required extensions (pgcrypto for gen_random_bytes)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================
-- 1. PROFILES (depends on auth.users)
-- ============================================================================
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email      TEXT UNIQUE NOT NULL,
  full_name_ar TEXT,
  full_name_en TEXT,
  phone      TEXT,
  country    TEXT,
  role       TEXT DEFAULT 'student' CHECK (role IN ('student', 'provider', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. INSTRUCTORS (depends on profiles)
-- ============================================================================
CREATE TABLE instructors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       UUID REFERENCES profiles(id),
  slug             TEXT UNIQUE NOT NULL,
  title_ar         TEXT NOT NULL,
  title_en         TEXT NOT NULL,
  bio_ar           TEXT,
  bio_en           TEXT,
  photo_url        TEXT,
  credentials      TEXT,
  coach_level      TEXT CHECK (coach_level IN ('basic', 'professional', 'expert', 'master')),
  specialties      TEXT[],
  coaching_styles  TEXT[],
  development_types TEXT[],
  pricing_json     JSONB,
  is_visible       BOOLEAN DEFAULT true,
  is_platform_coach BOOLEAN DEFAULT false,
  display_order    INTEGER DEFAULT 0
);

-- ============================================================================
-- 3. PAYMENTS (no FK to other custom tables initially)
-- ============================================================================
CREATE TABLE payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID,
  booking_id         UUID,
  gateway            TEXT CHECK (gateway IN ('stripe', 'paytabs', 'tabby')),
  gateway_payment_id TEXT,
  amount             INTEGER NOT NULL,
  currency           VARCHAR(3) NOT NULL,
  status             TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata           JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 4. COURSES (depends on instructors)
-- ============================================================================
CREATE TABLE courses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar          TEXT NOT NULL,
  title_en          TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  description_ar    TEXT,
  description_en    TEXT,
  instructor_id     UUID REFERENCES instructors(id),
  coach_ids         UUID[],
  price_aed         INTEGER DEFAULT 0,
  price_egp         INTEGER DEFAULT 0,
  price_usd         INTEGER DEFAULT 0,
  price_eur         INTEGER DEFAULT 0,
  duration_hours    NUMERIC,
  level             TEXT,
  nav_group         TEXT CHECK (nav_group IN ('certifications', 'courses', 'retreats', 'corporate', 'family', 'coaching', 'free')),
  internal_category TEXT,
  type              TEXT CHECK (type IN ('certification', 'course', 'retreat', 'workshop', 'masterclass', 'coaching', 'webinar', 'free')),
  format            TEXT,
  location          TEXT,
  is_featured       BOOLEAN DEFAULT false,
  is_free           BOOLEAN DEFAULT false,
  is_icf_accredited BOOLEAN DEFAULT false,
  icf_details       TEXT,
  thumbnail_url     TEXT,
  is_published      BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 5. LESSONS (depends on courses)
-- ============================================================================
CREATE TABLE lessons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title_ar         TEXT NOT NULL,
  title_en         TEXT NOT NULL,
  content_ar       TEXT,
  content_en       TEXT,
  video_url        TEXT,
  "order"          INTEGER NOT NULL,
  duration_minutes INTEGER
);

-- ============================================================================
-- 6. ENROLLMENTS (depends on profiles, courses)
-- ============================================================================
CREATE TABLE enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id),
  course_id     UUID NOT NULL REFERENCES courses(id),
  progress_data JSONB DEFAULT '{}',
  completed_at  TIMESTAMPTZ,
  enrolled_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 7. SERVICES
-- ============================================================================
CREATE TABLE services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  description_ar   TEXT,
  description_en   TEXT,
  duration_minutes INTEGER NOT NULL,
  price_aed        INTEGER DEFAULT 0,
  price_egp        INTEGER DEFAULT 0,
  price_usd        INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT true
);

-- ============================================================================
-- 8. PROVIDERS (depends on profiles)
-- ============================================================================
CREATE TABLE providers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES profiles(id),
  bio_ar      TEXT,
  bio_en      TEXT,
  specialties TEXT[],
  languages   TEXT[],
  credentials TEXT,
  is_visible  BOOLEAN DEFAULT true
);

-- ============================================================================
-- 9. AVAILABILITY (depends on providers)
-- ============================================================================
CREATE TABLE availability (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_active   BOOLEAN DEFAULT true
);

-- ============================================================================
-- 10. PRODUCTS
-- ============================================================================
CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  price_aed      INTEGER DEFAULT 0,
  price_egp      INTEGER DEFAULT 0,
  price_usd      INTEGER DEFAULT 0,
  images         JSONB DEFAULT '[]',
  stock          INTEGER DEFAULT 0,
  is_active      BOOLEAN DEFAULT true
);

-- ============================================================================
-- 11. ORDERS (depends on profiles, payments)
-- ============================================================================
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES profiles(id),
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  total_amount     INTEGER NOT NULL,
  currency         VARCHAR(3) NOT NULL,
  payment_gateway  VARCHAR(20),
  payment_id       UUID REFERENCES payments(id),
  shipping_address JSONB,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 12. ORDER_ITEMS (depends on orders, products)
-- ============================================================================
CREATE TABLE order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL
);

-- ============================================================================
-- 13. BOOKINGS (depends on services, providers, profiles, payments)
-- ============================================================================
CREATE TABLE bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID REFERENCES services(id),
  provider_id UUID REFERENCES providers(id),
  customer_id UUID NOT NULL REFERENCES profiles(id),
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  payment_id  UUID REFERENCES payments(id),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 14. POSTS (depends on profiles)
-- ============================================================================
CREATE TABLE posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar       TEXT NOT NULL,
  title_en       TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  content_ar     TEXT,
  content_en     TEXT,
  excerpt_ar     TEXT,
  excerpt_en     TEXT,
  category       TEXT CHECK (category IN ('somatic-thinking', 'parenting', 'leadership', 'kinetic-barakah', 'coaching')),
  featured_image TEXT,
  author_id      UUID REFERENCES profiles(id),
  is_published   BOOLEAN DEFAULT false,
  published_at   TIMESTAMPTZ
);

-- ============================================================================
-- 15. TESTIMONIALS (depends on instructors)
-- ============================================================================
CREATE TABLE testimonials (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name_ar TEXT,
  author_name_en TEXT,
  content_ar     TEXT NOT NULL,
  content_en     TEXT,
  coach_id       UUID REFERENCES instructors(id),
  program        TEXT,
  rating         INTEGER CHECK (rating BETWEEN 1 AND 5),
  video_url      TEXT,
  is_featured    BOOLEAN DEFAULT false,
  source_type    TEXT,
  migrated_at    TIMESTAMPTZ
);

-- ============================================================================
-- 16. INSTRUCTOR_DRAFTS (depends on instructors, profiles)
-- ============================================================================
CREATE TABLE instructor_drafts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  field_name    TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at  TIMESTAMPTZ DEFAULT now(),
  reviewed_at   TIMESTAMPTZ,
  reviewer_id   UUID REFERENCES profiles(id),
  review_note   TEXT
);


-- ============================================================================
-- ROW LEVEL SECURITY — Enable on ALL tables
-- ============================================================================
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials      ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_drafts ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- HELPER: Check if current user is admin
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================================
-- RLS POLICIES — Public read tables
-- ============================================================================

-- COURSES
CREATE POLICY "Public can read published courses"
  ON courses FOR SELECT USING (is_published = true);
CREATE POLICY "Admins full access on courses"
  ON courses FOR ALL USING (is_admin());

-- LESSONS
CREATE POLICY "Public can read lessons"
  ON lessons FOR SELECT USING (true);
CREATE POLICY "Admins full access on lessons"
  ON lessons FOR ALL USING (is_admin());

-- SERVICES
CREATE POLICY "Public can read active services"
  ON services FOR SELECT USING (is_active = true);
CREATE POLICY "Admins full access on services"
  ON services FOR ALL USING (is_admin());

-- PROVIDERS
CREATE POLICY "Public can read visible providers"
  ON providers FOR SELECT USING (is_visible = true);
CREATE POLICY "Admins full access on providers"
  ON providers FOR ALL USING (is_admin());

-- AVAILABILITY
CREATE POLICY "Public can read active availability"
  ON availability FOR SELECT USING (is_active = true);
CREATE POLICY "Admins full access on availability"
  ON availability FOR ALL USING (is_admin());

-- PRODUCTS
CREATE POLICY "Public can read active products"
  ON products FOR SELECT USING (is_active = true);
CREATE POLICY "Admins full access on products"
  ON products FOR ALL USING (is_admin());

-- POSTS
CREATE POLICY "Public can read published posts"
  ON posts FOR SELECT USING (is_published = true);
CREATE POLICY "Admins full access on posts"
  ON posts FOR ALL USING (is_admin());

-- TESTIMONIALS
CREATE POLICY "Public can read testimonials"
  ON testimonials FOR SELECT USING (true);
CREATE POLICY "Admins full access on testimonials"
  ON testimonials FOR ALL USING (is_admin());

-- INSTRUCTORS
CREATE POLICY "Public can read visible instructors"
  ON instructors FOR SELECT USING (is_visible = true);
CREATE POLICY "Admins full access on instructors"
  ON instructors FOR ALL USING (is_admin());


-- ============================================================================
-- RLS POLICIES — Authenticated read-own tables
-- ============================================================================

-- PROFILES
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins full access on profiles"
  ON profiles FOR ALL USING (is_admin());

-- ENROLLMENTS
CREATE POLICY "Users can read own enrollments"
  ON enrollments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins full access on enrollments"
  ON enrollments FOR ALL USING (is_admin());

-- BOOKINGS
CREATE POLICY "Customers can read own bookings"
  ON bookings FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Providers can read their bookings"
  ON bookings FOR SELECT USING (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );
CREATE POLICY "Admins full access on bookings"
  ON bookings FOR ALL USING (is_admin());

-- ORDERS
CREATE POLICY "Users can read own orders"
  ON orders FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Admins full access on orders"
  ON orders FOR ALL USING (is_admin());

-- ORDER_ITEMS
CREATE POLICY "Users can read own order items"
  ON order_items FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE customer_id = auth.uid()
    )
  );
CREATE POLICY "Admins full access on order_items"
  ON order_items FOR ALL USING (is_admin());

-- PAYMENTS
CREATE POLICY "Users can read own payments"
  ON payments FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
    OR
    booking_id IN (SELECT id FROM bookings WHERE customer_id = auth.uid())
  );
CREATE POLICY "Admins full access on payments"
  ON payments FOR ALL USING (is_admin());

-- INSTRUCTOR_DRAFTS
CREATE POLICY "Coaches can read own drafts"
  ON instructor_drafts FOR SELECT USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE profile_id = auth.uid()
    )
  );
CREATE POLICY "Coaches can insert own drafts"
  ON instructor_drafts FOR INSERT WITH CHECK (
    instructor_id IN (
      SELECT id FROM instructors WHERE profile_id = auth.uid()
    )
  );
CREATE POLICY "Coaches can update own pending drafts"
  ON instructor_drafts FOR UPDATE USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE profile_id = auth.uid()
    )
    AND status = 'pending'
  );
CREATE POLICY "Admins full access on instructor_drafts"
  ON instructor_drafts FOR ALL USING (is_admin());


-- ============================================================================
-- AUTH TRIGGER — Auto-create profile on signup
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name_en)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
