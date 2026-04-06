/**
 * POST /api/admin/payout-details
 *
 * Admin-only endpoint to decrypt and return a coach's bank details for
 * manual payout processing.
 *
 * SECURITY CONTRACT:
 *   1. Caller must be an authenticated admin (role = 'admin' | 'super_admin')
 *   2. Every successful decrypt is logged to admin_audit_log (DECRYPT_BANK_DETAILS)
 *   3. This is the ONLY place in the codebase where decryption occurs
 *   4. Decrypted values are NEVER cached, logged, or persisted
 *
 * Request body:
 *   { "user_id": "<coach-uuid>" }
 *
 * Response (method = manual_bank):
 *   {
 *     "method": "manual_bank",
 *     "bank_name": "...",
 *     "iban": "...",
 *     "account_number": "...",   // null if not set
 *     "swift": "..."             // null if not set
 *   }
 *
 * Response (method = stripe_connect):
 *   {
 *     "method": "stripe_connect",
 *     "stripe_account_id": "acct_...",
 *     "stripe_onboarding_complete": true
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, decryptField, logAdminAction } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // ── 1. Authenticate ────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── 2. Authorize — admin only ──────────────────────────────────────────────
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── 3. Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { user_id } = body as { user_id?: string };
  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  // ── 4. Fetch the coach's payout profile ────────────────────────────────────
  const profile = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`SELECT * FROM coach_payout_profiles WHERE user_id = ${user_id} LIMIT 1`
    );
    return rows.rows[0] as any | undefined;
  });

  if (!profile) {
    return NextResponse.json({ error: 'No payout profile found for this coach' }, { status: 404 });
  }

  // ── 5. Audit log — BEFORE returning any sensitive data ────────────────────
  // Non-blocking per logAdminAction contract; failure never blocks the response.
  const ip = request.headers.get('x-forwarded-for')
    ?? request.headers.get('x-real-ip')
    ?? undefined;

  await logAdminAction({
    adminId: user.id,
    action: 'DECRYPT_BANK_DETAILS',
    targetType: 'coach_payout_profile',
    targetId: user_id,
    metadata: {
      coach_user_id: user_id,
      method: profile.method,
    },
    ipAddress: ip,
  });

  // ── 6. Return by method type ───────────────────────────────────────────────
  if (profile.method === 'stripe_connect') {
    return NextResponse.json({
      method: 'stripe_connect',
      stripe_account_id: profile.stripe_account_id,
      stripe_onboarding_complete: profile.stripe_onboarding_complete ?? false,
    });
  }

  // method = 'manual_bank' — decrypt each field
  if (!profile.encrypted_iban || !profile.encryption_iv) {
    return NextResponse.json(
      { error: 'Bank details are incomplete for this coach' },
      { status: 422 }
    );
  }

  // IV map is stored as a JSON string (see payout-profile route for format)
  let ivMap: Record<string, string | null>;
  try {
    ivMap = JSON.parse(profile.encryption_iv) as Record<string, string | null>;
  } catch {
    return NextResponse.json(
      { error: 'Malformed encryption_iv — cannot decrypt' },
      { status: 500 }
    );
  }

  try {
    const bankName = profile.encrypted_bank_name && ivMap.bank_name_iv
      ? decryptField(profile.encrypted_bank_name, ivMap.bank_name_iv)
      : null;

    const iban = ivMap.iban_iv
      ? decryptField(profile.encrypted_iban, ivMap.iban_iv)
      : null;

    const accountNumber = profile.encrypted_account_number && ivMap.account_number_iv
      ? decryptField(profile.encrypted_account_number, ivMap.account_number_iv)
      : null;

    const swift = profile.encrypted_swift && ivMap.swift_iv
      ? decryptField(profile.encrypted_swift, ivMap.swift_iv)
      : null;

    return NextResponse.json({
      method: 'manual_bank',
      bank_name: bankName,
      iban,
      account_number: accountNumber,
      swift,
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[payout-details] Decryption failed:', msg);
    return NextResponse.json(
      { error: 'Decryption failed — key mismatch or data corruption' },
      { status: 500 }
    );
  }
}
