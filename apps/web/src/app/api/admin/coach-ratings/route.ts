/**
 * GET /api/admin/coach-ratings
 *
 * Admin endpoint — admin/super_admin auth required.
 * Returns paginated list of ALL ratings (public + private) for audit purposes.
 *
 * Query params (all optional):
 *   - coach_id  <uuid>        — filter by coach
 *   - privacy   public|private — filter by privacy value
 *   - page      (default 1)
 *   - pageSize  (default 20, max 100)
 *
 * Auth:
 *   - 401 if unauthenticated
 *   - 403 if authenticated but not admin/super_admin
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext, eq, and } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { coach_ratings, profiles } from '@kunacademy/db/schema';
import { alias } from 'drizzle-orm/pg-core';
import { desc, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Aliased profile tables for the two LEFT JOINs
const coachProfile = alias(profiles, 'coach_profile');
const clientProfile = alias(profiles, 'client_profile');

// Discriminated result — avoids calling getAuthUser() twice (M4 fix)
type AdminAuthResult =
  | { kind: 'ok'; user: Awaited<ReturnType<typeof getAuthUser>> & {} }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' };

async function requireAdmin(): Promise<AdminAuthResult> {
  const user = await getAuthUser();
  if (!user) return { kind: 'unauthenticated' };
  // Prefer role on auth user; fall back to profiles table query
  if (user.role && ADMIN_ROLES.has(user.role)) return { kind: 'ok', user };
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const role = rows[0]?.role ?? '';
  if (!ADMIN_ROLES.has(role)) return { kind: 'forbidden' };
  return { kind: 'ok', user };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    // Optional filters
    const coachIdParam = searchParams.get('coach_id');
    const privacyParam = searchParams.get('privacy'); // 'public' | 'private'

    // Pagination
    const pageRaw = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSizeRaw = parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10);
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(pageSizeRaw, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    // Validate optional UUID
    if (coachIdParam && !UUID_RE.test(coachIdParam)) {
      return NextResponse.json({ error: 'Invalid coach_id — must be a UUID' }, { status: 400 });
    }

    // Build WHERE conditions
    const conditions: SQL[] = [];
    if (coachIdParam) {
      conditions.push(eq(coach_ratings.coach_id, coachIdParam));
    }
    if (privacyParam === 'public' || privacyParam === 'private') {
      conditions.push(eq(coach_ratings.privacy, privacyParam));
    }

    const whereClause = conditions.length > 0
      ? conditions.length === 1 ? conditions[0] : and(...conditions)
      : undefined;

    // Fetch ratings (all — no privacy filter) with coach + client name enrichment
    const rows = await withAdminContext(async (adminDb) => {
      const q = adminDb
        .select({
          id: coach_ratings.id,
          coach_id: coach_ratings.coach_id,
          user_id: coach_ratings.user_id,
          booking_id: coach_ratings.booking_id,
          stars: coach_ratings.rating,
          review_text: coach_ratings.review_text,
          privacy: coach_ratings.privacy,
          is_published: coach_ratings.is_published,
          rated_at: coach_ratings.rated_at,
          created_at: coach_ratings.created_at,
          // Name enrichment via LEFT JOINs — nullable
          coach_full_name_en: coachProfile.full_name_en,
          coach_full_name_ar: coachProfile.full_name_ar,
          client_full_name_en: clientProfile.full_name_en,
          client_full_name_ar: clientProfile.full_name_ar,
        })
        .from(coach_ratings)
        .leftJoin(coachProfile, eq(coach_ratings.coach_id, coachProfile.id))
        .leftJoin(clientProfile, eq(coach_ratings.user_id, clientProfile.id))
        .orderBy(desc(coach_ratings.rated_at))
        .limit(pageSize)
        .offset(offset);

      return whereClause ? q.where(whereClause) : q;
    });

    // Total count
    const countRows = await withAdminContext(async (adminDb) => {
      const q = adminDb
        .select({ total: sql<number>`count(*)::int` })
        .from(coach_ratings);

      return whereClause ? q.where(whereClause) : q;
    });

    const total = countRows[0]?.total ?? 0;

    return NextResponse.json({
      ratings: rows,
      total,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error('[api/admin/coach-ratings GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
