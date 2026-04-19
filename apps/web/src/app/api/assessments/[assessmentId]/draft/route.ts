/**
 * PATCH /api/assessments/[assessmentId]/draft
 * Auto-save a partial rubric payload into package_assessments.rubric_scores.
 *
 * Auth: session user must be the assigned assessor OR admin/mentor_manager.
 * Status gate: returns 409 if assessment.decision !== 'pending' (submitted work).
 * Merge semantics: shallow-merge incoming fields into existing rubric_scores JSONB.
 * Column: draft_last_saved_at does not exist in v1 schema — saved_at is returned
 *   from the response timestamp (server now()) without a DB column write.
 *
 * Sub-phase: S2-Layer-1 / 2.5 — Auto-save + draft recovery
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq } from '@kunacademy/db';
import { packageAssessments } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Deep merge helper ────────────────────────────────────────────────────────
// Recursively merges `override` into `base`. Plain-object keys are walked
// recursively; arrays and primitives in override replace base entirely (no
// per-index merge — safer and easier to reason about).
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { assessmentId } = await context.params;

  if (!UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessmentId' }, { status: 400 });
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'mentor_manager';

  // ── Fetch existing row (ownership + status check) ───────────────────────────
  const rows = await withAdminContext(async (db) => {
    return db
      .select({
        id:            packageAssessments.id,
        assessor_id:   packageAssessments.assessor_id,
        decision:      packageAssessments.decision,
        rubric_scores: packageAssessments.rubric_scores,
      })
      .from(packageAssessments)
      .where(eq(packageAssessments.id, assessmentId))
      .limit(1);
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  const row = rows[0];

  // Non-admin: must be the assigned assessor
  if (!isAdmin && row.assessor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Status gate: refuse draft save if assessment is no longer pending
  if (row.decision !== 'pending') {
    return NextResponse.json(
      { error: 'Assessment already submitted — draft save rejected' },
      { status: 409 },
    );
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let incoming: Record<string, unknown>;
  try {
    incoming = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof incoming !== 'object' || incoming === null || Array.isArray(incoming)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  // ── Deep-merge into existing rubric_scores ───────────────────────────────────
  // Replaces the old shallow-merge so concurrent tabs writing independent fields
  // no longer clobber each other's nested rubric paths.
  const existing: Record<string, unknown> =
    (row.rubric_scores as Record<string, unknown> | null) ?? {};

  const merged: Record<string, unknown> = deepMerge(existing, incoming);
  const mergedKeys = Object.keys(incoming);

  await withAdminContext(async (db) => {
    return db
      .update(packageAssessments)
      .set({ rubric_scores: merged })
      .where(eq(packageAssessments.id, assessmentId));
  });

  const savedAt = new Date().toISOString();

  return NextResponse.json({ saved_at: savedAt, merged_keys: mergedKeys });
}
