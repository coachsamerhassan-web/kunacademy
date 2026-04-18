import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, withUserContext, eq, and, sql } from '@kunacademy/db';
import { beneficiaryFiles, beneficiaryFileSessions, packageInstances } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

/**
 * GET /api/beneficiary-files/[id]/sessions/[sessionNumber]
 * Read one session's data.
 *
 * PUT /api/beneficiary-files/[id]/sessions/[sessionNumber]
 * Student updates pre/post data; mentor updates status → reviewed.
 * Status transitions enforced server-side — no regression allowed.
 *
 * Authorization:
 *   - Student: owns the parent beneficiary_file
 *   - Mentor:  is assigned_mentor on the parent package_instance
 *   - Admin:   unrestricted
 *
 * Source: SPEC-mentoring-package-template.md §6.1
 * Sub-phase: S2-Layer-1 / 1.3
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DbFileRow {
  id:                  string;
  package_instance_id: string;
  student_id:          string;
  assigned_mentor_id:  string | null;
}

interface ExistingSessionRow {
  id:     string;
  status: string;
}

// ─── Validation helpers ────────────────────────────────────────────────────────

function isString(v: unknown): v is string  { return typeof v === 'string'; }
function isNumber(v: unknown): v is number  { return typeof v === 'number' && Number.isFinite(v); }
function isBool(v: unknown): v is boolean   { return typeof v === 'boolean'; }

function isAwarenessMap(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const validPillars = ['حكيمة', 'حركات', 'تحكم', 'الشخصية', 'الأنا'];
  const map = v as Record<string, unknown>;
  for (const key of Object.keys(map)) {
    if (!validPillars.includes(key)) return false;
    const cell = map[key];
    if (!cell || typeof cell !== 'object' || Array.isArray(cell)) return false;
    const c = cell as Record<string, unknown>;
    if (!isString(c.observation) || !isString(c.evidence)) return false;
  }
  return true;
}

function isNRCArray(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  const validCats = ['needs', 'resources', 'challenges'];
  return v.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      validCats.includes((item as Record<string, unknown>).category as string) &&
      isString((item as Record<string, unknown>).item),
  );
}

function isSelfEval(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  if (!Array.isArray(obj.items)) return false;
  return obj.items.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      isString((item as Record<string, unknown>).criterion) &&
      isBool((item as Record<string, unknown>).met),
  );
}

function isPreSessionData(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  const optionalStrings: Array<keyof typeof obj> = [
    'client_goal',
    'presenting_topic',
    'previous_session_follow_up',
    'somatic_hypothesis',
  ];
  for (const key of optionalStrings) {
    if (key in obj && !isString(obj[key])) return false;
  }
  if ('intended_tools' in obj) {
    if (!Array.isArray(obj.intended_tools) || !obj.intended_tools.every(isString)) return false;
  }
  return true;
}

// ─── Auth context helper ───────────────────────────────────────────────────────

interface AuthCtx {
  isAdmin:   boolean;
  isStudent: boolean;
  isMentor:  boolean;
  fileRow:   DbFileRow;
}

async function resolveAuthCtx(
  userId: string,
  userRole: string,
  fileId: string,
): Promise<AuthCtx | null> {
  const rawRows = await withAdminContext(async (db) => {
    return db.execute(sql`
      SELECT
        bf.id,
        bf.package_instance_id,
        pi.student_id,
        pi.assigned_mentor_id
      FROM beneficiary_files bf
      JOIN package_instances pi ON pi.id = bf.package_instance_id
      WHERE bf.id = ${fileId}
      LIMIT 1
    `);
  });

  if (!rawRows.rows.length) return null;
  const fileRow = rawRows.rows[0] as DbFileRow;

  const isAdmin   = userRole === 'admin' || userRole === 'super_admin';
  const isStudent = fileRow.student_id === userId;

  let isMentor = false;
  if (!isAdmin && !isStudent && fileRow.assigned_mentor_id) {
    const mentorCheck = await withAdminContext(async (db) => {
      return db.execute(sql`
        SELECT 1 FROM instructors
        WHERE id = ${fileRow.assigned_mentor_id}
          AND profile_id = ${userId}
        LIMIT 1
      `);
    });
    isMentor = mentorCheck.rows.length > 0;
  }

  return { isAdmin, isStudent, isMentor, fileRow };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionNumber: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, sessionNumber } = await params;
  const sessionNum = parseInt(sessionNumber, 10);
  if (!Number.isInteger(sessionNum) || sessionNum < 1 || sessionNum > 3) {
    return NextResponse.json({ error: 'sessionNumber must be 1, 2, or 3' }, { status: 400 });
  }

  const ctx = await resolveAuthCtx(user.id, user.role, id);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!ctx.isAdmin && !ctx.isStudent && !ctx.isMentor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await withAdminContext(async (db) => {
    return db
      .select()
      .from(beneficiaryFileSessions)
      .where(
        and(
          eq(beneficiaryFileSessions.beneficiary_file_id, id),
          eq(beneficiaryFileSessions.session_number, sessionNum),
        ),
      )
      .limit(1);
  });

  const session = rows[0] ?? null;
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  return NextResponse.json({ session });
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionNumber: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, sessionNumber } = await params;
  const sessionNum = parseInt(sessionNumber, 10);
  if (!Number.isInteger(sessionNum) || sessionNum < 1 || sessionNum > 3) {
    return NextResponse.json({ error: 'sessionNumber must be 1, 2, or 3' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ctx = await resolveAuthCtx(user.id, user.role, id);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!ctx.isAdmin && !ctx.isStudent && !ctx.isMentor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch current session
  const existingRows = await withAdminContext(async (db) => {
    return db
      .select({ id: beneficiaryFileSessions.id, status: beneficiaryFileSessions.status })
      .from(beneficiaryFileSessions)
      .where(
        and(
          eq(beneficiaryFileSessions.beneficiary_file_id, id),
          eq(beneficiaryFileSessions.session_number, sessionNum),
        ),
      )
      .limit(1);
  });
  const existing: ExistingSessionRow | null = existingRows[0] ?? null;

  const now = new Date().toISOString();

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  // ─── Mentor path ────────────────────────────────────────────────────────────
  if (ctx.isMentor && !ctx.isStudent && !ctx.isAdmin) {
    if (!isBool(b.mark_reviewed) || b.mark_reviewed !== true) {
      return NextResponse.json(
        { error: 'Mentors can only set mark_reviewed: true to transition to reviewed state' },
        { status: 422 },
      );
    }

    if (!existing) {
      return NextResponse.json({ error: 'Session not found — student must submit first' }, { status: 404 });
    }
    if (existing.status !== 'submitted') {
      return NextResponse.json(
        {
          error: `Status transition not allowed: '${existing.status}' → 'reviewed'. Session must be in 'submitted' state.`,
        },
        { status: 409 },
      );
    }

    const updatedRows = await withUserContext(user.id, async (db) => {
      return db
        .update(beneficiaryFileSessions)
        .set({ status: 'reviewed', reviewed_at: now, updated_at: now })
        .where(
          and(
            eq(beneficiaryFileSessions.beneficiary_file_id, id),
            eq(beneficiaryFileSessions.session_number, sessionNum),
          ),
        )
        .returning({
          id:          beneficiaryFileSessions.id,
          status:      beneficiaryFileSessions.status,
          reviewed_at: beneficiaryFileSessions.reviewed_at,
        });
    });

    return NextResponse.json({ session: updatedRows[0] ?? null });
  }

  // ─── Student / Admin path ────────────────────────────────────────────────────

  // Validate optional content fields
  if ('pre_session_data' in b && b.pre_session_data !== undefined && b.pre_session_data !== null) {
    if (!isPreSessionData(b.pre_session_data)) {
      return NextResponse.json({ error: 'pre_session_data has invalid shape' }, { status: 422 });
    }
  }
  if ('awareness_map' in b && b.awareness_map !== undefined && b.awareness_map !== null) {
    if (!isAwarenessMap(b.awareness_map)) {
      return NextResponse.json({ error: 'awareness_map has invalid shape — must use Arabic pillar keys with observation/evidence cells' }, { status: 422 });
    }
  }
  if ('needs_resources_challenges' in b && b.needs_resources_challenges !== undefined && b.needs_resources_challenges !== null) {
    if (!isNRCArray(b.needs_resources_challenges)) {
      return NextResponse.json({ error: 'needs_resources_challenges must be an array of {category, item} objects' }, { status: 422 });
    }
  }
  if ('self_evaluation' in b && b.self_evaluation !== undefined && b.self_evaluation !== null) {
    if (!isSelfEval(b.self_evaluation)) {
      return NextResponse.json({ error: 'self_evaluation must have items[] with {criterion, met} objects' }, { status: 422 });
    }
  }
  if ('recording_duration_seconds' in b && b.recording_duration_seconds !== undefined) {
    if (!isNumber(b.recording_duration_seconds) || b.recording_duration_seconds <= 0) {
      return NextResponse.json({ error: 'recording_duration_seconds must be a positive integer' }, { status: 422 });
    }
  }

  // Status transition check for student
  const wantsSubmit = b.submit === true;
  let newStatus: string | undefined;
  let submittedAt: string | undefined;

  if (wantsSubmit) {
    if (existing && existing.status === 'reviewed') {
      return NextResponse.json(
        { error: 'Cannot re-submit a session that has already been reviewed.' },
        { status: 409 },
      );
    }
    if (!existing || existing.status === 'draft') {
      newStatus   = 'submitted';
      submittedAt = now;
    }
    // already 'submitted' → idempotent, no status change needed
  }

  // Build the update patch — only include fields present in the body
  const patch: Record<string, unknown> = { updated_at: now };
  if ('pre_session_data'                in b && b.pre_session_data                != null) patch.pre_session_data                = b.pre_session_data;
  if ('client_goal_in_client_words'     in b && b.client_goal_in_client_words     != null) patch.client_goal_in_client_words     = String(b.client_goal_in_client_words);
  if ('client_learning_in_client_words' in b && b.client_learning_in_client_words != null) patch.client_learning_in_client_words = String(b.client_learning_in_client_words);
  if ('awareness_map'                   in b && b.awareness_map                   != null) patch.awareness_map                   = b.awareness_map;
  if ('needs_resources_challenges'      in b && b.needs_resources_challenges      != null) patch.needs_resources_challenges      = b.needs_resources_challenges;
  if ('immediate_metaphor'              in b && b.immediate_metaphor              != null) patch.immediate_metaphor              = String(b.immediate_metaphor);
  if ('developmental_metaphor'          in b && b.developmental_metaphor          != null) patch.developmental_metaphor          = String(b.developmental_metaphor);
  if ('self_evaluation'                 in b && b.self_evaluation                 != null) patch.self_evaluation                 = b.self_evaluation;
  if ('continue_stop_start'             in b && b.continue_stop_start             != null) patch.continue_stop_start             = String(b.continue_stop_start);
  if ('recording_url'                   in b) patch.recording_url                 = b.recording_url ? String(b.recording_url) : null;
  if ('recording_duration_seconds'      in b && b.recording_duration_seconds      != null) patch.recording_duration_seconds      = Number(b.recording_duration_seconds);
  if (newStatus)   patch.status       = newStatus;
  if (submittedAt) patch.submitted_at = submittedAt;

  if (existing) {
    const updatedRows = await withUserContext(user.id, async (db) => {
      return db
        .update(beneficiaryFileSessions)
        .set(patch)
        .where(
          and(
            eq(beneficiaryFileSessions.beneficiary_file_id, id),
            eq(beneficiaryFileSessions.session_number, sessionNum),
          ),
        )
        .returning();
    });
    return NextResponse.json({ session: updatedRows[0] ?? null });
  }

  // No existing row — create it
  const insertedRows = await withUserContext(user.id, async (db) => {
    return db
      .insert(beneficiaryFileSessions)
      .values({
        beneficiary_file_id:             id,
        session_number:                  sessionNum,
        status:                          (newStatus as 'draft' | 'submitted') ?? 'draft',
        submitted_at:                    submittedAt ?? null,
        pre_session_data:                (patch.pre_session_data                ?? null) as Record<string, unknown> | null,
        client_goal_in_client_words:     (patch.client_goal_in_client_words     ?? null) as string | null,
        client_learning_in_client_words: (patch.client_learning_in_client_words ?? null) as string | null,
        awareness_map:                   (patch.awareness_map                   ?? null) as Record<string, unknown> | null,
        needs_resources_challenges:      (patch.needs_resources_challenges      ?? null) as unknown[],
        immediate_metaphor:              (patch.immediate_metaphor              ?? null) as string | null,
        developmental_metaphor:          (patch.developmental_metaphor          ?? null) as string | null,
        self_evaluation:                 (patch.self_evaluation                 ?? null) as Record<string, unknown> | null,
        continue_stop_start:             (patch.continue_stop_start             ?? null) as string | null,
        recording_url:                   (patch.recording_url                   ?? null) as string | null,
        recording_duration_seconds:      (patch.recording_duration_seconds      ?? null) as number | null,
      })
      .returning();
  });

  return NextResponse.json({ session: insertedRows[0] ?? null }, { status: 201 });
}
