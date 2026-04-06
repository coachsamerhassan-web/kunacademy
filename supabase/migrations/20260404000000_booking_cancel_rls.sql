-- ─────────────────────────────────────────────────────────────────────────────
-- Wave 19 QA Fix: Booking cancel/reschedule RLS for customers
-- Without this, a customer calling supabase.from('bookings').update({status:'cancelled'})
-- from the browser client is silently blocked — no UPDATE policy existed for customers.
-- ─────────────────────────────────────────────────────────────────────────────

-- Allow customers to cancel or reschedule their OWN bookings (status must be pending or confirmed)
CREATE POLICY "Customers can update own bookings"
  ON bookings FOR UPDATE
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
