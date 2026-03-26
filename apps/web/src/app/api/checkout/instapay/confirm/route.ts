// @ts-nocheck — Generated DB types lack instapay/tabby gateway values
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';
import { sendTelegramAlert } from '@kunacademy/email';

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

    // Telegram alert to Samer for manual verification
    const displayAmount = ((payment.amount as number) / 100).toFixed(2);
    const itemName = (metadata.item_name as string) || (metadata.item_type as string) || 'Unknown';
    const userEmail = (metadata.user_email as string) || 'N/A';

    try {
      await sendTelegramAlert({
        to: 'samer',
        message: [
          `<b>InstaPay Payment Awaiting Verification</b>`,
          `Amount: ${displayAmount} EGP`,
          `Sender: ${sender_name || 'Not provided'}`,
          `Ref: ${transaction_ref || 'Not provided'}`,
          `Item: ${itemName}`,
          `Email: ${userEmail}`,
          `Payment ID: ${payment_id}`,
        ].join('\n'),
      });
    } catch (e) {
      console.error('[instapay-confirm] Telegram alert failed:', e);
    }

    return NextResponse.json({
      status: 'awaiting_verification',
      message: 'Payment confirmation received. We will verify and activate your access shortly.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
