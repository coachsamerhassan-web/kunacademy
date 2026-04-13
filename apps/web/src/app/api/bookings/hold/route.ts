import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { bookings } from '@kunacademy/db/schema';
import { eq, and, lt, gt, sql } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 10 * 60 * 1000);

/**
 * POST /api/bookings/hold
 * Body: { coach_id, start_time, end_time, service_id }
 * Creates a held booking for 5 minutes (optimistic lock).
 * Returns: { hold_id, held_until }
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.', error_ar: 'طلبات كثيرة. يرجى المحاولة لاحقًا.' }, { status: 429 });
  }

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { coach_id?: string; start_time?: string; end_time?: string; service_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { coach_id, start_time, end_time, service_id } = body;
  if (!coach_id || !start_time || !end_time || !service_id) {
    return NextResponse.json(
      { error: 'coach_id, start_time, end_time, service_id are required' },
      { status: 400 }
    );
  }

  // Validate UUIDs to prevent injection / oversized values
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(String(coach_id)) || !uuidRegex.test(String(service_id))) {
    return NextResponse.json({ error: 'Invalid coach_id or service_id' }, { status: 400 });
  }

  // Validate ISO 8601 datetime strings (length + parsability)
  if (String(start_time).length > 50 || String(end_time).length > 50) {
    return NextResponse.json({ error: 'Invalid time format' }, { status: 400 });
  }
  const parsedStart = new Date(String(start_time));
  const parsedEnd = new Date(String(end_time));
  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    return NextResponse.json({ error: 'Invalid time format' }, { status: 400 });
  }
  if (parsedEnd <= parsedStart) {
    return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 });
  }

  const now = new Date();
  const heldUntil = new Date(now.getTime() + 5 * 60 * 1000); // 5 min hold

  // Check for existing active bookings and insert hold in a SINGLE transaction
  // to prevent double-booking race conditions (FOR UPDATE locks overlapping rows)
  const result = await withAdminContext(async (db) => {
    // 1. Check conflicts WITH row lock (FOR UPDATE prevents concurrent reads)
    const conflicts = await db.execute(
      sql`SELECT id, status, held_until FROM bookings
          WHERE provider_id = ${coach_id}
          AND start_time < ${parsedEnd.toISOString()}
          AND end_time > ${parsedStart.toISOString()}
          FOR UPDATE`
    );

    // 2. Check if any are blocking
    const hasConflict = (conflicts.rows || []).some((b: any) => {
      if (b.status === 'pending' || b.status === 'confirmed') return true;
      if (b.status === 'held' && b.held_until && new Date(b.held_until) > now) return true;
      return false;
    });

    if (hasConflict) return { conflict: true as const };

    // 3. Insert in same transaction
    const [inserted] = await db.insert(bookings).values({
      customer_id: user.id,
      provider_id: coach_id,
      service_id,
      start_time: parsedStart.toISOString(),
      end_time: parsedEnd.toISOString(),
      status: 'held',
      held_until: heldUntil.toISOString(),
      held_by: user.id,
    }).returning({ id: bookings.id, held_until: bookings.held_until });

    return { conflict: false as const, inserted };
  });

  if (result.conflict) {
    return NextResponse.json(
      { error: 'Slot is not available' },
      { status: 409 }
    );
  }

  const inserted = result.inserted;

  if (!inserted) {
    console.error('[bookings/hold] insert failed');
    return NextResponse.json({ error: 'Failed to hold slot' }, { status: 500 });
  }

  return NextResponse.json({
    hold_id: inserted.id,
    held_until: inserted.held_until,
  });
}
