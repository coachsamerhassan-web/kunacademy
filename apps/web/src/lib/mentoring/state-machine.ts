/**
 * Mentoring Package State Machine
 *
 * Source: Phase 1.4 — SPEC-mentoring-package-template.md
 * Sub-phase: S2-Layer-1 / 1.4
 *
 * Implements transitionPackageState() — the single authoritative gate for
 * all journey_state changes on package_instances.
 *
 * Valid transitions are defined in ALLOWED_TRANSITIONS below.
 * All others are rejected with MentoringTransitionError.
 *
 * Special rules:
 *   - 'expired'    : ANY → expired, but actorId MUST be 'cron'
 *   - 'terminated' : ANY → terminated, actorId must be 'cron' OR admin
 *   - All other transitions: any actorId accepted
 */

import { withAdminContext, sql } from '@kunacademy/db';

// ── JourneyState type ──────────────────────────────────────────────────────

export const JOURNEY_STATES = [
  'enrolled',
  'coaching_in_progress',
  'mentoring_1_ready',
  'mentoring_1_done',
  'mentoring_2_ready',
  'mentoring_2_done',
  'recording_submitted',
  'under_assessment',
  'assessment_passed',
  'assessment_failed',
  'under_escalation',
  'second_try_pending',
  'final_mentoring_ready',
  'completed',
  'expired',
  'terminated',
] as const;

export type JourneyState = typeof JOURNEY_STATES[number];

// ── Transition guard table ─────────────────────────────────────────────────

/**
 * Map of from → Set<to>.
 * 'expired' and 'terminated' are handled separately (ANY-from, actor-restricted).
 */
const ALLOWED_TRANSITIONS: ReadonlyMap<JourneyState, ReadonlySet<JourneyState>> = new Map([
  ['enrolled',               new Set<JourneyState>(['coaching_in_progress'])],
  ['coaching_in_progress',   new Set<JourneyState>(['mentoring_1_ready'])],
  ['mentoring_1_ready',      new Set<JourneyState>(['mentoring_1_done'])],
  ['mentoring_1_done',       new Set<JourneyState>(['mentoring_2_ready'])],
  ['mentoring_2_ready',      new Set<JourneyState>(['mentoring_2_done'])],
  ['mentoring_2_done',       new Set<JourneyState>(['recording_submitted'])],
  ['recording_submitted',    new Set<JourneyState>(['under_assessment'])],
  ['under_assessment',       new Set<JourneyState>(['assessment_passed', 'assessment_failed'])],
  ['assessment_failed',      new Set<JourneyState>(['under_escalation'])],
  ['under_escalation',       new Set<JourneyState>(['second_try_pending', 'terminated'])],
  ['second_try_pending',     new Set<JourneyState>(['recording_submitted'])],
  ['assessment_passed',      new Set<JourneyState>(['final_mentoring_ready'])],
  ['final_mentoring_ready',  new Set<JourneyState>(['completed'])],
  // Terminal states — no outbound transitions (except via ANY rules below)
  ['completed',              new Set<JourneyState>()],
  ['expired',                new Set<JourneyState>()],
  ['terminated',             new Set<JourneyState>()],
]);

// ── Error class ────────────────────────────────────────────────────────────

export class MentoringTransitionError extends Error {
  constructor(
    public readonly instanceId: string,
    public readonly from: JourneyState,
    public readonly to: JourneyState,
    public readonly reason: string,
  ) {
    super(
      `[state-machine] Package ${instanceId}: cannot transition ${from} → ${to}. ${reason}`
    );
    this.name = 'MentoringTransitionError';
  }
}

// ── DB row type ────────────────────────────────────────────────────────────

interface PackageInstanceRow {
  id: string;
  journey_state: string;
}

// ── Core transition function ───────────────────────────────────────────────

export interface TransitionResult {
  ok: true;
  instanceId: string;
  previousState: JourneyState;
  newState: JourneyState;
}

export interface TransitionOptions {
  /**
   * If true, skips the actor check for 'expired'/'terminated' targets.
   * Used only by the cron helpers in this module — not exposed to API callers.
   */
  _internal_skipActorCheck?: boolean;
}

/**
 * Transition a package instance to a new journey state.
 *
 * @param instanceId - UUID of the package_instance row
 * @param newState   - Target JourneyState
 * @param actorId    - User ID or 'cron' — used for actor-restricted transitions
 * @param opts       - Internal options (not for API callers)
 *
 * @throws MentoringTransitionError if the transition is not allowed
 * @throws Error if the instance is not found
 */
export async function transitionPackageState(
  instanceId: string,
  newState: JourneyState,
  actorId: string,
  opts: TransitionOptions = {},
): Promise<TransitionResult> {
  // 1. Read current state
  const rows = await withAdminContext(async (db) => {
    const result = await db.execute(
      sql`
        SELECT id, journey_state
        FROM package_instances
        WHERE id = ${instanceId}
        LIMIT 1
      `
    );
    return result.rows as PackageInstanceRow[];
  });

  if (rows.length === 0) {
    throw new Error(`[state-machine] Package instance not found: ${instanceId}`);
  }

  const current = rows[0];
  const previousState = current.journey_state as JourneyState;

  // 2. Validate newState is a known JourneyState
  if (!(JOURNEY_STATES as ReadonlyArray<string>).includes(newState)) {
    throw new MentoringTransitionError(
      instanceId, previousState, newState,
      `Unknown target state "${newState}".`
    );
  }

  // 3. Special rules for 'expired' and 'terminated' — ANY → target, actor-restricted
  if (newState === 'expired' || newState === 'terminated') {
    if (!opts._internal_skipActorCheck) {
      const isCron  = actorId === 'cron';
      const isAdmin = actorId.startsWith('admin:') || actorId === 'admin';
      if (!isCron && !isAdmin && newState === 'expired') {
        throw new MentoringTransitionError(
          instanceId, previousState, newState,
          `Only 'cron' may transition to '${newState}'. actorId="${actorId}".`
        );
      }
      if (!isCron && !isAdmin && newState === 'terminated') {
        throw new MentoringTransitionError(
          instanceId, previousState, newState,
          `Only 'cron' or admin may transition to '${newState}'. actorId="${actorId}".`
        );
      }
    }
    // ANY from-state is allowed for these two targets — skip guard table check
  } else {
    // 4. Guard table check for all other transitions
    const allowed = ALLOWED_TRANSITIONS.get(previousState);
    if (!allowed || !allowed.has(newState)) {
      throw new MentoringTransitionError(
        instanceId, previousState, newState,
        `Transition not in guard table.`
      );
    }
  }

  // 5. No-op if already in target state (idempotent for cron safety)
  if (previousState === newState) {
    return { ok: true, instanceId, previousState, newState };
  }

  // 6. Atomic DB update
  const now = new Date().toISOString();
  await withAdminContext(async (db) => {
    await db.execute(
      sql`
        UPDATE package_instances
        SET
          journey_state = ${newState},
          updated_at    = ${now}
        WHERE id = ${instanceId}
          AND journey_state = ${previousState}
      `
    );
  });

  console.log(
    `[state-machine] ${instanceId}: ${previousState} → ${newState} (actor=${actorId})`
  );

  return { ok: true, instanceId, previousState, newState };
}
