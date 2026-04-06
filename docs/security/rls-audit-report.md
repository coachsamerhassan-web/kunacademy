# RLS Audit Report — kunacademy.com

**Audited:** 2026-04-04
**Auditor:** Sani' (CTO Agent)
**Source:** All 23 migration files in `/supabase/migrations/`
**Total tables:** 44 (16 initial + 11 EMS + 11 V2 remaining + 6 subsequent migrations, minus 1 dropped)

---

## Summary

| Metric | Count |
|--------|-------|
| Tables with RLS enabled | 43/44 |
| Tables with RLS enabled but NO user-accessible policies | 2 |
| Critical issues found | 4 |
| IDOR risks | 1 |
| Overly permissive INSERT policies | 3 |
| service_role key in server components (Next.js Server Components — not browser) | 2 |

---

## Critical Issues (Fix Immediately)

| # | Table | Issue | Risk | Fix |
|---|-------|-------|------|-----|
| C1 | `availability` | **Table DROPPED** in `20260403000000_cleanup.sql` via `DROP TABLE IF EXISTS availability CASCADE` but RLS was enabled on it in initial migration. Table no longer exists — any code still referencing it will error. | Silent data loss / API errors | Audit all code for `supabase.from('availability')` calls and replace with `coach_schedules` |
| C2 | `book_access` | INSERT policy is `WITH CHECK (true)` — any authenticated OR anonymous user can insert any `book_slug` for any `user_id`. The policy comment says "Service role insert" but it actually allows all roles. | Any user can grant themselves access to any book without purchasing | Change to `WITH CHECK (auth.uid() = user_id)` if self-service, or remove the policy entirely and rely solely on `service_role` for inserts |
| C3 | `pathfinder_responses` | UPDATE policy uses `email = (SELECT email FROM auth.users WHERE id = auth.uid())` — an attacker who knows another user's email (from a prior pathfinder submission by that email) could update that record's `user_id` to link it to their account, then read it. Also, `proposal_pdf_url` is stored in this table which may contain sensitive corporate data. | IDOR: user can hijack another person's pathfinder record and its PDF link | Tighten UPDATE to `USING (user_id = auth.uid())` only; add a separate verified-link endpoint for anonymous → auth linking that requires a signed token |
| C4 | `digital_assets` | RLS is enabled but **only an admin policy exists** (`digital_assets_admin`). There is no SELECT policy for purchasers. The comment says "enforced via download_tokens" but the RLS completely blocks non-admins from ever reading `digital_assets` rows — this means the download flow is broken for real users unless `service_role` is used everywhere. | Functional breakage: legitimate purchasers cannot access their digital products; OR service_role is silently bypassing RLS everywhere (masking this gap) | Add: `CREATE POLICY "purchasers_select" ON digital_assets FOR SELECT USING (EXISTS (SELECT 1 FROM download_tokens dt WHERE dt.asset_id = digital_assets.id AND dt.user_id = auth.uid() AND dt.expires_at > now()))` |

---

## Warnings (Fix Before Launch)

| # | Table | Issue | Risk | Fix |
|---|-------|-------|------|-----|
| W1 | `profiles` | The policy "Providers can read profiles of their booking customers" (migration `20260331000000`) exposes the **entire profile row** including phone, country, and avatar to any user who has any booking with that provider. The comment acknowledges "the policy cannot restrict columns." | Coaches can read customer phone numbers and personal data beyond what is needed | Create a restricted view `booking_customer_summary` with only `id, full_name_ar, full_name_en, email` and expose that instead; or restrict via application layer |
| W2 | `community_posts` | UPDATE policy is `USING (author_id = auth.uid())` with no `WITH CHECK`. This means an author can update their post to set `board_id` to any board (including admin-only boards), effectively moving their post to restricted boards. | Privilege escalation: student moves content into admin-only boards | Add `WITH CHECK (author_id = auth.uid() AND board_id = (SELECT board_id FROM community_posts WHERE id = community_posts.id))` to lock board_id on update |
| W3 | `bookings` | UPDATE policy "Customers can update own bookings" (`WITH CHECK (customer_id = auth.uid())`) has no column restriction. A customer can update `provider_id`, `service_id`, `start_time`, `payment_id`, or any other field — not just `status`. | Customer can reassign their booking to a different coach or alter payment references | Restrict updates to status only: `WITH CHECK (customer_id = auth.uid() AND status IN ('cancelled'))` and use service_role for confirmed/completed transitions |
| W4 | `event_registrations` | UPDATE policy allows update by `email = (SELECT email FROM auth.users WHERE id = auth.uid())`. Any authenticated user with an email matching an anonymous registration can update ALL fields of that registration (including `status`, `payment_id`, `seats`). | A user could mark their own pending_payment registration as 'confirmed' without paying | Restrict UPDATE to only `status = 'cancelled'` via `WITH CHECK`, or split into separate cancel-only policy |
| W5 | `waitlist_entries` | No DELETE policy exists. Waitlisted users cannot remove themselves from the waitlist. Also, the SELECT policy uses `email = (SELECT email FROM auth.users WHERE id = auth.uid())` — fine for known users but anonymous entries have no way to be claimed. | Minor: users cannot self-remove from waitlist; may cause UX issues | Add: `CREATE POLICY "Users can delete own waitlist entries" ON waitlist_entries FOR DELETE USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))` |
| W6 | `is_admin()` function | The initial migration (`20260324010000`) defines `is_admin()` checking `role = 'admin'` only. Migration `20260324020000_ems_schema.sql` redefines it (still `role = 'admin'` only). The correct version checking `role IN ('admin', 'super_admin')` only arrives in `20260405020000_fix_is_admin_and_jwt.sql`. If migrations are run out of order or the latest fix isn't applied, `super_admin` users lose all access. | super_admin role is silently treated as a regular student until the last migration runs | Confirm migration `20260405020000` is applied in production; add a post-deploy test that verifies `is_admin()` returns true for a super_admin user |
| W7 | `admin_audit_log` | No INSERT policy for authenticated users — the table relies entirely on `service_role`. If any audit write path uses the anon or user client instead of the admin client, writes silently fail with no error (RLS blocks, doesn't throw). | Audit log gaps — security events silently dropped | Add explicit error handling in audit write paths; consider a DB trigger-based audit that always runs as SECURITY DEFINER |
| W8 | `webhook_events` | Same as W7: no INSERT policy for authenticated users. If webhook handler somehow uses the user client, events are dropped. | Duplicate payment processing risk if idempotency check fails silently | Verify all webhook routes use `createAdminClient()` (service_role); add a CI test |
| W9 | `custom_benefit_submissions` | Public INSERT `WITH CHECK (true)` allows spam submissions with no rate limiting at DB level. The table has no RLS protection on volume. | Spam / data pollution in your AI training dataset | Add at minimum a rate-limit check via a DB function, or enforce via API middleware |
| W10 | `lesson_syllabus` (VIEW) | `GRANT SELECT ON lesson_syllabus TO anon, authenticated` — this view joins `lessons` to `courses` and exposes lesson titles and durations publicly. The view intentionally omits `video_url`. However, `description_ar` and `description_en` are included, which may contain content previews beyond what is intended for non-enrolled users. | Minor information disclosure | Review whether lesson descriptions should be visible in the syllabus view for non-enrolled users |
| W11 | `enrollments` | The policy "Users can enroll themselves" (`INSERT WITH CHECK (user_id = auth.uid())`) allows any authenticated user to self-enroll in any course — including paid courses — without going through payment. | Free access to paid courses by bypassing checkout | This policy comment says it's "for free course self-enrollment" — it should be restricted to free courses: `WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM courses WHERE id = course_id AND is_free = true))` |

---

## Table-by-Table Status

| Table | RLS | SELECT | INSERT | UPDATE | DELETE | IDOR Safe? | Notes |
|-------|-----|--------|--------|--------|--------|------------|-------|
| `profiles` | YES | Own + provider-for-booking-customers + admin | No policy (trigger only) | Own + admin | Admin only | PARTIAL | Providers see full row of booking customers — see W1 |
| `instructors` | YES | Public (is_visible=true) + admin | Admin only | Admin only | Admin only | YES | OK |
| `payments` | YES | Own (via orders/bookings) + admin | No user policy (service_role) | Admin only | Admin only | YES | No user INSERT = good; service_role creates payments |
| `courses` | YES | Public (is_published=true) + admin | Admin only | Admin only | Admin only | YES | OK |
| `lessons` | YES | Preview-public + enrolled users + admin | Admin only | Admin only | Admin only | YES | Fixed in `20260327010000` — originally dangerously public |
| `enrollments` | YES | Own + admin | Own (any course!) + admin | Own + admin | Admin only | YES | **WARNING W11**: INSERT allows self-enrollment in paid courses |
| `services` | YES | Public (is_active=true) + admin | Admin only | Admin only | Admin only | YES | OK |
| `providers` | YES | Public (is_visible=true) + admin | Admin only | Admin only | Admin only | YES | OK |
| `availability` | **DROPPED** | N/A | N/A | N/A | N/A | N/A | Table dropped in `20260403000000_cleanup.sql` |
| `products` | YES | Public (is_active=true) + admin | Admin only | Admin only | Admin only | YES | OK |
| `orders` | YES | Own + admin | No user policy (service_role) | Admin only | Admin only | YES | OK |
| `order_items` | YES | Own (via orders) + admin | No user policy | Admin only | Admin only | YES | OK |
| `bookings` | YES | Own (customer) + provider + admin | No user policy (service_role creates) | Own + admin | Admin only | YES | **WARNING W3**: UPDATE has no column restriction |
| `posts` | YES | Public (is_published=true) + admin | Admin only | Admin only | Admin only | YES | OK |
| `testimonials` | YES | Public (all) + admin | Admin only | Admin only | Admin only | YES | OK |
| `instructor_drafts` | YES | Own (via instructor) + admin | Own (via instructor) + admin | Own pending + admin | Admin only | YES | OK |
| `lesson_progress` | YES | Own + admin | Own + admin | Own + admin | Admin only | YES | OK |
| `attendance` | YES | Own (via enrollment) + admin | Admin only | Admin only | Admin only | YES | OK |
| `materials` | YES | Enrolled + is_published + admin | Admin only | Admin only | Admin only | YES | OK |
| `certificates` | YES | Own + admin | Admin only | Admin only | Admin only | YES | OK |
| `coach_schedules` | YES | Public (is_active=true) + admin | Own + admin | Own + admin | Own + admin | YES | OK |
| `coach_time_off` | YES | Public (all!) | Own + admin | Own + admin | Own + admin | YES | All time-off readable by anyone — intentional per booking engine |
| `service_categories` | YES | Public (all) + admin | Admin only | Admin only | Admin only | YES | OK |
| `community_boards` | YES | General/announcements public; cohort = members only + admin | Admin only | Admin only | Admin only | YES | OK |
| `board_members` | YES | Public (all) + admin | Admin only | Admin only | Admin only | YES | Minor: everyone can see who is in which board |
| `community_posts` | YES | Board member or public board + admin | Board member or admin | Own only + admin | Admin only | PARTIAL | **WARNING W2**: UPDATE allows changing board_id |
| `community_reactions` | YES | Public (all) + admin | Own + admin | No policy | Own delete + admin | YES | OK |
| `coach_ratings` | YES | Public (is_published) + own (user or coach) + admin | Own (completed booking required) + admin | Admin only | Admin only | YES | Good — insert gated on completed booking |
| `coach_badges` | YES | Public (all) + admin | Admin/trigger only | Admin/trigger only | Admin only | YES | Written by SECURITY DEFINER trigger — OK |
| `referral_codes` | YES | Own + admin | No user policy | No user policy | Admin only | YES | Users cannot create their own referral codes — may be intentional |
| `credit_transactions` | YES | Own + admin | No user policy | No user policy | No user policy | YES | All writes via service_role — OK |
| `blog_posts` | YES | Public (is_published) + own (author) + admin | Admin only | Admin only | Admin only | YES | OK |
| `digital_assets` | YES | **Admin only — no user policy** | Admin only | Admin only | Admin only | NO | **CRITICAL C4**: users cannot access their purchased digital assets |
| `download_tokens` | YES | Own + admin | No user policy (service_role) | No user policy | No user policy | YES | OK — tokens created by service_role after purchase |
| `commission_rates` | YES | Own (scope='coach') + global + admin | Admin only | Admin only | Admin only | YES | Fixed in `20260326010000` — scope check corrected |
| `earnings` | YES | Own + admin | No user policy | No user policy | No user policy | YES | OK — earnings written by service_role |
| `payout_requests` | YES | Own + admin | Own + admin | Admin only | No user policy | YES | `bank_details` JSONB added — contains IBAN data, admin-only access confirmed |
| `payment_schedules` | YES | Own + admin | No user policy | No user policy | No user policy | YES | OK |
| `book_access` | YES | Own + admin | **`WITH CHECK (true)` — any user/anon** | No user policy | No user policy | NO | **CRITICAL C2**: any caller can insert book_access for any user |
| `pathfinder_responses` | YES | Own + admin | Public (anyone) | Own by uid OR email | No user policy | PARTIAL | **CRITICAL C3**: UPDATE by email enables hijacking another user's record |
| `custom_benefit_submissions` | YES | Admin only | Public (anyone) | No user policy | No user policy | YES | Spam risk — no rate limit |
| `event_registrations` | YES | Own (uid or email) + admin | Public (anyone) | Own (uid or email) + admin | No user policy | PARTIAL | **WARNING W4**: UPDATE unrestricted on fields |
| `waitlist_entries` | YES | Own (by email) + admin | Public (anyone) | Admin only | **No policy** | YES | Users cannot remove themselves |
| `admin_audit_log` | YES | Admin only | **No policy** | No policy | No policy | YES | Only service_role can write — intended, but risky if misconfigured |
| `webhook_events` | YES | Admin only | **No policy** | No policy | No policy | YES | Only service_role can write — intended |
| `course_sections` | YES | Published course sections + admin | Admin only | Admin only | Admin only | YES | OK |

---

## service_role Key Exposure Check

### Search scope
- `/apps/web/src/app/` — all pages and API routes
- `/apps/web/src/components/`
- `/packages/ui/`

### Results

**Server Components using `SUPABASE_SERVICE_ROLE_KEY` (NOT browser-exposed):**

| File | Usage | Risk Assessment |
|------|-------|-----------------|
| `/apps/web/src/app/[locale]/pathfinder/results/page.tsx` | `createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)` — fetches `pathfinder_responses` by ID, bypassing RLS | This is a Next.js **Server Component** (`async function` + `await params`). The key is accessed via `process.env` on the server. It is NOT exposed to the browser. **However:** the page fetches a pathfinder record by `id` (UUID from query string) with no auth check — any user who guesses or shares a `?id=` UUID can view that pathfinder result including name, email, phone, and recommendation data. |
| `/apps/web/src/app/[locale]/community/[slug]/page.tsx` | `createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)` in `getProfile()` — fetches profile + instructor data | This is a Next.js **Server Component**. Key is server-side only. **However:** the `getProfile(slug)` function uses `service_role` to fetch profiles by UUID slug with `select('*')` — this exposes phone number and country in the server-side render even though only name is displayed. If the rendering logic changes, sensitive fields could leak. |

**API Routes using `SUPABASE_SERVICE_ROLE_KEY` (server-side, expected):**

All files under `/apps/web/src/app/api/` are Next.js Route Handlers (server-only). Their use of `SUPABASE_SERVICE_ROLE_KEY` is architecturally correct and not browser-exposed.

**`/packages/ui/` — CLEAR.** No matches found. The UI package does not reference `service_role`.

**`/apps/web/src/components/` — CLEAR.** No matches found.

### Verdict

The `service_role` key is **not directly browser-exposed**. However, two server component patterns warrant hardening (see R3 and R4 in recommendations below).

---

## Recommendations (Prioritized)

### P0 — Fix Before Any Public Traffic

**R1. Fix `book_access` INSERT policy (Critical C2)**
```sql
-- Drop the permissive policy
DROP POLICY "Service role insert" ON book_access;
-- No replacement needed — service_role bypasses RLS automatically.
-- If frontend needs self-service: WITH CHECK (auth.uid() = user_id)
```

**R2. Fix `digital_assets` — add purchaser SELECT policy (Critical C4)**
```sql
CREATE POLICY "Purchasers can read own digital assets" ON digital_assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM download_tokens dt
      WHERE dt.asset_id = digital_assets.id
        AND dt.user_id = auth.uid()
        AND dt.expires_at > now()
        AND dt.download_count < dt.max_downloads
    )
  );
```

**R3. Fix `pathfinder_responses` UPDATE hijack vulnerability (Critical C3)**
```sql
DROP POLICY "Users can update own pathfinder responses" ON pathfinder_responses;
CREATE POLICY "Users can update own pathfinder responses" ON pathfinder_responses
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- For anonymous → auth linking, implement a separate server-side API route
-- that validates a signed token before calling service_role to set user_id.
```

**R4. Fix `pathfinder/results/page.tsx` — unauthenticated record exposure**

The page fetches a full pathfinder record (name, email, phone, recommendations) by UUID alone. An attacker who obtained or guessed a UUID can view anyone's personal data.

```typescript
// Add auth check before fetching
const { data: { user } } = await supabase.auth.getUser(); // use anon client
// Then verify: response.user_id === user?.id OR response.email === user?.email
// before rendering. Redirect to /pathfinder if mismatch.
```

**R5. Fix `enrollments` INSERT — restrict to free courses only (Warning W11)**
```sql
DROP POLICY "Users can enroll themselves" ON enrollments;
CREATE POLICY "Users can self-enroll in free courses only" ON enrollments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM courses WHERE id = course_id AND is_free = true AND is_published = true
    )
  );
-- All paid-course enrollments must go through service_role (checkout webhook).
```

### P1 — Fix Before Beta Launch

**R6. Fix `bookings` UPDATE — restrict to status='cancelled' only (Warning W3)**
```sql
DROP POLICY "Customers can update own bookings" ON bookings;
CREATE POLICY "Customers can cancel own bookings" ON bookings
  FOR UPDATE
  USING (customer_id = auth.uid() AND status IN ('pending', 'confirmed'))
  WITH CHECK (customer_id = auth.uid() AND status = 'cancelled');
```

**R7. Fix `community_posts` UPDATE — lock board_id (Warning W2)**
```sql
DROP POLICY "posts_own_update" ON community_posts;
CREATE POLICY "posts_own_update" ON community_posts
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (
    author_id = auth.uid()
    AND board_id = (SELECT board_id FROM community_posts cp WHERE cp.id = community_posts.id)
  );
```

**R8. Fix `event_registrations` UPDATE — restrict to cancellation only (Warning W4)**
```sql
DROP POLICY "Users can cancel own event registrations" ON event_registrations;
CREATE POLICY "Users can cancel own event registrations" ON event_registrations
  FOR UPDATE
  USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (status = 'cancelled');
```

**R9. Add `waitlist_entries` DELETE policy for users (Warning W5)**
```sql
CREATE POLICY "Users can remove own waitlist entries" ON waitlist_entries
  FOR DELETE USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
```

**R10. Harden `community/[slug]/page.tsx` — select only needed columns**

Change `select('*')` to `select('id, full_name_ar, full_name_en, email, role, avatar_url, country')` in `getProfile()`. This prevents accidental rendering of `phone` or future sensitive columns added to `profiles`.

### P2 — Security Hygiene

**R11. Verify `is_admin()` includes `super_admin` in production**

Confirm migration `20260405020000_fix_is_admin_and_jwt.sql` has been applied. Run:
```sql
SELECT proname, prosrc FROM pg_proc WHERE proname = 'is_admin';
-- Must contain: role IN ('admin', 'super_admin')
```

**R12. Add rate limiting on public INSERT tables**

Tables with `WITH CHECK (true)` INSERT policies (`pathfinder_responses`, `event_registrations`, `waitlist_entries`, `custom_benefit_submissions`) should have API-level rate limiting (e.g., Vercel Edge Middleware + IP-based limits) to prevent abuse.

**R13. Replace `NEXT_PUBLIC_SUPABASE_URL` + `SERVICE_ROLE_KEY` pattern in Server Components**

Move `service_role` client creation to a shared server-only helper (`lib/supabase/admin.ts`) with `import 'server-only'` guard. This prevents accidental client-side import in future refactors.

**R14. Confirm `availability` table removal is complete**

Search the full codebase for `from('availability')` and remove or update to `coach_schedules`:
```bash
grep -r "from('availability')" apps/ packages/
```

**R15. Document the `admin_audit_log` / `webhook_events` write-only-via-service-role pattern**

Add a code comment or assertion in `packages/db/src/audit.ts` and the webhook routes confirming they use the admin client. A future developer using the user client will cause silent audit gaps.

---

## Risk Summary Matrix

| Issue | Exploitable without auth? | Exploitable by authenticated user? | Data exposed |
|-------|--------------------------|-------------------------------------|--------------|
| C2 book_access | YES | YES | Free access to paid book content |
| C3 pathfinder UPDATE hijack | NO | YES (email knowledge required) | Name, email, phone, recommendations, PDF URL |
| C4 digital_assets no SELECT | N/A | N/A | Functional breakage only |
| W11 free enrollment in paid courses | NO | YES | Financial loss (course revenue bypass) |
| W3 bookings unrestricted UPDATE | NO | YES | Payment reference manipulation |
| W4 event_registrations UPDATE | NO | YES | Confirm self as paid without payment |
| Pathfinder results page no auth check | YES (UUID guessing) | YES | Personal PII + assessment data |

---

*Report generated by automated audit of all 23 migration files. No production database was queried.*
