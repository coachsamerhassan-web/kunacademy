-- ============================================================================
-- Auth.js tables for self-hosted authentication
-- Replaces Supabase GoTrue auth.users with local tables
-- ============================================================================

-- ── Auth Users ───────────────────────────────────────────────────────────────
-- This replaces auth.users. The profiles table already has FK to auth.users(id).
-- We create auth_users to store credentials, then re-point profiles.
CREATE TABLE auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  email_verified TIMESTAMPTZ,
  password_hash TEXT,  -- bcrypt hash, NULL for OAuth-only users
  image TEXT,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auth.js required tables
CREATE TABLE auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'oauth', 'oidc', 'email', 'credentials'
  provider TEXT NOT NULL,  -- 'google', 'credentials', 'email'
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_accounts_provider_unique UNIQUE (provider, provider_account_id)
);

CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_verification_tokens (
  identifier TEXT NOT NULL,  -- email address
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  CONSTRAINT auth_verification_tokens_pkey PRIMARY KEY (identifier, token)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_auth_accounts_user_id ON auth_accounts(user_id);
CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_token ON auth_sessions(session_token);
CREATE INDEX idx_auth_users_email ON auth_users(email);

-- ── Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_auth_users_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auth_users_updated_at
  BEFORE UPDATE ON auth_users
  FOR EACH ROW
  EXECUTE FUNCTION update_auth_users_timestamp();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Auth tables are managed by the application (service_role), not by users
-- No authenticated user policies needed — Auth.js manages these directly
GRANT ALL ON auth_users, auth_accounts, auth_sessions, auth_verification_tokens TO service_role;
GRANT SELECT ON auth_users TO authenticated;  -- for profile lookups

-- ── Migrate existing auth.users → auth_users ─────────────────────────────────
-- NOTE: The auth.users stub table has columns: id, email, created_at,
-- raw_user_meta_data, raw_app_meta_data, role.
-- No email_confirmed_at column exists (minimal stub, not full Supabase GoTrue).
-- email_verified is left NULL for all migrated users — they will need to
-- re-verify or be confirmed via Auth.js flow.
INSERT INTO auth_users (id, email, name, created_at)
SELECT
  id,
  COALESCE(email, ''),
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
  created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;
