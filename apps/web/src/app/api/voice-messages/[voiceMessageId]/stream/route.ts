/**
 * GET /api/voice-messages/[voiceMessageId]/stream
 * Stream a voice message with HTTP Range support.
 *
 * Auth: session required.
 * Ownership: caller must be admin/super_admin/mentor_manager
 *   OR the assessor who uploaded the message
 *   OR the student who owns the linked package instance.
 *
 * Mirrors the pattern of GET /api/recordings/[recordingId]/stream.
 *
 * Sub-phase: S2-Layer-1 / 2.6 — Assessor Voice Message Playback
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq } from '@kunacademy/db';
import {
  assessmentVoiceMessages,
  packageAssessments,
  packageRecordings,
  packageInstances,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { createReadStream, statSync, existsSync } from 'fs';

// ── Constants ─────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FALLBACK_MIME = 'audio/webm';

// ── Route context ─────────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ voiceMessageId: string }>;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const { voiceMessageId } = await context.params;

  if (!UUID_RE.test(voiceMessageId)) {
    return NextResponse.json({ error: 'Invalid voiceMessageId' }, { status: 400 });
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Fetch voice message row ────────────────────────────────────────────────
  const vmRow = await withAdminContext(async (db) => {
    const rows = await db
      .select({
        id:            assessmentVoiceMessages.id,
        assessment_id: assessmentVoiceMessages.assessment_id,
        assessor_id:   assessmentVoiceMessages.assessor_id,
        file_path:     assessmentVoiceMessages.file_path,
        mime_type:     assessmentVoiceMessages.mime_type,
      })
      .from(assessmentVoiceMessages)
      .where(eq(assessmentVoiceMessages.id, voiceMessageId))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!vmRow) {
    return NextResponse.json({ error: 'Voice message not found' }, { status: 404 });
  }

  // ── Ownership check ────────────────────────────────────────────────────────
  // Arm A: admin / super_admin / mentor_manager — bypass.
  // Arm B: assessor who uploaded the message.
  // Arm C: student who owns the package instance linked via the assessment chain.

  const isAdmin =
    user.role === 'admin' ||
    user.role === 'super_admin' ||
    user.role === 'mentor_manager';

  if (!isAdmin) {
    const isAssessor = vmRow.assessor_id === user.id;

    let isStudent = false;
    if (!isAssessor) {
      const studentRow = await withAdminContext(async (db) => {
        const rows = await db
          .select({ student_id: packageInstances.student_id })
          .from(packageAssessments)
          .innerJoin(
            packageRecordings,
            eq(packageRecordings.id, packageAssessments.recording_id),
          )
          .innerJoin(
            packageInstances,
            eq(packageInstances.id, packageRecordings.package_instance_id),
          )
          .where(eq(packageAssessments.id, vmRow.assessment_id))
          .limit(1);
        return rows[0] ?? null;
      });
      isStudent = studentRow?.student_id === user.id;
    }

    if (!isAssessor && !isStudent) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // ── Verify file exists on disk ─────────────────────────────────────────────
  const filePath = vmRow.file_path;

  if (!existsSync(filePath)) {
    console.error(
      `[voice-messages/stream] File not found on disk: ${filePath} (voiceMessageId=${voiceMessageId})`,
    );
    return NextResponse.json(
      { error: 'Voice message file not found on server' },
      { status: 404 },
    );
  }

  let fileSize: number;
  try {
    fileSize = statSync(filePath).size;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[voice-messages/stream] stat failed: ${msg}`);
    return NextResponse.json({ error: 'Could not read voice message file' }, { status: 500 });
  }

  const contentType = vmRow.mime_type || FALLBACK_MIME;

  // ── Parse Range header ─────────────────────────────────────────────────────
  const rangeHeader = request.headers.get('range');

  if (rangeHeader) {
    const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);

    if (!match) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const start = parseInt(match[1], 10);
    const end   = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (start > end || end >= fileSize) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;

    const nodeStream = createReadStream(filePath, { start, end });
    const webStream  = nodeStreamToWebStream(nodeStream);

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        'Content-Type':   contentType,
        'Content-Length': String(chunkSize),
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Cache-Control':  'private, no-store',
      },
    });
  }

  // ── Full stream (no Range header) ──────────────────────────────────────────
  const nodeStream = createReadStream(filePath);
  const webStream  = nodeStreamToWebStream(nodeStream);

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type':   contentType,
      'Content-Length': String(fileSize),
      'Accept-Ranges':  'bytes',
      'Cache-Control':  'private, no-store',
    },
  });
}

// ── Utility: Node.js Readable → Web ReadableStream ────────────────────────────

function nodeStreamToWebStream(nodeStream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer | string) => {
        controller.enqueue(
          typeof chunk === 'string' ? Buffer.from(chunk) : chunk,
        );
      });
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      (nodeStream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    },
  });
}
