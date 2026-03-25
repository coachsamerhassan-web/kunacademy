// @ts-nocheck — Generated DB types lack instapay/tabby gateway values. Fix with: supabase gen types
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** GET: List pending InstaPay payments awaiting verification */
export async function GET() {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('gateway', 'instapay' as any)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const payments = (data || []).map((p) => {
    const meta = (p.metadata || {}) as Record<string, unknown>;
    return {
      id: p.id,
      amount: (p.amount / 100).toFixed(2),
      amount_raw: p.amount,
      unique_suffix: p.amount % 100,
      created_at: p.created_at,
      item_type: meta.item_type,
      item_id: meta.item_id,
      item_name: meta.item_name,
      user_email: meta.user_email,
      user_id: meta.user_id,
      sender_name: meta.sender_name,
      transaction_ref: meta.transaction_ref,
      verification_status: meta.verification_status,
      confirmed_at: meta.confirmed_at,
    };
  });

  return NextResponse.json({ payments });
}

/** POST: Admin verifies or rejects an InstaPay payment */
export async function POST(request: NextRequest) {
  try {
    const { payment_id, action, admin_note } = await request.json();

    if (!payment_id || !action) {
      return NextResponse.json({ error: 'Missing payment_id or action' }, { status: 400 });
    }

    if (!['verify', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be verify or reject' }, { status: 400 });
    }

    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const metadata = (payment.metadata || {}) as Record<string, unknown>;
    const newStatus = action === 'verify' ? 'completed' : 'failed';

    // Update payment
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: newStatus as any,
        metadata: {
          ...metadata,
          verification_status: action === 'verify' ? 'verified' : 'rejected',
          verified_at: new Date().toISOString(),
          admin_note: admin_note || null,
        },
      })
      .eq('id', payment_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // On verification: fulfill the purchase
    if (action === 'verify') {
      const itemType = metadata.item_type as string;
      const itemId = metadata.item_id as string;
      const userId = metadata.user_id as string;

      if (itemType === 'course' && itemId && userId) {
        await supabase.from('enrollments').upsert({
          user_id: userId,
          course_id: itemId,
          status: 'enrolled',
          enrollment_type: 'recorded',
        }, { onConflict: 'user_id,course_id' });
      }

      if (itemType === 'booking' && itemId) {
        await supabase.from('bookings').update({
          status: 'confirmed',
          payment_id: payment_id,
        }).eq('id', itemId);
      }

      if (itemType === 'order' && itemId) {
        await supabase.from('orders').update({
          status: 'paid',
          payment_id: payment_id,
        }).eq('id', itemId);
      }

      // TODO: Send confirmation email/WhatsApp to customer
    }

    return NextResponse.json({
      status: newStatus,
      message: action === 'verify'
        ? 'Payment verified. Customer access activated.'
        : 'Payment rejected.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
