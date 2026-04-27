/**
 * POST /api/admin/scholarships/applications/[id]/disburse — Wave E.6
 *
 * Atomically:
 *   - Validates application status='allocated'
 *   - Generates plaintext + sha256 hash
 *   - INSERTs scholarship_tokens row (one active per scholarship enforced by
 *     partial unique index)
 *   - UPDATEs scholarships.disbursed_at
 *   - Flips application status allocated → disbursed + writes audit rows
 *   - Sends application-disbursed.tsx email with plaintext token + enrollment
 *     URL (fire-and-forget; plaintext NEVER logged + NEVER returned in
 *     response body)
 *
 * Body:
 *   { note?: string }
 *
 * Auth: admin | super_admin via getAuthUser().
 *
 * Errors:
 *   400 — invalid id / body
 *   401 — unauthenticated
 *   403 — non-admin
 *   404 — scholarship not found
 *   409 — token already active (race; or already disbursed)
 *   422 — invalid state
 *   500 — unexpected
 *
 * SECURITY NOTE: response body intentionally omits the plaintext token.
 * The token only travels in the email body. If the email fails to send,
 * the admin must re-issue (next wave: a "regenerate token" admin action).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthUser } from '@kunacademy/auth/server';
import { applyDisbursement, AllocationError } from '@/lib/scholarship-allocation';
import { listEligibleScholarshipPrograms } from '@/lib/scholarship-application';
import { sendScholarshipApplicationDisbursedEmail } from '@kunacademy/email';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const DISBURSE_ERROR_HTTP: Record<string, number> = {
  invalid_scholarship_id: 400,
  scholarship_not_found: 404,
  invalid_application_status: 422,
  already_disbursed: 422,
  token_already_active: 409,
  token_hash_collision: 500,
};

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') ?? 'kuncoaching.me';
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export async function POST(
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

  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    // body is optional — treat parse failure on empty body as "no body"
    raw = null;
  }
  const body = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};

  let note: string | null = null;
  if (typeof body.note === 'string') {
    const trimmed = body.note.trim();
    if (trimmed.length > 0) {
      if (trimmed.length > 2000) {
        return NextResponse.json({ error: 'note-too-long' }, { status: 400 });
      }
      // eslint-disable-next-line no-control-regex
      if (/[ --]/.test(trimmed)) {
        return NextResponse.json({ error: 'invalid-note' }, { status: 400 });
      }
      note = trimmed;
    }
  } else if (body.note !== undefined && body.note !== null) {
    return NextResponse.json({ error: 'invalid-note' }, { status: 400 });
  }

  // The route param is the APPLICATION id. We need the SCHOLARSHIP id to
  // disburse — look it up from the application.
  interface AppSnapshot {
    scholarship_id: string;
    applicant_name: string;
    applicant_email: string;
    preferred_language: 'ar' | 'en';
    program_slug: string;
    scholarship_tier: 'partial' | 'full';
  }
  let snapshotResult: AppSnapshot | null = null;
  try {
    snapshotResult = await withAdminContext(async (db): Promise<AppSnapshot | null> => {
      const r = await db.execute(sql`
        SELECT
          s.id            AS scholarship_id,
          a.applicant_name,
          a.applicant_email,
          a.preferred_language,
          a.program_slug,
          a.scholarship_tier
        FROM scholarship_applications a
        INNER JOIN scholarships s ON s.application_id = a.id
        WHERE a.id = ${id}::uuid
      `);
      const row = r.rows[0] as AppSnapshot | undefined;
      return row ?? null;
    });
  } catch (e) {
    console.error('[admin-scholarships-disburse] snapshot failed:', e);
    return NextResponse.json({ error: 'read-failed' }, { status: 500 });
  }

  if (!snapshotResult) {
    return NextResponse.json({ error: 'scholarship-not-found' }, { status: 404 });
  }
  const appSnapshot: AppSnapshot = snapshotResult;
  const scholarshipId = appSnapshot.scholarship_id;

  // Apply disbursement
  let result;
  try {
    result = await applyDisbursement({
      scholarship_id: scholarshipId,
      admin_id: user.id,
      note,
    });
  } catch (err) {
    if (err instanceof AllocationError) {
      const code = DISBURSE_ERROR_HTTP[err.code] ?? 422;
      return NextResponse.json({ error: err.code, message: err.message }, { status: code });
    }
    console.error('[admin-scholarships-disburse] failed:', err);
    return NextResponse.json({ error: 'disbursement-failed' }, { status: 500 });
  }

  const baseUrl = getBaseUrl(req);
  const enrollmentUrl = `${baseUrl}${result.enrollment_url_path}`;

  // Capture plaintext into a local var, then send the email; plaintext goes
  // out of scope after this function returns.
  const plaintext = result.plaintext_token;
  const expiresAt = result.expires_at;

  // Fire disbursed email (fire-and-forget)
  const snap = appSnapshot;
  void (async () => {
    try {
      const programs = await listEligibleScholarshipPrograms();
      const found = programs.find((p) => p.slug === snap.program_slug);
      const program_title =
        found
          ? snap.preferred_language === 'ar' ? found.title_ar : found.title_en
          : snap.program_slug;
      await sendScholarshipApplicationDisbursedEmail({
        to: snap.applicant_email,
        recipient_name: snap.applicant_name,
        program_title,
        scholarship_tier: snap.scholarship_tier,
        preferred_language: snap.preferred_language,
        enrollment_url: enrollmentUrl,
        expires_at: expiresAt,
        plaintext_token: plaintext,
      });
    } catch (e) {
      console.error('[admin-scholarships-disburse] disbursed email failed:', e);
    }
  })();

  // Response intentionally omits plaintext token — only emails carry it.
  return NextResponse.json({
    ok: true,
    scholarship_id: result.scholarship_id,
    application_id: result.application_id,
    expires_at: result.expires_at,
    next_status: 'disbursed',
  });
}
