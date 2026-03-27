import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook } from '@kunacademy/payments';
import { createAdminClient } from '@kunacademy/db';
import { randomUUID } from 'crypto';
import { getBusinessConfig } from '@/lib/cms-config';

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

        // Handle product purchases (digital/hybrid)
        if (itemType === 'product' && itemId && userId) {
          // Get the product to check if it's digital
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, product_type')
            .eq('id', itemId)
            .single();

          if (!productError && product && (product.product_type === 'digital' || product.product_type === 'subscription')) {
            // Find or create the order for this purchase
            // First, check if there's already an order for this payment
            const { data: existingOrder, error: orderError } = await supabase
              .from('orders')
              .select('id')
              .eq('payment_id', paymentId)
              .single();

            let orderId = existingOrder?.id;

            if (!existingOrder && !orderError) {
              // Create an order if it doesn't exist
              const { data: newOrder, error: newOrderError } = await supabase
                .from('orders')
                .insert({
                  user_id: userId,
                  status: 'paid',
                  payment_id: paymentId,
                  total_amount: (result as any).amount || 0,
                  currency: (result as any).currency || 'AED',
                } as any)
                .select('id')
                .single();

              if (!newOrderError && newOrder) {
                orderId = newOrder.id;
              }
            }

            // Create order_item if doesn't exist
            if (orderId) {
              const { data: existingItem } = await supabase
                .from('order_items')
                .select('id')
                .eq('order_id', orderId)
                .eq('product_id', itemId)
                .single();

              if (!existingItem) {
                await supabase
                  .from('order_items')
                  .insert({
                    order_id: orderId,
                    product_id: itemId,
                    quantity: 1,
                    unit_price: (result as any).amount || 0,
                  } as any);
              }

              // Get the order_item ID for the download token
              const { data: orderItem } = await supabase
                .from('order_items')
                .select('id')
                .eq('order_id', orderId)
                .eq('product_id', itemId)
                .single();

              if (orderItem) {
                // Get the digital asset
                const { data: asset } = await supabase
                  .from('digital_assets')
                  .select('id')
                  .eq('product_id', itemId)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .single();

                if (asset) {
                  // Create download token
                  const config = await getBusinessConfig();
                  const token = randomUUID();
                  const expiresAt = new Date(
                    Date.now() + config.download_token_expiry_hours * 60 * 60 * 1000
                  ).toISOString();

                  await supabase
                    .from('download_tokens')
                    .insert({
                      order_item_id: orderItem.id,
                      user_id: userId,
                      asset_id: asset.id,
                      token,
                      expires_at: expiresAt,
                      download_count: 0,
                      max_downloads: config.download_max_count,
                    } as any);

                  console.log(`[stripe-webhook] Generated download token for product ${itemId}`);
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[stripe-webhook]', err.message);
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
  }
}
