/**
 * GET /api/admin/audio-exchanges/[id]
 *
 * Returns a single audio-exchange row.
 *
 * Auth: admin + super_admin only.
 *
 * LESSON-BLOCKS Session A — 2026-04-22
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { profiles, lesson_audio_exchanges } from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';
import { eq } from 'drizzle-orm';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return { kind: 'unauthenticated' as const };
  if (user.role && ADMIN_ROLES.has(user.role)) return { kind: 'ok' as const, user };
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const role = rows[0]?.role ?? '';
  if (!ADMIN_ROLES.has(role)) return { kind: 'forbidden' as const };
  return { kind: 'ok' as const, user };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const rows = await withAdminContext(async (adminDb) =>
      adminDb
        .select()
        .from(lesson_audio_exchanges)
        .where(eq(lesson_audio_exchanges.id, id))
        .limit(1)
    );

    const exchange = rows[0];
    if (!exchange) {
      return NextResponse.json({ error: 'Audio exchange not found' }, { status: 404 });
    }
    return NextResponse.json({ exchange });
  } catch (err: any) {
    console.error('[api/admin/audio-exchanges/[id] GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
