-- =============================================================================
-- Migration: 20260415150000_stic_l1_seed.sql
-- Sub-phase: 1.2 — STIC L1 Mentoring Package Seed
-- =============================================================================
--
-- (a) PURPOSE
--     Seeds the canonical package_templates row for the STIC L1 mentoring
--     bundle (slug: stic-l1-mentoring-bundle-v1) and its 12 companion rows in
--     milestone_library. This is the authoritative definition used by
--     sub-phases 1.3 (instance creation) and 1.4 (state machine).
--
-- (b) TEST PERSONA IDEMPOTENCY
--     The migration ensures the test mentor_manager persona exists via
--     INSERT … ON CONFLICT DO NOTHING on three tables: profiles, auth_users,
--     and instructors. This is safe to re-apply: if the persona was already
--     created by a Playwright beforeAll seed or a prior migration run, all
--     three inserts silently no-op. If it was never created (as confirmed by
--     recon on 2026-04-15), all three inserts run. No data is overwritten.
--
-- (c) RATE MODEL — three distinct AED rates for kun_student_bundled context
--     mentoring_session_rate =  150 AED
--         Paid per developmental mentoring session (sessions 1 & 2 on the
--         happy path). Covers live review of student practice work.
--     assessment_rate         =  100 AED
--         Paid for STANDALONE assessment work only: mentor listens to a
--         submitted recording, decides pass/fail, and records voice-message
--         feedback. This rate is activated in the failure / re-assessment /
--         escalation loop (sub-phases 1.5 + 1.7) and maps to the
--         assess_recording action in the permission matrix. It is NOT charged
--         when the assessment happens live during the final mentoring session
--         (that case is fully bundled into final_session_rate).
--     final_session_rate      =  200 AED
--         Paid for the live final mentoring session, which includes in-session
--         assessment. No additional assessment_rate charge in this path.
--
-- (d) ARABIC TITLES
--     All Arabic title_ar values in milestone_library are DRAFT translations
--     pending Samer Hassan's review. Each line is marked:
--     -- DRAFT: Samer to review
--
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- BLOCK 1: Idempotent test mentor_manager persona
--
-- Insert order is dictated by the FK chain:
--   auth_users (root)
--     └─ profiles.id REFERENCES auth_users(id) ON DELETE CASCADE
--          └─ instructors.profile_id REFERENCES profiles(id)
--               └─ package_templates.created_by REFERENCES instructors(id)
-- ---------------------------------------------------------------------------

-- 1a. auth_users row (must come first — profiles.id FKs into this)
INSERT INTO auth_users (
    id,
    email,
    password_hash,
    name
)
VALUES (
    '99999999-0000-0000-0000-000000000009'::uuid,
    'mentor-manager.test@kun.example',
    '$2a$10$placeholder.never.used.in.tests.do.not.authenticate',
    'Test Mentor Manager'
)
ON CONFLICT DO NOTHING;

-- 1b. profiles row (id FKs to auth_users.id)
INSERT INTO profiles (
    id,
    email,
    full_name_en,
    role
)
VALUES (
    '99999999-0000-0000-0000-000000000009'::uuid,
    'mentor-manager.test@kun.example',
    'Test Mentor Manager',
    'provider'
)
ON CONFLICT DO NOTHING;

-- 1c. instructors row (profile_id FKs to profiles.id)
--     slug, title_ar, title_en are NOT NULL with no DB default — values below
--     are test-persona stubs and are never surfaced to end users.
INSERT INTO instructors (
    id,
    profile_id,
    slug,
    title_en,
    title_ar,
    service_roles,
    icf_credential,
    kun_level
)
VALUES (
    'bbbb9999-0000-0000-0000-000000000009'::uuid,
    '99999999-0000-0000-0000-000000000009'::uuid,
    'test-mentor-manager',
    'Test Mentor Manager',
    'مدير المنتورينج (اختبار)',
    ARRAY['coach','mentor_coach','advanced_mentor','mentor_manager']::text[],
    'mcc',
    'master'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- BLOCK 2: STIC L1 package_template + 12 milestone_library rows
-- ---------------------------------------------------------------------------

WITH stic_l1 AS (
    INSERT INTO package_templates (
        slug,
        name_ar,
        name_en,
        program_family,
        program_name,
        program_level,
        context,
        coaching_sessions_count,
        mentoring_sessions_count,
        assessment_enabled,
        final_session_enabled,
        sequence_gates,
        rubric_id,
        rubric_version,
        price_behavior,
        price_amount,
        price_currency,
        mentoring_session_rate,
        assessment_rate,
        final_session_rate,
        validity_window_days,
        validity_extension_allowed,
        prompt_testimonial,
        testimonial_visibility,
        offer_referral,
        referral_credit_amount,
        issue_certificate,
        certificate_brand,
        published,
        created_by
    )
    VALUES (
        'stic-l1-mentoring-bundle-v1',
        'حزمة المنتورينج — التفكير الحسي المستوى الأول (STIC L1)',
        'Mentoring Bundle — Somatic Thinking Level 1 (STIC L1)',
        'stce',
        'stic',
        1,
        'kun_student_bundled',
        2,
        3,
        true,
        true,
        '[
          "coaching_personal_1",
          "coaching_personal_2",
          "practice_client_1_session_1",
          "mentoring_1",
          "practice_client_1_session_2",
          "practice_client_1_session_3",
          "practice_client_2_session_1",
          "practice_client_2_session_2",
          "practice_client_2_session_3",
          "mentoring_2",
          "recording_submission",
          "assessment",
          "final_mentoring"
        ]'::jsonb,
        'somatic_thinking_level_1',
        1,
        'bundled_in_program',
        NULL,
        NULL,
        150,   -- mentoring_session_rate: developmental sessions (AED)
        100,   -- assessment_rate: standalone recording assessment + voice feedback, failure-loop path only (AED)
        200,   -- final_session_rate: live final session incl. in-session assessment (AED)
        90,
        false,
        true,
        'public',
        false,
        NULL,
        true,
        'kun_coaching',
        false,
        'bbbb9999-0000-0000-0000-000000000009'::uuid
    )
    ON CONFLICT DO NOTHING
    RETURNING id
)
INSERT INTO milestone_library (
    package_template_id,
    code,
    anchor_event,
    due_offset_days,
    required,
    display_order,
    title_en,
    title_ar,
    created_at,
    updated_at
)
SELECT
    stic_l1.id,
    vals.code,
    vals.anchor_event,
    vals.due_offset_days,
    true,
    vals.display_order,
    vals.title_en,
    vals.title_ar,
    now(),
    now()
FROM stic_l1, (VALUES
    (
        'M0.a',
        'enrollment_start',
        0,
        1,
        'Watch the Student Portal orientation video',
        'شاهد فيديو التعريف ببوابة الطالب'  -- DRAFT: Samer to review
    ),
    (
        'M0.b',
        'enrollment_start',
        0,
        2,
        'Book 2 personal coaching sessions with a Kun coach (use discount code)',
        'احجز جلستَي كوتشينج شخصي مع كوتش من كُن (استخدم كود الخصم)'  -- DRAFT: Samer to review
    ),
    (
        'M1.a',
        'coaching_1_done',
        0,
        3,
        'Execute Session 1 with Volunteer Client 1, following the Beneficiary File',
        'نفّذ الجلسة الأولى مع العميل المتطوع الأول وفقًا لملف المستفيد'  -- DRAFT: Samer to review
    ),
    (
        'M1.b',
        'coaching_1_done',
        0,
        4,
        'Book your first mentoring session',
        'احجز جلسة المنتورينج الأولى'  -- DRAFT: Samer to review
    ),
    (
        'M1.c',
        'mentoring_1_done',
        14,
        5,
        'Complete Sessions 2 and 3 with Volunteer Client 1 (record Session 3)',
        'أكمل الجلستين الثانية والثالثة مع العميل المتطوع الأول (سجّل الجلسة الثالثة)'  -- DRAFT: Samer to review
    ),
    (
        'M2.a',
        'mentoring_1_done',
        0,
        6,
        'Begin coaching Volunteer Client 2 (Session 1 following the Beneficiary File)',
        'ابدأ الكوتشينج مع العميل المتطوع الثاني (الجلسة الأولى وفقًا لملف المستفيد)'  -- DRAFT: Samer to review
    ),
    (
        'M2.b',
        'practice_client_2_session_1',
        14,
        7,
        'Complete Sessions 2 and 3 with Volunteer Client 2 (record Session 3)',
        'أكمل الجلستين الثانية والثالثة مع العميل المتطوع الثاني (سجّل الجلسة الثالثة)'  -- DRAFT: Samer to review
    ),
    (
        -- FIXED 2026-04-15: spec had mentoring_2_done +0 (temporally inverted), Samer confirmed mirror of M2.b pattern
        'M2.c',
        'practice_client_2_session_1',
        14,
        8,
        'Book your second mentoring session',
        'احجز جلسة المنتورينج الثانية'  -- DRAFT: Samer to review
    ),
    (
        'M3.a',
        'mentoring_2_done',
        7,
        9,
        'Choose one recorded session to submit',
        'اختر جلسة مسجّلة واحدة لتقديمها'  -- DRAFT: Samer to review
    ),
    (
        'M3.b',
        'mentoring_2_done',
        7,
        10,
        'Transcribe the chosen recording in the required table format (Speech / Speaker / Time)',
        'فرّغ الجلسة المختارة وفق الصيغة المطلوبة (الكلام / المتحدث / الوقت)'  -- DRAFT: Samer to review
    ),
    (
        'M3.c',
        'mentoring_2_done',
        7,
        11,
        'Upload audio + transcript to the platform, confirming volunteer-client criteria',
        'ارفع الصوت والنص إلى المنصة، مؤكدًا استيفاء شروط العميل المتطوع'  -- DRAFT: Samer to review
    ),
    (
        'M3.d',
        'assessment_passed',
        0,
        12,
        'Book your final mentoring session (scheduled from advanced mentor''s availability)',
        'احجز جلسة المنتورينج النهائية (من توفر المدرب المتقدم)'  -- DRAFT: Samer to review
    )
    -- NOTE: M3.d is a library definition only. Conditional auto-creation on
    -- assessment_passed event belongs to sub-phase 1.4 state machine.
) AS vals(code, anchor_event, due_offset_days, display_order, title_en, title_ar);

-- ---------------------------------------------------------------------------
-- BLOCK 3: Smoke tests
-- ---------------------------------------------------------------------------

-- Replay-safe smoke tests: all assertions query by slug/id and validate state,
-- regardless of whether this run inserted fresh rows or a prior run already did.
DO $$
DECLARE
    v_count   INT;
    v_tmpl_id UUID;
BEGIN
    -- 3a. Template exists (exactly one row) keyed by slug
    SELECT id INTO v_tmpl_id
    FROM package_templates
    WHERE slug = 'stic-l1-mentoring-bundle-v1';

    IF v_tmpl_id IS NULL THEN
        RAISE EXCEPTION 'SMOKE FAIL: STIC L1 package_templates row not found post-migration (slug lookup returned NULL)';
    END IF;

    -- 3b. Exactly 12 milestone_library rows linked to this template
    SELECT COUNT(*) INTO v_count
    FROM milestone_library
    WHERE package_template_id = v_tmpl_id;

    IF v_count <> 12 THEN
        RAISE EXCEPTION 'SMOKE FAIL: expected 12 milestone_library rows for STIC L1, got %', v_count;
    END IF;

    -- 3c. Rate values are correct (150/100/200 AED)
    SELECT COUNT(*) INTO v_count
    FROM package_templates
    WHERE id                     = v_tmpl_id
      AND mentoring_session_rate = 150
      AND assessment_rate        = 100
      AND final_session_rate     = 200;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'SMOKE FAIL: STIC L1 rate values do not match expected 150/100/200 AED';
    END IF;

    -- 3d. M2.c was fixed to practice_client_2_session_1 +14 (not mentoring_2_done +0)
    SELECT COUNT(*) INTO v_count
    FROM milestone_library
    WHERE package_template_id = v_tmpl_id
      AND code                = 'M2.c'
      AND anchor_event        = 'practice_client_2_session_1'
      AND due_offset_days     = 14;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'SMOKE FAIL: M2.c anchor/offset does not match fixed pattern (practice_client_2_session_1 +14)';
    END IF;

    -- 3e. Test persona instructor exists
    SELECT COUNT(*) INTO v_count
    FROM instructors
    WHERE id = 'bbbb9999-0000-0000-0000-000000000009'::uuid;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'SMOKE FAIL: test mentor_manager instructor persona missing post-migration';
    END IF;

    RAISE NOTICE 'SMOKE TEST PASSED: STIC L1 — template present, 12 milestones, rates 150/100/200 AED, M2.c fixed, test persona present';
END $$;

COMMIT;
