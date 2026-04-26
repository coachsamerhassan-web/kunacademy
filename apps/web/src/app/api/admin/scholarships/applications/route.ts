/**
 * GET /api/admin/scholarships/applications — Wave E.5 admin queue list.
 * POST /api/admin/scholarships/applications — Wave E.5 admin manual entry (B5).
 *
 * Auth: admin | super_admin via getAuthUser(). Unauthed → 401; non-admin → 403.
 *
 * GET supports ?format=csv for CSV export.
 *
 * POST creates a manual-entry application (metadata.source='manual_entry').
 * Skips the public-form rate limit + honeypot since the admin is authenticated.
 * Skips public-confirmation email since the admin already has the applicant
 * on an internal channel (per dispatch §"Skips public confirmation email").
 *
 * Note: the admin queue is NOT gated by SCHOLARSHIP_PUBLIC_LAUNCH (per
 * lib/feature-flags.ts comment + dispatch B2 — admin can author manual
 * entries during closed beta).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthUser } from '@kunacademy/auth/server';
import {
  buildApplicationJson,
  createApplication,
  isValidProgramFamily,
  isValidTier,
  listApplicationsForAdmin,
  listEligibleScholarshipPrograms,
  rowsToCsv,
  sanitizeEmail,
  sanitizeName,
  sanitizeOpenText,
  sanitizePhone,
  type ListApplicationsFilter,
  type ScholarshipAppStatus,
  type ScholarshipProgramFamily,
  type ScholarshipTier,
} from '@/lib/scholarship-application';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const VALID_STATUSES: ReadonlySet<ScholarshipAppStatus | 'any'> = new Set([
  'any',
  'pending',
  'in_review',
  'info_requested',
  'approved',
  'allocated',
  'disbursed',
  'rejected',
  'withdrawn',
  'waitlisted',
]);

// ─────────────────────────────────────────────────────────────────────────────
// GET — list with filters + optional CSV export
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const params = url.searchParams;

  const statusRaw = params.get('status');
  const familyRaw = params.get('program_family');
  const dateFromRaw = params.get('date_from');
  const dateToRaw = params.get('date_to');
  const limitRaw = params.get('limit');
  const offsetRaw = params.get('offset');
  const searchRaw = params.get('search');
  const format = params.get('format');

  // Validate filters; reject unknown enum values
  const status: ScholarshipAppStatus | 'any' | undefined =
    statusRaw && VALID_STATUSES.has(statusRaw as ScholarshipAppStatus | 'any')
      ? (statusRaw as ScholarshipAppStatus | 'any')
      : undefined;

  const program_family: ScholarshipProgramFamily | 'any' | undefined =
    familyRaw && (familyRaw === 'any' || isValidProgramFamily(familyRaw))
      ? (familyRaw as ScholarshipProgramFamily | 'any')
      : undefined;

  // Date filter — accept ISO date or full timestamp; reject otherwise
  function safeIso(s: string | null): string | null {
    if (!s) return null;
    if (s.length > 32) return null;
    if (!/^\d{4}-\d{2}-\d{2}([Tt][\d:.]+([Zz]|[+\-]\d{2}:?\d{2})?)?$/.test(s)) return null;
    return s;
  }
  const date_from = safeIso(dateFromRaw);
  const date_to = safeIso(dateToRaw);

  const limit = limitRaw && /^\d+$/.test(limitRaw) ? Number(limitRaw) : undefined;
  const offset = offsetRaw && /^\d+$/.test(offsetRaw) ? Number(offsetRaw) : undefined;

  // Search — bound length + reject angle brackets
  const search =
    searchRaw &&
    searchRaw.length > 0 &&
    searchRaw.length <= 200 &&
    !/[<>]/.test(searchRaw)
      ? searchRaw
      : null;

  const filter: ListApplicationsFilter = {
    status,
    program_family,
    date_from,
    date_to,
    limit,
    offset,
    search,
  };

  let rows;
  try {
    rows = await listApplicationsForAdmin(filter);
  } catch (err) {
    console.error('[admin-scholarships-list] list failed:', err);
    return NextResponse.json({ error: 'list-failed' }, { status: 500 });
  }

  if (format === 'csv') {
    const csv = rowsToCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="scholarship-applications.csv"',
      },
    });
  }

  return NextResponse.json({
    applications: rows,
    count: rows.length,
    filter: {
      status: filter.status ?? 'any',
      program_family: filter.program_family ?? 'any',
      date_from: filter.date_from ?? null,
      date_to: filter.date_to ?? null,
      limit: filter.limit ?? 100,
      offset: filter.offset ?? 0,
      search: filter.search ?? null,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — admin manual entry
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

  const applicant_name = sanitizeName(body.applicant_name);
  if (!applicant_name) {
    return NextResponse.json({ error: 'invalid-applicant-name' }, { status: 400 });
  }
  const applicant_email = sanitizeEmail(body.applicant_email);
  if (!applicant_email) {
    return NextResponse.json({ error: 'invalid-applicant-email' }, { status: 400 });
  }
  const applicant_phone =
    body.applicant_phone === undefined || body.applicant_phone === null
      ? null
      : sanitizePhone(body.applicant_phone);
  if (body.applicant_phone !== undefined && body.applicant_phone !== null && applicant_phone === null) {
    return NextResponse.json({ error: 'invalid-applicant-phone' }, { status: 400 });
  }
  const preferred_language: 'ar' | 'en' = body.preferred_language === 'en' ? 'en' : 'ar';

  if (!isValidProgramFamily(body.program_family)) {
    return NextResponse.json({ error: 'invalid-program-family' }, { status: 400 });
  }
  const program_family = body.program_family as ScholarshipProgramFamily;

  if (!isValidTier(body.scholarship_tier)) {
    return NextResponse.json({ error: 'invalid-scholarship-tier' }, { status: 400 });
  }
  const scholarship_tier = body.scholarship_tier as ScholarshipTier;

  const program_slug =
    typeof body.program_slug === 'string' ? body.program_slug.trim() : null;
  if (!program_slug || !/^[a-z0-9][a-z0-9-]*$/.test(program_slug) || program_slug.length > 100) {
    return NextResponse.json({ error: 'invalid-program-slug' }, { status: 400 });
  }
  // Verify program is canon scholarship-eligible.
  let eligibleSlugs: Set<string>;
  try {
    const programs = await listEligibleScholarshipPrograms();
    eligibleSlugs = new Set(programs.map((p) => p.slug));
  } catch (err) {
    console.error('[admin-scholarships-create] eligibility lookup failed:', err);
    return NextResponse.json({ error: 'eligibility-lookup-failed' }, { status: 500 });
  }
  if (!eligibleSlugs.has(program_slug)) {
    return NextResponse.json({ error: 'program-not-scholarship-eligible' }, { status: 422 });
  }

  // Admin-only fields: required admin_note + optional source_referrer.
  const admin_note = sanitizeOpenText(body.admin_note, 2000);
  if (!admin_note) {
    return NextResponse.json({ error: 'admin-note-required' }, { status: 400 });
  }
  const source_referrer =
    body.source_referrer === undefined || body.source_referrer === null
      ? null
      : sanitizeOpenText(body.source_referrer, 200);
  if (
    body.source_referrer !== undefined &&
    body.source_referrer !== null &&
    body.source_referrer !== '' &&
    source_referrer === null
  ) {
    return NextResponse.json({ error: 'invalid-source-referrer' }, { status: 400 });
  }

  // Application JSON
  const application_json = buildApplicationJson(body.application_json);
  if (!application_json) {
    return NextResponse.json({ error: 'invalid-application-json' }, { status: 400 });
  }

  try {
    const created = await createApplication({
      applicant_name,
      applicant_email,
      applicant_phone,
      preferred_language,
      program_family,
      program_slug,
      scholarship_tier,
      application_json,
      source: 'manual_entry',
      admin_id: user.id,
      admin_note,
      source_referrer,
    });
    return NextResponse.json({ ok: true, application_id: created.id });
  } catch (err) {
    console.error('[admin-scholarships-create] insert failed:', err);
    return NextResponse.json({ error: 'insert-failed' }, { status: 500 });
  }
}
