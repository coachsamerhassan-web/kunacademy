/**
 * POST /api/scholarships/apply
 *
 * Wave E.5 — public scholarship application intake.
 *
 * Behavior:
 *   - Feature-flag gated (SCHOLARSHIP_PUBLIC_LAUNCH=true required; defense-in-depth
 *     re-check inside handler — middleware also 404s the request first).
 *   - Rate-limited per IP (3 submissions/IP/hour) — generous enough for a
 *     household with shared NAT, strict enough to block bots.
 *   - Honeypot field (`hp_company`) — silently 200 if the bot fills it.
 *   - Idempotent on same-day submissions: the partial unique index on
 *     scholarship_applications (lower(applicant_email), created_at::date)
 *     WHERE source='public_form' catches the second submit; this handler
 *     also pre-checks via publicFormSubmissionExistsToday() to return a
 *     friendly 200 instead of a 409.
 *   - Origin check (CSRF defense — same-origin only).
 *   - Validates input via lib/scholarship-application.ts helpers (length-bound,
 *     control-char-free, type-checked).
 *   - Writes scholarship_applications row + audit event row (event_type='created'),
 *     then sends bilingual confirmation email + admin-notification email.
 *
 * IP / dignity boundary:
 *   - Form prompts visible to users live in the page component
 *     (ScholarshipApplicationForm.tsx), NOT in this API route. The route only
 *     sees the structured payload.
 *   - Confirmation email + admin-notification email both go through templates
 *     that are dignity-clean and methodology-clean.
 *
 * Returns:
 *   - 200 { ok: true, application_id, message } on success
 *   - 200 { ok: true, application_id: null, deduped: true } when same-day
 *     duplicate (idempotent path; we don't reveal the existing application_id
 *     to the public for safety)
 *   - 200 { ok: true, honeypot: true } silent OK when honeypot was filled
 *   - 400 / 422 on validation failure
 *   - 403 on cross-origin / invalid origin
 *   - 429 on rate-limit
 *   - 500 on server error
 *   - 404 when feature flag is off
 */

import { NextResponse, type NextRequest } from 'next/server';
import { isScholarshipPublicLaunched } from '@/lib/feature-flags';
import {
  buildApplicationJson,
  createApplication,
  isValidProgramFamily,
  isValidTier,
  listEligibleScholarshipPrograms,
  publicFormSubmissionExistsToday,
  sanitizeEmail,
  sanitizeName,
  sanitizePhone,
  type ScholarshipProgramFamily,
  type ScholarshipTier,
} from '@/lib/scholarship-application';
import {
  sendScholarshipAdminNotificationEmail,
  sendScholarshipApplicationConfirmationEmail,
} from '@kunacademy/email';

// ─────────────────────────────────────────────────────────────────────────────
// Rate limit (per-IP, sliding 1-hour window in-memory)
// ─────────────────────────────────────────────────────────────────────────────

const _rlIp = new Map<string, { count: number; resetAt: number }>();
const RL_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RL_MAX_IP = 3; // 3 submissions per IP per hour

function _checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = _rlIp.get(key);
  if (!entry || now > entry.resetAt) {
    _rlIp.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RL_MAX_IP;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rlIp) if (now > v.resetAt) _rlIp.delete(k);
}, 5 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// Admin distribution list
// ─────────────────────────────────────────────────────────────────────────────

/** Admin distribution list for new-application alerts. Comma-separated env var. */
function getAdminAlertList(): string | null {
  const raw = process.env.SCHOLARSHIP_ADMIN_ALERT_EMAILS;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Origin check (CSRF defense)
// ─────────────────────────────────────────────────────────────────────────────

function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin) return true; // server-to-server / curl-no-origin
  if (!host) return false;
  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') ?? 'kuncoaching.me';
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Defense-in-depth feature-flag gate.
  if (!isScholarshipPublicLaunched()) {
    return new NextResponse(null, { status: 404 });
  }

  // CSRF / Origin
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'cross-origin-forbidden' }, { status: 403 });
  }

  // Rate limit
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (_checkRateLimit(ip)) {
    return NextResponse.json({ error: 'rate-limited' }, { status: 429 });
  }

  // Parse body
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  // Honeypot — drop bots silently with 200.
  if (typeof body.hp_company === 'string' && body.hp_company.trim().length > 0) {
    return NextResponse.json({ ok: true, honeypot: true });
  }

  // Identity fields
  const applicant_name = sanitizeName(body.applicant_name);
  if (!applicant_name) {
    return NextResponse.json({ error: 'invalid-applicant-name' }, { status: 400 });
  }
  const applicant_email = sanitizeEmail(body.applicant_email);
  if (!applicant_email) {
    return NextResponse.json({ error: 'invalid-applicant-email' }, { status: 400 });
  }
  const applicant_phone =
    body.applicant_phone === null || body.applicant_phone === undefined
      ? null
      : sanitizePhone(body.applicant_phone);
  if (body.applicant_phone !== null && body.applicant_phone !== undefined && applicant_phone === null) {
    return NextResponse.json({ error: 'invalid-applicant-phone' }, { status: 400 });
  }

  const preferred_language =
    body.preferred_language === 'en' ? 'en' : 'ar';

  // Program & tier
  if (!isValidProgramFamily(body.program_family)) {
    return NextResponse.json({ error: 'invalid-program-family' }, { status: 400 });
  }
  const program_family = body.program_family as ScholarshipProgramFamily;

  if (!isValidTier(body.scholarship_tier)) {
    return NextResponse.json({ error: 'invalid-scholarship-tier' }, { status: 400 });
  }
  const scholarship_tier = body.scholarship_tier as ScholarshipTier;

  // Program slug — must be in the canon scholarship-eligible list
  const program_slug =
    typeof body.program_slug === 'string' ? body.program_slug.trim() : null;
  if (!program_slug || program_slug.length === 0 || program_slug.length > 100) {
    return NextResponse.json({ error: 'invalid-program-slug' }, { status: 400 });
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(program_slug)) {
    return NextResponse.json({ error: 'invalid-program-slug-format' }, { status: 400 });
  }

  let eligibleSlugs: Set<string>;
  let chosenProgram: { slug: string; family: string; title_ar: string; title_en: string } | undefined;
  try {
    const eligible = await listEligibleScholarshipPrograms();
    eligibleSlugs = new Set(eligible.map((p) => p.slug));
    chosenProgram = eligible.find((p) => p.slug === program_slug);
  } catch (err) {
    console.error('[scholarships-apply] eligible programs lookup failed:', err);
    return NextResponse.json({ error: 'eligibility-lookup-failed' }, { status: 500 });
  }
  if (!eligibleSlugs.has(program_slug)) {
    return NextResponse.json({ error: 'program-not-scholarship-eligible' }, { status: 422 });
  }
  if (chosenProgram && chosenProgram.family !== program_family) {
    return NextResponse.json(
      { error: 'program-family-mismatch' },
      { status: 422 },
    );
  }

  // Application JSON (free-text + buckets)
  const application_json = buildApplicationJson(body.application_json);
  if (!application_json) {
    return NextResponse.json({ error: 'invalid-application-json' }, { status: 400 });
  }

  // Same-day idempotency probe — return success without creating dupe.
  try {
    const exists = await publicFormSubmissionExistsToday(applicant_email);
    if (exists) {
      return NextResponse.json({ ok: true, application_id: null, deduped: true });
    }
  } catch (err) {
    console.error('[scholarships-apply] same-day probe failed:', err);
    // Don't fail-loud here — fall through to INSERT and let the DB unique
    // constraint catch a real duplicate.
  }

  // INSERT application + audit event.
  const userAgent = request.headers.get('user-agent') ?? null;
  let created;
  try {
    created = await createApplication({
      applicant_name,
      applicant_email,
      applicant_phone,
      preferred_language,
      program_family,
      program_slug,
      scholarship_tier,
      application_json,
      source: 'public_form',
      client_ip: ip === 'unknown' ? null : ip,
      user_agent: userAgent,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique/i.test(msg) || /duplicate/i.test(msg)) {
      // Race window between the probe + INSERT — return idempotent OK.
      return NextResponse.json({ ok: true, application_id: null, deduped: true });
    }
    console.error('[scholarships-apply] insert failed:', msg);
    return NextResponse.json({ error: 'insert-failed' }, { status: 500 });
  }

  // Fire-and-forget emails. We don't want a transient email-provider blip
  // to surface as an INSERT failure (the application IS recorded; the email
  // can be retried via the admin queue).
  const baseUrl = getBaseUrl(request);
  const adminQueueUrl = `${baseUrl}/${preferred_language}/admin/scholarships/applications/${created.id}`;
  void sendScholarshipApplicationConfirmationEmail({
    to: applicant_email,
    recipient_name: applicant_name,
    preferred_language,
  }).catch((e) => {
    console.error('[scholarships-apply] confirmation email failed:', e);
  });
  const adminAlertList = getAdminAlertList();
  if (adminAlertList) {
    void sendScholarshipAdminNotificationEmail({
      to: adminAlertList,
      applicant_name,
      applicant_email,
      program_slug,
      scholarship_tier,
      admin_queue_url: adminQueueUrl,
    }).catch((e) => {
      console.error('[scholarships-apply] admin notification failed:', e);
    });
  }

  return NextResponse.json({
    ok: true,
    application_id: created.id,
    deduped: false,
  });
}

// Reject non-POST methods.
export async function GET() {
  return NextResponse.json({ error: 'method-not-allowed' }, { status: 405 });
}
export async function PUT() {
  return NextResponse.json({ error: 'method-not-allowed' }, { status: 405 });
}
export async function DELETE() {
  return NextResponse.json({ error: 'method-not-allowed' }, { status: 405 });
}
export async function PATCH() {
  return NextResponse.json({ error: 'method-not-allowed' }, { status: 405 });
}
