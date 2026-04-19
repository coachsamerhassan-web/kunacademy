/**
 * POST /api/assessments/[assessmentId]/voice-message
 * Upload a voice message from assessor to student on a failed assessment.
 *
 * GET  /api/assessments/[assessmentId]/voice-message
 * Retrieve metadata for the voice message (playback URL, duration, etc.).
 * Audio streaming is served via GET /api/voice-messages/[id]/stream.
 *
 * Auth (POST): session required AND caller is the assigned assessor OR admin/mentor_manager.
 * Auth (GET):  session required AND caller is the assigned assessor OR the student
 *              who owns the assessment's recording instance OR admin/mentor_manager.
 *
 * POST body: multipart/form-data
 *   voice — audio blob from MediaRecorder
 *
 * Constraints:
 *   - MIME type must start with 'audio/' (webm, mp4, mpeg, ogg, wav)
 *   - File size ≤ 15 MB
 *   - Only one voice message per assessment (latest upload replaces the previous)
 *
 * Storage path: uploads/voice-messages/[assessmentId]/[timestamp].[ext]
 * (VPS-local per feedback_vps_first_storage.md)
 *
 * Sub-phase: S2-Layer-1 / 2.6 — Assessor Voice Message
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq } from '@kunacademy/db';
import {
  packageAssessments,
  packageRecordings,
  packageInstances,
  assessmentVoiceMessages,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { writeFile, mkdir, rm } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// ── Constants ─────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_VOICE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

/** Root directory for voice message uploads on the VPS. */
const VOICE_UPLOAD_ROOT = process.env.VOICE_MESSAGES_UPLOAD_DIR
  ?? '/var/www/kunacademy-git/uploads/voice-messages';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map MIME type → canonical file extension for storage path. */
function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'audio/webm':  'webm',
    'audio/mp4':   'mp4',
    'audio/mpeg':  'mp3',
    'audio/mp3':   'mp3',
    'audio/ogg':   'ogg',
    'audio/wav':   'wav',
    'audio/x-wav': 'wav',
  };
  return map[mime] ?? 'bin';
}

/**
 * Probe duration using ffprobe.
 * Returns seconds as an integer, or null if ffprobe is unavailable / fails.
 */
async function probeDurationSeconds(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
    );
    const seconds = parseFloat(stdout.trim());
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.round(seconds);
    }
    return null;
  } catch {
    return null;
  }
}

// ── Route context ─────────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, context: RouteContext) {
  const { assessmentId } = await context.params;

  if (!UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessmentId' }, { status: 400 });
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin =
    user.role === 'admin' ||
    user.role === 'super_admin' ||
    user.role === 'mentor_manager';

  // ── Ownership check: fetch assessment row ──────────────────────────────────
  const assessmentRow = await withAdminContext(async (db) => {
    const rows = await db
      .select({
        id:          packageAssessments.id,
        assessor_id: packageAssessments.assessor_id,
        decision:    packageAssessments.decision,
      })
      .from(packageAssessments)
      .where(eq(packageAssessments.id, assessmentId))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!assessmentRow) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  // Non-admin: must be the assigned assessor
  if (!isAdmin && assessmentRow.assessor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse multipart body ───────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data body' }, { status: 400 });
  }

  const voiceField = formData.get('voice');
  if (!(voiceField instanceof File)) {
    return NextResponse.json({ error: 'Missing required field: voice' }, { status: 400 });
  }

  // ── Validate MIME ──────────────────────────────────────────────────────────
  const mimeType = voiceField.type;
  if (!mimeType.startsWith('audio/')) {
    return NextResponse.json(
      { error: `File type '${mimeType}' is not allowed. Only audio/* types are accepted.` },
      { status: 400 },
    );
  }

  // ── Validate file size ─────────────────────────────────────────────────────
  if (voiceField.size > MAX_VOICE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the 15 MB limit (received ${(voiceField.size / 1024 / 1024).toFixed(1)} MB)` },
      { status: 413 },
    );
  }

  // ── Build storage path ─────────────────────────────────────────────────────
  // Path: uploads/voice-messages/[assessmentId]/[timestamp].[ext]
  // Use timestamp (not UUID) so chronological ordering is trivially visible on disk.
  // Note: file.name is NOT used in the path — only goes to the DB record if needed.
  const timestamp = Date.now();
  const ext = mimeToExt(mimeType);
  const uploadDir = path.join(VOICE_UPLOAD_ROOT, assessmentId);
  const filename  = `${timestamp}.${ext}`;
  const filePath  = path.join(uploadDir, filename);

  // ── Write file to disk ─────────────────────────────────────────────────────
  try {
    await mkdir(uploadDir, { recursive: true });
    const arrayBuffer = await voiceField.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));
  } catch (fsErr: unknown) {
    const msg = fsErr instanceof Error ? fsErr.message : String(fsErr);
    console.error('[voice-message POST] File write error:', msg);
    return NextResponse.json({ error: 'Failed to save voice message' }, { status: 500 });
  }

  // ── Probe duration (best-effort) ───────────────────────────────────────────
  const durationSeconds = await probeDurationSeconds(filePath);

  // ── Upsert DB row (one voice message per assessment; latest replaces old) ──
  // Strategy: write-new → insert-new → delete-old (prevents data loss if INSERT fails).
  // Only unlink old file after all DB ops succeed.
  const now = new Date().toISOString();

  let inserted: { id: string; file_path: string; created_at: string } | null = null;
  let oldFilePath: string | null = null;

  try {
    inserted = await withAdminContext(async (db) => {
      // Fetch any existing row for this assessment
      const existingRows = await db
        .select({
          id:        assessmentVoiceMessages.id,
          file_path: assessmentVoiceMessages.file_path,
        })
        .from(assessmentVoiceMessages)
        .where(eq(assessmentVoiceMessages.assessment_id, assessmentId))
        .limit(1);
      const existingRow = existingRows[0] ?? null;

      // Insert new row
      const rows = await db
        .insert(assessmentVoiceMessages)
        .values({
          assessment_id:    assessmentId,
          assessor_id:      user.id,
          file_path:        filePath,
          mime_type:        mimeType,
          size_bytes:       voiceField.size,
          duration_seconds: durationSeconds,
          created_at:       now,
        })
        .returning({
          id:         assessmentVoiceMessages.id,
          file_path:  assessmentVoiceMessages.file_path,
          created_at: assessmentVoiceMessages.created_at,
        });
      const newRow = rows[0] ?? null;
      if (!newRow) return null;

      // Delete old row only if new row inserted successfully
      if (existingRow) {
        oldFilePath = existingRow.file_path;
        await db
          .delete(assessmentVoiceMessages)
          .where(eq(assessmentVoiceMessages.id, existingRow.id));
      }

      return newRow;
    });
  } catch (dbErr: unknown) {
    // DB transaction failed: cleanup the newly-written file (orphan prevention)
    await rm(filePath, { force: true }).catch(() => {});
    console.error('[voice-message POST] DB error:', dbErr);
    return NextResponse.json(
      { error: 'Failed to save voice message to database' },
      { status: 500 },
    );
  }

  if (!inserted) {
    await rm(filePath, { force: true }).catch(() => {});
    return NextResponse.json({ error: 'Failed to create voice message record' }, { status: 500 });
  }

  // All DB ops succeeded: now safe to unlink old file from disk
  if (oldFilePath) {
    await rm(oldFilePath, { force: true }).catch(() => {});
  }

  return NextResponse.json(
    {
      id:         inserted.id,
      file_path:  inserted.file_path,
      created_at: inserted.created_at,
    },
    { status: 201 },
  );
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, context: RouteContext) {
  const { assessmentId } = await context.params;

  if (!UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessmentId' }, { status: 400 });
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin =
    user.role === 'admin' ||
    user.role === 'super_admin' ||
    user.role === 'mentor_manager';

  // ── Fetch voice message row ────────────────────────────────────────────────
  const vmRow = await withAdminContext(async (db) => {
    const rows = await db
      .select({
        id:               assessmentVoiceMessages.id,
        assessment_id:    assessmentVoiceMessages.assessment_id,
        assessor_id:      assessmentVoiceMessages.assessor_id,
        mime_type:        assessmentVoiceMessages.mime_type,
        size_bytes:       assessmentVoiceMessages.size_bytes,
        duration_seconds: assessmentVoiceMessages.duration_seconds,
        created_at:       assessmentVoiceMessages.created_at,
      })
      .from(assessmentVoiceMessages)
      .where(eq(assessmentVoiceMessages.assessment_id, assessmentId))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!vmRow) {
    return NextResponse.json({ error: 'No voice message found for this assessment' }, { status: 404 });
  }

  // ── Ownership check (non-admin) ────────────────────────────────────────────
  // Arm A: assessor who uploaded it.
  // Arm B: student who owns the package instance linked to this assessment.
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
          .where(eq(packageAssessments.id, assessmentId))
          .limit(1);
        return rows[0] ?? null;
      });
      isStudent = studentRow?.student_id === user.id;
    }

    if (!isAssessor && !isStudent) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return NextResponse.json({
    id:               vmRow.id,
    assessment_id:    vmRow.assessment_id,
    mime_type:        vmRow.mime_type,
    size_bytes:       vmRow.size_bytes,
    duration_seconds: vmRow.duration_seconds,
    created_at:       vmRow.created_at,
    stream_url:       `/api/voice-messages/${vmRow.id}/stream`,
  });
}
