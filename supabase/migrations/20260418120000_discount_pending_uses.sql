-- Hardening #3: Discount max_uses atomic reservation
-- Add pending_uses column to support reserve-at-confirm pattern.
-- This prevents race conditions where N concurrent users can pass
-- max_uses validation and claim the same slots between confirm and webhook.

ALTER TABLE public.discount_codes
ADD COLUMN IF NOT EXISTS pending_uses integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.discount_codes.pending_uses IS
  'Count of discount uses reserved at /confirm but not yet committed at webhook. '
  'Atomic increment during confirm, then transitioned (pending→current) during webhook settlement.';
