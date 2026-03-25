// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';

const supabase = createClient<Database>(
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

async function getUserRole(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role ?? null;
}

/** GET /api/commissions — Return commission rates */
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);

  if (role === 'admin') {
    // Admin sees all rates
    const { data: rates, error } = await supabase
      .from('commission_rates')
      .select('*')
      .order('scope', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rates });
  }

  // Coach sees global rates + their own overrides
  const { data: globalRates } = await supabase
    .from('commission_rates')
    .select('*')
    .eq('scope', 'global');

  const { data: coachOverrides } = await supabase
    .from('commission_rates')
    .select('*')
    .eq('scope', 'coach')
    .eq('scope_id', user.id);

  return NextResponse.json({
    rates: [...(globalRates ?? []), ...(coachOverrides ?? [])],
  });
}

/** POST /api/commissions — Record a new earning */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { source_type, source_id, coach_id, gross_amount, currency = 'AED' } = body;

  if (!source_type || !source_id || !coach_id || !gross_amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Rate lookup chain: coach-specific → product/service-specific → global
  let rate: number | null = null;

  // 1. Coach-specific override
  const { data: coachRate } = await supabase
    .from('commission_rates')
    .select('rate')
    .eq('scope', 'coach')
    .eq('scope_id', coach_id)
    .single();
  if (coachRate) rate = Number(coachRate.rate);

  // 2. Product/service-specific
  if (rate === null) {
    const { data: specificRate } = await supabase
      .from('commission_rates')
      .select('rate')
      .eq('scope', source_type === 'service_booking' ? 'service' : 'product')
      .eq('scope_id', source_id)
      .single();
    if (specificRate) rate = Number(specificRate.rate);
  }

  // 3. Global for source type
  if (rate === null) {
    const globalScope = source_type === 'service_booking' ? 'service' : 'product';
    const { data: globalRate } = await supabase
      .from('commission_rates')
      .select('rate')
      .eq('scope', 'global')
      .is('scope_id', null)
      .ilike('id', '%') // match any
      .limit(10);

    // Find the global rate matching the source type
    const { data: globalRateRow } = await supabase
      .from('commission_rates')
      .select('rate')
      .eq('scope', 'global')
      .is('scope_id', null);

    // Pick the right global rate based on source_type
    if (globalRateRow && globalRateRow.length > 0) {
      // Convention: first seeded row = service (30%), second = product (20%)
      // Better: look for a comment/tag. For now, use ordering.
      const sorted = globalRateRow.sort((a: any, b: any) => Number(b.rate) - Number(a.rate));
      if (source_type === 'service_booking') {
        rate = Number(sorted[0].rate); // higher rate = service
      } else {
        rate = Number(sorted[sorted.length - 1].rate); // lower rate = product
      }
    }
  }

  if (rate === null) {
    return NextResponse.json({ error: 'No commission rate found' }, { status: 400 });
  }

  const net_amount = Math.round(gross_amount * rate / 100);
  const available_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: earning, error } = await supabase
    .from('earnings')
    .insert({
      coach_id,
      source_type,
      source_id,
      gross_amount,
      commission_rate: rate,
      net_amount,
      currency,
      status: 'pending',
      available_at,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ earning }, { status: 201 });
}

/** PATCH /api/commissions — Update commission rate (admin only) */
export async function PATCH(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { scope, scope_id, rate } = body;

  if (!scope || rate === undefined || rate === null) {
    return NextResponse.json({ error: 'Missing scope or rate' }, { status: 400 });
  }

  if (rate < 0 || rate > 100) {
    return NextResponse.json({ error: 'Rate must be between 0 and 100' }, { status: 400 });
  }

  // Upsert: find existing rate for this scope+scope_id, update or insert
  const query = supabase
    .from('commission_rates')
    .select('id')
    .eq('scope', scope);

  if (scope_id) {
    query.eq('scope_id', scope_id);
  } else {
    query.is('scope_id', null);
  }

  const { data: existing } = await query.single();

  if (existing) {
    const { data: updated, error } = await supabase
      .from('commission_rates')
      .update({ rate, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rate: updated });
  }

  const { data: inserted, error } = await supabase
    .from('commission_rates')
    .insert({ scope, scope_id: scope_id ?? null, rate })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rate: inserted }, { status: 201 });
}
