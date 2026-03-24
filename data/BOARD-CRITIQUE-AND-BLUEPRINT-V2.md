# كُنْ Board Review — Functionality Blueprint v2 (FINAL)
**Date:** 2026-03-24 | **Session:** Board Critique + Refinement
**Called by:** Samer | **Orchestrated by:** Rafik
**Input from:** All 6 C-Suite agents

---

## PART 1: ZOHO API LIMITS RESEARCH

Before committing to any Zoho product, here are the verified limits:

| Product | Limit | Impact | Verdict |
|---------|-------|--------|---------|
| **Zoho Sheet** | 65,536 rows/sheet, 1,024 columns, 5M cells | More than enough for CMS (we'd use ~500 rows max) | ✅ SAFE |
| **Zoho CRM** | 5,000,000 API credits/day (Zoho One) | ~25,000 standard API calls/day. Plenty for our scale | ✅ SAFE |
| **Zoho Books** | 10,000 API calls/day (Premium+), 100 req/min | At ~50 transactions/day max, well within limits | ✅ SAFE |
| **Zoho Flow** | 300 exec/min (app trigger), 100 exec/min (webhook) | Comfortable for our notification volume | ✅ SAFE |
| **Zoho Campaigns** | Tied to subscriber count + plan | Already LIVE, known limits | ✅ SAFE |
| **Zoho SalesIQ** | 10K visitors/month (Basic in Zoho One) | May need upgrade if traffic grows past 300/day | ⚠️ WATCH |
| **Zoho WorkDrive** | 5 TB team storage, 5 GB file size | Plenty for course materials | ✅ SAFE |
| **Zoho Bookings** | Requires Zoho One license per staff | ❌ NOT VIABLE for 100+ external coaches | ❌ BLOCKED |
| **Zoho Learn** | External portals available. Arabic/RTL unverified | Needs prototype before commitment | ⚠️ TEST |
| **Zoho Books webhooks** | 500 webhooks/day | Enough for ~500 transactions/day | ✅ SAFE |
| **Zoho Sign** | Varies by plan, included in Zoho One | Fine for contracts/certificates | ✅ SAFE |

### Products we WILL use: CRM, Books, Campaigns, Flow, Sheet, SalesIQ, WorkDrive, Sign, Cliq, Mail
### Products we WON'T use: Bookings (licensing), Learn (unverified — test first)
### Products to TEST: Learn (Arabic support prototype)

---

## PART 2: BOARD CRITIQUE (Agent by Agent)

### رفيق (Rafik — CEO/Orchestrator)

**Strategic critique:**
The blueprint is solid but missing **operational handoff clarity**. Who does what daily?
We need a RACI matrix for every recurring operation.

**Additions:**
- Add a "Day in the Life" section showing how Samer, Nashit, and Shahira interact
  with the system on a typical day
- The Zoho contingency plan is critical — if we build deep Zoho integrations and
  they change pricing or APIs, we're stuck. Every Zoho integration must have an
  abstraction layer.

### صانع (Sani — CTO)

**Technical critique:**
1. **Zoho Sheet as CMS is elegant BUT fragile.** What if someone accidentally deletes
   a row? We need:
   - Version history (Zoho Sheet has this natively)
   - Automatic Google Sheet backup (via Zoho Flow — every edit triggers sync)
   - Validation rules on the sheet (required fields, allowed values)
   - A "publish" mechanism — edits don't go live until someone marks them "published"

2. **The 5-sheet CMS architecture needs defining now**, not during build:
   - Sheet 1: **Page Content** (slug, section, key, value_ar, value_en, published)
   - Sheet 2: **Programs** (slug, title_ar/en, type, prices, duration, nav_group, etc.)
   - Sheet 3: **Services & Packages** (coaching sessions, mentoring, pricing, discounts)
   - Sheet 4: **Team** (coaches, instructors — name, bio, credentials, photo_url, etc.)
   - Sheet 5: **Settings** (global config — social links, contact info, footer text, etc.)

3. **Drive-based lesson delivery** (Samer's idea) is smart. Folder structure:
   ```
   WorkDrive/Courses/
   ├── STCE-L1-Cohort-12/
   │   ├── Session-01-Recording.mp4
   │   ├── Session-01-Slides.pdf
   │   └── Session-01-Handout.pdf
   ├── STCE-L1-Cohort-13/
   │   └── ...
   └── Micro-Courses/
       ├── Balance-to-Barakah/
       │   ├── Lesson-01.mp4
       │   └── ...
   ```
   Sheet 2 (Programs) has a column `materials_folder_url` pointing to the Drive folder.
   The site fetches the folder listing and renders it.

### أمين (Amin — CFO)

**Financial critique:**
1. **Pricing flexibility in Sheet 3 is excellent.** I need these columns:
   - `base_price_aed`, `base_price_egp`, `base_price_usd`, `base_price_eur`
   - `discount_percentage`, `discount_valid_until`
   - `early_bird_price_aed`, `early_bird_deadline`
   - `installment_enabled` (boolean — triggers Tabby)
   - `bundle_id` (links to a package/bundle)

2. **Revenue attribution must be traceable.** Every payment needs:
   - Which program/service
   - Which coach (for session bookings)
   - Which campaign/source (UTM → CRM → payment)
   - Currency + gateway used
   - This feeds into Zoho Books AND our analytics

3. **Multi-currency pricing should support "theater pricing":**
   - Gulf theater: AED (primary) — higher prices
   - Egypt theater: EGP — adjusted for market
   - Global theater: USD/EUR — international pricing
   - The Sheet controls this per-program. No code changes for price updates.

### نشيط (Nashit — COO)

**Operations critique:**
1. **Coach onboarding journey (admin-invite only) needs a defined flow:**
   ```
   Admin invites coach (email) →
   Coach receives welcome email with setup link →
   Coach creates account (social login or magic link) →
   Coach guided setup: profile photo → bio → credentials → specialties →
   Coach sets weekly schedule (drag time blocks) →
   Coach selects which services they offer →
   Admin reviews and approves profile →
   Coach goes live on the platform
   ```
   This should be a step-by-step wizard, not a form dump.

2. **Student onboarding needs equal care:**
   ```
   Student registers (social login preferred) →
   Welcome screen: "What brings you to Kun?" (quiz-like) →
     - Personal growth → Show free courses + retreats
     - Become a coach → Show STCE + certification path
     - Get coaching → Show booking flow
     - Corporate → Show corporate inquiry form
   → Profile setup: name, photo, language preference →
   → Dashboard with recommended first step
   ```

3. **The notification system needs a "quiet hours" setting.**
   Gulf timezone (UTC+4): no WhatsApp messages before 8am or after 10pm.
   Egypt timezone (UTC+2): same rule, different hours.

### شهيرة (Shahira — CMO)

**Marketing critique:**
1. **The Sheet CMS must support SEO fields:**
   - `meta_title_ar`, `meta_title_en`
   - `meta_description_ar`, `meta_description_en`
   - `og_image_url`
   - `canonical_url`
   This way I can optimize SEO without touching code.

2. **Landing page support:** Can we have a Sheet where I create a temporary landing
   page just by adding a row? Example:
   - slug: `/ar/events/ihya-2026`
   - type: `landing`
   - hero_image, headline, body, cta_text, cta_url, form_embed
   This would let me launch campaign pages in minutes.

3. **Testimonial display rules:** The 888 testimonials need:
   - A `featured` flag (top testimonials for homepage)
   - A `program` tag (show relevant testimonials on each program page)
   - A `video_url` field (video testimonials are higher impact)
   - Display should prioritize recent + video + featured

### حكيمة (Hakima — CEDO)

**Educational critique:**
1. **Course structure must support Samer's pedagogical model:**
   - Each program has a **learning journey** (not just a list of lessons)
   - Journey stages: Foundation → Practice → Integration → Mastery
   - Each stage has materials, exercises, and reflection prompts
   - Live programs: recorded sessions are supplementary, not primary

2. **The "My Journey" view should feel like a growing tree, not a checklist.**
   - Visual metaphor: roots (foundation) → trunk (practice) → branches (integration)
   - This aligns with Kun's brand visual direction (trees, growth, roots)
   - Can be a simple visual indicator per enrollment, not complex animation

3. **Materials access timing is critical:**
   - STCE sessions: recording available within 48h of live session
   - Available for 90 days after program end (not forever)
   - Sheet column: `access_duration_days` per program
   - This prevents content hoarding and encourages re-enrollment

---

## PART 3: ZOHO CONTINGENCY PLAN

**Principle: Never be locked into a vendor.**

### Abstraction Layer Design
Every Zoho integration goes through an abstraction layer:

```typescript
// /packages/integrations/src/crm.ts
interface CRMProvider {
  createLead(data: LeadData): Promise<string>;
  updateContact(id: string, data: ContactData): Promise<void>;
  getContactByEmail(email: string): Promise<Contact | null>;
}

// Current implementation
class ZohoCRMProvider implements CRMProvider { ... }

// Emergency replacement
class SupabaseCRMProvider implements CRMProvider { ... }
```

### For each Zoho product — the escape plan:

| Zoho Product | Abstraction | Fallback if Zoho dies |
|---|---|---|
| CRM | `CRMProvider` interface | Supabase `contacts` table + custom UI |
| Books | `InvoiceProvider` interface | Stripe Invoicing (free) |
| Campaigns | `EmailMarketingProvider` interface | Resend + custom sequences in Supabase |
| Flow | `AutomationProvider` interface | Custom webhooks + Supabase Edge Functions |
| Sheet (CMS) | `ContentProvider` interface | Google Sheets API (backup is always synced) |
| SalesIQ | Script tag removal | GA4 (already configured) |
| WorkDrive | `StorageProvider` interface | Google Drive (backup) or Supabase Storage |
| Sign | `SignatureProvider` interface | DocuSign or manual |
| Cliq | `InternalNotificationProvider` | Telegram bot (already exists) |

### Data portability:
- All Supabase data: fully portable (PostgreSQL dump)
- All Zoho Sheet data: mirrored to Google Sheets continuously
- All Zoho CRM data: weekly export to JSON via API (automated)
- All Zoho Books data: monthly export via API
- Course materials: stored in Drive (not Zoho-dependent)

### Trigger for contingency activation:
- Zoho announces pricing change affecting us by >50%
- Zoho deprecates a critical API with <6 months notice
- Zoho One availability changes in UAE region
- Any product downtime >24 hours affecting customers

---

## PART 4: THE 5-SHEET CMS ARCHITECTURE (Detailed)

### Sheet 1: Page Content
Controls all static text on the website.

| Column | Type | Example |
|--------|------|---------|
| page_slug | text | `home`, `about`, `contact` |
| section | text | `hero`, `vision`, `cta` |
| key | text | `headline`, `subtext`, `cta_label` |
| value_ar | text | النمو لا يبدأ من الأعلى |
| value_en | text | Growth doesn't start from the top |
| meta_title_ar | text | (SEO — only for section=`seo`) |
| meta_title_en | text | |
| meta_desc_ar | text | |
| meta_desc_en | text | |
| og_image | url | |
| published | boolean | TRUE |
| last_edited_by | text | Shahira |
| last_edited_at | date | 2026-03-24 |

### Sheet 2: Programs
Controls the full program catalog.

| Column | Type | Example |
|--------|------|---------|
| slug | text | `stce-level-1` |
| title_ar | text | رحلة كوتش التفكير الحسّي — المستوى الأول |
| title_en | text | STCE Level 1 — Somatic Thinking Coach |
| nav_group | text | `certifications` |
| type | text | `live_cohort` |
| format | text | `online` / `in_person` / `hybrid` |
| description_ar | long text | ... |
| description_en | long text | ... |
| price_aed | number | 12000 |
| price_egp | number | 45000 |
| price_usd | number | 3200 |
| price_eur | number | 2900 |
| early_bird_aed | number | 9600 |
| early_bird_deadline | date | 2026-04-15 |
| discount_pct | number | 0 |
| installment_enabled | boolean | TRUE |
| duration_hours | number | 60 |
| duration_text_ar | text | ٨ أسابيع |
| duration_text_en | text | 8 weeks |
| next_cohort_date | date | 2026-05-01 |
| location | text | Online / Dubai / Cairo |
| instructor_slugs | text | `samer-hassan,nahla-elghamrawy` |
| materials_folder_url | url | (WorkDrive/Drive link) |
| access_duration_days | number | 90 |
| is_icf_accredited | boolean | TRUE |
| icf_details | text | Level 1 ACSTH |
| thumbnail_url | url | |
| is_featured | boolean | FALSE |
| is_published | boolean | TRUE |

### Sheet 3: Services & Packages
Controls coaching sessions, mentoring, and package pricing.

| Column | Type | Example |
|--------|------|---------|
| slug | text | `individual-coaching` |
| name_ar | text | جلسة كوتشينج فردية |
| name_en | text | Individual Coaching Session |
| category | text | `seeker` / `student` |
| price_aed | number | 500 |
| price_egp | number | 2000 |
| price_usd | number | 135 |
| sale_price_aed | number | 400 |
| sale_valid_until | date | 2026-04-30 |
| duration_minutes | number | 60 |
| is_free | boolean | FALSE |
| eligible_coaches | text | `all` or `samer-hassan,nahla` |
| description_ar | text | ... |
| description_en | text | ... |
| is_published | boolean | TRUE |

### Sheet 4: Team (Coaches & Instructors)
Controls coach/instructor profiles displayed on the site.

| Column | Type | Example |
|--------|------|---------|
| slug | text | `samer-hassan` |
| name_ar | text | سامر حسن |
| name_en | text | Samer Hassan |
| role | text | `founder` / `coach` / `instructor` |
| title_ar | text | مؤسس أكاديمية كُن |
| title_en | text | Founder of Kun Academy |
| credentials | text | `MCC, ICF` |
| specialties_ar | text | التفكير الحسّي، القيادة |
| specialties_en | text | Somatic Thinking, Leadership |
| bio_ar | long text | ... |
| bio_en | long text | ... |
| photo_url | url | |
| languages | text | `ar,en,it` |
| services | text | (slugs from Sheet 3) |
| is_visible | boolean | TRUE |
| sort_order | number | 1 |

### Sheet 5: Settings
Global site configuration.

| Column | Type | Example |
|--------|------|---------|
| key | text | `site_name_ar` |
| value | text | أكاديمية كُنْ |
| category | text | `branding` / `contact` / `social` / `footer` |

Examples:
- `contact_phone` → `+971 XX XXX XXXX`
- `contact_email` → `info@kunacademy.com`
- `whatsapp_number` → `+971XXXXXXXXX`
- `instagram_url` → `https://instagram.com/kunacademy`
- `footer_text_ar` → `نرافقك إلى العمق، بخطى واعية`
- `icf_badge_url` → `https://...`
- `default_currency` → `AED`

---

## PART 5: REFINED BUILD SEQUENCE

### Wave A: Foundation + Content Shell (3 days)
**Output:** All pages render with real content. Zoho Sheet CMS live.
- [ ] Create 5 Zoho Sheets with defined schemas above
- [ ] Build Next.js content fetcher (Zoho Sheet API → ISR)
- [ ] Set up Google Sheet mirror via Zoho Flow
- [ ] Scrape all 29 WP pages → populate Sheet 1 (Page Content)
- [ ] Populate Sheet 2 with all 59 programs from catalog
- [ ] 2 dummy coaches in Sheet 4, 2 dummy services in Sheet 3
- [ ] Stitch design propagation to all remaining pages
- [ ] Supabase schema v2 (EMS-oriented)

### Wave B: EMS + Student Portal (5 days)
**Output:** Students can log in and see their unified journey.
- [ ] Auth: magic link + Google social login
- [ ] Student onboarding wizard ("What brings you to Kun?")
- [ ] "My Journey" dashboard (unified view of all enrollments)
- [ ] Course player (video from Drive/WorkDrive links + progress tracking)
- [ ] Materials viewer (PDFs, links — time-limited access)
- [ ] Certificate generation (HTML → PDF, triggered by completion)
- [ ] Admin: enrollment management, attendance logging

### Wave C: Booking System (4 days)
**Output:** Clients can book coaching sessions with any coach.
- [ ] Coach profile pages (from Sheet 4 data + Supabase auth)
- [ ] Coach self-service: schedule editor, day-off, service selection
- [ ] Coach onboarding wizard (admin-invite → guided setup)
- [ ] Availability engine (weekly patterns + exceptions)
- [ ] Booking flow UI (category → coach → calendar → checkout)
- [ ] Coach dashboard (upcoming, past, earnings)
- [ ] Admin: booking overview, reschedule, cancel

### Wave D: Payments + Notifications (3 days)
**Output:** Full payment flow + multi-channel notifications.
- [ ] Stripe Checkout (USD/EUR)
- [ ] PayTabs Checkout (AED/SAR native)
- [ ] Tabby BNPL (AED installments)
- [ ] Payment → Zoho Books auto-invoice
- [ ] Payment → CRM contact update
- [ ] Payment → enrollment/booking activation
- [ ] Email notifications (Resend transactional)
- [ ] WhatsApp notifications (Meta BAPI — infrastructure ready, test number)
- [ ] Internal notifications (Cliq + Telegram)
- [ ] Quiet hours: no customer messages outside 8am-10pm local

### Wave E: Community + Admin (4 days)
**Output:** Community profiles, discussion boards, full admin portal.
- [ ] Community profiles (public, role badges, credentials)
- [ ] 3 discussion boards (General, Coaching Practice, Announcements)
- [ ] Threaded discussions, reactions, pinned posts
- [ ] Auto-create cohort boards on new cohort enrollment
- [ ] Admin portal (students, coaches, programs, testimonials, bookings, payments)
- [ ] Testimonial migration (888 records with featured/program/video tags)
- [ ] Landing page system (Shahira adds row to Sheet → page appears)

### Wave F: Migration + QA + Launch (3 days)
**Output:** Production-ready site.
- [ ] Migrate 23 instructor profiles from WordPress
- [ ] Migrate 10 Amelia services to Sheet 3
- [ ] Configure all Zoho Flow automations
- [ ] E2E test all golden paths (6 paths)
- [ ] Mobile QA: 390px, both languages, RTL
- [ ] Lighthouse > 90 on key pages
- [ ] DNS cutover + 301 redirects
- [ ] old.kunacademy.com WordPress rollback standby
- [ ] WhatsApp: production number activation (when Samer provides)

**Total: ~22 working days across 6 waves**

---

## PART 6: SAMER'S DECISIONS (INCORPORATED)

| # | Decision | Status |
|---|----------|--------|
| 1 | Blueprint approval | Pending board review → THIS document |
| 2 | WhatsApp phone number | Build infrastructure now, number later ✅ |
| 3 | Sheet editors | Shahira + Hakima + Samer (by content type) ✅ |
| 4 | Community boards | 3 boards: General, Coaching Practice, Announcements ✅ |
| 5 | Coach onboarding | Admin-only invite + guided onboarding wizard ✅ |
| 6 | Student auth | Magic link + Google social login (both) ✅ |
| 7 | Google Classroom | NO migration. Future: Drive folder + Sheet link ✅ |
| 8 | Content CMS | Zoho Sheet (primary) + Google Sheet (backup) ✅ |
| 9 | Zoho contingency | Abstraction layer on every integration ✅ |
| 10 | Recorded vs live | Most programs are live. LMS is small slice. ✅ |

---

## SIGN-OFF

This blueprint is ready for Samer's final approval.

One remaining question: **Should we prototype Zoho Learn for the small recorded
course slice, or skip it entirely and build a simple custom player from the start?**

Given that:
- Arabic/RTL support in Zoho Learn is unverified
- The recorded course slice is small (6 courses, 52 lessons)
- Drive/WorkDrive-based delivery is simpler and already planned
- A custom player gives us full Stitch design control

**Board recommendation: Skip Zoho Learn. Build a simple custom player.**
The video URL comes from the Sheet/Drive. The player is react-player with our
Stitch skin. Progress tracking is 1 Supabase table. Total: ~1 day of work.
This avoids an untested dependency and keeps the architecture clean.

---

## ADDENDUM: SITE TREE REDESIGN + NEW FEATURES (2026-03-24)

**Source:** Board critique of Samer's PDF site design document + Blueprint v2 merge.
**Full site tree:** See `/data/SITE-TREE-V2.md` (approved)

### Key Structural Changes from Original Blueprint
1. **Coaching vs Academy split** — visitors navigate by intent ("get coaching" vs "learn"), not by program type
2. **Pathfinder (المُرشد)** — interactive decision tree replaces static learning paths page
3. **Events as first-class section** — retreats/workshops/conferences not buried under programs
4. **Blog** — dedicated section for SEO and content marketing
5. **Testimonials standalone page** — 888 testimonials with coach ratings system
6. **Corporate dedicated experience** — with ROI Calculator and corporate Pathfinder

### New Features Added (Board + Samer, 2026-03-24)
- **F8: Pathfinder** — Interactive guided journey (individual + corporate) with branching questions and video
- **F9: Coach Rating System** — Star ratings on testimonials feed into coach badges and directory sorting
- **F10: Referral & Store Credit** — Unique referral codes, credit ledger, dashboard widget, spend at checkout or cash payout
- **F11: Scroll-Driven Visual Storytelling** — GSAP ScrollTrigger narratives (tree growth, Islamic architecture corridors)
- **F12: Self-Optimizing Asset Pipeline** — next/image + sharp + Cloudflare CDN + Lighthouse CI gate

### CMS Decision (2026-03-24)
- **Read source:** Google Sheets API (not Zoho Sheet API)
- **Edit UI:** Zoho Sheet → Zoho Flow syncs to Google Sheet → site reads Google Sheet
- **Rationale:** Google Sheets API is rock-solid, credentials already available, sync delay is invisible since ISR caches for 5 min
- **Contingency:** ContentProvider interface allows swap to Zoho Sheet API later
- **Spreadsheet ID:** 1CLChiKTXGvUDmPFHcjCpa3TmmC6F0KG5RnFCsCiBLIg
- **API Key:** Stored in project credentials (Google Sheets API, restricted)
