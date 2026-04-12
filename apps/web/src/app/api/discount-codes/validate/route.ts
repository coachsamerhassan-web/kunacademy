import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { eq } from 'drizzle-orm';
import { discount_codes } from '@kunacademy/db/schema';

// In-memory rate limiter: max 10 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true; // allowed
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // blocked
  }

  entry.count++;
  return true; // allowed
}

/** POST /api/discount-codes/validate — public endpoint for booking flow */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { valid: false, error: 'Too many requests. Please wait a minute before trying again.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { code, service_id, provider_id } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'code is required' }, { status: 400 });
    }
    if (!service_id) {
      return NextResponse.json({ valid: false, error: 'service_id is required' }, { status: 400 });
    }

    const upperCode = code.toUpperCase().trim();

    // Fetch the code
    const [row] = await db
      .select()
      .from(discount_codes)
      .where(eq(discount_codes.code, upperCode))
      .limit(1) as Array<typeof discount_codes.$inferSelect>;

    if (!row) {
      return NextResponse.json({ valid: false, error: 'Invalid discount code' });
    }

    // 1. Must be active
    if (!row.is_active) {
      return NextResponse.json({ valid: false, error: 'This discount code is no longer active' });
    }

    // 2. Must be within validity window
    const now = new Date();
    const validFrom = new Date(row.valid_from);
    const validUntil = new Date(row.valid_until);

    if (now < validFrom) {
      return NextResponse.json({ valid: false, error: 'This discount code is not yet valid' });
    }
    if (now > validUntil) {
      return NextResponse.json({ valid: false, error: 'This discount code has expired' });
    }

    // 3. Usage limit check
    if (row.max_uses !== null && row.current_uses >= row.max_uses) {
      return NextResponse.json({ valid: false, error: 'This discount code has reached its usage limit' });
    }

    // 4. Service applicability check (null = all services)
    if (row.applicable_service_ids && row.applicable_service_ids.length > 0) {
      if (!row.applicable_service_ids.includes(service_id)) {
        return NextResponse.json({
          valid: false,
          error: 'This discount code is not valid for the selected service',
        });
      }
    }

    // 5. Provider check: if code is coach-specific, must match
    if (row.provider_id) {
      if (!provider_id || row.provider_id !== provider_id) {
        return NextResponse.json({
          valid: false,
          error: 'This discount code is not valid for the selected coach',
        });
      }
    }

    // All checks passed
    return NextResponse.json({
      valid: true,
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      currency: row.currency ?? undefined,
    });
  } catch (err: any) {
    console.error('[api/discount-codes/validate]', err);
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500 });
  }
}
