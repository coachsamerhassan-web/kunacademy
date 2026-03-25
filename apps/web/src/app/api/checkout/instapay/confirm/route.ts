// @ts-nocheck — Generated DB types lack instapay/tabby gateway values
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Customer confirms they've sent the InstaPay transfer */
export async function POST(request: NextRequest) {
  try {
    const { payment_id, sender_name, transaction_ref } = await request.json();

    if (!payment_id) {
      return NextResponse.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    // Update payment metadata with customer confirmation
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status !== 'pending') {
      return NextResponse.json({ error: 'Payment already processed' }, { status: 400 });
    }

    const metadata = (payment.metadata || {}) as Record<string, unknown>;

    const { error } = await supabase
      .from('payments')
      .update({
        metadata: {
          ...metadata,
          verification_status: 'customer_confirmed',
          sender_name: sender_name || null,
          transaction_ref: transaction_ref || null,
          confirmed_at: new Date().toISOString(),
        },
      })
      .eq('id', payment_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // TODO: Send Telegram notification to admin
    // "New InstaPay payment awaiting verification: {amount} EGP from {sender_name}"

    return NextResponse.json({
      status: 'awaiting_verification',
      message: 'Payment confirmation received. We will verify and activate your access shortly.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
