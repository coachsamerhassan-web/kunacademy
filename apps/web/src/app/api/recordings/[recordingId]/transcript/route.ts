/**
 * GET /api/recordings/[recordingId]/transcript
 * Serve the student-uploaded transcript for a coaching recording.
 *
 * Auth: session required.
 * Ownership: same rules as /stream — caller must be:
 *   - admin / super_admin / mentor_manager, OR
 *   - the student who submitted the recording (student_id on package_instances), OR
 *   - the assessor assigned to this recording via package_assessments.
 *
 * No Range support — transcripts are small (≤ 2 MB) and served inline.
 * Content-Disposition is 'inline' so the browser renders PDFs and text directly.
 *
 * Sub-phase: S2-Layer-1 / 2.2 — Transcript Storage + Assessor-Side Viewer
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq } from '@kunacademy/db';
import {
  packageRecordings,
  packageAssessments,
  packageInstances,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { readFile, access } from 'fs/promises';
import path from 'path';

// ── Constants ─────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FALLBACK_MIME = 'text/plain';

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

  // ── Fetch recording row (include transcript columns) ───────────────────────
  const recording = await withAdminContext(async (db) => {
    const rows = await db
      .select({
        id:                   packageRecordings.id,
        package_instance_id:  packageRecordings.package_instance_id,
        transcript_file_path: packageRecordings.transcript_file_path,
        transcript_mime:      packageRecordings.transcript_mime,
      })
      .from(packageRecordings)
      .where(eq(packageRecordings.id, recordingId))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
  }

  if (!recording.transcript_file_path) {
    return NextResponse.json(
      { error: 'No transcript has been submitted for this recording' },
      { status: 404 },
    );
  }

  // ── Ownership check — identical to /stream ─────────────────────────────────
  const isAdmin =
    user.role === 'admin' ||
    user.role === 'super_admin' ||
    user.role === 'mentor_manager';

  if (!isAdmin) {
    const [instanceRow, assessmentRow] = await Promise.all([
      withAdminContext(async (db) => {
        const rows = await db
          .select({ student_id: packageInstances.student_id })
          .from(packageInstances)
          .where(eq(packageInstances.id, recording.package_instance_id))
          .limit(1);
        return rows[0] ?? null;
      }),
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
  const filePath = recording.transcript_file_path;

  try {
    await access(filePath);
  } catch {
    console.error(`[transcript] File not found on disk: ${filePath} (recordingId=${recordingId})`);
    return NextResponse.json(
      { error: 'Transcript file not found on server' },
      { status: 404 },
    );
  }

  // ── Read and serve inline ──────────────────────────────────────────────────
  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(filePath);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[transcript] readFile failed: ${msg}`);
    return NextResponse.json({ error: 'Could not read transcript file' }, { status: 500 });
  }

  const contentType = recording.transcript_mime ?? FALLBACK_MIME;

  // Use the basename for Content-Disposition so browsers label the tab correctly
  const basename = path.basename(filePath);

  // Wrap in a ReadableStream — same pattern as /stream route, avoids Buffer type issues.
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(fileBuffer));
      controller.close();
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type':        contentType,
      'Content-Length':      String(fileBuffer.length),
      'Content-Disposition': `inline; filename="${basename}"`,
      'Cache-Control':       'private, no-store',
    },
  });
}
