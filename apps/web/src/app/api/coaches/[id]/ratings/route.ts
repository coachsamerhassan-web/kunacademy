/**
 * GET /api/coaches/[id]/ratings
 *
 * Public endpoint — no auth required.
 * Returns paginated list of PUBLIC ratings for a coach.
 * CRITICAL: Only rows where privacy = 'public' are returned.
 *
 * Query params:
 *   - page     (default 1)
 *   - pageSize (default 10, max 50)
 *
 * Response:
 *   { ratings: [{id, stars, review_text, created_at, client_name_display}], total_public }
 *
 * client_name_display: first name + last initial (e.g. "Samer H.") or "Anonymous"
 * Full identity is NOT exposed.
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext, eq, and } from '@kunacademy/db';
import { coach_ratings, profiles } from '@kunacademy/db/schema';
import { desc, sql } from 'drizzle-orm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

// Honorifics to strip (case-insensitive). Both English and Arabic forms.
const HONORIFICS = new Set([
  'dr', 'dr.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'prof', 'prof.',
  'eng', 'eng.', 'coach',
  'د', 'د.', 'دكتور', 'دكتورة', 'كوتش', 'أستاذ', 'أستاذة', 'م', 'م.', 'مهندس', 'مهندسة',
]);

/**
 * Build a display-safe client name: "First L." or "Anonymous".
 * Strips leading honorifics (Arabic + English) before masking.
 * Prefers English name; falls back to Arabic name; falls back to "Anonymous".
 */
function buildClientNameDisplay(
  fullNameEn: string | null | undefined,
  fullNameAr: string | null | undefined,
): string {
  const raw = (fullNameEn || fullNameAr || '').trim();
  if (!raw) return 'Anonymous';

  // Tokenise and strip leading honorifics
  let parts = raw.split(/\s+/).map((t) => t.replace(/\.$/, '').trim()).filter(Boolean);
  while (parts.length > 0 && HONORIFICS.has(parts[0].toLowerCase())) {
    parts = parts.slice(1);
  }

  if (parts.length === 0) return 'Anonymous';
  if (parts.length === 1) return parts[0]; // Single given name — return as-is
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${first} ${lastInitial}.`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: coachId } = await context.params;

    // Validate UUID
    if (!UUID_RE.test(coachId)) {
      return NextResponse.json({ error: 'Invalid coach id — must be a UUID' }, { status: 400 });
    }

    // Pagination
    const { searchParams } = new URL(request.url);
    const pageRaw = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSizeRaw = parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10);

    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(pageSizeRaw, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    // Verify coach exists — role must be 'coach' to prevent user enumeration
    const coachRows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.id, coachId), eq(profiles.role, 'coach')))
      .limit(1);

    if (!coachRows[0]) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    // Fetch public ratings with client profile for display name
    // Use withAdminContext to bypass RLS (app role kunacademy has RLS on coach_ratings)
    const rows = await withAdminContext(async (adminDb) => {
      return adminDb
        .select({
          id: coach_ratings.id,
          stars: coach_ratings.rating,
          review_text: coach_ratings.review_text,
          created_at: coach_ratings.created_at,
          rated_at: coach_ratings.rated_at,
          client_full_name_en: profiles.full_name_en,
          client_full_name_ar: profiles.full_name_ar,
        })
        .from(coach_ratings)
        .leftJoin(profiles, eq(coach_ratings.user_id, profiles.id))
        .where(
          and(
            eq(coach_ratings.coach_id, coachId),
            eq(coach_ratings.privacy, 'public'),
            eq(coach_ratings.is_published, true),
          ),
        )
        .orderBy(desc(coach_ratings.rated_at))
        .limit(pageSize)
        .offset(offset);
    });

    // Count total public ratings
    const countRows = await withAdminContext(async (adminDb) => {
      return adminDb
        .select({ total: sql<number>`count(*)::int` })
        .from(coach_ratings)
        .where(
          and(
            eq(coach_ratings.coach_id, coachId),
            eq(coach_ratings.privacy, 'public'),
            eq(coach_ratings.is_published, true),
          ),
        );
    });

    const total_public = countRows[0]?.total ?? 0;

    type RatingRow = {
      id: string;
      stars: number;
      review_text: string | null;
      created_at: string | null;
      rated_at: string | null;
      client_full_name_en: string | null;
      client_full_name_ar: string | null;
    };

    const ratings = (rows as RatingRow[]).map((r) => ({
      id: r.id,
      stars: r.stars,
      review_text: r.review_text,
      created_at: r.rated_at ?? r.created_at,
      client_name_display: buildClientNameDisplay(r.client_full_name_en, r.client_full_name_ar),
    }));

    return NextResponse.json({ ratings, total_public });
  } catch (err: any) {
    console.error('[api/coaches/[id]/ratings GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
