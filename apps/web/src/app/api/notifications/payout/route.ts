import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notify } from '@kunacademy/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/notifications/payout
 * Called by admin payouts page after status update.
 * Sends payout status notification to the coach.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify admin
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (adminProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { payoutId, newStatus } = await request.json();
  if (!payoutId || !newStatus) {
    return NextResponse.json({ error: 'payoutId and newStatus required' }, { status: 400 });
  }

  // Fetch payout with coach profile
  const { data: payout } = await supabase
    .from('payout_requests')
    .select('*, requester:profiles!payout_requests_user_id_fkey(full_name_ar, full_name_en, email)')
    .eq('id', payoutId)
    .single();

  if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });

  const requester = payout.requester as any;
  if (!requester?.email) return NextResponse.json({ ok: true, skipped: 'no email' });

  const statusMap: Record<string, 'approved' | 'completed' | 'rejected'> = {
    approved: 'approved',
    processed: 'completed',
    rejected: 'rejected',
  };

  const results = await notify({
    event: 'payout_update',
    locale: 'ar',
    email: requester.email,
    data: {
      name: requester.full_name_ar || requester.full_name_en || requester.email,
      amount: String(payout.amount || 0),
      currency: payout.currency || 'AED',
      status: statusMap[newStatus] || newStatus,
      note: payout.notes || '',
    },
  });

  return NextResponse.json({ ok: true, results });
}
