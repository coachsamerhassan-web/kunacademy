# KUN ACADEMY — SITE TREE v2 (APPROVED)
# Date: 2026-03-24
# Source: Board critique of PDF site design + Blueprint v2 merge + Samer's additions
# Status: APPROVED by Samer

---

## NAVIGATION STRUCTURE (Mega-Menu)

Primary nav items visible in header:
1. الكوتشينج (Coaching)
2. الأكاديمية (Academy)
3. الفعاليات (Events)
4. المُرشد (Pathfinder)
5. الكوتشز (Coaches)
6. المدونة (Blog)
7. من نحن (About)

Secondary nav (utility bar):
- اتصل بنا (Contact)
- المؤسسات (Corporate)
- تسجيل الدخول (Login) / لوحة التحكم (Dashboard)
- 🌐 AR/EN toggle

---

## FULL ROUTE MAP

```
kunacademy.com
│
├── / (Home)
│   ├── Hero section (CMS-driven, scroll-triggered tree narrative)
│   ├── Services overview (4 audience paths with icons)
│   ├── Featured programs carousel
│   ├── Upcoming events (next 3)
│   ├── Featured testimonials (video priority)
│   ├── Trust bar (ICF MCC, 500+ coaches, 4 continents, 10K+ sessions)
│   ├── About teaser → /about
│   └── CTA footer
│
├── /coaching                           — Coaching Services Overview
│   ├── /coaching/individual            — Individual coaching sessions + booking CTA
│   ├── /coaching/group                 — Group workshops + upcoming dates
│   └── /coaching/corporate             — Corporate solutions + Pathfinder + ROI calculator + proposal form
│
├── /academy                            — Academy Overview ("learn at Kun")
│   ├── /academy/certifications         — STCE L1/L2/L3, diplomas, certification pathways visual map
│   ├── /academy/courses                — Live + upcoming courses catalog
│   ├── /academy/recorded               — Recorded course catalog (self-paced)
│   └── /academy/free                   — Free micro-courses + resources (funnel entry point)
│
├── /pathfinder                         — Interactive Guided Journey (المُرشد)
│   │   Decision tree: Question → Answer (with brief + 30-60s video) → Next question → Recommendation
│   │   Ends with: specific program/course/coach recommendation + CTA
│   └── /pathfinder/corporate           — Corporate version + ROI Calculator
│       ROI Calculator: # employees × program type → projected savings vs. investment
│
├── /events                             — Events & Journeys
│   │   Event calendar with filters (type, date, location)
│   │   Types: retreats, workshops, conferences, masterclasses
│   └── /events/[slug]                  — Event detail (agenda, location, speakers, booking)
│
├── /coaches                            — Coach Directory (browseable with filters)
│   │   Filters: specialty, language, rating, availability
│   │   Sort by: rating, reviews count, availability
│   └── /coaches/[slug]                 — Coach Profile
│       Includes: bio, credentials, specialties, rating badge, aggregate score,
│       rated reviews, availability calendar, booking CTA, referral link
│
├── /book                               — Unified Booking Flow
│   Select category → browse coaches → select coach → pick time → checkout
│   Supports: free sessions (confirm without payment), paid sessions (gateway)
│
├── /shop                               — Product Shop (books, cards, tools)
│   │   Product grid with categories, multi-currency pricing
│   │   Product types: physical (shipped), digital (instant download), hybrid (both)
│   ├── /shop/[slug]                    — Product detail page
│   ├── /shop/cart                      — Shopping cart
│   └── /shop/checkout                  — Checkout (reuses Stripe/PayTabs/Tabby gateways)
│       Digital: purchase → signed download URL (72h, 3 downloads)
│       Physical: purchase → Nashit notification → manual fulfillment
│       Coach-created products: creator_id → revenue share via credit system
│
├── /blog                               — Blog / Articles
│   │   Categories: coaching, somatic thinking, personal development, Islamic coaching, news
│   │   Each article: author, related programs, social share, CTA
│   └── /blog/[slug]                    — Individual article
│
├── /testimonials                       — Testimonials Hub (standalone page)
│   888 testimonials, filterable by: program, coach, type (text/video), rating
│   Video testimonials prioritized. Featured flag for homepage.
│   Coach reviews feed into coach badges and ratings.
│
├── /about                              — About Kun Academy
│   ├── /about/samer                    — Founder page (MCC, 10K sessions, ICF Young Leader)
│   ├── /about/methodology              — Somatic Thinking explained (التفكير الحسّي)
│   ├── /about/values                   — Core values: Presence, Authenticity, Ihsan, Interconnectedness, Companionship
│   └── /about/team                     — Team page (from Sheet 4)
│
├── /contact                            — Contact Us
│   Form + WhatsApp + email + social links + Google Maps (if physical location)
│
├── /legal
│   ├── /privacy                        — Privacy policy
│   ├── /terms                          — Terms of service
│   └── /refund                         — Refund policy
│
├── /[slug]                             — Dynamic Landing Pages (Sheet-driven)
│   Shahira creates campaign pages by adding rows to CMS sheet.
│   Template: hero image + headline + body + CTA + form embed
│   Supports scroll-driven visual narratives (Islamic door, corridor, etc.)
│
├── /dashboard (authenticated — Student Portal)
│   ├── /dashboard                      — "My Journey" unified enrollment view
│   ├── /dashboard/courses              — My courses + progress + resume
│   ├── /dashboard/bookings             — My bookings + history
│   ├── /dashboard/certificates         — My certificates + downloads
│   ├── /dashboard/payments             — Payment history + invoices
│   ├── /dashboard/orders               — Purchase history + digital download links
│   ├── /dashboard/earnings             — Product earnings (if creator): gross, commission, net, payout
│   ├── /dashboard/payout               — Request payout for product earnings
│   ├── /dashboard/credits              — Store credit balance + history + redeem
│   ├── /dashboard/referrals            — My referral link + stats + earnings
│   └── /dashboard/profile              — Profile settings
│
├── /coach (authenticated — Coach Portal)
│   ├── /coach                          — Coach dashboard (upcoming bookings, metrics)
│   ├── /coach/schedule                 — Manage weekly availability + time off
│   ├── /coach/bookings                 — Upcoming + past bookings
│   ├── /coach/profile                  — Edit profile (goes to approval queue)
│   ├── /coach/earnings                 — Revenue summary (two subtotals: services + products)
│   │   Shows: gross, commission deducted, net available, payout history
│   │   Filterable by: month, category (services vs products)
│   ├── /coach/products                 — My products (books, cards, tools I created)
│   ├── /coach/payout                   — Request payout (min threshold, payment method)
│   ├── /coach/credits                  — Store credit balance
│   └── /coach/referrals                — Referral link + stats
│
└── /admin (authenticated — Admin Portal)
    ├── /admin                          — Dashboard + key metrics
    ├── /admin/students                 — Student management
    ├── /admin/coaches                  — Coach approval queue
    ├── /admin/programs                 — Program management
    ├── /admin/bookings                 — Booking management
    ├── /admin/payments                 — Payment overview (deposits, installments, BNPL tracking)
    ├── /admin/commissions              — Commission rate management
    │   Global defaults, per-level, per-profile, per-item overrides
    │   Priority cascade: item > profile > level > global
    ├── /admin/payouts                  — Payout requests queue (approve/reject/process)
    │   Amin reviews → approves → Zoho Books vendor bill → payment
    ├── /admin/products                 — Product catalog management
    ├── /admin/testimonials             — Moderation queue
    ├── /admin/community                — Board management
    ├── /admin/referrals                — Referral program overview
    └── /admin/content                  — CMS sheet links + content preview
```

---

## PAGE COUNT SUMMARY

| Category | Pages | Dynamic |
|----------|-------|---------|
| Public static | 22 | No |
| Public dynamic (programs, events, coaches, blog, testimonials) | ~100+ | Yes — from CMS sheets + DB |
| Landing pages | Unlimited | Yes — Sheet-driven |
| Student portal | 8 | Auth-gated |
| Coach portal | 7 | Auth-gated |
| Admin portal | 10 | Auth-gated |
| **Total routes** | **~47 defined + unlimited dynamic** | |

---

## NEW FEATURES (Board + Samer additions, 2026-03-24)

### Feature: Pathfinder (المُرشد)
- Interactive decision tree guiding visitors to the right program/coach
- Individual version: "What do you need?" → branching questions → recommendation
- Corporate version: same pattern + ROI Calculator
- Each answer includes brief explanation + optional 30-60s video
- Tree definition stored in CMS sheet (Hakima can update without code)
- Final recommendation links directly to program/coach/booking page

### Feature: Coach Rating System
- Testimonials include star ratings (1-5) for coaches
- Coach profiles display: aggregate score, review count, badge
- Badge tiers: New (< 5), Rising (5+, 4.0+), Distinguished (20+, 4.5+), Master (50+, 4.8+)
- Ratings visible on coach cards in /coaches directory
- Ratings feed into Pathfinder recommendations

### Feature: Referral & Store Credit System
- Every profile (student, coach, alumni) gets a unique referral code
- Referral links: `?ref=CODE` works on any page
- 30-day cookie attribution window
- On paid conversion → configurable % or flat credit to referrer
- Credit ledger in Supabase (earn/spend/payout entries)
- Dashboard: balance, history, redeem (spend on services or request cash payout)
- Payouts processed via Zoho Books (Amin approval)
- Credits expire after 12 months (configurable via Settings sheet)

### Feature: Scroll-Driven Visual Storytelling
- GSAP ScrollTrigger replaces basic Framer Motion for page narratives
- Homepage: Tree growth narrative (roots → trunk → branches → canopy → sky)
- Landing pages: Islamic architecture narrative (door → corridor → rooms/choices)
- SVG + Canvas for visual assets, scrubbed to scroll position
- Remotion for pre-rendered complex sequences (corridor walk-through)
- Mobile-optimized with GPU-accelerated transforms
- Each narrative tied to brand visual pillars (nature, Islamic architecture, exploration)

### Feature: Marketplace Earnings & Commissions
- Every transaction (service booking, product sale) generates an earnings record
- Gross amount → commission deducted (configurable %) → net to creator
- Commission rates cascade: per-item > per-profile > per-coach-level > global default
- Coach dashboard shows two subtotals: services earnings + product earnings
- Student/community dashboard shows product earnings only
- Payout requests: creator requests → Amin approves → Zoho Books vendor bill → payment
- Minimum payout threshold configurable via Settings sheet
- Admin panel: /admin/commissions for rate management, /admin/payouts for approval queue

### Feature: Deposit & Installment Payments
- Full payment: Stripe / PayTabs (100% upfront)
- Tabby BNPL: 4 installments, Tabby collects from customer (existing D.3)
- Deposit payment: configurable % upfront (e.g., 30%), balance due by date
  - Balance tracked in payment_schedules table
  - Auto-reminders: 7 days before, on due date, grace period
  - Auto-charge saved card (Stripe) or manual reminder
  - Unpaid after grace: access paused, Nashit notified
- Custom installments: 2-6 monthly payments managed by platform
  - Each installment tracked with due_date, amount, status
  - Configurable per-program via Sheet 2 (installment_count, deposit_pct columns)

### Feature: Self-Optimizing Asset Pipeline
- `next/image` + `sharp` for automatic WebP/AVIF, responsive srcsets, lazy loading
- Cloudflare CDN (free tier) in front of Hostinger
- `next/font` with `font-display: swap` for zero layout shift
- Video: `preload="none"` + poster image, lazy loaded
- Lighthouse CI gate: blocks deploy if mobile score < 85
- No raw `<img>` tags ever — all through Next.js Image component
