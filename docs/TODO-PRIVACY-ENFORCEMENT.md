# TODO: Privacy Enforcement for Coach Ratings Display Endpoints

**Wave:** S9 (Display Endpoints)
**Added:** 2026-04-20
**Schema:** `packages/db/src/schema/coach_ratings.ts` — `privacy` column

**Status 2026-04-20 13:25Z:** Primary spec SHIPPED (99049c5). 4 endpoints live with privacy enforcement. Remaining defense-in-depth follow-up below.

## Remaining hardening (future migration)

Adversarial QA surfaced that public endpoints currently rely solely on WHERE-clause filtering — no RLS policy backstops. Future work:

```sql
-- Add anon read policy that only exposes public rows
ALTER TABLE coach_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY coach_ratings_anon_public_read
  ON coach_ratings FOR SELECT
  TO anon
  USING (privacy = 'public');
-- Then swap withAdminContext → default db in public GET routes
```

This lets a future bug in the WHERE clause not leak private rows — belt-and-suspenders. Deferred because public endpoints now correctly filter; this is defense-in-depth, not a live security hole.

**Correction 2026-04-20:** Adversarial QA H1 said "no RLS policy exists on coach_ratings" — this was incorrect. 4 policies are LIVE (`coach_ratings_public_select`, `_admin`, `_own_select`, `_own_insert`). The public endpoints now filter by BOTH `privacy='public'` AND `is_published=true` to match the RLS gate exactly, eliminating drift risk. No new migration required.

## Requirement

When any rating display or aggregation endpoint is built, it MUST enforce the `privacy` column:

- `GET /api/coaches/[id]/ratings` (or similar public-facing endpoint)
  - Return ONLY rows where `privacy = 'public'`
  - Aggregate averages (avg rating, count) may include private ratings for numeric accuracy, but MUST NOT surface private review text or identifiable data

- `GET /api/portal/bookings/[id]/rating` (client's own rating)
  - Allow the client who submitted the rating to view it regardless of `privacy` value

- `GET /api/admin/coach-ratings` (admin audit view)
  - Admin may see all ratings regardless of `privacy` value

## Anti-pattern to avoid

```ts
// WRONG — exposes private ratings to public
const ratings = await db.select().from(coach_ratings).where(eq(coach_ratings.coach_id, coachId));

// CORRECT — filter by privacy for public endpoints
const ratings = await db.select().from(coach_ratings).where(
  and(eq(coach_ratings.coach_id, coachId), eq(coach_ratings.privacy, 'public'))
);
```

## References

- Schema: `packages/db/src/schema/coach_ratings.ts`
- Migration: `packages/db/drizzle/0023_*` (Wave S9 coach ratings)
- DeepSeek QA finding: MED — privacy flag not enforced (no display endpoint yet, document for Wave S9)
