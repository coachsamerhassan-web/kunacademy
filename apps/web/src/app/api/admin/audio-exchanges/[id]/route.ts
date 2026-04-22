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
import { eq, sql } from 'drizzle-orm';

const VALID_RESPONSE_MODES = new Set(['audio_only', 'text_only', 'either']);

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

// ─── PATCH /api/admin/audio-exchanges/[id] ────────────────────────────────
// Update an exchange. Creator or admin only (D4e=i, RLS on Session A schema).
export async function PATCH(
  request: NextRequest,
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
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const existingRows = await withAdminContext(async (adminDb) =>
      adminDb
        .select()
        .from(lesson_audio_exchanges)
        .where(eq(lesson_audio_exchanges.id, id))
        .limit(1)
    );
    const existing = existingRows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Audio exchange not found' }, { status: 404 });
    }

    const isAdmin =
      authResult.user.role === 'admin' || authResult.user.role === 'super_admin';
    if (!isAdmin && existing.created_by && existing.created_by !== authResult.user.id) {
      return NextResponse.json(
        { error: 'Only the exchange creator or an admin can edit this exchange' },
        { status: 403 }
      );
    }

    const patch: Record<string, unknown> = { updated_at: sql`NOW()` };
    if (typeof body.prompt_audio_url === 'string' && body.prompt_audio_url.trim()) {
      patch.prompt_audio_url = body.prompt_audio_url.trim();
    }
    if (typeof body.prompt_duration_sec === 'number' || body.prompt_duration_sec === null) {
      patch.prompt_duration_sec = body.prompt_duration_sec;
    }
    if (typeof body.prompt_transcript_ar === 'string' || body.prompt_transcript_ar === null) {
      patch.prompt_transcript_ar = body.prompt_transcript_ar;
    }
    if (typeof body.prompt_transcript_en === 'string' || body.prompt_transcript_en === null) {
      patch.prompt_transcript_en = body.prompt_transcript_en;
    }
    if (typeof body.instructions_ar === 'string' || body.instructions_ar === null) {
      patch.instructions_ar = body.instructions_ar;
    }
    if (typeof body.instructions_en === 'string' || body.instructions_en === null) {
      patch.instructions_en = body.instructions_en;
    }
    if (VALID_RESPONSE_MODES.has(body.response_mode)) {
      patch.response_mode = body.response_mode;
    }
    if (typeof body.response_time_limit_sec === 'number' || body.response_time_limit_sec === null) {
      patch.response_time_limit_sec = body.response_time_limit_sec;
    }
    if (typeof body.requires_review === 'boolean') {
      patch.requires_review = body.requires_review;
    }

    const updated = await withAdminContext(async (adminDb) =>
      adminDb
        .update(lesson_audio_exchanges)
        .set(patch as any)
        .where(eq(lesson_audio_exchanges.id, id))
        .returning()
    );
    return NextResponse.json({ exchange: updated[0] });
  } catch (err: any) {
    console.error('[api/admin/audio-exchanges/[id] PATCH]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/admin/audio-exchanges/[id] ───────────────────────────────
// Delete an exchange. Blocks referencing it get audio_exchange_id=null via
// the ON DELETE SET NULL FK on lesson_blocks.audio_exchange_id. Note: those
// orphaned blocks will fail the lesson_blocks_ref_integrity_check (block_type
// = 'audio_exchange' requires non-null audio_exchange_id). Caller must
// reassign or delete those blocks first — we pre-check and surface 409.
export async function DELETE(
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

    const existingRows = await withAdminContext(async (adminDb) =>
      adminDb
        .select()
        .from(lesson_audio_exchanges)
        .where(eq(lesson_audio_exchanges.id, id))
        .limit(1)
    );
    const existing = existingRows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Audio exchange not found' }, { status: 404 });
    }

    const isAdmin =
      authResult.user.role === 'admin' || authResult.user.role === 'super_admin';
    if (!isAdmin && existing.created_by && existing.created_by !== authResult.user.id) {
      return NextResponse.json(
        { error: 'Only the exchange creator or an admin can delete this exchange' },
        { status: 403 }
      );
    }

    // Pre-check: would this delete orphan any audio_exchange blocks?
    const refRows = await withAdminContext(async (adminDb) =>
      adminDb.execute(sql`
        SELECT count(*)::int AS n FROM lesson_blocks WHERE audio_exchange_id = ${id}
      `)
    );
    const refCount = Number((refRows.rows?.[0] as any)?.n ?? 0);
    if (refCount > 0) {
      return NextResponse.json(
        {
          error: `Exchange is attached to ${refCount} block${refCount === 1 ? '' : 's'}. Delete or reassign those blocks first.`,
          code: 'exchange_in_use',
          block_count: refCount,
        },
        { status: 409 }
      );
    }

    await withAdminContext(async (adminDb) =>
      adminDb.delete(lesson_audio_exchanges).where(eq(lesson_audio_exchanges.id, id))
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[api/admin/audio-exchanges/[id] DELETE]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
