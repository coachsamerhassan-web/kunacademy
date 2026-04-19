/**
 * POST /api/admin/package-instances/[instanceId]/unpause
 *
 * Admin / mentor_manager endpoint to unpause a paused student journey.
 *
 * Auth: session + role in ['admin', 'super_admin', 'mentor_manager']
 * Validates: package_instance exists AND journey_state = 'paused'
 * Transition: paused → second_try_pending (via state machine)
 * Audit: logs UNPAUSE_JOURNEY to admin_audit_log
 *
 * M4 — Sub-phase: S2-Layer-1 / M4
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, logAdminAction } from '@kunacademy/db';
import { packageInstances } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { transitionPackageState } from '@/lib/mentoring/state-machine';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ instanceId: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const { instanceId } = await context.params;

  if (!UUID_RE.test(instanceId)) {
    return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAuthorized =
    user.role === 'admin' ||
    user.role === 'super_admin' ||
    user.role === 'mentor_manager';

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Fetch instance ─────────────────────────────────────────────────────────
  const rows = await withAdminContext(async (db) => {
    return db
      .select({ id: packageInstances.id, journey_state: packageInstances.journey_state })
      .from(packageInstances)
      .where(eq(packageInstances.id, instanceId))
      .limit(1);
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Package instance not found' }, { status: 404 });
  }

  const instance = rows[0];

  if (instance.journey_state !== 'paused') {
    return NextResponse.json(
      {
        error:    `Journey is not paused (current state: ${instance.journey_state}). Only paused journeys can be unpaused.`,
        error_ar: `الرحلة ليست متوقفة (الحالة الحالية: ${instance.journey_state}). لا يمكن إعادة التفعيل إلا للرحلات الموقوفة.`,
      },
      { status: 409 },
    );
  }

  // ── Transition: paused → second_try_pending ────────────────────────────────
  // 'second_try_pending' is the correct re-entry point: student already exhausted
  // their first attempt and is allowed to re-submit once more.
  try {
    await transitionPackageState(instanceId, 'second_try_pending', `admin:${user.id}`);
  } catch (smErr) {
    console.error('[unpause] state-machine transition failed:', smErr);
    return NextResponse.json(
      { error: 'State machine transition failed. Check server logs.' },
      { status: 500 },
    );
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  void logAdminAction({
    adminId:    user.id,
    action:     'UNPAUSE_JOURNEY',
    targetType: 'package_instance',
    targetId:   instanceId,
    metadata:   { new_state: 'second_try_pending', actor_role: user.role },
  });

  return NextResponse.json(
    { id: instanceId, new_journey_state: 'second_try_pending' },
    { status: 200 },
  );
}
