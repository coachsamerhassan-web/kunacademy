-- ============================================================================
-- Kun Academy — Seed STI Course (Introduction to Somatic Thinking)
-- First recorded course in the LMS
-- 6 hours, 350 AED, 5 sections, 12 lessons
-- ============================================================================

-- Insert the course
INSERT INTO courses (
  id, title_ar, title_en, slug, description_ar, description_en,
  price_aed, price_egp, price_eur,
  duration_hours, level, nav_group, type, format,
  is_published, is_featured, is_free, is_icf_accredited,
  total_lessons, total_video_minutes
) VALUES (
  'c0000001-sti0-4000-a000-000000000001',
  'مقدمة في التفكير الحسّي (STI)',
  'Introduction to Somatic Thinking (STI)',
  'somatic-thinking-intro',
  'بوابتك الأولى لعالم التفكير الحسّي® — تعرّف على أساسيات الكوتشينج والمبادئ الأربعة من خلال تمارين عملية. دورة مسجّلة ٦ ساعات يمكنك مشاهدتها في أي وقت.',
  'Your first gateway to Somatic Thinking® — learn the fundamentals of coaching and four core principles through practical exercises. 6-hour recorded course you can watch anytime.',
  35000, 150000, 9500,
  6, 'beginner', 'courses', 'course', 'online',
  true, true, false, false,
  12, 360
);

-- Insert sections
INSERT INTO course_sections (id, course_id, title_ar, title_en, "order") VALUES
  ('s0000001-sec1-4000-a000-000000000001', 'c0000001-sti0-4000-a000-000000000001', 'مرحبًا بك', 'Welcome', 0),
  ('s0000001-sec2-4000-a000-000000000002', 'c0000001-sti0-4000-a000-000000000001', 'تاريخ الكوتشينج', 'History of Coaching', 1),
  ('s0000001-sec3-4000-a000-000000000003', 'c0000001-sti0-4000-a000-000000000001', 'ما هو التفكير الحسّي®', 'What is Somatic Thinking®', 2),
  ('s0000001-sec4-4000-a000-000000000004', 'c0000001-sti0-4000-a000-000000000001', 'الكفاءات الجوهرية', 'Core Competencies', 3),
  ('s0000001-sec5-4000-a000-000000000005', 'c0000001-sti0-4000-a000-000000000001', 'هل الكوتشينج مناسب لك؟', 'Is Coaching Right for You?', 4);

-- Insert lessons (video_url left NULL — to be filled when videos are uploaded to Bunny)
INSERT INTO lessons (id, course_id, section_id, title_ar, title_en, "order", duration_minutes, is_preview, video_provider) VALUES
  -- Section 1: Welcome (1 lesson, free preview)
  ('l0000001-les1-4000-a000-000000000001', 'c0000001-sti0-4000-a000-000000000001', 's0000001-sec1-4000-a000-000000000001',
   'مرحبًا في رحلة التفكير الحسّي', 'Welcome to the Somatic Thinking Journey', 0, 15, true, 'bunny'),

  -- Section 2: History of Coaching (3 lessons)
  ('l0000001-les2-4000-a000-000000000002', 'c0000001-sti0-4000-a000-000000000001', 's0000001-sec2-4000-a000-000000000002',
   'كيف بدأ الكوتشينج كمهنة', 'How Coaching Began as a Profession', 1, 35, false, 'bunny'),
  ('l0000001-les3-4000-a000-000000000003', 'c0000001-sti0-4000-a000-000000000001', 's0000001-sec2-4000-a000-000000000002',
   'تطوّر الكوتشينج عبر العقود', 'Evolution of Coaching Through the Decades', 2, 30, false, 'bunny'),
  ('l0000001-les4-4000-a000-000000000004', 'c0000001-sti0-4000-a000-000000000001', 's0000001-sec2-4000-a000-000000000002',
   'الفرق بين الكوتشينج والإرشاد والعلاج', 'Coaching vs Counseling vs Therapy', 3, 25, false, 'bunny'),

  -- Section 3: What is Somatic Thinking (3 lessons)
  ('l0000001-les5-4000-a000-000000000005', 'c0000001-sti0-4000-a000-000000000001', 's0000001-sec3-4000-a000-000000000003',
   'ولادة التفكير الحسّي®', 'The Birth of Somatic Thinking®', 4, 40, false, 'bunny'),
  ('l0000001-les6-4000-a000-000000000006', 'c0000001-sti0-4000-a000-000000000001', 's0000001-sec3-4000-a000-000000000003',
   'المبادئ الأربعة', 'The Four Principles', 5, 35, false, 'bunny'),
  ('l0000001-les7-4000-a000-000000000007', 'c0000001-sti0-4000-a000-000000000001', 's0000001-sec3-4000-a000-000000000003',
   'تمرين عملي: الإصغاء الحسّي', 'Practical Exercise: Somatic Listening', 6, 30, false, 'bunny'),

  -- Section 4: Core Competencies (3 lessons)
  ('l0000001-les8-4000-a000-000000000008', 'c0000001-sti0-4000-a000-000000000001', 's0000001-sec4-4000-a000-000000000004',
   'الكفاءات الثماني لـ ICF', 'The Eight ICF Competencies', 7, 40, false, 'bunny'),
  ('l0000001-les9-4000-a000-000000000009', 'c0000001-sti0-4000-a000-000000000001', 's0000001-sec4-4000-a000-000000000004',
   'كيف يعزّز التفكير الحسّي كل كفاءة', 'How Somatic Thinking Enhances Each Competency', 8, 35, false, 'bunny'),
  ('l0000001-les10-400-a000-000000000010', 'c0000001-sti0-4000-a000-000000000001', 's0000001-sec4-4000-a000-000000000004',
   'تمرين عملي: رسم خريطتك الجسدية', 'Practical Exercise: Mapping Your Body', 9, 30, false, 'bunny'),

  -- Section 5: Is Coaching for You? (2 lessons)
  ('l0000001-les11-400-a000-000000000011', 'c0000001-sti0-4000-a000-000000000001', 's0000001-sec5-4000-a000-000000000005',
   'التقييم الذاتي: اكتشف أسلوبك', 'Self-Assessment: Discover Your Style', 10, 25, false, 'bunny'),
  ('l0000001-les12-400-a000-000000000012', 'c0000001-sti0-4000-a000-000000000001', 's0000001-sec5-4000-a000-000000000005',
   'الخطوات التالية في رحلتك', 'Next Steps in Your Journey', 11, 20, false, 'bunny');
