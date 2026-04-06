@AGENTS.md

# Kun Academy Platform — Project Rules
**Last updated:** 2026-04-04 | **Status:** Tier 1 execution (Code 78%, User-Ready 64%)

---

## 1. WHAT THIS IS

A full-stack platform for Kun Coaching Academy (kunacademy.com):
- **Conversion engine** — 59 programs across 7 categories, 3 currencies, bilingual AR/EN
- **LMS** — Course enrollment, lesson video player, progress tracking, auto-certificates
- **Coaching marketplace** — Coach directory, booking with availability engine, 4 pricing tiers
- **Commerce** — Stripe + Tabby BNPL + InstaPay, referrals, commissions, payouts
- **Admin operations** — Dashboards for students, coaches, admin with role-based access
- **Content engine** — Google Sheets CMS + Google Docs for rich content via `fetchDocAsHtml()`

Three theaters: **Egypt** (Arabic, EGP) | **Gulf/MENA** (Arabic, AED) | **Global English** (English, EUR)

---

## 2. METHODOLOGY GUARDIAN [IMMUTABLE]

These rules CANNOT be overridden. Violation = rejected code.

| Rule | Correct | NEVER Use |
|------|---------|-----------|
| Self/Soul | النَّفْس | الرُّوح (in methodology context) |
| Body signals | إشارات حسّية جسدية | الطاقة (avoids New Age framing) |
| Brand name | التفكير الحسّي / Somatic Thinking | الوعي الجسدي, اليقظة الجسدية, Somatic Coaching |
| Positioning | "somatic intelligence" (descriptive) | Energy work, chakras, NLP |
| Boundaries | Coaching only | Medical, psychological, or therapeutic advice |
| Quranic citation | (سورة + رقم الآية) | Unsourced quotes |
| Hadith citation | (الراوي + المصدر + رقم الحديث) | Unsourced quotes |

Every content piece must connect thought to bodily experience.

---

## 3. BRAND CONSTRAINTS [IMMUTABLE]

### 6 Colors Only
| Color | Hex | Usage |
|-------|-----|-------|
| Dark Slate Blue | #474099 | 40% — primary, trust |
| Mandarin | #F47E42 | 20% — CTAs, energy |
| Charleston Green | #2C2C2D | 10% — text |
| Sky Blue | #82C4E8 | 10% — secondary |
| Cosmic Latte | #FFF5E9 | 10% — backgrounds |
| Platinum | #E6E7E8 | 10% — borders |

**Accessibility warning:** Mandarin on Cosmic Latte = 3.2:1 contrast. FAILS WCAG 4.5:1 for text. Use Mandarin only as button background with white text or on dark backgrounds.

### Typography
- AR headings: AR Noor | AR body: Tajawal > Cairo > Noto Naskh
- EN formal: STIX Two Text | EN body: Inter

### Layout
- Mobile-first: 390px primary canvas
- RTL-native, CSS logical properties ONLY (start/end, not left/right)
- Section padding: 80px (48px mobile) | Grid gap: 24px | Card radius: 12px
- Touch targets: minimum 44px

---

## 4. CMS ARCHITECTURE

Two-layer system — understand this before writing ANY content-related code.

```
Layer 1: Google Sheets ──→ Short copy (titles, CTAs, SEO, pricing)
   Spreadsheet ID: 1CLChiKTXGvUDmPFHcjCpa3TmmC6F0KG5RnFCsCiBLIg
   9 tabs: Page Content, Programs, Services, Team, Settings, Pathfinder, Testimonials, Events, Blog

Layer 2: Google Docs ──→ Rich content (program details, blog articles, bios)
   Location: /Shared drives/Kun Management Team/.../Website content/
   Folders: Blog/, Pages/, Programs/, Services/, Team/
   Templates exist for each type (Doc IDs in Blueprint/07-CMS-AND-CONTENT.md)

Data Flow:
   Sheet row → content_doc_id column → Google Doc → fetchDocAsHtml() → Next.js page
```

### How pages read CMS data
```tsx
import { cms } from '@kunacademy/cms';

// Short copy from Sheets
const sections = await cms.getPageContent('about');
const t = contentGetter(sections, locale);
// t('hero', 'title') → value_ar or value_en

// Program data from Sheets
const program = await cms.getProgram('stce-level-1-stic');
// <ProgramDetail program={program} locale={locale} />

// Rich content from Google Docs (via content_doc_id)
import { fetchDocAsHtml } from '@kunacademy/cms';
const html = await fetchDocAsHtml(program.content_doc_id);
// Sanitize with DOMPurify before rendering
```

### fetchDocAsHtml() Rules
- ALWAYS sanitize output with `isomorphic-dompurify` before `dangerouslySetInnerHTML`
- Strip Google Docs inline styles — preserve only semantic tags (h1-h4, p, ul, ol, li, strong, em, a, table)
- Parse callout markers into styled `<aside>` components:
  - `📖 من التراث` → heritage aside
  - `⏸️ توقّف وتأمّل` → reflective pause aside
  - `🔬 جرّب بنفسك` → exercise aside
  - `⚠️ حدود العلم هنا` → science boundary aside
- Cache rendered HTML in Supabase `page_content` table as fallback for Google API rate limits (300 req/60s)

---

## 5. SECURITY RULES

1. **RLS:** Every Supabase table MUST have Row-Level Security policies. Test IDOR (User A can't access User B's data by guessing UUID).
2. **Auth:** Role check uses `['admin', 'super_admin'].includes(role)`. Add JWT claims verification via `app_metadata.role`.
3. **PII:** Coach bank details handled via Stripe Connect — never store raw bank details. If stored, encrypt with dedicated key.
4. **XSS:** ALL user-generated content and Google Docs HTML must be sanitized. No raw `dangerouslySetInnerHTML` without DOMPurify.
5. **Webhooks:** Stripe `constructEvent` with webhook secret. Tabby custom signature. InstaPay manual admin verification.
6. **Credentials:** NEVER in source code, comments, logs, or docs. Reference env var names only.
7. **Admin audit:** All admin write operations logged to `admin_audit_log` table.

---

## 6. CODING STANDARDS

### General
- TypeScript strict — no `any` unless unavoidable (document why)
- All pages bilingual: currently inline `isAr ? 'عربي' : 'English'` (migration to next-intl planned for Tier 2)
- All images via `next/image` + sharp — WebP/AVIF auto
- Lazy load heavy libraries: Chart.js (dashboard only), jsPDF (certificate only), pdfjs-dist (reader only). GSAP stays global.
- `generateStaticParams`: build only top 20 programs at compile, rest on-demand (`dynamicParams: true`)

### Component Patterns
- `ProgramDetail` (287 lines) is the central program renderer — extend with feature flags, don't replace
- Use `contentGetter(sections, locale)` for CMS page content
- Shadcn/ui for all UI components — themed with Kun brand tokens
- GSAP ScrollTrigger for section animations, Framer Motion for micro-interactions

### API Patterns
- Rate limit sensitive endpoints (contact: 3/hr, booking hold: 10/hr)
- Honeypot fields on public forms
- Non-blocking notification calls (fire-and-forget for email/WhatsApp/Telegram)
- Multi-channel notifications via `notify()` dispatcher in @kunacademy/email

---

## 7. SESSION PROTOCOL

### Starting a session — ONE ENTRY POINT
```
Read: /Users/samer/Claude Code/Project Memory/KUN-Website/Blueprint/00-INDEX.md
```
That file tells you EVERYTHING: which Blueprint file to read for your task, where the Execution plan is, and what the current state is. Do NOT improvise a different starting point.

### During a session
- Follow the orchestration model (Section 7.1 below)
- Mark tasks complete as you finish them (checkbox in wave file)
- If blocked, document the blocker and continue with non-dependent tasks
- If uncertain about product behavior: STOP. Present 2 options with trade-offs. Wait for Samer.
- If uncertain about payment logic: STOP and escalate immediately.

### Ending a session
- Update the wave file with completed tasks
- If work remains, write a handoff file: `Project Memory/KUN-Website/HANDOFF-[description].md`
- Commit all work

---

## 7.1. ORCHESTRATION MODEL [IMMUTABLE]

Every build session uses this fan-out architecture. This is NOT optional.

```
                    ┌─────────────────────┐
                    │   OPUS (Maestro)    │
                    │  Orchestrates ONLY  │
                    │  Never implements   │
                    └──────┬──────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
    ┌──────────────┐ ┌──────────┐ ┌──────────────┐
    │ Haiku Agents │ │  Sonnet  │ │  DeepSeek    │
    │  (Workers)   │ │  Agents  │ │  (Tester)    │
    │ Boilerplate, │ │ (Builders│ │ Gap finder,  │
    │ simple tasks,│ │ Complex  │ │ bug hunter,  │
    │ reads, audits│ │ features,│ │ ruthless QA  │
    └──────────────┘ │ integr.) │ └──────────────┘
                     └──────────┘
            All report back to Opus
```

### Role Assignments

| Role | Model | What They Do | What They DON'T Do |
|------|-------|--------------|--------------------|
| **Maestro** | Opus | Reads plans, decomposes tasks, fans out agents, synthesizes results, aligns with blueprint, makes architecture decisions, resolves conflicts | Write code, implement features, do repetitive work |
| **Workers** | Haiku | Read files, audit content, search codebase, run quick checks, produce boilerplate, gather information | Make architecture decisions, write complex logic |
| **Builders** | Sonnet | Build features, write complex components, integrate APIs, implement business logic, produce production code | Make strategic decisions, skip code review |
| **Tester** | DeepSeek | Test EVERYTHING built, find bugs, find gaps between plan and reality, check security, verify Golden Paths, report ruthlessly to Maestro | Fix bugs (reports them), approve code (Maestro decides) |

### How It Works in Practice

1. **Opus reads** the current wave file from `Execution/Tier-1/`
2. **Opus decomposes** the wave into parallel tasks
3. **Opus fans out** Haiku agents for reads/audits, Sonnet agents for builds
4. **Builders report back** to Opus with completed work
5. **Opus deploys DeepSeek** to test what was just built — ruthlessly
6. **DeepSeek reports** bugs, gaps, inconsistencies to Opus
7. **Opus decides:** fix now (fan out Sonnet) or document for later
8. **Opus confirms** task complete only after DeepSeek passes it

### DeepSeek Tester Protocol
DeepSeek's job is to be ADVERSARIAL. For every feature built:
- Does it match the Blueprint spec?
- Does it work in Arabic RTL at 390px?
- Can a malicious user break it? (IDOR, XSS, price tampering)
- Does it handle edge cases? (empty data, missing CMS content, API timeout)
- Does the Golden Path still pass after this change?
- Is the methodology guardian respected in any content?

DeepSeek reports using this format:
```
PASS: [what works]
FAIL: [what's broken, with reproduction steps]
GAP: [what's missing vs blueprint]
RISK: [what could break in production]
```

### Fan-Out Rules
- **Independent tasks** → fan out in parallel (multiple Agent calls in one message)
- **Dependent tasks** → sequential (wait for result before next)
- **Read-only tasks** → always Haiku (cheaper, faster)
- **Build tasks** → always Sonnet (quality code)
- **Test tasks** → always DeepSeek via `mcp__kun-ai-router__route_task` with `force: "deep"`
- **Opus NEVER writes code** — only plans, reviews, decides, and aligns

---

## 8. REFERENCE PATHS

### Blueprint (permanent reference — platform architecture)
```
/Users/samer/Claude Code/Project Memory/KUN-Website/Blueprint/
  00-INDEX.md                  ← Start here — tells you which file to read
  01-IDENTITY-AND-STRATEGY.md  ← Who, why, three theaters
  02-TECHNICAL-ARCHITECTURE.md ← Stack, monorepo, DB schema, performance
  03-BRAND-AND-DESIGN-SYSTEM.md← Colors, typography, components, accessibility
  04-SITE-MAP.md               ← 105 pages + 10 templates, full route tree
  05-API-AND-BACKEND.md        ← 45+ API routes, notification channels
  06-DASHBOARDS.md             ← Student, Coach, Admin + 6 Golden Paths
  07-CMS-AND-CONTENT.md        ← Google Sheets + Docs pipeline, templates, Doc IDs
  08-PAYMENTS-AND-COMMERCE.md  ← Stripe, Tabby, InstaPay, pricing/geo rules
  09-SECURITY-AND-COMPLIANCE.md← RLS, PII, WCAG, GDPR, audit logging, rollback
  10-CONVERSION-AND-MARKETING.md← CTA matrix, trust architecture, SEO, Pathfinder
  11-KNOWN-ISSUES.md           ← 44 issues, 12 decisions needed, prioritized P0-P3
```

### Execution (session-level — one file per wave)
```
/Users/samer/Claude Code/Project Memory/KUN-Website/Execution/
  00-LAUNCH-SCOPE.md           ← Tier definitions, decision ledger, checkpoints
  Tier-1/                      ← 10 numbered wave files (soft launch in 4-5 weeks)
    01 through 10              ← Pick up current wave, execute, mark done
  Tier-2/                      ← Full public launch (+2-3 weeks)
  Tier-3/                      ← Platform maturity (+2-3 weeks)
```

### Content Refinement
```
/Users/samer/Claude Code/Project Memory/KUN-Website/CONTENT-REFINEMENT-POST-SESSION.md
  ← Apply after Hakima + Shahira content production session
```

### Content Agent Prompt (full CMS pipeline spec)
```
/Users/samer/Claude Code/Workspace/CTO/PROMPT-content-creation-agent.md
```

---

## 9. SIX GOLDEN PATHS (Must Pass End-to-End)

| # | Journey | Key Routes |
|---|---------|-----------|
| GP-1 | Discover → Enroll STCE L1 | / → /programs/ → /academy/certifications/stce/level-1/ → checkout → /dashboard/ |
| GP-2 | Browse → Book Coaching | /coaching/ → /coaches/[slug]/ → /coaching/book/ → pay → calendar invite |
| GP-3 | Free → Paid Funnel | /academy/free/ → enroll → complete → upsell → enroll paid |
| GP-4 | Corporate Inquiry | /programs/corporate/ → contact form → proposal PDF → follow up |
| GP-5 | Coach Self-Service | /coach/ → set schedule → view bookings → earnings → request payout |
| GP-6 | Admin Operations | /admin/ → manage courses → approve coach → process payout |

---

## 10. GEO-BASED PRICING [IMMUTABLE]

| Visitor From | Currency | Show |
|-------------|----------|------|
| Egypt | EGP | EGP price only |
| Gulf + Arab countries | AED | AED price only |
| Rest of world | EUR | EUR price only |

- Programs > 4,000 AED equivalent → hide price, show "Request Info" form
- Programs <= 4,000 AED → show price directly
- Events > 1,000 AED → show price + deposit option
- NEVER show all three currencies at once

---

## 11. CURRENT KNOWN ISSUES (Top Priority)

See `Blueprint/11-KNOWN-ISSUES.md` for the full list (44 items). Critical ones:

| Issue | Status |
|-------|--------|
| Duplicate Stripe webhook handlers | P0 — fix in Wave 6 |
| Installment cron date filter bug | P0 — fix in Wave 6 |
| `requireAdmin` misses super_admin | P0 — fix in Wave 6 |
| Coach schedule = stub | P0 — build in Wave 9 |
| Coach products = stub | P0 — build in Wave 9 |
| Retreats section missing entirely | P0 — build in Wave 9 |
| `fetchDocAsHtml()` not wired | P0 — wire in Wave 9 |
| No staging environment | P0 — setup in Wave 5.5 |
| No rollback strategy | P0 — document in Wave 5.5 |
| Event capacity check = TODO | P0 — fix in Wave 6 |
