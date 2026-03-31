import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

/**
 * POST /api/bookings/hold
 * Body: { coach_id, start_time, end_time, service_id }
 * Creates a held booking for 5 minutes (optimistic lock).
 * Returns: { hold_id, held_until }
 */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
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

  const now = new Date();
  const heldUntil = new Date(now.getTime() + 5 * 60 * 1000); // 5 min hold

  // Check for existing active bookings (confirmed, pending) or active holds at this slot
  const { data: conflicts } = await supabase
    .from('bookings')
    .select('id, status, held_until')
    .eq('provider_id', coach_id)
    .lt('start_time', end_time)
    .gt('end_time', start_time);

  const hasConflict = (conflicts || []).some(b => {
    if (b.status === 'pending' || b.status === 'confirmed') return true;
    if (b.status === 'held' && b.held_until && b.held_until > now.toISOString()) return true;
    return false;
  });

  if (hasConflict) {
    return NextResponse.json(
      { error: 'Slot is not available' },
      { status: 409 }
    );
  }

  // Insert hold record
  const { data: inserted, error: insertError } = await supabase
    .from('bookings')
    .insert({
      customer_id: user.id,
      provider_id: coach_id,
      service_id,
      start_time,
      end_time,
      status: 'held',
      held_until: heldUntil.toISOString(),
      held_by: user.id,
    } as any)
    .select('id, held_until')
    .single();

  if (insertError || !inserted) {
    console.error('[bookings/hold] insert error:', insertError);
    return NextResponse.json({ error: 'Failed to hold slot' }, { status: 500 });
  }

  return NextResponse.json({
    hold_id: inserted.id,
    held_until: (inserted as any).held_until,
  });
}
