-- ============================================================================
-- CRITICAL RLS SECURITY FIXES
-- Audit date: 2026-04-05
-- ============================================================================

-- FIX C1: Remove public INSERT on book_access
-- The policy "Service role insert" uses WITH CHECK (true), meaning ANY
-- authenticated or anonymous caller can grant themselves access to any book.
-- service_role already bypasses RLS automatically — this policy is unnecessary
-- and dangerous.
DROP POLICY IF EXISTS "Service role insert" ON book_access;

-- FIX C2: Restrict pathfinder_responses UPDATE to own records by user_id only
-- The old policy allowed update if email = auth.users.email, which lets an
-- authenticated user hijack anonymous submissions that share their email
-- address (e.g. a user signs up with the same email used in an anon session).
-- The fix: only allow update where user_id = auth.uid().
DROP POLICY IF EXISTS "Users can update own pathfinder responses" ON pathfinder_responses;
CREATE POLICY "Users can update own pathfinder responses"
  ON pathfinder_responses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- FIX C3: Add digital_assets SELECT policy for purchasers
-- Previously only admins could SELECT from digital_assets. Users who bought a
-- product had no way to query asset metadata. Access is allowed via two paths:
--   a) The user has a completed order containing an order_item for this product.
--   b) The user has an active download_token for this specific asset.
CREATE POLICY "Purchasers can view digital assets"
  ON digital_assets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.customer_id = auth.uid()
        AND o.status = 'completed'
        AND oi.product_id = digital_assets.product_id
    )
    OR
    EXISTS (
      SELECT 1
      FROM download_tokens dt
      WHERE dt.user_id = auth.uid()
        AND dt.asset_id = digital_assets.id
    )
  );
