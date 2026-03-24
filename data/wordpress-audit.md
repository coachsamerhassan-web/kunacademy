# WordPress Infrastructure Audit — kunacademy.com
# Date: 2026-03-24
# Audited by: Sani (CTO)

## PLUGIN STACK (32 active plugins)

### Core Business Logic
| Plugin | Version | Role |
|--------|---------|------|
| Tutor LMS | 3.9.7 | Course management, enrollment, progress |
| Tutor Pro | 3.5.0 | Advanced LMS features |
| Tutor Certificate Builder | 1.3.0 | Certificate generation |
| Tutor Stripe | 1.0.3 | LMS payment via Stripe |
| Amelia Booking | 9.2 | Session booking, provider scheduling |
| WooCommerce | 10.6.1 | Shop, products, checkout |
| WooCommerce Stripe | 10.5.2 | Payment gateway |
| PayTabs WooCommerce | 5.7.3 | Gulf payment gateway |
| Tabby Checkout | 5.9.2 | BNPL (Buy Now Pay Later) |

### Content & i18n
| Plugin | Version | Role |
|--------|---------|------|
| Bricks Builder (theme) | — | Page builder (all pages) |
| Bricksable | 1.6.83 | Bricks extensions |
| WPML + 6 addons | 4.9.2 | Bilingual AR/EN |
| H5P | 1.17.4 | Interactive content |
| dFlip | 2.4.13 | Flipbook viewer |
| kun-testimonials | 0.1.0 | Custom testimonial CPT |

### Integrations
| Plugin | Version | Role |
|--------|---------|------|
| Meta Pixel | 4.1.5 | Facebook tracking |
| Google Site Kit | 1.174.0 | GA4 + Search Console |
| Zoho Flow | 2.14.2 | Zoho CRM integration |
| WP Mail SMTP Pro | 4.7.1 | Email delivery |
| Bosta WooCommerce | 4.5.3 | Shipping (Egypt) |

---

## CONTENT INVENTORY

### Pages: 29 published
Key pages: Homepage, About, Contact, FAQ, Privacy, Terms, Cookies, Support,
Community, Programs, Events, Dashboard, Booking, Cart, Checkout, Coach Team,
Instructor Registration, Login, Student Registration, Course Library, My Library,
My Bookings, My Schedule, Mentoring Sessions

### Blog Posts: 2 published
- إحياء النفس (Reviving the Soul)
- إحياء الجسد (Reviving the Body)

### WooCommerce Products: 5 published (AR) + bilingual WPML duplicates
| Product | Price (AED) |
|---------|------------|
| إحياء الجسد [٢٠٢٥/١١] | 4,800 (retreat) |
| كتاب التوازن إلى البركة (مطبوعة) | 100 |
| كتاب التوازن إلى البركة (إلكترونية) | 76 |
| حجز (Appointment — via Amelia bridge) | 0 |

### Testimonials: 888 published (custom post type: kun_testimonial)

---

## TUTOR LMS STRUCTURE

### Courses: 6 published
| ID | Title | Type | Product |
|----|-------|------|---------|
| 8297 | الطريق إلى المنهج الأصيل (ورشة) | Free | — |
| 2819 | كتاب من التوازن إلى البركة (عينة) | Free | — |
| 7098 | كتاب من التوازن إلى البركة (كاملة) | Paid | WC #7100 |
| 4208 | براند يمتد من هويتك الأصيلة | Paid | — |
| 4149 | رحلة كوتش التفكير الحسي (تأسيسي) | Paid | — |
| 4101 | مقدمة رحلة كوتش التفكير الحسي | Paid | — |

### Hierarchy: Course → Topics → Lessons
- Course 4149 (STCE Foundation): 9 topics, 28+ lessons
- Course 4101 (Intro): 2 topics, 10+ lessons
- Course 8297 (Workshop): 1 topic, 1 lesson
- Course 2819 (Book sample): 3 topics, 3 lessons
- Total: ~52 lessons across all courses

### Enrollment: 0 via Tutor Orders (uses WooCommerce bridge)
### Quizzes: 0 published
### Certificates: via Tutor Certificate Builder (1 template)

---

## AMELIA BOOKING SYSTEM

### Service Categories: 2
1. **باحث عن التطور** (Development Seeker) — external clients
2. **كوتش دارس في كُنْ** (Kun Student Coach) — internal students

### Services: 10
| Service | Price (AED) | Duration | Category |
|---------|------------|----------|----------|
| جلسة كوتشينج فردية | 0 (custom) | 60 min | External |
| جلسة استكشافية | 0 (free) | 60 min | External |
| جلسة منتورينج معتمدة | 0 (custom) | 90 min | External |
| جلسة كوتشينج للدارسين | 300 | 60 min | Student |
| منتورينج L1 (1st) | 400 | 60 min | Student |
| منتورينج L1 (2nd) | 400 | 60 min | Student |
| منتورينج L1 (3rd) | 600 | 60 min | Student |
| منتورينج L2 (1st) | 400 | 60 min | Student |
| منتورينج L2 (2nd) | 400 | 60 min | Student |
| منتورينج L2 (3rd) | 400 | 60 min | Student |

### Providers: 25 total (12 visible, 13 hidden)
- Samer Hassan (lead)
- 11 active coaches (PCC-level, various nationalities)
- 13 hidden/inactive coaches

### Booking Stats:
- Total bookings: 97
- Payment via WooCommerce: 50 (AED 159,694.60 total)
- Payment on-site: 47

### Key Amelia Features Used:
- Provider-to-service mapping
- WooCommerce payment bridge
- Custom fields on bookings
- Categories with bilingual translations
- Provider locations

---

## WHAT NEEDS TO BE REBUILT (Complexity Assessment)

### HIGH COMPLEXITY (the real work)

1. **LMS System** (replacing Tutor LMS)
   - Course → Topic → Lesson hierarchy with ordering
   - Video lesson player with progress tracking
   - Course enrollment via payment
   - Certificate generation on completion
   - Student dashboard: enrolled courses, progress bars, resume
   - H5P interactive content support (or alternative)
   - 52+ lessons with video/text content migration

2. **Booking System** (replacing Amelia)
   - 2 service categories with different pricing
   - 10 service types with variable duration/pricing
   - 12+ provider profiles with availability schedules
   - Provider-to-service assignment
   - Calendar availability with day-off management
   - WooCommerce payment bridge (→ Stripe/PayTabs)
   - Customer booking management
   - Bilingual service names

3. **Multicurrency Payments** (replacing WooCommerce + Stripe + PayTabs + Tabby)
   - 3 currencies: AED (primary), EGP, USD/EUR
   - 3 gateways: Stripe (international), PayTabs (Gulf), Tabby (BNPL)
   - Course purchases (LMS enrollment trigger)
   - Session booking payments (Amelia bridge)
   - Product purchases (books, retreats)
   - Invoice generation
   - Refund handling

### MEDIUM COMPLEXITY

4. **Coach Portal** (replacing WP instructor roles)
   - Profile with credentials, photo, specialties
   - Availability management
   - Booking dashboard (upcoming, past)
   - Earnings/payout tracking
   - Approval queue for profile edits

5. **Testimonial System** (888 records)
   - Custom post type migration
   - Rating, program, photo, video fields
   - Display on relevant program pages

6. **WPML Content** (bilingual)
   - All pages have AR/EN versions via WPML
   - WPML string translations
   - Product translations

### LOW COMPLEXITY (content migration)

7. **Static pages**: 29 pages → scrape and port content
8. **Blog posts**: 2 posts → direct migration
9. **Products**: 5 products → Supabase products table
10. **Course content**: 6 courses, 52 lessons → Supabase
