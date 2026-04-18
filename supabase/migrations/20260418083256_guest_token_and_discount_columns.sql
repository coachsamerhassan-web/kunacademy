-- =============================================================================
-- Migration: 20260418083256_guest_token_and_discount_columns.sql
-- Purpose: Add guest booking token + server-side discount support to bookings table
-- =============================================================================
--
-- (a) GUEST TOKEN (P0-#7)
--     guest_token: text UNIQUE, nullable
--       Issued to guest bookings for stateless session retrieval and completion.
--       Expires after guest_token_expires_at. Only populated for guest workflows.
--     guest_token_expires_at: timestamptz, nullable
--       Expiry of the guest booking session. Guest cannot book/confirm without
--       a valid token and timestamp.
--
-- (b) SERVER-SIDE DISCOUNT (P0-#8)
--     discount_code_id: uuid, REFERENCES discount_codes(id) ON DELETE SET NULL
--       Nullable foreign key. Populated at booking confirmation if a code was
--       applied. Null if no discount code used.
--     final_amount_aed: integer, nullable
--       Cents. Populated when discount applies or at confirm (else null).
--       Use service.price_aed if null.
--     final_amount_egp: integer, nullable
--       Cents. Populated when discount applies or at confirm (else null).
--     final_amount_usd: integer, nullable
--       Cents. Populated when discount applies or at confirm (else null).
--     final_amount_currency: text, nullable
--       Which of (aed, egp, usd) is authoritative. Nullable; null means
--       use service.price_aed (default service currency).
--
-- (c) INDEX
--     idx_bookings_guest_token: sparse index on guest_token (WHERE IS NOT NULL).
--       Fast lookup for guest session retrieval; null-safe to avoid bloat.
--
-- =============================================================================

BEGIN;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_token text UNIQUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_token_expires_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_code_id uuid
  REFERENCES discount_codes(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_amount_aed integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_amount_egp integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_amount_usd integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_amount_currency text;

CREATE INDEX IF NOT EXISTS idx_bookings_guest_token ON bookings(guest_token)
  WHERE guest_token IS NOT NULL;

COMMIT;
