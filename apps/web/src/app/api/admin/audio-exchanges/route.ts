/**
 * POST /api/admin/audio-exchanges — create a new audio exchange
 *
 * Body:
 *   prompt_audio_url        (required)
 *   prompt_duration_sec     (optional)
 *   prompt_transcript_ar    (optional)
 *   prompt_transcript_en    (optional)
 *   instructions_ar         (optional)
 *   instructions_en         (optional)
 *   response_mode           ('audio_only' | 'text_only' | 'either'; default 'either')
 *   response_time_limit_sec (optional)
 *   requires_review         (bool; default false — D4a=iii reflection-by-default)
 *
 * Audio is uploaded via the existing assessment voice-message endpoint family
 * (VPS-local storage). This endpoint takes the already-hosted URL.
 *
 * Auth: coach or admin. Creator = caller.
 *
 * LESSON-BLOCKS Session B — 2026-04-22
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { profiles, lesson_audio_exchanges } from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';
import { eq } from 'drizzle-orm';

const COACH_ROLES = new Set(['admin', 'super_admin', 'coach', 'instructor']);

async function requireCoachOrAdmin() {
  const user = await getAuthUser();
  if (!user) return { kind: 'unauthenticated' as const };
  if (user.role && COACH_ROLES.has(user.role)) return { kind: 'ok' as const, user };
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const role = rows[0]?.role ?? '';
  if (!COACH_ROLES.has(role)) return { kind: 'forbidden' as const };
  return { kind: 'ok' as const, user };
}

const VALID_RESPONSE_MODES = new Set(['audio_only', 'text_only', 'either']);

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCoachOrAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const prompt_audio_url =
      typeof body.prompt_audio_url === 'string' ? body.prompt_audio_url.trim() : '';
    if (!prompt_audio_url) {
      return NextResponse.json(
        { error: 'prompt_audio_url is required' },
        { status: 400 }
      );
    }

    const response_mode = VALID_RESPONSE_MODES.has(body.response_mode)
      ? body.response_mode
      : 'either';

    const inserted = await withAdminContext(async (adminDb) =>
      adminDb
        .insert(lesson_audio_exchanges)
        .values({
          prompt_audio_url,
          prompt_duration_sec:
            typeof body.prompt_duration_sec === 'number' ? body.prompt_duration_sec : undefined,
          prompt_transcript_ar:
            typeof body.prompt_transcript_ar === 'string' ? body.prompt_transcript_ar : undefined,
          prompt_transcript_en:
            typeof body.prompt_transcript_en === 'string' ? body.prompt_transcript_en : undefined,
          instructions_ar:
            typeof body.instructions_ar === 'string' ? body.instructions_ar : undefined,
          instructions_en:
            typeof body.instructions_en === 'string' ? body.instructions_en : undefined,
          response_mode,
          response_time_limit_sec:
            typeof body.response_time_limit_sec === 'number'
              ? body.response_time_limit_sec
              : undefined,
          requires_review: body.requires_review === true,
          created_by: authResult.user.id,
        })
        .returning()
    );

    return NextResponse.json({ exchange: inserted[0] }, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/audio-exchanges POST]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
