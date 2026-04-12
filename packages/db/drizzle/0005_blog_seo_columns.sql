ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS meta_title_ar TEXT,
  ADD COLUMN IF NOT EXISTS meta_title_en TEXT,
  ADD COLUMN IF NOT EXISTS meta_description_ar TEXT,
  ADD COLUMN IF NOT EXISTS meta_description_en TEXT;
