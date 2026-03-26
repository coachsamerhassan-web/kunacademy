-- Fix Commission Rates RLS Policy (2026-03-26)
-- Issue: Migration changes scope='profile' to scope='coach', but RLS policy still checks 'profile'
-- This prevents coaches from viewing their own rate overrides

-- Drop old policy that checks for 'profile'
DROP POLICY IF EXISTS "commission_rates_own_select" ON commission_rates;

-- Create new policy that checks for 'coach' (the updated value)
CREATE POLICY "commission_rates_own_select" ON commission_rates
  FOR SELECT USING (
    scope = 'coach' AND scope_id = auth.uid()::TEXT
  );

-- Also allow coaches to view global rates (scope='global')
CREATE POLICY "commission_rates_global_select" ON commission_rates
  FOR SELECT USING (scope = 'global');
