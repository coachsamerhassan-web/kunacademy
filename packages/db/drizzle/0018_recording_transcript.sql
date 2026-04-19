-- ============================================================================
-- Migration: 0018_recording_transcript
-- Sub-phase: S2-Layer-1 / 2.2
-- Adds transcript file columns to package_recordings.
--
-- Students submit a transcript document alongside their coaching recording.
-- Assessors read it in the left pane while listening to the audio.
--
-- Transcript formats accepted: PDF, plain text, Markdown.
-- Max size enforced at API layer: 2 MB.
-- Required alongside recording (API layer enforces, DB allows NULL for
-- forward-compatibility with rows created before this migration).
-- ============================================================================

BEGIN;

ALTER TABLE package_recordings
  ADD COLUMN IF NOT EXISTS transcript_file_path   TEXT,
  ADD COLUMN IF NOT EXISTS transcript_mime        TEXT,
  ADD COLUMN IF NOT EXISTS transcript_size_bytes  BIGINT,
  ADD COLUMN IF NOT EXISTS transcript_uploaded_at TIMESTAMPTZ;

-- Grant the transcript columns to the authenticated role so existing
-- INSERT/UPDATE policies continue to work for the new fields.
GRANT UPDATE (transcript_file_path, transcript_mime, transcript_size_bytes, transcript_uploaded_at)
  ON package_recordings TO authenticated;

-- ============================================================================
-- SMOKE TESTS
-- ============================================================================

DO $$
BEGIN
  PERFORM 1 FROM information_schema.columns
    WHERE table_name = 'package_recordings'
      AND table_schema = 'public'
      AND column_name = 'transcript_file_path';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMOKE FAIL: transcript_file_path column not found';
  END IF;
  RAISE NOTICE 'SMOKE 1 PASSED: transcript_file_path column exists';

  PERFORM 1 FROM information_schema.columns
    WHERE table_name = 'package_recordings'
      AND table_schema = 'public'
      AND column_name = 'transcript_mime';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMOKE FAIL: transcript_mime column not found';
  END IF;
  RAISE NOTICE 'SMOKE 2 PASSED: transcript_mime column exists';

  PERFORM 1 FROM information_schema.columns
    WHERE table_name = 'package_recordings'
      AND table_schema = 'public'
      AND column_name = 'transcript_size_bytes';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMOKE FAIL: transcript_size_bytes column not found';
  END IF;
  RAISE NOTICE 'SMOKE 3 PASSED: transcript_size_bytes column exists';

  PERFORM 1 FROM information_schema.columns
    WHERE table_name = 'package_recordings'
      AND table_schema = 'public'
      AND column_name = 'transcript_uploaded_at';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMOKE FAIL: transcript_uploaded_at column not found';
  END IF;
  RAISE NOTICE 'SMOKE 4 PASSED: transcript_uploaded_at column exists';
END $$;

-- ============================================================================
-- MIGRATION TRACKING
-- tag: 0018_recording_transcript
-- when: 1776950400000  (ms since epoch for 2026-04-19)
-- ============================================================================

COMMIT;
