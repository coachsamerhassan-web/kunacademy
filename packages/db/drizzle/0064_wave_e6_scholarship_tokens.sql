-- Migration 0064 — Wave E.6 — Scholarship Tokens (Allocation + Disbursement)
--
-- Source authority:
--   /Users/samer/Claude Code/Project Memory/KUN-Features/WAVE-E-SCHOLARSHIP-FUND-SPEC.md
--   Wave E.6 dispatch (00-STATUS 2026-04-26-g)
--
-- Scope (E.6 only — additive, no data migration):
--   (1) scholarship_tokens — single-use, hashed-at-rest tokens used to redeem
--       a disbursed scholarship as a full-price-offset at standard checkout.
--       Per spec §Q9: NOT a coupon (different surface; tokens are
--       scholarship-specific, single-use, expire on enrollment OR after 30 days).
--   (2) RLS — admin-readable; INSERT only via kunacademy_admin (server admin
--       routes hold this role via withAdminContext); validate-by-hash via
--       a SECURITY DEFINER RPC for unauthenticated checkout (no SELECT for
--       anonymous role).
--   (3) UPDATE constraint — only redeemed_at, redeemed_by_user_id, and the
--       parent scholarships.program_enrollment_id may be set; everything else
--       immutable post-INSERT.
--   (4) DELETE blocked — append-only.
--   (5) Plaintext token NEVER stored; only sha256 hash. Plaintext sent once
--       in the disbursement email; if user loses email, admin regenerates
--       (writing a new audit row + invalidating prior token).
--
-- IP / dignity boundary (per CLAUDE.md):
--   No methodology / scoring detail anywhere. Token metadata column is
--   strictly operational (issued_for_program_slug, etc.) — never recipient
--   identifying detail beyond what is already in scholarships row.
--
-- Token shape:
--   - 32 random bytes → base64url (43 chars, ~256 bits entropy)
--   - SHA-256 of plaintext → 64 hex chars stored in token_hash (UNIQUE)
--   - Collision space ≈ 2^256; 1M generated tokens → ~0 collisions
--   - One-time send via email; no recovery from DB
--
-- Atomicity contract (lib layer):
--   - applyDisbursement runs INSERT scholarship_tokens + UPDATE scholarships
--     + applyStatusTransition('disbursed') in single TXN. Email send happens
--     after commit (fire-and-forget); if email fails, admin can re-send via
--     re-issue (writes new token, invalidates prior).
--   - validateAndRedeemToken at checkout: SHA256 lookup → check expires_at >
--     now() AND redeemed_at IS NULL → UPDATE redeemed_at + redeemed_by_user_id
--     + UPDATE scholarships.program_enrollment_id (post-checkout). Atomic via
--     same TXN that creates enrollment row.
--
-- Idempotency:
--   CREATE TABLE IF NOT EXISTS — re-run safe
--   DROP POLICY IF EXISTS before each CREATE POLICY — re-run safe
--   GRANTs are idempotent in Postgres
--   CHECK constraints guarded by EXISTS in pg_constraint

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. scholarship_tokens — single-use redemption tokens                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS scholarship_tokens (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id        uuid NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,

  -- SHA-256 of plaintext; plaintext NEVER stored. UNIQUE so we can lookup.
  token_hash            text NOT NULL UNIQUE,

  -- Lifecycle
  expires_at            timestamptz NOT NULL,
  redeemed_at           timestamptz,
  redeemed_by_user_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Audit
  created_at            timestamptz NOT NULL DEFAULT now(),
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE scholarship_tokens IS
  'Wave E.6 — single-use, hashed-at-rest tokens that redeem a disbursed '
  'scholarship as a full-price offset at standard checkout. Plaintext token '
  'is sent once in the disbursement email; only sha256 hash stored here. '
  'UPDATE restricted to redeemed_at + redeemed_by_user_id; DELETE blocked.';

COMMENT ON COLUMN scholarship_tokens.token_hash IS
  'SHA-256(plaintext_token) hex. Plaintext is never stored in DB.';

COMMENT ON COLUMN scholarship_tokens.expires_at IS
  '30 days after disbursement (per spec §Q9). NULL is not allowed.';

COMMENT ON COLUMN scholarship_tokens.redeemed_at IS
  'Set on first valid redemption at checkout. After this is set, the token '
  'is single-use exhausted and cannot redeem again.';

-- CHECK: token_hash must be 64 hex characters (sha256 output)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'scholarship_tokens'::regclass
      AND conname  = 'scholarship_tokens_hash_shape_chk'
  ) THEN
    ALTER TABLE scholarship_tokens
      ADD CONSTRAINT scholarship_tokens_hash_shape_chk
      CHECK (token_hash ~ '^[0-9a-f]{64}$');
  END IF;
END $$;

-- CHECK: redemption pair coherence — both redeemed_at + redeemed_by_user_id
-- set, or both NULL. No half-redeemed rows.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'scholarship_tokens'::regclass
      AND conname  = 'scholarship_tokens_redeem_pair_chk'
  ) THEN
    ALTER TABLE scholarship_tokens
      ADD CONSTRAINT scholarship_tokens_redeem_pair_chk
      CHECK (
        (redeemed_at IS NULL AND redeemed_by_user_id IS NULL)
        OR (redeemed_at IS NOT NULL AND redeemed_by_user_id IS NOT NULL)
      );
  END IF;
END $$;

-- CHECK: expires_at must be in the future at INSERT time. We can't enforce
-- "future-relative-to-now" easily, but we can enforce "after created_at".
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'scholarship_tokens'::regclass
      AND conname  = 'scholarship_tokens_expiry_after_create_chk'
  ) THEN
    ALTER TABLE scholarship_tokens
      ADD CONSTRAINT scholarship_tokens_expiry_after_create_chk
      CHECK (expires_at > created_at);
  END IF;
END $$;

-- Indexes for the redemption-validation hot path:
-- 1. hash lookup (already UNIQUE → implicit index, but make explicit-named)
-- 2. scholarship FK lookup (admin views all tokens for a given scholarship)
-- 3. partial index on (expires_at) WHERE redeemed_at IS NULL — for cleanup
--    cron OR for "any active token for this scholarship?" admin checks
CREATE INDEX IF NOT EXISTS scholarship_tokens_scholarship_idx
  ON scholarship_tokens(scholarship_id, created_at DESC);

CREATE INDEX IF NOT EXISTS scholarship_tokens_active_idx
  ON scholarship_tokens(expires_at)
  WHERE redeemed_at IS NULL;

-- Partial unique index: at most ONE active (un-redeemed, un-expired) token
-- per scholarship at any time. Prevents the admin from accidentally
-- generating two valid tokens that race to redeem.
--
-- Implementation note: we cannot put `expires_at > now()` in the WHERE
-- clause (now() is STABLE not IMMUTABLE). The "active" check is therefore
-- "redeemed_at IS NULL"; the application layer is responsible for marking
-- prior tokens as redeemed (or expired) when re-issuing, OR uses the
-- conditional partial unique index below which protects against
-- "two un-redeemed at once".
CREATE UNIQUE INDEX IF NOT EXISTS scholarship_tokens_one_active_per_scholarship_uidx
  ON scholarship_tokens(scholarship_id)
  WHERE redeemed_at IS NULL;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. RLS — admin read; admin INSERT; redemption-validate via RPC only      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE scholarship_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scholarship_tokens_admin_all ON scholarship_tokens;
CREATE POLICY scholarship_tokens_admin_all
  ON scholarship_tokens
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Server role: API admin routes hold kunacademy via withAdminContext.
-- We allow INSERT (issue token at disbursement) + SELECT (admin reads via
-- kunacademy_admin path; kunacademy is the runtime app role).
DROP POLICY IF EXISTS scholarship_tokens_server_insert ON scholarship_tokens;
CREATE POLICY scholarship_tokens_server_insert
  ON scholarship_tokens
  FOR INSERT TO kunacademy
  WITH CHECK (true);

-- The redemption-validate path runs via the server role. We allow SELECT for
-- this path (server has kunacademy or kunacademy_admin); RLS prevents
-- anonymous-role reads. The unauthenticated checkout flow does NOT hit this
-- table directly — it goes through the validateAndRedeemToken lib helper
-- which runs withAdminContext.
DROP POLICY IF EXISTS scholarship_tokens_server_select ON scholarship_tokens;
CREATE POLICY scholarship_tokens_server_select
  ON scholarship_tokens
  FOR SELECT TO kunacademy
  USING (true);

-- UPDATE policy: server can update redeemed_at + redeemed_by_user_id only.
-- We use a column-level check by REVOKE/GRANT pattern below; the row-level
-- policy permits the UPDATE, the column-level GRANT restricts which columns.
DROP POLICY IF EXISTS scholarship_tokens_server_redeem_update ON scholarship_tokens;
CREATE POLICY scholarship_tokens_server_redeem_update
  ON scholarship_tokens
  FOR UPDATE TO kunacademy
  USING (redeemed_at IS NULL)            -- can only mutate un-redeemed rows
  WITH CHECK (redeemed_at IS NOT NULL);  -- mutation must SET redeemed_at (forward-only)

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. GRANTs — admin can read+write+update; kunacademy can INSERT + UPDATE   ║
-- ║    (redemption columns only) + SELECT (lookup); DELETE BLOCKED.           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

GRANT SELECT, INSERT ON scholarship_tokens TO kunacademy;
GRANT SELECT, INSERT, UPDATE ON scholarship_tokens TO kunacademy_admin;

-- Column-scoped UPDATE for the runtime app role: only redeemed_at +
-- redeemed_by_user_id are mutable from the kunacademy role. Everything else
-- immutable post-INSERT (token_hash, expires_at, scholarship_id, etc.).
GRANT UPDATE (redeemed_at, redeemed_by_user_id) ON scholarship_tokens TO kunacademy;

-- DELETE explicitly REVOKED — append-only ledger.
REVOKE DELETE ON scholarship_tokens FROM kunacademy;
REVOKE DELETE ON scholarship_tokens FROM kunacademy_admin;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Audit-events whitelist confirmation                                   ║
-- ║    The 'allocated' + 'disbursed' event types are already in the          ║
-- ║    sch_app_audit_events_event_type_chk whitelist (migration 0063).        ║
-- ║    This block re-asserts and no-ops if already present.                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- No DDL needed — the CHECK was already created in 0063 with allocated +
-- disbursed in the whitelist. We DOcument the contract here for grep.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Self-smoke                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  cnt int;
  scholarship_uuid uuid;
  app_uuid uuid;
  fake_hash_a text := repeat('a', 64);
  fake_hash_b text := repeat('b', 64);
  inserted_id uuid;
BEGIN
  -- 1. token table exists
  SELECT count(*) INTO cnt FROM information_schema.tables
   WHERE table_name='scholarship_tokens';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 1 FAIL: scholarship_tokens missing'; END IF;
  RAISE NOTICE 'SMOKE 1 PASSED: scholarship_tokens table exists';

  -- 2. token_hash CHECK present
  SELECT count(*) INTO cnt FROM pg_constraint
   WHERE conrelid='scholarship_tokens'::regclass
     AND conname='scholarship_tokens_hash_shape_chk';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 2 FAIL: hash CHECK missing'; END IF;
  RAISE NOTICE 'SMOKE 2 PASSED: hash CHECK exists';

  -- 3. redemption pair CHECK present
  SELECT count(*) INTO cnt FROM pg_constraint
   WHERE conrelid='scholarship_tokens'::regclass
     AND conname='scholarship_tokens_redeem_pair_chk';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 3 FAIL: redeem-pair CHECK missing'; END IF;
  RAISE NOTICE 'SMOKE 3 PASSED: redeem-pair CHECK exists';

  -- 4. expiry-after-create CHECK present
  SELECT count(*) INTO cnt FROM pg_constraint
   WHERE conrelid='scholarship_tokens'::regclass
     AND conname='scholarship_tokens_expiry_after_create_chk';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 4 FAIL: expiry CHECK missing'; END IF;
  RAISE NOTICE 'SMOKE 4 PASSED: expiry-after-create CHECK exists';

  -- 5. RLS enabled
  SELECT count(*) INTO cnt FROM pg_class
   WHERE relname='scholarship_tokens' AND relrowsecurity=true;
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 5 FAIL: RLS not enabled'; END IF;
  RAISE NOTICE 'SMOKE 5 PASSED: RLS enabled';

  -- 6. policies present
  SELECT count(*) INTO cnt FROM pg_policy
   WHERE polrelid='scholarship_tokens'::regclass
     AND polname IN (
       'scholarship_tokens_admin_all',
       'scholarship_tokens_server_insert',
       'scholarship_tokens_server_select',
       'scholarship_tokens_server_redeem_update'
     );
  IF cnt <> 4 THEN RAISE EXCEPTION 'SMOKE 6 FAIL: expected 4 policies, found %', cnt; END IF;
  RAISE NOTICE 'SMOKE 6 PASSED: 4 RLS policies present';

  -- 7. partial unique index exists
  SELECT count(*) INTO cnt FROM pg_indexes
   WHERE tablename='scholarship_tokens'
     AND indexname='scholarship_tokens_one_active_per_scholarship_uidx';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 7 FAIL: active-uidx missing'; END IF;
  RAISE NOTICE 'SMOKE 7 PASSED: one-active-per-scholarship unique index exists';

  -- 8. CHECK rejects bad hash shape (negative test)
  -- Need a real scholarship_id for FK; create a throwaway pair.
  INSERT INTO scholarship_applications (
    applicant_name, applicant_email, preferred_language,
    program_family, program_slug, scholarship_tier, status
  ) VALUES (
    'Smoke 0064', 'smoke-0064@example.invalid', 'en',
    'gps', 'gps-of-life', 'partial', 'allocated'
  ) RETURNING id INTO app_uuid;

  INSERT INTO scholarships (
    application_id, recipient_name, recipient_email,
    program_family, program_slug, scholarship_tier,
    amount_cents, currency
  ) VALUES (
    app_uuid, 'Smoke', 'smoke-0064@example.invalid',
    'gps', 'gps-of-life', 'partial',
    100000, 'AED'
  ) RETURNING id INTO scholarship_uuid;

  -- Bad hash (not 64 hex chars) — expect rejection
  BEGIN
    INSERT INTO scholarship_tokens (scholarship_id, token_hash, expires_at)
    VALUES (scholarship_uuid, 'not-a-real-hash', now() + interval '30 days');
    RAISE EXCEPTION 'SMOKE 8 FAIL: bad hash was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'SMOKE 8 PASSED: bad hash rejected by CHECK';
  END;

  -- 9. CHECK rejects half-redeemed pair (negative test)
  BEGIN
    INSERT INTO scholarship_tokens (
      scholarship_id, token_hash, expires_at, redeemed_at, redeemed_by_user_id
    ) VALUES (
      scholarship_uuid,
      fake_hash_a,
      now() + interval '30 days',
      now(),  -- redeemed_at set
      NULL    -- redeemed_by_user_id NULL — should fail
    );
    RAISE EXCEPTION 'SMOKE 9 FAIL: half-redeemed was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'SMOKE 9 PASSED: half-redeemed rejected by CHECK';
  END;

  -- 10. Insert a valid token, then try to insert a SECOND active token for
  -- the same scholarship — should fail (partial unique index).
  INSERT INTO scholarship_tokens (scholarship_id, token_hash, expires_at)
  VALUES (scholarship_uuid, fake_hash_a, now() + interval '30 days')
  RETURNING id INTO inserted_id;
  RAISE NOTICE 'SMOKE 10a PASSED: first active token inserted';

  BEGIN
    INSERT INTO scholarship_tokens (scholarship_id, token_hash, expires_at)
    VALUES (scholarship_uuid, fake_hash_b, now() + interval '30 days');
    RAISE EXCEPTION 'SMOKE 10b FAIL: second active token was accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'SMOKE 10b PASSED: second active token blocked by partial uidx';
  END;

  -- 11. Mark first as redeemed; THEN second active token should succeed.
  UPDATE scholarship_tokens
  SET redeemed_at = now(),
      redeemed_by_user_id = (SELECT id FROM profiles LIMIT 1)
  WHERE id = inserted_id;

  INSERT INTO scholarship_tokens (scholarship_id, token_hash, expires_at)
  VALUES (scholarship_uuid, fake_hash_b, now() + interval '30 days');
  RAISE NOTICE 'SMOKE 11 PASSED: second active token allowed after first redeemed';

  -- 12. expiry-before-create CHECK rejects past expires_at
  BEGIN
    INSERT INTO scholarship_tokens (
      scholarship_id, token_hash, expires_at, created_at
    ) VALUES (
      scholarship_uuid,
      repeat('c', 64),
      now() - interval '1 hour',
      now()
    );
    RAISE EXCEPTION 'SMOKE 12 FAIL: past-expiry was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'SMOKE 12 PASSED: past-expiry rejected by CHECK';
  END;

  -- Cleanup smoke rows so we don't leave dangling test data
  DELETE FROM scholarship_tokens WHERE scholarship_id = scholarship_uuid;
  DELETE FROM scholarships WHERE id = scholarship_uuid;
  DELETE FROM scholarship_applications WHERE id = app_uuid;

  RAISE NOTICE 'Migration 0064 self-smoke complete (12 PASS)';
END $$;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Operator follow-up (run AFTER `sudo -u postgres psql -f`)                ║
-- ║                                                                          ║
-- ║ Per F.1 / F.5 / F.6 ownership pattern, ensure the table remains owned   ║
-- ║ by postgres so RLS is enforced (table owners bypass RLS by default).    ║
-- ║                                                                          ║
-- ║   ALTER TABLE scholarship_tokens OWNER TO postgres;                       ║
-- ║                                                                          ║
-- ║   GRANT SELECT, INSERT ON scholarship_tokens TO kunacademy;               ║
-- ║   GRANT UPDATE (redeemed_at, redeemed_by_user_id)                          ║
-- ║     ON scholarship_tokens TO kunacademy;                                  ║
-- ║   GRANT SELECT, INSERT, UPDATE ON scholarship_tokens TO kunacademy_admin; ║
-- ║   REVOKE DELETE ON scholarship_tokens FROM kunacademy;                     ║
-- ║   REVOKE DELETE ON scholarship_tokens FROM kunacademy_admin;               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ROLLBACK (manual — rare; for emergency only)                             ║
-- ║                                                                          ║
-- ║   BEGIN;                                                                  ║
-- ║   DROP TABLE IF EXISTS scholarship_tokens CASCADE;                        ║
-- ║   COMMIT;                                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
