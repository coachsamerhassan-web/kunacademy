# TODO: Privacy Enforcement for Coach Ratings Display Endpoints

**Wave:** S9 (Display Endpoints)
**Added:** 2026-04-20
**Schema:** `packages/db/src/schema/coach_ratings.ts` — `privacy` column

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
