/**
 * Zoho Books Projects API wrapper — Wave E.2 Scholarship Fund integration.
 *
 * Wave E architectural decision #1: NEW module (do NOT extend zoho-books.ts).
 *   zoho-books.ts is 575 lines and focused on Invoices/Items/Customers.
 *   Projects API is structurally different (project-centric, task-based).
 *   Shared primitives (token cache + backoff) extracted to zoho-auth.ts +
 *   zoho-backoff.ts for both modules to reuse.
 *
 * Spec: WAVE-E-SCHOLARSHIP-FUND-SPEC.md §8
 * Amin's pre-work: 2026-04-24-canon-phase2-zoho-dryrun.md §scholarship-fund
 *
 * Target project:
 *   Single "Kun Scholarship Fund 2026" project in UAE org (873861649). The
 *   project is created manually by Amin via the Zoho Books UI (spec §8.1).
 *   This module only posts TASKS to that project — never creates projects.
 *
 * Zoho Free-plan caveat:
 *   UAE org (873861649) is on a paid plan — Projects API is fully available.
 *   Egypt org (918849313) is on Free plan — Projects API is unavailable there.
 *   This module routes exclusively to UAE org. The Scholarship Fund is held
 *   by the UAE entity per Amin 2026-04-22 + canon-phase2 Q6.
 *
 * Mock mode:
 *   If ZOHO_SELF_CLIENT_ID is missing, all functions resolve with
 *   { mock: true, task_id: 'mock-<uuid>' } — lets webhook unit tests run
 *   without network access. Mock returns are structured identically to live
 *   so callers can't branch on presence of fields.
 *
 * Exports:
 *   logDonationTask(projectId, donation)       → post a task on donation success
 *   logAllocationTask(projectId, allocation)   → post a task on allocation
 *   logDisbursementTask(projectId, disb)       → post a task on disbursement
 *   logReversalTask(projectId, reversal)       → post a task on refund/reversal
 *   getProjectBalance(projectId)               → read-only aggregate (read from tasks)
 *   resolveScholarshipFundProjectId()          → derive project_id from env
 *
 * Dignity-framing:
 *   Task descriptions reference donors + recipients by system IDs, NOT by the
 *   banned words list (see spec §3.2). Task tags are tightly-constrained enums.
 */

import { getZohoAccessToken, zohoAuthedHeaders } from './zoho-auth';
import { zohoFetchWithRetry } from './zoho-backoff';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ZOHO_PROJECTS_API = 'https://www.zohoapis.com/books/v3';

/** UAE org holds the Scholarship Fund per canon-phase2 Q6. */
const UAE_ORG_ID_DEFAULT = '873861649';

/** Project slug / stable identifier envelope for the fund. */
const FUND_PROJECT_SLUG = 'kun-scholarship-fund-2026';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tight enum of task tags so we can grep the Zoho UI + reconcile rows. If
 * you add a tag here, also update Amin's reconciliation script scope.
 */
export type ZohoTaskTag =
  | 'donor_received'
  | 'designation_gps'
  | 'designation_ihya'
  | 'designation_wisal'
  | 'designation_seeds'
  | 'designation_any'
  | 'recurring'
  | 'anonymous'
  | 'allocated'
  | 'disbursed'
  | 'refunded'
  | 'reversal'
  | 'gps'
  | 'ihya'
  | 'wisal'
  | 'seeds';

export type ProgramFamily = 'gps' | 'ihya' | 'wisal' | 'seeds';

export interface DonationTaskInput {
  donation_id: string; // internal UUID from donations table
  donor_display_name: string; // "Jane S." if named, or "Anonymous donor" if is_anonymous
  amount_minor: number; // minor units (e.g., 1000 = AED 10.00)
  currency: string;
  designation_preference: 'gps' | 'ihya' | 'wisal' | 'seeds' | 'any';
  is_anonymous: boolean;
  is_recurring: boolean;
  stripe_payment_intent_id?: string | null;
  donor_message?: string | null;
}

export interface AllocationTaskInput {
  scholarship_id: string;
  application_id: string;
  recipient_display_name: string;
  program_slug: string;
  program_family: ProgramFamily;
  scholarship_tier: 'partial' | 'full';
  total_amount_minor: number;
  currency: string;
  donation_ids: string[];
  allocated_by_display: string;
}

export interface DisbursementTaskInput {
  scholarship_id: string;
  recipient_display_name: string;
  program_slug: string;
  program_family: ProgramFamily;
  program_enrollment_id?: string | null;
}

export interface ReversalTaskInput {
  donation_id: string;
  original_task_id?: string | null;
  amount_minor: number;
  currency: string;
  reason: string;
}

export interface ZohoTaskResult {
  task_id: string;
  /** true when mock-mode — no live Zoho call was made. */
  mock: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function isMockMode(): boolean {
  // If live Zoho credentials are missing, we run in mock mode so callers can
  // persist DB rows without the webhook failing. Amin's reconciliation script
  // catches any divergence monthly (spec §8.5).
  return (
    !process.env.ZOHO_SELF_CLIENT_ID ||
    !process.env.ZOHO_SELF_CLIENT_SECRET ||
    !(process.env.ZOHO_REFRESH_TOKEN_CORE ?? process.env.ZOHO_REFRESH_TOKEN)
  );
}

function getUaeOrgId(): string {
  // Allow env override for test/staging; default to canonical UAE org.
  return process.env.ZOHO_BOOKS_UAE_ORG_ID ?? UAE_ORG_ID_DEFAULT;
}

function formatMajor(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

function truncateMessage(msg: string | null | undefined, max = 280): string {
  if (!msg) return 'none';
  return msg.length > max ? msg.slice(0, max - 3) + '...' : msg;
}

/**
 * Core POST helper — sends a task payload and returns the task_id.
 * Handles mock mode + error wrapping.
 */
async function postProjectTask(
  projectId: string,
  taskPayload: Record<string, unknown>,
): Promise<ZohoTaskResult> {
  if (isMockMode()) {
    const mockId = `mock-${projectId}-${Date.now()}`;
    console.warn(
      '[zoho-projects] Mock mode: Zoho credentials missing. Task NOT posted to Zoho. ' +
        `Synthesized task_id=${mockId}. Payload keys: ${Object.keys(taskPayload).join(',')}`,
    );
    return { task_id: mockId, mock: true };
  }

  const orgId = getUaeOrgId();
  const token = await getZohoAccessToken();
  const url = `${ZOHO_PROJECTS_API}/projects/${encodeURIComponent(projectId)}/tasks?organization_id=${orgId}`;

  const res = await zohoFetchWithRetry(url, {
    method: 'POST',
    headers: zohoAuthedHeaders(token, true),
    body: JSON.stringify(taskPayload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[zoho-projects] Task create failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { task?: { task_id: string } };
  const taskId = data.task?.task_id;
  if (!taskId) {
    throw new Error('[zoho-projects] Task create returned no task_id');
  }

  return { task_id: taskId, mock: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — task loggers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the Scholarship Fund project_id from env (or return null if unset).
 *
 * Production: set `ZOHO_PROJECTS_SCHOLARSHIP_FUND_ID` to the project_id that
 * Amin created manually via the Zoho UI (spec §8.1). The env var lets us
 * swap projects (e.g., year 2027) without a deploy.
 *
 * If unset in production, callers should fall back to mock mode rather than
 * hard-error — the DB row is the source of truth; Zoho tasks are secondary.
 */
export function resolveScholarshipFundProjectId(): string | null {
  const v = process.env.ZOHO_PROJECTS_SCHOLARSHIP_FUND_ID;
  if (!v || v.trim() === '') return null;
  return v.trim();
}

/**
 * Posts a task on donation success. Called from /api/webhooks/payment on
 * payment_intent.succeeded (one-time) and invoice.payment_succeeded (recurring).
 *
 * Spec §8.2 — donor_received tag + designation tag.
 */
export async function logDonationTask(
  projectId: string,
  donation: DonationTaskInput,
): Promise<ZohoTaskResult> {
  const amountDisplay = `${formatMajor(donation.amount_minor)} ${donation.currency}`;
  const donorLabel = donation.is_anonymous ? 'Anonymous donor' : donation.donor_display_name;

  const tags: ZohoTaskTag[] = [
    'donor_received',
    `designation_${donation.designation_preference}` as ZohoTaskTag,
  ];
  if (donation.is_recurring) tags.push('recurring');
  if (donation.is_anonymous) tags.push('anonymous');

  const description = [
    `Amount: ${amountDisplay}`,
    `Designation: ${donation.designation_preference}`,
    `Anonymous: ${donation.is_anonymous}`,
    `Recurring: ${donation.is_recurring}`,
    `Stripe PI: ${donation.stripe_payment_intent_id ?? 'n/a'}`,
    `Message: ${truncateMessage(donation.donor_message)}`,
    `Donation ID: ${donation.donation_id}`,
  ].join('\n');

  const payload = {
    task_name: `Donation received — ${donorLabel}`,
    description,
    billing_type: 'none',
    status: 'inprogress',
    tags,
  };

  return postProjectTask(projectId, payload);
}

/**
 * Posts a task on scholarship allocation. Called from admin allocation
 * endpoint (E.6).
 *
 * Spec §8.2 — allocated tag + program_family tag.
 */
export async function logAllocationTask(
  projectId: string,
  alloc: AllocationTaskInput,
): Promise<ZohoTaskResult> {
  const amountDisplay = `${formatMajor(alloc.total_amount_minor)} ${alloc.currency}`;
  const tags: ZohoTaskTag[] = ['allocated', alloc.program_family];

  const description = [
    `Application ID: ${alloc.application_id}`,
    `Scholarship ID: ${alloc.scholarship_id}`,
    `Tier: ${alloc.scholarship_tier}`,
    `Amount: ${amountDisplay}`,
    `Donations backing: [${alloc.donation_ids.join(', ')}]`,
    `Allocated by: ${alloc.allocated_by_display}`,
    `Date: ${new Date().toISOString()}`,
  ].join('\n');

  const payload = {
    task_name: `Scholarship allocated — ${alloc.recipient_display_name} / ${alloc.program_slug}`,
    description,
    status: 'open',
    tags,
  };

  return postProjectTask(projectId, payload);
}

/**
 * Posts a task on scholarship disbursement. Called from admin disburse
 * endpoint (E.6) or enrollment webhook.
 *
 * Spec §8.2 — disbursed tag + program_family tag.
 */
export async function logDisbursementTask(
  projectId: string,
  disb: DisbursementTaskInput,
): Promise<ZohoTaskResult> {
  const tags: ZohoTaskTag[] = ['disbursed', disb.program_family];

  const description = [
    `Scholarship ID: ${disb.scholarship_id}`,
    `Enrollment ID: ${disb.program_enrollment_id ?? 'n/a'}`,
    `Date: ${new Date().toISOString()}`,
  ].join('\n');

  const payload = {
    task_name: `Scholarship disbursed — ${disb.recipient_display_name} / ${disb.program_slug}`,
    description,
    status: 'closed',
    tags,
  };

  return postProjectTask(projectId, payload);
}

/**
 * Posts a reversal task for a refunded donation. Called from /api/webhooks/payment
 * on charge.refunded.
 *
 * Leaves the original donor_received task in place (audit trail); adds a new
 * reversal task so the running total reconciles.
 */
export async function logReversalTask(
  projectId: string,
  reversal: ReversalTaskInput,
): Promise<ZohoTaskResult> {
  const amountDisplay = `${formatMajor(reversal.amount_minor)} ${reversal.currency}`;

  const description = [
    `Donation ID: ${reversal.donation_id}`,
    `Original task ID: ${reversal.original_task_id ?? 'n/a'}`,
    `Amount: -${amountDisplay}`,
    `Reason: ${reversal.reason}`,
    `Date: ${new Date().toISOString()}`,
  ].join('\n');

  const payload = {
    task_name: `Reversal — ${reversal.donation_id.slice(0, 8)}`,
    description,
    status: 'closed',
    tags: ['refunded', 'reversal'] as ZohoTaskTag[],
  };

  return postProjectTask(projectId, payload);
}

/**
 * Read-only aggregate: fetch task list from the project and sum by tag.
 *
 * Zoho returns paginated results (max 200/page). This helper walks pages
 * up to 10x (2000 tasks) — enough for ~2 years of donations at 100/month.
 * If the cap is hit, we log a warning and return partial aggregate — the
 * DB is the source of truth; this is a secondary telemetry surface.
 *
 * Mock mode returns zero-filled aggregates.
 */
export async function getProjectBalance(projectId: string): Promise<{
  mock: boolean;
  donor_received_count: number;
  allocated_count: number;
  disbursed_count: number;
  refunded_count: number;
  truncated: boolean;
}> {
  if (isMockMode()) {
    return {
      mock: true,
      donor_received_count: 0,
      allocated_count: 0,
      disbursed_count: 0,
      refunded_count: 0,
      truncated: false,
    };
  }

  const orgId = getUaeOrgId();
  const token = await getZohoAccessToken();

  let donor_received_count = 0;
  let allocated_count = 0;
  let disbursed_count = 0;
  let refunded_count = 0;
  let truncated = false;

  const PAGE_SIZE = 200;
  const MAX_PAGES = 10;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${ZOHO_PROJECTS_API}/projects/${encodeURIComponent(projectId)}/tasks?organization_id=${orgId}&page=${page}&per_page=${PAGE_SIZE}`;
    const res = await zohoFetchWithRetry(url, { headers: zohoAuthedHeaders(token) });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[zoho-projects] getProjectBalance failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      tasks?: Array<{ tags?: string[] }>;
      page_context?: { has_more_page?: boolean };
    };

    const tasks = data.tasks ?? [];
    for (const t of tasks) {
      const tags = t.tags ?? [];
      if (tags.includes('donor_received')) donor_received_count += 1;
      if (tags.includes('allocated')) allocated_count += 1;
      if (tags.includes('disbursed')) disbursed_count += 1;
      if (tags.includes('refunded')) refunded_count += 1;
    }

    const hasMore = data.page_context?.has_more_page === true;
    if (!hasMore) break;
    if (page === MAX_PAGES) {
      truncated = true;
      console.warn(
        `[zoho-projects] getProjectBalance truncated at page ${MAX_PAGES} (${PAGE_SIZE * MAX_PAGES} tasks). ` +
          'DB is source of truth — use DB aggregate instead.',
      );
    }
  }

  return {
    mock: false,
    donor_received_count,
    allocated_count,
    disbursed_count,
    refunded_count,
    truncated,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exported constants for callers who want to display project context
// ─────────────────────────────────────────────────────────────────────────────

export const ZOHO_SCHOLARSHIP_FUND_PROJECT_SLUG = FUND_PROJECT_SLUG;
export const ZOHO_SCHOLARSHIP_FUND_ORG_ID = UAE_ORG_ID_DEFAULT;
