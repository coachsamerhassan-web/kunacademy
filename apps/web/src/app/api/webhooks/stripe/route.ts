// @ts-nocheck — Generated DB types stale. Fix with: supabase gen types
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
      const paymentId = result.metadata?.payment_id;

      if (paymentId) {
        // Update existing payment record (created during checkout)
        await supabase.from('payments').update({
          status: 'completed',
          gateway_payment_id: result.sessionId,
        }).eq('id', paymentId);

        // Handle enrollment if it's a course purchase
        const itemType = result.metadata?.item_type;
        const itemId = result.metadata?.item_id;
        const userId = result.metadata?.user_id;

        if (itemType === 'course' && itemId && userId) {
          // Auto-enroll student on successful payment
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
            payment_id: paymentId,
          }).eq('id', itemId);
        }

        if (itemType === 'order' && itemId) {
          await supabase.from('orders').update({
            status: 'paid',
            payment_id: paymentId,
          }).eq('id', itemId);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[stripe-webhook]', err.message);
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
  }
}
