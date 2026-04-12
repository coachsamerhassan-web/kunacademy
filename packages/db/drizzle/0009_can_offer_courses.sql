ALTER TABLE providers ADD COLUMN IF NOT EXISTS can_offer_courses BOOLEAN DEFAULT false;
