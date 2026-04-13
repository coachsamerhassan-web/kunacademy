import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext, sql } from '@kunacademy/db';

// ---------------------------------------------------------------------------
// Rate limiter: max 3 claims per email per hour (in-process Map)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase().trim();
  const timestamps = rateLimitMap.get(key) ?? [];
  // Purge entries older than window
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  rateLimitMap.set(key, recent);
  return recent.length >= RATE_LIMIT_MAX;
}

function recordAttempt(email: string): void {
  const key = email.toLowerCase().trim();
  const timestamps = rateLimitMap.get(key) ?? [];
  timestamps.push(Date.now());
  rateLimitMap.set(key, timestamps);
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeText(val: unknown, maxLen: number): string | null {
  if (typeof val !== 'string') return null;
  return val.trim().slice(0, maxLen) || null;
}

// ---------------------------------------------------------------------------
// POST /api/graduates/claim
//
// Body: { member_id: uuid, email: string, message?: string }
//
// Logic:
//   1. Validate inputs
//   2. Rate-limit by email (3/hr)
//   3. Check community_members row exists and is unclaimed (profile_id IS NULL)
//   4. If email matches community_members.email → auto-approve (set claimed_at)
//   5. If no match → create claim_requests record for admin review
//   6. If already claimed → 409
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Validate inputs ──────────────────────────────────────────────────
    const member_id = sanitizeText(body.member_id, 36);
    const email = sanitizeText(body.email, 320);
    const message = sanitizeText(body.message, 500);

    if (!member_id || !UUID_RE.test(member_id)) {
      return NextResponse.json({ error: 'Invalid member_id' }, { status: 400 });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Rate limit ───────────────────────────────────────────────────────
    if (isRateLimited(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Too many claim attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // ── Check member exists ──────────────────────────────────────────────
    const memberRows = await withAdminContext(async (adminDb: any) =>
      adminDb.execute(sql`
        SELECT id, email, profile_id, claimed_at, name_ar, name_en
        FROM community_members
        WHERE id = ${member_id}
        LIMIT 1
      `)
    );

    const member = memberRows.rows[0] as {
      id: string;
      email: string | null;
      profile_id: string | null;
      claimed_at: string | null;
      name_ar: string;
      name_en: string;
    } | undefined;

    if (!member) {
      return NextResponse.json({ error: 'Graduate not found' }, { status: 404 });
    }

    // ── Already claimed ──────────────────────────────────────────────────
    if (member.profile_id || member.claimed_at) {
      return NextResponse.json(
        { error: 'Profile already claimed' },
        { status: 409 }
      );
    }

    // Record the attempt for rate limiting
    recordAttempt(normalizedEmail);

    // ── Check for duplicate pending claim ────────────────────────────────
    const existingClaim = await withAdminContext(async (adminDb: any) =>
      adminDb.execute(sql`
        SELECT id, status FROM claim_requests
        WHERE member_id = ${member_id}
          AND email = ${normalizedEmail}
          AND status = 'pending'
        LIMIT 1
      `)
    );

    if (existingClaim.rows.length > 0) {
      return NextResponse.json(
        { status: 'pending', message: 'A claim request for this profile is already pending review.' },
        { status: 200 }
      );
    }

    // ── Email match → auto-approve ───────────────────────────────────────
    const memberEmail = (member.email || '').toLowerCase().trim();
    if (memberEmail && memberEmail === normalizedEmail) {
      await withAdminContext(async (adminDb: any) =>
        adminDb.execute(sql`
          UPDATE community_members
          SET claimed_at = NOW(), updated_at = NOW()
          WHERE id = ${member_id}
        `)
      );

      // Also create an approved claim_requests record for audit trail
      await withAdminContext(async (adminDb: any) =>
        adminDb.execute(sql`
          INSERT INTO claim_requests (member_id, email, message, status)
          VALUES (${member_id}, ${normalizedEmail}, ${message}, 'approved')
        `)
      );

      return NextResponse.json({
        status: 'approved',
        message: 'Profile claimed successfully. Your email matches our records.',
      });
    }

    // ── No match → pending claim request ─────────────────────────────────
    await withAdminContext(async (adminDb: any) =>
      adminDb.execute(sql`
        INSERT INTO claim_requests (member_id, email, message, status)
        VALUES (${member_id}, ${normalizedEmail}, ${message}, 'pending')
      `)
    );

    return NextResponse.json({
      status: 'pending',
      message: 'Claim request submitted for review. An administrator will review your request.',
    });
  } catch (err: any) {
    console.error('[api/graduates/claim POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
