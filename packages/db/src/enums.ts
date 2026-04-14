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
