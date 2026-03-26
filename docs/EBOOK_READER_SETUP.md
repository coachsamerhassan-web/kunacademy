# eBook Reader Setup & Configuration

Complete guide to the Kun Academy eBook reader: magazine-style, no-download bookshelf with email sharing.

---

## Features

### 1. **Magazine-Style Reader**
- Full-screen, immersive reading experience
- Page-flip animation with 3D spine effect
- Closed-book state (cover display) before opening
- Theme switching (Sand/Night modes)
- Zoom (1x–3x) with pan support
- Mobile-optimized vertical scroll

### 2. **Audio Ambience**
- 3 ambient sound tracks: Birds, Waves, Rain
- Volume control with visual slider
- Play/pause toggle
- Toggleable per-session

### 3. **Access Control**
- Protected PDFs (stored outside web root)
- Sample books (public, no auth)
- Paid books (auth + `book_access` table record required)
- Rate limiting (3 requests/5sec per user)

### 4. **Email Link Sharing**
- Users can share books with friends via email
- 30-day shareable links with unique tokens
- One-click access grant (authenticated users)
- Automatic email notifications

### 5. **Bookshelf Dashboard**
- Personal library view
- Book covers + metadata
- One-click reader access
- Owned books only

---

## Setup & Deployment

### Step 1: Create Database Tables

Run the SQL migrations in Supabase:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy & paste SQL from `/docs/DATABASE_MIGRATIONS.md`
3. Execute both migrations

Tables created:
- `book_access` — User ↔ Book ownership
- `book_shares` — Share tokens & invitations

### Step 2: Define Books in Code

Books are currently hardcoded in:
- `/apps/web/src/app/[locale]/reader/[slug]/page.tsx` (BOOKS constant)
- `/apps/web/src/app/[locale]/dashboard/bookshelf/page.tsx` (BOOK_CATALOG constant)

To add a new book:

```typescript
const BOOKS: Record<string, {
  title_ar: string;
  title_en: string;
  author_ar: string;
  author_en: string;
  coverImage: string;
  isPaid: boolean;
  hasSample: boolean;
}> = {
  'my-book-slug': {
    title_ar: 'عنوان الكتاب',
    title_en: 'My Book Title',
    author_ar: 'المؤلف',
    author_en: 'Author Name',
    coverImage: '/images/products/books/my-book-cover.jpg',
    isPaid: true,        // true = auth required (unless sample=true)
    hasSample: true,     // true = sample PDF available
  },
};
```

### Step 3: Add Book Assets

#### PDF Files
Location: `/content/books/{slug}/`
```
content/books/my-book-slug/
├── full.pdf          ← Full book (auth required)
└── sample.pdf        ← Sample/teaser (public)
```

#### Cover Images
Location: `/apps/web/public/images/products/books/`
```
my-book-cover.jpg
my-book-back.jpg      ← Optional
```

#### Ambient Audio
Location: `/apps/web/public/audio/ambience/`
(Already included: birds.mp3, waves.mp3, rain.mp3)

### Step 4: Refresh Supabase Service Key (for product seeding)

If you want to populate products in Supabase:

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Copy the `service_role` key (labeled "SECRET")
3. Update `/apps/web/.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=<paste-key-here>
   ```
4. Run:
   ```bash
   cd /Users/samer/kunacademy
   npx tsx scripts/seed-products.ts
   ```

### Step 5: Configure Email Service

The share feature emits `book_share_invitation` events that need email delivery.

Currently, events are emitted to the local event bus (`http://localhost:3001/events`).

**For production**, you need:
1. Event bus endpoint configured (or integrate with your notification dispatcher)
2. Email template integration (see `/apps/web/src/lib/email-templates.ts`)
3. SMTP service or email API (SendGrid, Mailgun, etc.)

---

## API Endpoints

### Share Book (Create Invitation)

```
POST /api/books/{slug}/share
Authorization: Bearer {user_token}
Content-Type: application/json

{
  "recipientEmail": "friend@example.com",
  "senderName": "Your Name",
  "message": "Check this out!" (optional)
}

Response:
{
  "shareToken": "abc123...",
  "shareUrl": "https://kunacademy.com/reader/{slug}/share?token=abc123...",
  "expiresAt": "2026-04-26T03:26:00.000Z"
}
```

### Accept Share (Grant Access)

```
POST /api/books/{slug}/share/accept
Authorization: Bearer {user_token}
Content-Type: application/json

{
  "token": "abc123..."
}

Response:
{
  "success": true,
  "message": "Book access granted successfully"
}
```

### Fetch Book Pages (PDF)

```
GET /api/books/{slug}/pages?sample=true
Authorization: Bearer {user_token} (required for paid books, unless sample=true)

Response: Binary PDF data (streamed)
```

---

## Routes

### Reader
- `/[locale]/reader/{slug}` — Book page (server component with auth check)
- `/[locale]/reader/{slug}/book-reader.tsx` — Reader UI component
- `/[locale]/reader/{slug}/share?token={token}` — Share landing page (grants access)

### Bookshelf
- `/[locale]/dashboard/bookshelf` — User's library dashboard

---

## TypeScript Types

All types are in `/packages/db/src/types.ts`.

Key tables:
```typescript
interface book_access {
  id: uuid;
  user_id: uuid;          // refs auth.users
  book_slug: text;
  granted_at: timestamp;
}

interface book_shares {
  id: uuid;
  book_slug: text;
  token: text;            // Unique, 64-char hex
  sender_user_id: uuid;   // refs auth.users
  recipient_email: text;
  sender_name: text;
  message: text | null;
  expires_at: timestamp;  // 30 days from creation
  used: boolean;
  created_at: timestamp;
}
```

---

## Known Limitations & Deferred Work

### RTL Book Direction (Arabic)
- **Status**: Deferred to end-of-project
- **Issue**: page-flip library's `rtl` flag doesn't properly mirror book physics for Arabic
- **Impact**: Arabic books open LTR instead of RTL
- **Solution pending**: Try alternative library (turn.js) or CSS scaleX(-1) approach
- **Memory**: `/Users/samer/.claude/projects/-Users-samer-Claude-Code/memory/feedback_ebook_reader_rtl.md`

### PDF Rendering (QR Codes)
- **Status**: Deferred
- **Issue**: pdf.js canvas render doesn't display embedded QR codes
- **Impact**: Sample PDFs with embedded QR may show blank
- **Solution**: May require different pdf.js render options or image extraction

---

## Testing Checklist

- [ ] Sample book loads without auth
- [ ] Paid book requires auth
- [ ] Theme switching works (Sand/Night)
- [ ] Audio plays, stop button visible
- [ ] Volume slider functional
- [ ] Zoom in/out, pan works
- [ ] Mobile vertical scroll functional
- [ ] Share button opens modal
- [ ] Share email sent successfully
- [ ] Share token works (grants access)
- [ ] Expired tokens rejected
- [ ] Bookshelf displays owned books
- [ ] Close book returns to cover

---

## Performance Notes

### PDF Pre-rendering
- All PDF pages rendered to canvas + JPEG data URLs at load time
- ~25-30s in dev (with HMR), ~3-5s in production
- High memory usage for large PDFs (100+ pages)

### Asset Size
- Book covers: ~0.5-2.4 MB (JPG)
- Sample PDFs: ~1.3 MB
- Full PDFs: ~2.4 MB
- Ambient audio: ~350 KB each (MP3)

---

## Future Enhancements

1. **CMS-driven books** — Move book metadata to Google Sheets
2. **Reading progress** — Track page bookmarks per user
3. **Annotations** — Highlight, note-taking
4. **Social sharing** — Share on WhatsApp, email preview cards
5. **Accessibility** — ARIA labels, keyboard navigation
6. **Analytics** — Track reading sessions, average time per book
