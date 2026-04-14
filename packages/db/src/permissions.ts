/**
 * Permission model for the Kun coaching platform.
 *
 * Every gated action in the app — from "can deliver a coaching session" to
 * "can resolve a failed-assessment escalation" — is authorized through
 * `canPerform(user, action)` here. No other module is allowed to check
 * role or credential directly. Centralizing this is the ONLY way to keep
 * the 24 consumers of the old legacy column from re-growing as
 * tangled conditional checks.
 *
 * See: SPEC-mentoring-package-template.md §roles
 */

import {
  type IcfCredential,
  type ServiceRole,
} from './enums';

export type Action =
  // Coaching
  | 'deliver_coaching'
  // Mentoring track
  | 'deliver_developmental_mentoring_session'
  | 'deliver_final_mentoring_session'
  | 'assess_recording'
  | 'record_voice_fail_message'
  | 'second_opinion_assess'
  // Management track
  | 'curate_milestones'
  | 'resolve_escalation'
  | 'edit_rubric_template'
  | 'create_package_template'
  // Teaching track
  | 'deliver_training_course'
  | 'facilitate_retreat'
  | 'publish_methodology';

/**
 * A permission rule: which service_role unlocks the action, and the
 * minimum ICF credential required alongside it. `none` means the action
 * is gated only by service_role.
 */
export interface PermissionRule {
  role: ServiceRole;
  minIcf: IcfCredential;
}

/**
 * The full permission matrix. One rule per action. Service roles are
 * stored as a plural array on `instructors.service_roles` — roles
 * accumulate over a career (coach → mentor_coach → advanced_mentor → ...,
 * with `teacher` as a parallel branch). `canPerform` below checks array
 * membership, not hierarchy.
 *
 * Locked with Samer on 2026-04-14. Do not edit without re-opening the
 * permissions interview in Project Memory/KUN-Features/.
 */
export const PERMISSION_MATRIX: Record<Action, PermissionRule> = {
  // Coaching
  deliver_coaching:                         { role: 'coach',           minIcf: 'none' },
  // Mentoring track
  deliver_developmental_mentoring_session:  { role: 'mentor_coach',    minIcf: 'pcc'  },
  deliver_final_mentoring_session:          { role: 'advanced_mentor', minIcf: 'pcc'  },
  assess_recording:                         { role: 'advanced_mentor', minIcf: 'pcc'  },
  record_voice_fail_message:                { role: 'advanced_mentor', minIcf: 'pcc'  },
  second_opinion_assess:                    { role: 'advanced_mentor', minIcf: 'pcc'  },
  // Management track
  curate_milestones:                        { role: 'mentor_manager',  minIcf: 'mcc'  },
  resolve_escalation:                       { role: 'mentor_manager',  minIcf: 'mcc'  },
  edit_rubric_template:                     { role: 'mentor_manager',  minIcf: 'mcc'  },
  create_package_template:                  { role: 'mentor_manager',  minIcf: 'mcc'  },
  // Teaching track
  deliver_training_course:                  { role: 'teacher',         minIcf: 'pcc'  },
  facilitate_retreat:                       { role: 'teacher',         minIcf: 'pcc'  },
  publish_methodology:                      { role: 'teacher',         minIcf: 'mcc'  },
};

/**
 * Capability check. Call this instead of reading role/credential fields
 * directly anywhere in the app.
 */
export function canPerform(
  user: { service_roles: ServiceRole[] | null; icf_credential: IcfCredential | null },
  action: Action,
): boolean {
  const rule = PERMISSION_MATRIX[action];
  if (!rule) return false;
  if (!user.service_roles?.includes(rule.role)) return false;
  // null icf_credential → rank 0 ('none') inside meetsIcfMinimum,
  // matching SQL kun.icf_rank(COALESCE(p_icf, 'none'))
  return meetsIcfMinimum(user.icf_credential, rule.minIcf);
}

/**
 * Maps an ICF credential to its numeric rank.
 * null/undefined → 0, matching SQL `kun.icf_rank(COALESCE(p_icf, 'none'))`.
 * Exported so callers and tests can assert rank values directly.
 */
export function icfRank(icf: IcfCredential | null | undefined): number {
  const normalized = (icf ?? 'none') as IcfCredential;
  return ({ none: 0, acc: 1, pcc: 2, mcc: 3 } as const)[normalized] ?? 0;
}

/**
 * Returns true if `userIcf` meets or exceeds `minIcf`.
 * Accepts null/undefined for `userIcf` — treated as rank 0 ('none'),
 * matching SQL COALESCE semantics.
 */
export function meetsIcfMinimum(
  userIcf: IcfCredential | null | undefined,
  minIcf: IcfCredential,
): boolean {
  return icfRank(userIcf) >= icfRank(minIcf);
}
