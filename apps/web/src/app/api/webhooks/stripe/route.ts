// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook } from '@kunacademy/payments';
import { createAdminClient } from '@kunacademy/db';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  try {
    const result = await handleWebhook(body, signature);
    if (result.type === 'payment_completed') {
      const supabase = createAdminClient();
      const orderId = result.metadata?.order_id;
      if (orderId) {
        await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId);
        await supabase.from('payments').insert({
          order_id: orderId,
          gateway: 'stripe',
          gateway_payment_id: result.sessionId,
          amount: 0, // Will be filled from session
          currency: 'aed',
          status: 'completed',
        });
      }
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 });
  }
}
