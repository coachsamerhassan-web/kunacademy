/**
 * GET /api/recordings/[recordingId]/stream
 * Stream a coaching recording with HTTP Range support.
 *
 * Auth: session required.
 * Ownership: caller must be admin OR the student who submitted the recording
 *             OR the assessor assigned to the recording's package_assessment.
 *
 * Sub-phase: S2-Layer-1 / 2.2 — Audio Streaming (unblocks Phase 2.1 Assessor Workspace)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq } from '@kunacademy/db';
import {
  packageRecordings,
  packageAssessments,
  packageInstances,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { createReadStream, statSync } from 'fs';
import { existsSync } from 'fs';

// ── Constants ─────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FALLBACK_MIME = 'audio/mpeg';

// ── Route params type ─────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ recordingId: string }>;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const { recordingId } = await context.params;

  if (!UUID_RE.test(recordingId)) {
    return NextResponse.json({ error: 'Invalid recordingId' }, { status: 400 });
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Fetch recording row ────────────────────────────────────────────────────
  const recording = await withAdminContext(async (db) => {
    const rows = await db
      .select({
        id:                  packageRecordings.id,
        file_path:           packageRecordings.file_path,
        mime_type:           packageRecordings.mime_type,
        package_instance_id: packageRecordings.package_instance_id,
      })
      .from(packageRecordings)
      .where(eq(packageRecordings.id, recordingId))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
  }

  // ── Ownership check ────────────────────────────────────────────────────────
  // Arm A: admin / super_admin / mentor_manager bypass ownership check entirely.
  // Arm B: student who owns the package instance (student_id on package_instances).
  // Arm C: assessor assigned to this recording via package_assessments.assessor_id.

  const isAdmin =
    user.role === 'admin' ||
    user.role === 'super_admin' ||
    user.role === 'mentor_manager';

  if (!isAdmin) {
    const [instanceRow, assessmentRow] = await Promise.all([
      // Arm B: is caller the student who owns this instance?
      withAdminContext(async (db) => {
        const rows = await db
          .select({ student_id: packageInstances.student_id })
          .from(packageInstances)
          .where(eq(packageInstances.id, recording.package_instance_id))
          .limit(1);
        return rows[0] ?? null;
      }),
      // Arm C: is caller the assessor assigned to this recording?
      withAdminContext(async (db) => {
        const rows = await db
          .select({ assessor_id: packageAssessments.assessor_id })
          .from(packageAssessments)
          .where(eq(packageAssessments.recording_id, recordingId))
          .limit(1);
        return rows[0] ?? null;
      }),
    ]);

    const isStudent  = instanceRow?.student_id === user.id;
    const isAssessor = assessmentRow?.assessor_id === user.id;

    if (!isStudent && !isAssessor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // ── Verify file exists on disk ─────────────────────────────────────────────
  const filePath = recording.file_path;

  if (!existsSync(filePath)) {
    console.error(`[recordings/stream] File not found on disk: ${filePath} (recordingId=${recordingId})`);
    return NextResponse.json(
      { error: 'Recording file not found on server' },
      { status: 404 },
    );
  }

  let fileSize: number;
  try {
    fileSize = statSync(filePath).size;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[recordings/stream] stat failed: ${msg}`);
    return NextResponse.json({ error: 'Could not read recording file' }, { status: 500 });
  }

  const contentType = recording.mime_type || FALLBACK_MIME;

  // ── Parse Range header ─────────────────────────────────────────────────────
  const rangeHeader = request.headers.get('range');

  if (rangeHeader) {
    // Expected format: "bytes=<start>-<end>" (end is optional per HTTP spec)
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

    // Node.js ReadStream → Web ReadableStream adapter
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
      // Allow the stream to be garbage-collected if the client disconnects.
      (nodeStream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    },
  });
}
