# Database Migrations for Kun Academy

This document contains SQL migrations needed for new features. Run these in the Supabase SQL Editor.

## Migration 1: Book Shares Table (eBook Reader Email Sharing)

**When needed**: When deploying the eBook reader share feature.

**Purpose**: Track book share tokens and their usage for email-based access granting.

```sql
-- Create book_shares table for tracking book share tokens
create table if not exists public.book_shares (
  id uuid default gen_random_uuid() primary key,
  book_slug text not null,
  token text not null unique,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  sender_name text not null,
  message text,
  expires_at timestamp with time zone not null,
  used boolean default false not null,
  created_at timestamp with time zone default now() not null,

  constraint book_slug_format check (book_slug ~ '^[a-z0-9-]+$')
);

-- Indexes for efficient queries
create index if not exists idx_book_shares_token on public.book_shares(token);
create index if not exists idx_book_shares_book_slug on public.book_shares(book_slug);
create index if not exists idx_book_shares_sender_user_id on public.book_shares(sender_user_id);
create index if not exists idx_book_shares_expires_at on public.book_shares(expires_at);

-- Enable RLS
alter table public.book_shares enable row level security;

-- RLS Policies
-- Anyone can query shares (checks happen in API)
create policy "shares_readable" on public.book_shares
  for select using (true);

-- Only authenticated users who are the sender can create/update/delete
create policy "shares_writable_by_sender" on public.book_shares
  for all
  using (auth.uid() = sender_user_id)
  with check (auth.uid() = sender_user_id);
```

## Migration 2: Ensure book_access Table (if not exists)

```sql
-- Create book_access table if it doesn't exist
create table if not exists public.book_access (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_slug text not null,
  granted_at timestamp with time zone default now() not null,

  unique(user_id, book_slug)
);

create index if not exists idx_book_access_user_id on public.book_access(user_id);
create index if not exists idx_book_access_book_slug on public.book_access(book_slug);

alter table public.book_access enable row level security;

-- RLS: Users can only see their own access
create policy "book_access_readable_by_owner" on public.book_access
  for select
  using (auth.uid() = user_id);

create policy "book_access_writable_by_owner" on public.book_access
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

## How to Apply

1. Go to https://supabase.com → Your Project → SQL Editor
2. Create a new query
3. Paste the migration SQL above
4. Click "Run"
5. Verify no errors

## Verification

After running migrations:

```sql
-- Check tables exist
select table_name from information_schema.tables
where table_schema = 'public';

-- Check book_shares table structure
select column_name, data_type from information_schema.columns
where table_name = 'book_shares';
```
