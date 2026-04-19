-- Add preferred_language to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'ar' CHECK (preferred_language IN ('ar', 'en'));

-- Add payment_portal_url to payments table for short-link customization
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_portal_url TEXT;

-- Ensure app roles have CRUD access
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO kunacademy, kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO kunacademy, kunacademy_admin;
