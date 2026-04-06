-- ============================================================================
-- Kun Academy — EMS Schema Migration (v2)
-- Created: 2026-03-24
-- Adds: 11 new tables for EMS, booking, community, and payments
-- Modifies: enrollments, services, bookings with new columns
-- All prices are INTEGER in minor units (250 AED = 25000)
-- ============================================================================
-- Junior-built (qwen3-coder:30b), RLS reviewed by Sani (Claude)

-- ============================================================================
-- HELPER: reusable admin check
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- 1. LESSON PROGRESS (video playback position, completion)
-- ============================================================================
CREATE TABLE lesson_progress (
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
CREATE POLICY "lesson_progress_own_select" ON lesson_progress
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "lesson_progress_own_upsert" ON lesson_progress
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "lesson_progress_own_update" ON lesson_progress
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "lesson_progress_admin" ON lesson_progress
  FOR ALL USING (is_admin());

-- ============================================================================
-- 2. ATTENDANCE (live program session tracking)
-- ============================================================================
CREATE TABLE attendance (
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
-- Students see their own attendance via enrollment ownership
CREATE POLICY "attendance_own_select" ON attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = enrollment_id AND e.user_id = auth.uid()
    )
  );
-- Only admins/instructors can mark attendance
CREATE POLICY "attendance_admin" ON attendance
  FOR ALL USING (is_admin());

-- ============================================================================
-- 3. MATERIALS (PDFs, videos, links — time-limited access)
-- ============================================================================
CREATE TABLE materials (
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
-- Enrolled students can see published materials for their courses
CREATE POLICY "materials_enrolled_select" ON materials
  FOR SELECT USING (
    is_published = true AND (
      EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.course_id = materials.course_id AND e.user_id = auth.uid()
      )
      OR is_admin()
    )
  );
CREATE POLICY "materials_admin" ON materials
  FOR ALL USING (is_admin());

-- ============================================================================
-- 4. CERTIFICATES (template_id, issued_at, pdf_url)
-- ============================================================================
CREATE TABLE certificates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrollment_id     UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  template_id       TEXT,
  credential_type   TEXT,
  issued_at         TIMESTAMPTZ DEFAULT now(),
  pdf_url           TEXT,
  verification_code TEXT UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex')
);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificates_own_select" ON certificates
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "certificates_admin" ON certificates
  FOR ALL USING (is_admin());

-- ============================================================================
-- 5. COACH SCHEDULES (weekly availability patterns)
-- ============================================================================
CREATE TABLE coach_schedules (
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
-- Coaches manage their own; anyone can read (for booking UI)
CREATE POLICY "coach_schedules_public_select" ON coach_schedules
  FOR SELECT USING (is_active = true);
CREATE POLICY "coach_schedules_own_manage" ON coach_schedules
  FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "coach_schedules_admin" ON coach_schedules
  FOR ALL USING (is_admin());

-- ============================================================================
-- 6. COACH TIME OFF (day-off management)
-- ============================================================================
CREATE TABLE coach_time_off (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (end_date >= start_date)
);

ALTER TABLE coach_time_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_time_off_public_select" ON coach_time_off
  FOR SELECT USING (true); -- booking engine needs to read time off
CREATE POLICY "coach_time_off_own_manage" ON coach_time_off
  FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "coach_time_off_admin" ON coach_time_off
  FOR ALL USING (is_admin());

-- ============================================================================
-- 7. SERVICE CATEGORIES (seeker vs student vs corporate)
-- ============================================================================
CREATE TABLE service_categories (
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
CREATE POLICY "service_categories_public" ON service_categories
  FOR SELECT USING (true);
CREATE POLICY "service_categories_admin" ON service_categories
  FOR ALL USING (is_admin());

-- ============================================================================
-- 8. COMMUNITY BOARDS
-- ============================================================================
CREATE TABLE community_boards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,
  name_ar        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  type           TEXT NOT NULL CHECK (type IN ('general','cohort','announcements')),
  is_admin_only  BOOLEAN DEFAULT false,
  course_id      UUID REFERENCES courses(id), -- for cohort boards
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE community_boards ENABLE ROW LEVEL SECURITY;

-- 8b. BOARD MEMBERS (must exist before community_boards policies reference it)
CREATE TABLE board_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id  UUID NOT NULL REFERENCES community_boards(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      TEXT DEFAULT 'member' CHECK (role IN ('member','moderator','admin')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, user_id)
);

ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "board_members_select" ON board_members
  FOR SELECT USING (true);
CREATE POLICY "board_members_admin" ON board_members
  FOR ALL USING (is_admin());

-- Now we can safely reference board_members in community_boards policies
CREATE POLICY "boards_general_select" ON community_boards
  FOR SELECT USING (
    type IN ('general', 'announcements')
    OR EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = community_boards.id AND bm.user_id = auth.uid()
    )
    OR is_admin()
  );
CREATE POLICY "boards_admin" ON community_boards
  FOR ALL USING (is_admin());

-- ============================================================================
-- 9. COMMUNITY POSTS (threaded, with reactions)
-- ============================================================================
CREATE TABLE community_posts (
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
-- Visible if user can see the board
CREATE POLICY "posts_board_member_select" ON community_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_boards b
      WHERE b.id = board_id AND (
        b.type IN ('general', 'announcements')
        OR EXISTS (
          SELECT 1 FROM board_members bm
          WHERE bm.board_id = b.id AND bm.user_id = auth.uid()
        )
      )
    )
    OR is_admin()
  );
-- Authors can create posts in boards they're members of
CREATE POLICY "posts_member_insert" ON community_posts
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM community_boards b
        WHERE b.id = board_id AND (
          (b.type IN ('general', 'announcements') AND NOT b.is_admin_only)
          OR EXISTS (
            SELECT 1 FROM board_members bm
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid()
          )
        )
      )
      OR is_admin()
    )
  );
-- Authors can edit their own posts
CREATE POLICY "posts_own_update" ON community_posts
  FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "posts_admin" ON community_posts
  FOR ALL USING (is_admin());

-- ============================================================================
-- 10. COMMUNITY REACTIONS
-- ============================================================================
CREATE TABLE community_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction   TEXT NOT NULL CHECK (reaction IN ('heart','hands','lightbulb')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id, reaction)
);

ALTER TABLE community_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_select" ON community_reactions
  FOR SELECT USING (true);
CREATE POLICY "reactions_own_manage" ON community_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions_own_delete" ON community_reactions
  FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "reactions_admin" ON community_reactions
  FOR ALL USING (is_admin());

-- (board_members moved to section 8b above, before community_boards policies)

-- ============================================================================
-- ALTER EXISTING TABLES
-- ============================================================================

-- Enrollments: add status tracking and type classification
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'enrolled'
    CHECK (status IN ('enrolled','in_progress','completed','dropped')),
  ADD COLUMN IF NOT EXISTS enrollment_type TEXT DEFAULT 'recorded'
    CHECK (enrollment_type IN ('recorded','live','retreat','coaching_package')),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Services: link to categories, support packages
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES service_categories(id),
  ADD COLUMN IF NOT EXISTS sessions_count INTEGER,
  ADD COLUMN IF NOT EXISTS validity_days INTEGER;

-- Bookings: add coach reference, meeting details, cancellation
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS meeting_url TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- ============================================================================
-- SEED DATA (2 dummy records per key table)
-- ============================================================================
INSERT INTO service_categories (slug, name_ar, name_en, audience, display_order) VALUES
  ('personal-growth', 'النمو الشخصي', 'Personal Growth', 'seeker', 1),
  ('coach-development', 'تطوير الكوتش', 'Coach Development', 'student', 2),
  ('corporate-solutions', 'حلول مؤسسية', 'Corporate Solutions', 'corporate', 3);

INSERT INTO community_boards (slug, name_ar, name_en, type) VALUES
  ('suhba-kun', 'صحبة كُنْ', 'Kun Community', 'general'),
  ('coaching-practice', 'ممارسة الكوتشينج', 'Coaching Practice', 'general'),
  ('announcements', 'إعلانات', 'Announcements', 'announcements');
