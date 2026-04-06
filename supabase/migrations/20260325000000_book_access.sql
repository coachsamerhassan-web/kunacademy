-- Book access control table
-- Tracks which users have access to which books (via purchase, gift, or admin grant)

CREATE TABLE IF NOT EXISTS book_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_slug TEXT NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by TEXT DEFAULT 'purchase', -- purchase, gift, admin
  UNIQUE(user_id, book_slug)
);

-- RLS: users can only read their own access
ALTER TABLE book_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own access"
  ON book_access FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role insert"
  ON book_access FOR INSERT
  WITH CHECK (true);

-- Index for fast lookups by user
CREATE INDEX idx_book_access_user_id ON book_access(user_id);
CREATE INDEX idx_book_access_book_slug ON book_access(book_slug);
