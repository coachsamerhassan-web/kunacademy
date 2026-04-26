/**
 * GET    /api/admin/scholarships/applications/[id] — application detail + audit log
 * PATCH  /api/admin/scholarships/applications/[id] — status transition + note
 *
 * Auth: admin | super_admin via getAuthUser().
 *
 * PATCH body: { new_status: ScholarshipAppStatus, note?: string }
 *
 * The status transition runs atomically (UPDATE + audit INSERT in same withAdminContext);
 * upon success it triggers the appropriate dignity-framed bilingual email
 * (approved / declined / waitlisted) AND resets the E.4 transparency cache.
 *
 * "info_requested" → fires bilingual info-requested email (template TBD by E.6;
 * for now this transition simply writes the audit row + applicant gets a note
 * via Nashit's external channel).
 *
 * Allocated/disbursed transitions are reserved for E.6 — this route returns
 * 422 if asked to do them (E.6's allocation matcher writes scholarships +
 * scholarship_donation_links rows, then flips the application status).
 *
 * UUID validation: the route param is enforced as canonical 36-char UUID; bad
 * shapes 400.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthUser } from '@kunacademy/auth/server';
import {
  ALLOWED_STATUS_TRANSITIONS,
  applyStatusTransition,
  getApplicationDetail,
  TransitionError,
  type ScholarshipAppStatus,
  sanitizeOpenText,
} from '@/lib/scholarship-application';
import { listEligibleScholarshipPrograms } from '@/lib/scholarship-application';
import {
  sendScholarshipApplicationApprovedEmail,
  sendScholarshipApplicationDeclinedEmail,
  sendScholarshipApplicationWaitlistedEmail,
} from '@kunacademy/email';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_TARGETS: ReadonlySet<ScholarshipAppStatus> = new Set([
  'in_review',
  'info_requested',
  'approved',
  'rejected',
  'waitlisted',
]);

// Allocated/disbursed are E.6's domain — return 422 if attempted from here.
const RESERVED_FOR_E6: ReadonlySet<ScholarshipAppStatus> = new Set([
  'allocated',
  'disbursed',
]);

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') ?? 'kuncoaching.me';
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid-id' }, { status: 400 });
  }

  let detail;
  try {
    detail = await getApplicationDetail(id);
  } catch (err) {
    console.error('[admin-scholarships-detail] read failed:', err);
    return NextResponse.json({ error: 'read-failed' }, { status: 500 });
  }
  if (!detail) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  return NextResponse.json({ application: detail });
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid-id' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const newStatusRaw = body.new_status;
  if (typeof newStatusRaw !== 'string') {
    return NextResponse.json({ error: 'missing-new-status' }, { status: 400 });
  }
  const new_status = newStatusRaw as ScholarshipAppStatus;
  if (RESERVED_FOR_E6.has(new_status)) {
    return NextResponse.json(
      { error: 'transition-reserved-for-allocation-flow' },
      { status: 422 },
    );
  }
  if (!VALID_TARGETS.has(new_status)) {
    return NextResponse.json({ error: 'invalid-target-status' }, { status: 400 });
  }

  const note =
    body.note === undefined || body.note === null
      ? null
      : sanitizeOpenText(body.note, 2000);
  if (body.note !== undefined && body.note !== null && body.note !== '' && note === null) {
    return NextResponse.json({ error: 'invalid-note' }, { status: 400 });
  }

  // Read current application detail BEFORE transition so we have the email + name.
  let applicantSnapshot:
    | { applicant_name: string; applicant_email: string; preferred_language: 'ar' | 'en'; program_slug: string; scholarship_tier: 'partial' | 'full' }
    | null = null;
  try {
    const detail = await getApplicationDetail(id);
    if (!detail) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    applicantSnapshot = {
      applicant_name: detail.applicant_name,
      applicant_email: detail.applicant_email,
      preferred_language: detail.preferred_language,
      program_slug: detail.program_slug,
      scholarship_tier: detail.scholarship_tier,
    };
  } catch (err) {
    console.error('[admin-scholarships-detail] pre-read failed:', err);
    return NextResponse.json({ error: 'read-failed' }, { status: 500 });
  }

  // Apply transition
  let result;
  try {
    result = await applyStatusTransition({
      application_id: id,
      admin_id: user.id,
      new_status,
      note,
    });
  } catch (err) {
    if (err instanceof TransitionError) {
      const code = err.code === 'illegal_transition' ? 422 : err.code === 'not_found' ? 404 : 500;
      return NextResponse.json({ error: err.code, message: err.message }, { status: code });
    }
    console.error('[admin-scholarships-detail] transition failed:', err);
    return NextResponse.json({ error: 'transition-failed' }, { status: 500 });
  }

  // Fire notification emails (fire-and-forget; transition has already been committed).
  if (applicantSnapshot) {
    const baseUrl = getBaseUrl(req);
    if (new_status === 'approved') {
      // Resolve canon program title for the email
      let program_title = applicantSnapshot.program_slug;
      try {
        const programs = await listEligibleScholarshipPrograms();
        const found = programs.find((p) => p.slug === applicantSnapshot!.program_slug);
        if (found) {
          program_title =
            applicantSnapshot.preferred_language === 'ar' ? found.title_ar : found.title_en;
        }
      } catch (e) {
        console.error('[admin-scholarships-detail] program title lookup failed:', e);
      }
      void sendScholarshipApplicationApprovedEmail({
        to: applicantSnapshot.applicant_email,
        recipient_name: applicantSnapshot.applicant_name,
        program_title,
        scholarship_tier: applicantSnapshot.scholarship_tier,
        preferred_language: applicantSnapshot.preferred_language,
        next_step_url: `${baseUrl}/${applicantSnapshot.preferred_language}/programs/${applicantSnapshot.program_slug}`,
      }).catch((e) => {
        console.error('[admin-scholarships-detail] approved email failed:', e);
      });
    } else if (new_status === 'rejected') {
      void sendScholarshipApplicationDeclinedEmail({
        to: applicantSnapshot.applicant_email,
        recipient_name: applicantSnapshot.applicant_name,
        preferred_language: applicantSnapshot.preferred_language,
      }).catch((e) => {
        console.error('[admin-scholarships-detail] declined email failed:', e);
      });
    } else if (new_status === 'waitlisted') {
      let program_title = applicantSnapshot.program_slug;
      try {
        const programs = await listEligibleScholarshipPrograms();
        const found = programs.find((p) => p.slug === applicantSnapshot!.program_slug);
        if (found) {
          program_title =
            applicantSnapshot.preferred_language === 'ar' ? found.title_ar : found.title_en;
        }
      } catch (e) {
        console.error('[admin-scholarships-detail] program title lookup failed:', e);
      }
      void sendScholarshipApplicationWaitlistedEmail({
        to: applicantSnapshot.applicant_email,
        recipient_name: applicantSnapshot.applicant_name,
        program_title,
        preferred_language: applicantSnapshot.preferred_language,
      }).catch((e) => {
        console.error('[admin-scholarships-detail] waitlisted email failed:', e);
      });
    }
    // 'in_review' and 'info_requested' do NOT auto-send emails — admin sends
    // personally via Nashit's external channel.
  }

  return NextResponse.json({
    ok: true,
    before: result.before,
    after: result.after,
    allowed_next: ALLOWED_STATUS_TRANSITIONS[result.after] ?? [],
  });
}
