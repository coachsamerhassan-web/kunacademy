-- Atomic capacity guard for event registrations
-- Fixes TOCTOU race condition: two concurrent requests could both pass
-- `count < capacity` before either inserts, allowing overbooking.
-- This function holds a row-level lock on all registrations for the event,
-- counts atomically, then either registers or waitlists in one transaction.

CREATE OR REPLACE FUNCTION register_for_event(
  p_event_slug TEXT,
  p_user_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_capacity INTEGER,
  p_requires_payment BOOLEAN DEFAULT false
) RETURNS TABLE(result_status TEXT, registration_id UUID) AS $$
DECLARE
  v_count INTEGER;
  v_reg_id UUID;
BEGIN
  -- Lock all registrations for this event to prevent concurrent inserts
  PERFORM 1 FROM event_registrations
  WHERE event_slug = p_event_slug
  FOR UPDATE;

  -- Count active registrations
  SELECT COUNT(*) INTO v_count
  FROM event_registrations
  WHERE event_slug = p_event_slug
  AND status IN ('registered', 'confirmed', 'pending_payment');

  -- Check capacity (NULL = unlimited)
  IF p_capacity IS NOT NULL AND v_count >= p_capacity THEN
    -- Insert into waitlist instead
    INSERT INTO waitlist_entries (event_slug, name, email, phone)
    VALUES (p_event_slug, p_name, p_email, p_phone)
    RETURNING id INTO v_reg_id;

    RETURN QUERY SELECT 'waitlisted'::TEXT, v_reg_id;
    RETURN;
  END IF;

  -- Register
  INSERT INTO event_registrations (user_id, event_slug, name, email, phone, status)
  VALUES (p_user_id, p_event_slug, p_name, p_email, p_phone,
          CASE WHEN p_requires_payment THEN 'pending_payment' ELSE 'registered' END)
  RETURNING id INTO v_reg_id;

  RETURN QUERY SELECT CASE WHEN p_requires_payment THEN 'pending_payment' ELSE 'registered' END, v_reg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
