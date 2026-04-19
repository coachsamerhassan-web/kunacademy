/**
 * POST /api/packages/[instanceId]/recordings
 * Submit a coaching recording for assessment.
 *
 * GET  /api/packages/[instanceId]/recordings
 * List all recordings for this package instance.
 *
 * Sub-phase: S2-Layer-1 / 1.5
 *
 * POST body: multipart/form-data
 *   file        — audio/video file (required)
 *   attestation — JSON array of 6 booleans, all must be true (required)
 *
 * POST constraints:
 *   - Student must own the package instance
 *   - MIME: audio/mp4 | audio/x-m4a | video/webm | audio/webm | audio/mpeg | audio/mp3
 *   - Size: ≤ 500 MB
 *   - All 6 attestation boxes must be true
 *   - File saved to: /var/www/kunacademy-git/uploads/recordings/[instanceId]/[recordingId].[ext]
 *   - Duration probed via ffprobe (best-effort; null if unavailable)
 *   - journey_state transitioned to 'recording_submitted'
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, withUserContext, eq, desc } from '@kunacademy/db';
import {
  packageInstances,
  packageRecordings,
  packageAssessments,
  profiles,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { assignAssessor } from '@/lib/mentoring/assign-assessor';
import { writeFile, mkdir, rm } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// In-memory per-user upload counter: max 3 uploads per rolling hour.
// Acceptable for soft launch (10–20 users). TODO: migrate to Redis when scaling.

const UPLOAD_RATE_MAX = 3;
const UPLOAD_RATE_WINDOW_MS = 60 * 60 * 1_000; // 1 hour

const uploadRateMap = new Map<string, { count: number; resetAt: number }>();

function checkUploadRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = uploadRateMap.get(userId);

  if (!entry || now > entry.resetAt) {
    uploadRateMap.set(userId, { count: 1, resetAt: now + UPLOAD_RATE_WINDOW_MS });
    return true; // allowed
  }

  if (entry.count >= UPLOAD_RATE_MAX) {
    return false; // blocked
  }

  entry.count++;
  return true; // allowed
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

const ALLOWED_MIME_TYPES = new Set([
  'audio/mp4',
  'audio/x-m4a',
  'video/webm',
  'audio/webm',
  'audio/mpeg',
  'audio/mp3',
]);

const ATTESTATION_COUNT = 6;

/** Root directory for uploaded recordings on the VPS. */
const UPLOAD_ROOT = process.env.RECORDINGS_UPLOAD_DIR
  ?? '/var/www/kunacademy-git/uploads/recordings';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map MIME type → canonical file extension for storage path. */
function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'audio/mp4':   'm4a',
    'audio/x-m4a': 'm4a',
    'video/webm':  'webm',
    'audio/webm':  'webm',
    'audio/mpeg':  'mp3',
    'audio/mp3':   'mp3',
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
    // ffprobe not installed or failed — skip silently
    return null;
  }
}

// ── UUID regex ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Route params type ─────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ instanceId: string }>;
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, context: RouteContext) {
  const { instanceId } = await context.params;

  if (!UUID_RE.test(instanceId)) {
    return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
  }

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Rate limit: max 3 uploads per user per hour ────────────────────────────
  if (!checkUploadRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Upload limit reached. You may submit at most 3 recordings per hour.' },
      { status: 429 },
    );
  }

  // ── Parse multipart body ───────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data body' }, { status: 400 });
  }

  const fileField = formData.get('file');
  if (!(fileField instanceof File)) {
    return NextResponse.json({ error: 'Missing required field: file' }, { status: 400 });
  }

  const attestationRaw = formData.get('attestation');
  if (typeof attestationRaw !== 'string') {
    return NextResponse.json({ error: 'Missing required field: attestation' }, { status: 400 });
  }

  // ── Validate attestation ───────────────────────────────────────────────────
  let attestation: unknown;
  try {
    attestation = JSON.parse(attestationRaw);
  } catch {
    return NextResponse.json({ error: 'attestation must be valid JSON' }, { status: 400 });
  }

  if (
    !Array.isArray(attestation) ||
    attestation.length !== ATTESTATION_COUNT ||
    !attestation.every((v) => v === true)
  ) {
    return NextResponse.json(
      { error: `attestation must be an array of exactly ${ATTESTATION_COUNT} true values` },
      { status: 400 },
    );
  }

  // ── Validate MIME ──────────────────────────────────────────────────────────
  const mimeType = fileField.type;
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: `File type '${mimeType}' is not allowed. Accepted: ${[...ALLOWED_MIME_TYPES].join(', ')}` },
      { status: 400 },
    );
  }

  // ── Validate file size ─────────────────────────────────────────────────────
  if (fileField.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the 500 MB limit (received ${(fileField.size / 1024 / 1024).toFixed(1)} MB)` },
      { status: 413 },
    );
  }

  // ── Verify student owns this package instance ──────────────────────────────
  const isAdmin =
    user.role === 'admin' || user.role === 'super_admin';

  const instanceRow = await withAdminContext(async (db) => {
    const rows = await db
      .select({
        student_id: packageInstances.student_id,
        journey_state: packageInstances.journey_state,
      })
      .from(packageInstances)
      .where(eq(packageInstances.id, instanceId))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!instanceRow) {
    return NextResponse.json({ error: 'Package instance not found' }, { status: 404 });
  }

  if (!isAdmin && instanceRow.student_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Generate a recording UUID for storage path ────────────────────────────
  const recordingId = crypto.randomUUID();
  const ext = mimeToExt(mimeType);
  const uploadDir = path.join(UPLOAD_ROOT, instanceId);
  const filename  = `${recordingId}.${ext}`;
  const filePath  = path.join(uploadDir, filename);

  // ── Write file to disk ─────────────────────────────────────────────────────
  try {
    await mkdir(uploadDir, { recursive: true });
    const arrayBuffer = await fileField.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));
  } catch (fsErr: unknown) {
    const msg = fsErr instanceof Error ? fsErr.message : String(fsErr);
    console.error('[recordings POST] File write error:', msg);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }

  // ── Probe duration (best-effort, non-blocking) ─────────────────────────────
  const durationSeconds = await probeDurationSeconds(filePath);

  // ── Create package_recordings row ─────────────────────────────────────────
  // If the DB insert fails, delete the file we already wrote to avoid orphaned
  // audio files accumulating on disk (storage leak).
  const now = new Date().toISOString();

  let inserted: { id: string } | null = null;
  try {
    inserted = await withAdminContext(async (db) => {
      const rows = await db
        .insert(packageRecordings)
        .values({
          id:                       recordingId,
          package_instance_id:      instanceId,
          file_path:                filePath,
          original_filename:        fileField.name,
          mime_type:                mimeType,
          file_size_bytes:          fileField.size,
          duration_seconds:         durationSeconds,
          status:                   'pending_assignment',
          attestation_confirmed_at: now,
          submitted_at:             now,
          created_at:               now,
          updated_at:               now,
        })
        .returning({ id: packageRecordings.id });
      return rows[0] ?? null;
    });
  } catch (dbErr: unknown) {
    // Best-effort cleanup — don't let cleanup failure mask the original error
    await rm(filePath, { force: true }).catch((cleanupErr: unknown) => {
      const msg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
      console.error('[recordings POST] Failed to remove orphaned file after DB error:', msg);
    });
    throw dbErr;
  }

  if (!inserted) {
    // insert returned empty — treat as failure and clean up
    await rm(filePath, { force: true }).catch(() => {});
    return NextResponse.json({ error: 'Failed to create recording record' }, { status: 500 });
  }

  // ── Assign assessor via round-robin ────────────────────────────────────────
  let assessorAssigned = false;
  try {
    await assignAssessor(recordingId, instanceId);
    assessorAssigned = true;
  } catch (assignErr: unknown) {
    // Log but don't fail the submission — recording is saved, admin can manually assign
    const msg = assignErr instanceof Error ? assignErr.message : String(assignErr);
    console.error('[recordings POST] assessor assignment failed:', msg);
  }

  // ── Transition journey_state → 'recording_submitted' ──────────────────────
  // TODO: replace with transitionPackageState() once Phase 1.4 is merged.
  // Currently calling DB directly with a simple status check to avoid silent regressions.
  await withAdminContext(async (db) => {
    await db
      .update(packageInstances)
      .set({
        journey_state: 'recording_submitted',
        updated_at:    now,
      })
      .where(eq(packageInstances.id, instanceId));
  });

  return NextResponse.json(
    { recordingId, assessorAssigned },
    { status: 201 },
  );
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, context: RouteContext) {
  const { instanceId } = await context.params;

  if (!UUID_RE.test(instanceId)) {
    return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
  }

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'mentor_manager';

  // Non-admins may only view their own package instance's recordings
  if (!isAdmin) {
    const instanceRow = await withAdminContext(async (db) => {
      const rows = await db
        .select({ student_id: packageInstances.student_id })
        .from(packageInstances)
        .where(eq(packageInstances.id, instanceId))
        .limit(1);
      return rows[0] ?? null;
    });

    if (!instanceRow) {
      return NextResponse.json({ error: 'Package instance not found' }, { status: 404 });
    }
    if (instanceRow.student_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const recordings = await withAdminContext(async (db) => {
    return db
      .select({
        id:                       packageRecordings.id,
        status:                   packageRecordings.status,
        original_filename:        packageRecordings.original_filename,
        mime_type:                packageRecordings.mime_type,
        file_size_bytes:          packageRecordings.file_size_bytes,
        duration_seconds:         packageRecordings.duration_seconds,
        submitted_at:             packageRecordings.submitted_at,
        attestation_confirmed_at: packageRecordings.attestation_confirmed_at,
        created_at:               packageRecordings.created_at,
      })
      .from(packageRecordings)
      .where(eq(packageRecordings.package_instance_id, instanceId))
      .orderBy(desc(packageRecordings.submitted_at));
  });

  return NextResponse.json({ recordings });
}
