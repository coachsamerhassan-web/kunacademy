import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, and } from 'drizzle-orm';
import {
  lesson_audio_exchanges,
  lesson_audio_responses,
  lesson_placements,
  lesson_blocks,
  enrollments,
} from '@kunacademy/db/schema';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';

/**
 * POST /api/lms/audio-exchanges/[id]/responses
 *
 * Student submission for an audio-exchange, anchored to a lesson_placement.
 * Handles BOTH audio upload (multipart/form-data) and text-only (JSON) in
 * one endpoint — per LESSON-BLOCKS Session C-1 spec "do NOT build a new
 * upload endpoint." The write-file-to-disk pattern mirrors the mentoring
 * voice-message endpoint (VPS-local storage per feedback_vps_first_storage).
 *
 * Body (multipart/form-data when audio):
 *   placement_id     — required
 *   voice (File)     — required if response_mode includes audio
 *   text_response    — optional
 * Body (application/json when text-only):
 *   { placement_id, audio_url?, audio_duration_sec?, text_response? }
 *
 * Auth: session + enrolled student of the placement's course.
 * Constraints:
 *   - exchange.id must be referenced by a lesson_block that belongs to
 *     the placement's lesson (otherwise 404 — prevents cross-lesson writes)
 *   - at least one of audio_url/audio(file) / text_response must be populated
 *     (mirrors DB CHECK constraint lesson_audio_responses_payload_check)
 *   - UNIQUE (exchange_id, placement_id, student_id) enforced at DB level
 *     → duplicate submit returns 409
 *   - review_status app-enforcement (D4a=iii):
 *       exchange.requires_review = true  → review_status = 'pending'
 *       exchange.requires_review = false → review_status = null
 *     NEVER overridable by client input.
 *
 * LESSON-BLOCKS wave — Session C-1 (2026-04-22)
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AUDIO_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB (mirrors mentoring endpoint)

// Storage root shared with mentoring voice messages so ops/backups stay unified.
const AUDIO_UPLOAD_ROOT =
  process.env.LESSON_AUDIO_UPLOAD_DIR ??
  process.env.VOICE_MESSAGES_UPLOAD_DIR ??
  '/var/www/kunacademy-git/uploads/lesson-audio-responses';

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
  };
  return map[mime] ?? 'bin';
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: exchangeId } = await context.params;
  if (!UUID_RE.test(exchangeId)) {
    return NextResponse.json({ error: 'Invalid exchange id' }, { status: 400 });
  }

  // ── Parse body (metadata only; hold audio in memory until lineage passes) ─
  const contentType = request.headers.get('content-type') ?? '';
  let placementId = '';
  let audioUrl: string | null = null;
  let audioDurationSec: number | null = null;
  let textResponse: string | null = null;
  let pendingAudio: { buffer: Buffer; mime: string; ext: string } | null = null;
  let writtenFilePath: string | null = null;

  const MAX_AUDIO_DURATION_SEC = 3600; // 1h sanity cap (DeepSeek QA fix)

  try {
    if (contentType.startsWith('multipart/form-data')) {
      const form = await request.formData();
      const pid = form.get('placement_id');
      if (typeof pid !== 'string') {
        return NextResponse.json({ error: 'placement_id required' }, { status: 400 });
      }
      placementId = pid;
      const tr = form.get('text_response');
      if (typeof tr === 'string' && tr.trim().length > 0) textResponse = tr.trim();
      const dur = form.get('audio_duration_sec');
      if (typeof dur === 'string' && dur.length > 0) {
        const n = Number.parseInt(dur, 10);
        if (Number.isFinite(n) && n >= 0 && n <= MAX_AUDIO_DURATION_SEC) audioDurationSec = n;
      }
      const voice = form.get('voice');
      if (voice instanceof File && voice.size > 0) {
        if (!voice.type.startsWith('audio/')) {
          return NextResponse.json(
            { error: `File type '${voice.type}' not allowed — audio/* only` },
            { status: 400 },
          );
        }
        if (voice.size > MAX_AUDIO_SIZE_BYTES) {
          return NextResponse.json(
            { error: `Audio file exceeds 15 MB limit (got ${(voice.size / 1024 / 1024).toFixed(1)} MB)` },
            { status: 413 },
          );
        }
        // Hold in memory — only written to disk AFTER lineage + enrollment pass
        // (DeepSeek QA HIGH fix — prevents disk-orphan window on bad lineage).
        const buf = Buffer.from(await voice.arrayBuffer());
        pendingAudio = { buffer: buf, mime: voice.type, ext: mimeToExt(voice.type) };
      }
    } else {
      // JSON body
      const body = await request.json().catch(() => ({}));
      if (typeof body.placement_id !== 'string') {
        return NextResponse.json({ error: 'placement_id required' }, { status: 400 });
      }
      placementId = body.placement_id;
      if (typeof body.audio_url === 'string' && body.audio_url.length > 0) audioUrl = body.audio_url;
      if (typeof body.audio_duration_sec === 'number' && body.audio_duration_sec >= 0 &&
          body.audio_duration_sec <= MAX_AUDIO_DURATION_SEC)
        audioDurationSec = Math.floor(body.audio_duration_sec);
      if (typeof body.text_response === 'string' && body.text_response.trim().length > 0)
        textResponse = body.text_response.trim();
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!UUID_RE.test(placementId)) {
    return NextResponse.json({ error: 'Invalid placement_id' }, { status: 400 });
  }
  if (!audioUrl && !textResponse && !pendingAudio) {
    return NextResponse.json(
      { error: 'At least one of audio or text_response required' },
      { status: 400 },
    );
  }

  try {
    // ── Load placement + exchange in parallel, verify lineage ──────────────
    const [placementRows, exchangeRows] = await Promise.all([
      db
        .select({
          id: lesson_placements.id,
          course_id: lesson_placements.course_id,
          lesson_id: lesson_placements.lesson_id,
        })
        .from(lesson_placements)
        .where(eq(lesson_placements.id, placementId))
        .limit(1),
      db
        .select({
          id: lesson_audio_exchanges.id,
          requires_review: lesson_audio_exchanges.requires_review,
          response_mode: lesson_audio_exchanges.response_mode,
        })
        .from(lesson_audio_exchanges)
        .where(eq(lesson_audio_exchanges.id, exchangeId))
        .limit(1),
    ]);
    const placement = placementRows[0] ?? null;
    const exchange = exchangeRows[0] ?? null;
    if (!placement || !exchange) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Lineage: the exchange MUST be referenced by a block in THIS placement's lesson.
    const blockRows = await db
      .select({ id: lesson_blocks.id })
      .from(lesson_blocks)
      .where(
        and(
          eq(lesson_blocks.lesson_id, placement.lesson_id),
          eq(lesson_blocks.audio_exchange_id, exchangeId),
        ),
      )
      .limit(1);
    if (!blockRows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // ── Enrollment gate ────────────────────────────────────────────────────
    const enrollmentRows = await db
      .select({ id: enrollments.id, status: enrollments.status })
      .from(enrollments)
      .where(
        and(eq(enrollments.user_id, user.id), eq(enrollments.course_id, placement.course_id)),
      )
      .limit(1);
    const enrollment = enrollmentRows[0] ?? null;
    if (!enrollment || !['enrolled', 'in_progress', 'completed'].includes(enrollment.status ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Response-mode validation ───────────────────────────────────────────
    const hasAudio = !!audioUrl || !!pendingAudio;
    if (exchange.response_mode === 'audio_only' && !hasAudio) {
      return NextResponse.json({ error: 'Audio required for this exchange' }, { status: 400 });
    }
    if (exchange.response_mode === 'text_only' && !textResponse) {
      return NextResponse.json({ error: 'Text required for this exchange' }, { status: 400 });
    }

    // ── ALL validations passed — now safe to write audio to disk ───────────
    // (DeepSeek QA HIGH fix — no disk-orphan window on lineage/enrollment failures.)
    if (pendingAudio) {
      const ts = Date.now();
      const dir = path.join(AUDIO_UPLOAD_ROOT, exchangeId, placementId);
      await mkdir(dir, { recursive: true });
      writtenFilePath = path.join(dir, `${user.id}-${ts}.${pendingAudio.ext}`);
      await writeFile(writtenFilePath, pendingAudio.buffer);
      audioUrl =
        (process.env.NEXT_PUBLIC_APP_URL ?? '') +
        '/uploads/lesson-audio-responses/' +
        `${exchangeId}/${placementId}/${path.basename(writtenFilePath)}`;
    }

    // ── review_status app-enforcement (D4a=iii) ────────────────────────────
    // NEVER read from client input. Always derive from exchange.requires_review.
    const reviewStatus: string | null = exchange.requires_review ? 'pending' : null;

    // ── INSERT ─────────────────────────────────────────────────────────────
    let inserted: typeof lesson_audio_responses.$inferSelect | null = null;
    try {
      await withAdminContext(async (adminDb) => {
        const rows = await adminDb
          .insert(lesson_audio_responses)
          .values({
            exchange_id: exchangeId,
            placement_id: placementId,
            student_id: user.id,
            audio_url: audioUrl,
            audio_duration_sec: audioDurationSec,
            text_response: textResponse,
            review_status: reviewStatus,
          })
          .returning();
        inserted = rows[0] ?? null;
      });
    } catch (e: unknown) {
      // Duplicate (UNIQUE violation) → 409
      const code = (e as { code?: string } | null)?.code;
      const msg = e instanceof Error ? e.message : String(e);
      if (code === '23505' || /unique/i.test(msg)) {
        if (writtenFilePath) await rm(writtenFilePath, { force: true }).catch(() => {});
        return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
      }
      throw e;
    }

    if (!inserted) {
      if (writtenFilePath) await rm(writtenFilePath, { force: true }).catch(() => {});
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }

    return NextResponse.json({ response: inserted }, { status: 201 });
  } catch (e: unknown) {
    if (writtenFilePath) await rm(writtenFilePath, { force: true }).catch(() => {});
    console.error('[api/lms/audio-exchanges/[id]/responses POST]', e);
    const msg = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
