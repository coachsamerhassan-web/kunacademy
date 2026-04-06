-- ============================================================================
-- Migration: Hybrid Payout Architecture
-- Created: 2026-04-05
-- ============================================================================
-- Adds coach_payout_profiles table which stores each coach's preferred
-- payout method: Stripe Connect OR Manual Bank Transfer (AES-256-GCM encrypted).
-- The existing payout_requests table is NOT modified.
-- ============================================================================

-- ── Coach payout profiles ────────────────────────────────────────────────────
CREATE TABLE coach_payout_profiles (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  method                       TEXT        NOT NULL DEFAULT 'manual_bank'
                                           CHECK (method IN ('stripe_connect', 'manual_bank')),

  -- Stripe Connect fields (only populated when method = 'stripe_connect')
  stripe_account_id            TEXT,
  stripe_onboarding_complete   BOOLEAN     DEFAULT FALSE,

  -- AES-256-GCM encrypted bank fields (only populated when method = 'manual_bank')
  -- Plaintext NEVER stored — ciphertext is base64-encoded
  encrypted_bank_name          TEXT,
  encrypted_iban               TEXT,
  encrypted_account_number     TEXT,
  encrypted_swift              TEXT,
  -- GCM auth tag is appended to ciphertext (standard pattern)
  -- IV is unique per row; stored separately so it can be rotated
  encryption_iv                TEXT,       -- base64-encoded 12-byte GCM IV

  -- Metadata
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_payout_profile_user UNIQUE (user_id)
);

-- ── updated_at auto-maintenance ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_payout_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payout_profiles_updated_at
  BEFORE UPDATE ON coach_payout_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_payout_profile_timestamp();

-- ── Row-Level Security ───────────────────────────────────────────────────────
ALTER TABLE coach_payout_profiles ENABLE ROW LEVEL SECURITY;

-- Coaches can read their own profile
CREATE POLICY "Coaches read own payout profile"
  ON coach_payout_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Coaches can insert their own profile
CREATE POLICY "Coaches insert own payout profile"
  ON coach_payout_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Coaches can update their own profile
CREATE POLICY "Coaches update own payout profile"
  ON coach_payout_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read ALL profiles (needed for payout processing)
CREATE POLICY "Admins read all payout profiles"
  ON coach_payout_profiles
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- ── Index ────────────────────────────────────────────────────────────────────
CREATE INDEX idx_payout_profiles_user ON coach_payout_profiles(user_id);
