/**
 * GET  /api/admin/assessments/[assessmentId]/shadow-score
 *   Returns the current reviewer's shadow-score row or null if not started.
 *   Shape: { id, shadow_scores, agreement_notes, agreement_level, submitted_at } | null
 *
 * PUT  /api/admin/assessments/[assessmentId]/shadow-score
 *   Auto-save (upsert) the manager's independent shadow rubric.
 *   Body (partial): { shadow_scores?, agreement_notes?, agreement_level? }
 *   Deep-merges into existing shadow_scores JSONB on every call.
 *   Returns: { saved_at, id }
 *
 * Auth: admin | super_admin | mentor_manager
 * Visibility: only the reviewer (reviewer_id === user.id) may read/write.
 *   admin/super_admin may also read (for audit purposes) but not write another's row.
 *
 * Track A — side-by-side shadow rubric for mentor-manager override decisions
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, and, sql } from '@kunacademy/db';
import { assessmentMmShadowScores, packageAssessments } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = new Set(['admin', 'super_admin', 'mentor_manager']);

// ── Deep merge (same impl as draft route) ────────────────────────────────────
function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const bv = base[key];
    const ov = override[key];
    if (
      ov !== null &&
      typeof ov === 'object' &&
      !Array.isArray(ov) &&
      bv !== null &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      result[key] = deepMerge(
        bv as Record<string, unknown>,
        ov as Record<string, unknown>,
      );
    } else {
      result[key] = ov;
    }
  }
  return result;
}

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, context: RouteContext) {
  const { assessmentId } = await context.params;

  if (!UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessmentId' }, { status: 400 });
  }

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const isSupervisor = user.role === 'admin' || user.role === 'super_admin';

  const rows = await withAdminContext(async (db) => {
    // Supervisors may read any row; mm reviewers may only read their own.
    const conditions = isSupervisor
      ? eq(assessmentMmShadowScores.assessment_id, assessmentId)
      : and(
          eq(assessmentMmShadowScores.assessment_id, assessmentId),
          eq(assessmentMmShadowScores.reviewer_id, user.id),
        );
    return db
      .select({
        id:              assessmentMmShadowScores.id,
        shadow_scores:   assessmentMmShadowScores.shadow_scores,
        agreement_notes: assessmentMmShadowScores.agreement_notes,
        agreement_level: assessmentMmShadowScores.agreement_level,
        submitted_at:    assessmentMmShadowScores.submitted_at,
      })
      .from(assessmentMmShadowScores)
      .where(conditions!)
      .limit(1);
  });

  if (rows.length === 0) {
    return NextResponse.json(null, { status: 200 });
  }

  return NextResponse.json(rows[0], { status: 200 });
}

// ── PUT ───────────────────────────────────────────────────────────────────────

interface ShadowScorePutBody {
  shadow_scores?: Record<string, unknown>;
  agreement_notes?: string;
  agreement_level?: 'fully_agree' | 'partially_agree' | 'disagree';
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { assessmentId } = await context.params;

  if (!UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessmentId' }, { status: 400 });
  }

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Verify parent assessment exists and is in a state that allows shadow edits ─
  const assessmentRows = await withAdminContext(async (db) => {
    return db
      .select({ id: packageAssessments.id, decision: packageAssessments.decision })
      .from(packageAssessments)
      .where(eq(packageAssessments.id, assessmentId))
      .limit(1);
  });

  if (assessmentRows.length === 0) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  // Allow shadow PUT while decision = 'pending' OR when the reviewer is about to
  // finalize (they can write right up until they POST /submit).
  // Block only if the assessment has already been overridden and submitted_at is set
  // on the reviewer's own row (handled by submit endpoint — PUT stays permissive).

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: ShadowScorePutBody;
  try {
    body = (await request.json()) as ShadowScorePutBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  const VALID_LEVELS = new Set(['fully_agree', 'partially_agree', 'disagree', undefined]);
  if (body.agreement_level !== undefined && !VALID_LEVELS.has(body.agreement_level)) {
    return NextResponse.json(
      { error: 'agreement_level must be fully_agree | partially_agree | disagree' },
      { status: 400 },
    );
  }

  // ── Fetch existing row for deep-merge ────────────────────────────────────────
  const existingRows = await withAdminContext(async (db) => {
    return db
      .select({
        id:              assessmentMmShadowScores.id,
        shadow_scores:   assessmentMmShadowScores.shadow_scores,
        submitted_at:    assessmentMmShadowScores.submitted_at,
      })
      .from(assessmentMmShadowScores)
      .where(
        and(
          eq(assessmentMmShadowScores.assessment_id, assessmentId),
          eq(assessmentMmShadowScores.reviewer_id, user.id),
        ),
      )
      .limit(1);
  });

  const existingRow = existingRows[0] ?? null;

  // If already submitted, block further edits
  if (existingRow?.submitted_at != null) {
    return NextResponse.json(
      { error: 'Shadow score already submitted — no further edits allowed' },
      { status: 409 },
    );
  }

  // Deep-merge incoming shadow_scores into existing
  const baseScores = (existingRow?.shadow_scores as Record<string, unknown> | null) ?? {};
  const mergedScores = body.shadow_scores != null
    ? deepMerge(baseScores, body.shadow_scores)
    : baseScores;

  const now = new Date().toISOString();

  // ── UPSERT ───────────────────────────────────────────────────────────────────
  const upsertResult = await withAdminContext(async (db) => {
    return db.execute(sql`
      INSERT INTO assessment_mm_shadow_scores
        (assessment_id, reviewer_id, shadow_scores, agreement_notes, agreement_level, updated_at)
      VALUES (
        ${assessmentId},
        ${user.id},
        ${JSON.stringify(mergedScores)}::jsonb,
        ${body.agreement_notes ?? null},
        ${body.agreement_level ?? null},
        ${now}
      )
      ON CONFLICT (assessment_id, reviewer_id) DO UPDATE
        SET shadow_scores    = EXCLUDED.shadow_scores,
            agreement_notes  = COALESCE(EXCLUDED.agreement_notes, assessment_mm_shadow_scores.agreement_notes),
            agreement_level  = COALESCE(EXCLUDED.agreement_level, assessment_mm_shadow_scores.agreement_level),
            updated_at       = EXCLUDED.updated_at
      RETURNING id
    `);
  });

  const upsertedId = (upsertResult.rows as Array<{ id: string }>)[0]?.id ?? existingRow?.id;

  return NextResponse.json({ saved_at: now, id: upsertedId }, { status: 200 });
}
