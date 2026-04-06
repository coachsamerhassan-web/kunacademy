/**
 * GET  /api/coach/payout-profile
 *   Returns the authenticated coach's payout profile.
 *   Bank fields are returned MASKED ("****") — plaintext is NEVER sent here.
 *
 * PUT  /api/coach/payout-profile
 *   Upsert the coach's payout method + details.
 *   - method = 'stripe_connect' → store stripe_account_id
 *   - method = 'manual_bank'   → encrypt bank fields server-side, store ciphertext + IV
 *
 * Security rules:
 *   - Server-side only (encryption key never leaves this route)
 *   - Decryption NEVER happens here — only the admin endpoint may decrypt
 *   - IV is re-generated on every PUT (key rotation friendly)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, encryptField } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';

// ── Mask helper ───────────────────────────────────────────────────────────────
/** Replace ciphertext with a fixed mask — never exposes encrypted bytes client-side */
function masked(value: string | null | undefined): string {
  return value ? '****' : '';
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`
        SELECT id, user_id, method, stripe_account_id, stripe_onboarding_complete,
               encrypted_bank_name, encrypted_iban, encrypted_account_number, encrypted_swift,
               created_at, updated_at
        FROM coach_payout_profiles
        WHERE user_id = ${user.id}
        LIMIT 1
      `
    );
    return rows.rows[0] as any | undefined;
  });

  if (!data) {
    return NextResponse.json({ profile: null });
  }

  // Return masked profile — ciphertext is replaced with "****" (or "" if empty)
  const profile = {
    id: data.id,
    user_id: data.user_id,
    method: data.method,
    stripe_account_id: data.stripe_account_id ?? null,
    stripe_onboarding_complete: data.stripe_onboarding_complete ?? false,
    // Bank fields: show masked indicator so UI knows data exists
    bank_name: masked(data.encrypted_bank_name),
    iban: masked(data.encrypted_iban),
    account_number: masked(data.encrypted_account_number),
    swift: masked(data.encrypted_swift),
    created_at: data.created_at,
    updated_at: data.updated_at,
  };

  return NextResponse.json({ profile });
}

// ── PUT ───────────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { method } = body as { method?: string };

  if (!method || !['stripe_connect', 'manual_bank'].includes(method)) {
    return NextResponse.json(
      { error: 'method must be "stripe_connect" or "manual_bank"' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  if (method === 'stripe_connect') {
    // ── Stripe Connect path ────────────────────────────────────────────────
    const { stripe_account_id, stripe_onboarding_complete } = body as {
      stripe_account_id?: string;
      stripe_onboarding_complete?: boolean;
    };

    if (!stripe_account_id) {
      return NextResponse.json(
        { error: 'stripe_account_id is required for stripe_connect method' },
        { status: 400 }
      );
    }

    const data = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`
          INSERT INTO coach_payout_profiles (user_id, method, stripe_account_id, stripe_onboarding_complete, updated_at, encrypted_bank_name, encrypted_iban, encrypted_account_number, encrypted_swift, encryption_iv)
          VALUES (${user.id}, 'stripe_connect', ${stripe_account_id}, ${stripe_onboarding_complete ?? false}, ${now}, NULL, NULL, NULL, NULL, NULL)
          ON CONFLICT (user_id) DO UPDATE SET
            method = 'stripe_connect',
            stripe_account_id = EXCLUDED.stripe_account_id,
            stripe_onboarding_complete = EXCLUDED.stripe_onboarding_complete,
            updated_at = EXCLUDED.updated_at,
            encrypted_bank_name = NULL,
            encrypted_iban = NULL,
            encrypted_account_number = NULL,
            encrypted_swift = NULL,
            encryption_iv = NULL
          RETURNING id, user_id, method, stripe_account_id, stripe_onboarding_complete, created_at, updated_at
        `
      );
      return rows.rows[0] as any | undefined;
    });

    if (!data) return NextResponse.json({ error: 'Upsert failed' }, { status: 500 });
    return NextResponse.json({ profile: data }, { status: 200 });

  } else {
    // ── Manual Bank Transfer path ──────────────────────────────────────────
    const { bank_name, iban, account_number, swift } = body as {
      bank_name?: string;
      iban?: string;
      account_number?: string;
      swift?: string;
    };

    if (!bank_name || !iban) {
      return NextResponse.json(
        { error: 'bank_name and iban are required for manual_bank method' },
        { status: 400 }
      );
    }

    // Encrypt each field independently with its own IV
    let encResult: { encrypted: string; iv: string };
    try {
      encResult = encryptField(bank_name);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[payout-profile] Encryption failed:', msg);
      return NextResponse.json(
        { error: 'Encryption configuration error — contact administrator' },
        { status: 500 }
      );
    }

    const encBankName = encResult;
    const encIban = encryptField(iban);
    const encAccountNumber = account_number ? encryptField(account_number) : null;
    const encSwift = swift ? encryptField(swift) : null;

    // Store per-field IVs encoded in a JSON object so each field can be decrypted independently.
    const ivMap = JSON.stringify({
      bank_name_iv: encBankName.iv,
      iban_iv: encIban.iv,
      account_number_iv: encAccountNumber?.iv ?? null,
      swift_iv: encSwift?.iv ?? null,
    });

    const data = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`
          INSERT INTO coach_payout_profiles (user_id, method, encrypted_bank_name, encrypted_iban, encrypted_account_number, encrypted_swift, encryption_iv, updated_at, stripe_account_id, stripe_onboarding_complete)
          VALUES (${user.id}, 'manual_bank', ${encBankName.encrypted}, ${encIban.encrypted}, ${encAccountNumber?.encrypted ?? null}, ${encSwift?.encrypted ?? null}, ${ivMap}, ${now}, NULL, false)
          ON CONFLICT (user_id) DO UPDATE SET
            method = 'manual_bank',
            encrypted_bank_name = EXCLUDED.encrypted_bank_name,
            encrypted_iban = EXCLUDED.encrypted_iban,
            encrypted_account_number = EXCLUDED.encrypted_account_number,
            encrypted_swift = EXCLUDED.encrypted_swift,
            encryption_iv = EXCLUDED.encryption_iv,
            updated_at = EXCLUDED.updated_at,
            stripe_account_id = NULL,
            stripe_onboarding_complete = false
          RETURNING id, user_id, method, stripe_account_id, stripe_onboarding_complete, created_at, updated_at
        `
      );
      return rows.rows[0] as any | undefined;
    });

    if (!data) return NextResponse.json({ error: 'Upsert failed' }, { status: 500 });
    return NextResponse.json({ profile: data }, { status: 200 });
  }
}
