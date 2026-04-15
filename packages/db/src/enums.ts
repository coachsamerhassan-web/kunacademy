/**
 * Single source of truth for all role, level, and credential enums on the
 * Kun coaching platform. All consumers — UI, API, forms, migrations,
 * Playwright specs — import from here. Do not redefine these anywhere else.
 *
 * Replaces the deprecated `instructors` legacy level column (split into
 * kun_level + icf_credential + service_roles in migration 20260406030000).
 *
 * See: Project Memory/KUN-Features/SPEC-mentoring-package-template.md
 */

export const KUN_LEVELS = ['basic', 'professional', 'expert', 'master'] as const;
export type KunLevel = (typeof KUN_LEVELS)[number];

export const ICF_CREDENTIALS = ['none', 'acc', 'pcc', 'mcc'] as const;
export type IcfCredential = (typeof ICF_CREDENTIALS)[number];

export const SERVICE_ROLES = [
  'coach',
  'mentor_coach',
  'advanced_mentor',
  'mentor_manager',
  'teacher',
] as const;
export type ServiceRole = (typeof SERVICE_ROLES)[number];

/**
 * Display labels. English only for now; Arabic added in sub-phase 1.0.3
 * when we rewrite the UI components to import from this module.
 */
export const KUN_LEVEL_LABELS: Record<KunLevel, string> = {
  basic: 'Basic',
  professional: 'Professional',
  expert: 'Expert',
  master: 'Master',
};

export const ICF_CREDENTIAL_LABELS: Record<IcfCredential, string> = {
  none: 'No ICF credential',
  acc: 'ACC',
  pcc: 'PCC',
  mcc: 'MCC',
};

export const SERVICE_ROLE_LABELS: Record<ServiceRole, string> = {
  coach: 'Coach',
  mentor_coach: 'Mentor Coach',
  advanced_mentor: 'Advanced Mentor',
  mentor_manager: 'Mentor Manager',
  teacher: 'Teacher',
};

// ============================================================================
// Sub-phase S2-Layer-1 / 1.1 — Package Template Engine enums
// Source: SPEC-mentoring-package-template.md §4.1–4.3
// ============================================================================

/**
 * PACKAGE_CONTEXT — determines which permission regime applies to a template.
 *   'kun_student_bundled'  → bundled inside a Kun program; mentor_manager only can create
 *   'external_standalone'  → standalone purchasable package
 */
export const PACKAGE_CONTEXTS = [
  'kun_student_bundled',
  'external_standalone',
] as const;
export type PackageContext = (typeof PACKAGE_CONTEXTS)[number];

export const PACKAGE_CONTEXT_LABELS: Record<PackageContext, string> = {
  kun_student_bundled: 'Kun Student Bundled',
  external_standalone: 'External Standalone',
};

/**
 * PRICE_BEHAVIOR — how the price for a template is applied.
 *   'bundled_in_program'   → no separate charge; included in program fee
 *   'standalone_purchase'  → priced separately; full upfront
 *   'deposit'              → deposit required at booking; balance later
 */
export const PRICE_BEHAVIORS = [
  'bundled_in_program',
  'standalone_purchase',
  'deposit',
] as const;
export type PriceBehavior = (typeof PRICE_BEHAVIORS)[number];

export const PRICE_BEHAVIOR_LABELS: Record<PriceBehavior, string> = {
  bundled_in_program:  'Bundled in Program',
  standalone_purchase: 'Standalone Purchase',
  deposit:             'Deposit',
};

/**
 * ANCHOR_EVENTS — the 9 events that can anchor a milestone's due date.
 * Source: SPEC-mentoring-package-template.md §4.2
 */
export const ANCHOR_EVENTS = [
  'enrollment_start',
  'coaching_1_done',
  'coaching_2_done',
  'mentoring_1_done',
  'mentoring_2_done',
  'mentoring_3_done',
  'practice_session_done',
  'recording_submitted',
  'assessment_passed',
] as const;
export type AnchorEvent = (typeof ANCHOR_EVENTS)[number];

export const ANCHOR_EVENT_LABELS: Record<AnchorEvent, string> = {
  enrollment_start:       'Enrollment Start',
  coaching_1_done:        'Coaching Session 1 Done',
  coaching_2_done:        'Coaching Session 2 Done',
  mentoring_1_done:       'Mentoring Session 1 Done',
  mentoring_2_done:       'Mentoring Session 2 Done',
  mentoring_3_done:       'Mentoring Session 3 Done',
  practice_session_done:  'Practice Session Done',
  recording_submitted:    'Recording Submitted',
  assessment_passed:      'Assessment Passed',
};

/**
 * JOURNEY_STATES — the 16 states in the package instance state machine.
 * Source: SPEC-mentoring-package-template.md §4.3
 */
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
export type JourneyState = (typeof JOURNEY_STATES)[number];

export const JOURNEY_STATE_LABELS: Record<JourneyState, string> = {
  enrolled:               'Enrolled',
  coaching_in_progress:   'Coaching In Progress',
  mentoring_1_ready:      'Ready for Mentoring Session 1',
  mentoring_1_done:       'Mentoring Session 1 Done',
  mentoring_2_ready:      'Ready for Mentoring Session 2',
  mentoring_2_done:       'Mentoring Session 2 Done',
  recording_submitted:    'Recording Submitted',
  under_assessment:       'Under Assessment',
  assessment_passed:      'Assessment Passed',
  assessment_failed:      'Assessment Failed',
  under_escalation:       'Under Escalation',
  second_try_pending:     'Second Try Pending',
  final_mentoring_ready:  'Ready for Final Mentoring',
  completed:              'Completed',
  expired:                'Expired',
  terminated:             'Terminated',
};

/**
 * MILESTONE_STATUS — the 5 states a milestone row can be in.
 * Source: SPEC-mentoring-package-template.md §4.3
 */
export const MILESTONE_STATUSES = [
  'pending',
  'in_progress',
  'done',
  'stuck',
  'skipped',
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  done:        'Done',
  stuck:       'Stuck',
  skipped:     'Skipped',
};
