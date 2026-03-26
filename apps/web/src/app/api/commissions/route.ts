import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';
import type {
  CommissionRate,
  CommissionRatePayload,
  CommissionsResponse,
  EarningPayload,
  EarningResponse,
} from '@/types/commission-system';

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
  const profile = data as Record<string, unknown> | null;
  return (profile?.role as string | undefined) ?? null;
}

/** GET /api/commissions — Return commission rates */
export async function GET(request: NextRequest): Promise<NextResponse<CommissionsResponse | { error: string }>> {
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
    return NextResponse.json({ rates: (rates as CommissionRate[]) ?? [] });
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

  const rates: CommissionRate[] = [
    ...(globalRates as CommissionRate[] ?? []),
    ...(coachOverrides as CommissionRate[] ?? []),
  ];

  return NextResponse.json({ rates });
}

/** POST /api/commissions — Record a new earning (admin only) */
export async function POST(request: NextRequest): Promise<NextResponse<EarningResponse | { error: string }>> {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json()) as EarningPayload;
  const { source_type, source_id, coach_id, gross_amount, currency = 'AED' } = body;

  if (!source_type || !source_id || !coach_id || !gross_amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Rate lookup chain (3-tier): coach-specific → product/service-specific → global
  let rate: number | null = null;

  // 1. Coach-specific override
  const { data: coachRateData } = await supabase
    .from('commission_rates')
    .select('rate_pct')
    .eq('scope', 'coach')
    .eq('scope_id', coach_id)
    .single();
  if (coachRateData) {
    const rateRow = coachRateData as Record<string, unknown>;
    rate = Number(rateRow.rate_pct);
  }

  // 2. Product/service-specific (item-level rate)
  if (rate === null) {
    const targetScope = source_type === 'service_booking' ? 'service' : 'product';
    const { data: itemRateData } = await supabase
      .from('commission_rates')
      .select('rate_pct')
      .eq('scope', targetScope)
      .eq('scope_id', source_id)
      .single();
    if (itemRateData) {
      const rateRow = itemRateData as Record<string, unknown>;
      rate = Number(rateRow.rate_pct);
    }
  }

  // 3. Global fallback (category-aware)
  if (rate === null) {
    const category = source_type === 'service_booking' ? 'services' : 'products';
    const { data: globalRateData } = await supabase
      .from('commission_rates')
      .select('rate_pct')
      .eq('scope', 'global')
      .eq('category', category)
      .is('scope_id', null)
      .single();
    if (globalRateData) {
      const rateRow = globalRateData as Record<string, unknown>;
      rate = Number(rateRow.rate_pct);
    }
  }

  if (rate === null) {
    return NextResponse.json({ error: 'No commission rate found' }, { status: 400 });
  }

  if (rate < 0 || rate > 100) {
    return NextResponse.json({ error: 'Invalid commission rate' }, { status: 400 });
  }

  // Calculate amounts in minor units
  const commission_amount = Math.round(gross_amount * rate / 100);
  const net_amount = commission_amount;
  const available_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: earning, error } = await supabase
    .from('earnings')
    .insert({
      user_id: coach_id,
      source_type,
      source_id,
      gross_amount,
      commission_pct: rate,
      commission_amount,
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
export async function PATCH(
  request: NextRequest
): Promise<NextResponse<{ rate: CommissionRate } | { error: string }>> {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json()) as CommissionRatePayload;
  const { scope, scope_id, rate_pct, category = 'services' } = body;

  if (!scope || rate_pct === undefined || rate_pct === null) {
    return NextResponse.json({ error: 'Missing scope or rate_pct' }, { status: 400 });
  }

  if (rate_pct < 0 || rate_pct > 100) {
    return NextResponse.json({ error: 'Rate must be between 0 and 100' }, { status: 400 });
  }

  // Upsert: find existing rate for this scope+scope_id+category
  let query = supabase
    .from('commission_rates')
    .select('id')
    .eq('scope', scope)
    .eq('category', category);

  if (scope_id) {
    query = query.eq('scope_id', scope_id);
  } else {
    query = query.is('scope_id', null);
  }

  const { data: existingArr, error: findError } = await query;
  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  const existingData = existingArr as unknown as Array<Record<string, unknown>> | null;
  const existing = existingData && existingData.length > 0 ? existingData[0] : null;

  if (existing) {
    // Update existing rate
    const { data: updated, error } = await supabase
      .from('commission_rates')
      .update({ rate_pct, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rate: updated as CommissionRate });
  }

  // Insert new rate
  const { data: inserted, error } = await supabase
    .from('commission_rates')
    .insert({
      scope,
      scope_id: scope_id ?? null,
      rate_pct,
      category,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rate: inserted as CommissionRate }, { status: 201 });
}
