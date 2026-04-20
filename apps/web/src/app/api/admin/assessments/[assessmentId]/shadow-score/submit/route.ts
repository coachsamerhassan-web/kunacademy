/**
 * POST /api/admin/assessments/[assessmentId]/shadow-score/submit
 *
 * Finalises the reviewer's shadow score by setting submitted_at = NOW().
 * After this point the PUT endpoint blocks further edits.
 *
 * Auth: admin | super_admin | mentor_manager
 * Requires: an existing (auto-saved) shadow_score row for this reviewer.
 * Idempotent: re-submitting returns 200 with the already-set submitted_at.
 *
 * Audit log: SUBMIT_MM_SHADOW_SCORE
 *
 * Track A — side-by-side shadow rubric for mentor-manager override decisions
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, and } from '@kunacademy/db';
import { assessmentMmShadowScores } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { logAdminAction } from '@kunacademy/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = new Set(['admin', 'super_admin', 'mentor_manager']);

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { assessmentId } = await context.params;

  if (!UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessmentId' }, { status: 400 });
  }

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Load existing shadow row ─────────────────────────────────────────────────
  const rows = await withAdminContext(async (db) => {
    return db
      .select({
        id:           assessmentMmShadowScores.id,
        submitted_at: assessmentMmShadowScores.submitted_at,
        shadow_scores: assessmentMmShadowScores.shadow_scores,
        agreement_level: assessmentMmShadowScores.agreement_level,
        agreement_notes: assessmentMmShadowScores.agreement_notes,
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

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'No shadow score found — start the shadow review before submitting' },
      { status: 404 },
    );
  }

  const row = rows[0];

  // Idempotent: already submitted → return existing state
  if (row.submitted_at != null) {
    return NextResponse.json(
      {
        id:              row.id,
        submitted_at:    row.submitted_at,
        shadow_scores:   row.shadow_scores,
        agreement_level: row.agreement_level,
        agreement_notes: row.agreement_notes,
      },
      { status: 200 },
    );
  }

  const now = new Date().toISOString();

  // ── Mark submitted ───────────────────────────────────────────────────────────
  await withAdminContext(async (db) => {
    await db
      .update(assessmentMmShadowScores)
      .set({ submitted_at: now, updated_at: now })
      .where(eq(assessmentMmShadowScores.id, row.id));
  });

  // ── Audit log (non-blocking) ─────────────────────────────────────────────────
  void logAdminAction({
    adminId:    user.id,
    action:     'SUBMIT_MM_SHADOW_SCORE',
    targetType: 'assessment_mm_shadow_score',
    targetId:   row.id,
    metadata:   {
      assessment_id:   assessmentId,
      reviewer_id:     user.id,
      agreement_level: row.agreement_level ?? null,
    },
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json(
    {
      id:              row.id,
      submitted_at:    now,
      shadow_scores:   row.shadow_scores,
      agreement_level: row.agreement_level,
      agreement_notes: row.agreement_notes,
    },
    { status: 200 },
  );
}
