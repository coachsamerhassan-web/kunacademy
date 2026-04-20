/**
 * POST /api/admin/coach-ratings/[id]/publish
 *
 * Admin-only mutation — toggle is_published on a coach_rating row.
 *
 * Auth: admin/super_admin only. 401 / 403 shapes match /api/admin/coach-ratings.
 *
 * URL param:  id   — UUID of the coach_rating
 * Body:       { is_published: boolean }
 *
 * Returns the updated row: { id, is_published, coach_id, updated_at }
 *
 * Audit log: RATING_PUBLISH_TOGGLE — actor_id, rating id, old/new is_published, coach_id.
 *
 * Wave S9 — 2026-04-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext, eq, logAdminAction } from '@kunacademy/db';
import { coach_ratings, profiles } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

// ── requireAdmin — copied verbatim from /api/admin/coach-ratings/route.ts ──────

type AdminAuthResult =
  | { kind: 'ok'; user: Awaited<ReturnType<typeof getAuthUser>> & {} }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' };

async function requireAdmin(): Promise<AdminAuthResult> {
  const user = await getAuthUser();
  if (!user) return { kind: 'unauthenticated' };
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

// ── Route ──────────────────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Validate route param
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id — must be a UUID' }, { status: 400 });
    }

    // Auth
    const authResult = await requireAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const actor = authResult.user;

    // Parse + validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
    }

    const rawBody = body as Record<string, unknown>;
    if (typeof rawBody.is_published !== 'boolean') {
      return NextResponse.json(
        { error: 'is_published must be a boolean' },
        { status: 400 },
      );
    }
    const newIsPublished: boolean = rawBody.is_published;

    // Load existing row (need coach_id + current is_published for audit log)
    const existing = await withAdminContext(async (db) => {
      return db
        .select({
          id:           coach_ratings.id,
          is_published: coach_ratings.is_published,
          coach_id:     coach_ratings.coach_id,
        })
        .from(coach_ratings)
        .where(eq(coach_ratings.id, id))
        .limit(1);
    });

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Rating not found' }, { status: 404 });
    }

    const prior = existing[0];

    // UPDATE
    const now = new Date().toISOString();
    const updated = await withAdminContext(async (db) => {
      return db
        .update(coach_ratings)
        .set({ is_published: newIsPublished })
        .where(eq(coach_ratings.id, id))
        .returning({
          id:           coach_ratings.id,
          is_published: coach_ratings.is_published,
          coach_id:     coach_ratings.coach_id,
        });
    });

    const row = { ...updated[0], toggled_at: now };

    // Audit log — non-blocking
    void logAdminAction({
      adminId:    actor.id,
      action:     'RATING_PUBLISH_TOGGLE',
      targetType: 'coach_rating',
      targetId:   id,
      metadata:   {
        old_is_published: prior.is_published,
        new_is_published: newIsPublished,
        coach_id:         prior.coach_id,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    });

    return NextResponse.json(row, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/coach-ratings/[id]/publish POST]', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
