BEGIN;

-- Sub-phase 1.1 correction: the milestone_library.anchor_event CHECK constraint
-- was too narrow. The spec (SPEC-mentoring-package-template.md §5) uses granular
-- per-client-per-session anchor names (matching sequence_gates JSONB vocabulary),
-- but 1.1 shipped a collapsed generic 'practice_session_done' bucket. This
-- migration widens the whitelist to match the spec so sub-phase 1.2 seed data
-- can land and 1.4's state machine can fire per-session events.
--
-- Values added (6 new): practice_client_{1,2}_session_{1,2,3}
-- Value kept (1 legacy): practice_session_done — for backwards compatibility
-- Other existing values unchanged.
--
-- Widening only. No existing row can violate a more-permissive constraint,
-- so DROP + ADD is safe.

ALTER TABLE milestone_library DROP CONSTRAINT milestone_library_anchor_event_check;

ALTER TABLE milestone_library ADD CONSTRAINT milestone_library_anchor_event_check
  CHECK (anchor_event IN (
    'enrollment_start',
    'coaching_1_done',
    'coaching_2_done',
    'mentoring_1_done',
    'mentoring_2_done',
    'mentoring_3_done',
    'practice_session_done',
    'practice_client_1_session_1',
    'practice_client_1_session_2',
    'practice_client_1_session_3',
    'practice_client_2_session_1',
    'practice_client_2_session_2',
    'practice_client_2_session_3',
    'recording_submitted',
    'assessment_passed'
  ));

-- Smoke test: inserting a row with a new granular value should NOT raise
-- check_violation. We wrap this in a ROLLBACK so no permanent row lands.
DO $$
DECLARE v_caught TEXT;
BEGIN
  BEGIN
    -- Try inserting a fake row that references a non-existent template.
    -- This will fail on FK, not CHECK — which is what we want to prove:
    -- the anchor_event value is now ACCEPTED by the check constraint, so
    -- the error we get should be 'insert or update on table ... violates
    -- foreign key constraint', NOT 'new row violates check constraint'.
    INSERT INTO milestone_library (
      package_template_id, code, anchor_event, due_offset_days,
      required, display_order, title_en, title_ar, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      'SMOKE.1',
      'practice_client_2_session_1',
      0, true, 999, 'smoke', 'smoke', now(), now()
    );
    RAISE EXCEPTION 'SMOKE TEST FAILED: insert unexpectedly succeeded';
  EXCEPTION
    WHEN foreign_key_violation THEN
      v_caught := 'foreign_key_violation (expected — CHECK did not fire)';
    WHEN check_violation THEN
      RAISE EXCEPTION 'SMOKE TEST FAILED: CHECK still rejects practice_client_2_session_1 — %', SQLERRM;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'SMOKE TEST FAILED: unexpected error — %', SQLERRM;
  END;
  RAISE NOTICE 'SMOKE TEST PASSED: widened CHECK accepts practice_client_2_session_1 (FK blocked as expected)';
END $$;

COMMIT;
