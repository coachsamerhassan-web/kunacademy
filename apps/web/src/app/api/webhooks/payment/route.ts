import { NextResponse, type NextRequest } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { captureTabbyPayment } from '@kunacademy/payments';
import { createZohoInvoice } from '@/lib/zoho-books';
import { randomUUID, timingSafeEqual } from 'crypto';
import { getBusinessConfig } from '@/lib/cms-config';
import { alertWebhookFailure, alertPaymentMismatch } from '@kunacademy/email';
import { sql } from 'drizzle-orm';

// Unified payment webhook — handles Stripe, Tabby
export async function POST(request: NextRequest) {
  const gateway = request.headers.get('x-gateway') || detectGateway(request);

  let eventId: string | null = null;
  let eventType: string = 'unknown';

  try {
    const body = await request.text();

    let paymentId: string | null = null;
    let status: 'completed' | 'failed' = 'completed';
    let tabbyPaymentIdForCapture: string | null = null;
    // 6.5.8 — amount reported by the gateway, in minor units (cents/fils), for mismatch detection
    let gatewayAmount: number | null = null;

    if (gateway === 'stripe') {
      // Verify Stripe webhook signature
      const stripeSignature = request.headers.get('stripe-signature');
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      let event: any;

      if (!webhookSecret) {
        // Fail-closed: never silently accept unsigned webhooks.
        if (process.env.NODE_ENV === 'production') {
          console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set — rejecting webhook in production');
          return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 500 });
        }
        // In dev/test: reject with a clear developer message.
        console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set. Set it in .env.local to process webhooks locally (use the Stripe CLI: stripe listen --forward-to localhost:3000/api/webhooks/payment).');
        return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET env var is not set — cannot verify signature' }, { status: 500 });
      }

      if (!stripeSignature) {
        console.error('[stripe-webhook] Missing stripe-signature header');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }

      {
        const stripe = (await import('stripe')).default;
        const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
        try {
          event = stripeClient.webhooks.constructEvent(body, stripeSignature, webhookSecret);
        } catch (err: any) {
          console.error('[stripe-webhook] Signature verification failed:', err.message);
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }

      // --- IDEMPOTENCY CHECK (event-level, primary guard) ---
      eventId = event.id; // Stripe: evt_xxx
      eventType = event.type;

      const existingEvent = await withAdminContext(async (db) => {
        const rows = await db.execute(
          sql`SELECT id, status FROM webhook_events WHERE event_id = ${eventId} LIMIT 1`
        );
        return rows.rows[0] as { id: string; status: string } | undefined;
      });

      if (existingEvent) {
        console.log(`[stripe-webhook] Duplicate event ${eventId} (status: ${existingEvent.status}) — skipping`);
        return NextResponse.json({ received: true, note: 'duplicate event' });
      }

      // Register event as processing (non-blocking — race condition handled by UNIQUE constraint)
      try {
        await withAdminContext(async (db) => {
          await db.execute(
            sql`INSERT INTO webhook_events (event_id, gateway, event_type, status) VALUES (${eventId}, 'stripe', ${eventType}, 'processing')`
          );
        });
      } catch (insertErr: any) {
        // UNIQUE violation means a concurrent request beat us here — safe to exit
        console.warn(`[stripe-webhook] Concurrent insert for event ${eventId} — exiting`);
        return NextResponse.json({ received: true, note: 'concurrent duplicate' });
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        paymentId = session.metadata?.payment_id;
        // Capture gateway-reported amount in minor units for mismatch detection
        if (typeof session.amount_total === 'number') {
          gatewayAmount = session.amount_total;
        }

        // Secondary safety net: check if already completed by gateway_payment_id
        const existingPayment = await withAdminContext(async (db) => {
          const rows = await db.execute(
            sql`SELECT id, status FROM payments WHERE gateway_payment_id = ${session.id} AND status = 'completed' LIMIT 1`
          );
          return rows.rows[0] as { id: string; status: string } | undefined;
        });

        if (existingPayment) {
          // Mark the event record as completed too (keeps audit trail consistent)
          await withAdminContext(async (db) => {
            await db.execute(
              sql`UPDATE webhook_events SET status = 'completed', completed_at = NOW() WHERE event_id = ${eventId}`
            );
          });
          return NextResponse.json({ received: true, note: 'already processed' });
        }
      } else if (event.type === 'checkout.session.expired') {
        paymentId = event.data.object.metadata?.payment_id;
        status = 'failed';
      }
    } else if (gateway === 'tabby') {
      // Verify Tabby webhook signature using timingSafeEqual to prevent timing attacks.
      // Tabby sends the secret as a literal header value (not HMAC) — UTF-8 encoding.
      const expectedSig = process.env.TABBY_WEBHOOK_SECRET;
      if (!expectedSig) {
        console.error('[tabby-webhook] TABBY_WEBHOOK_SECRET is not set — rejecting webhook');
        return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 500 });
      }
      const sigHeader = request.headers.get('x-tabby-signature');
      // NEVER log sigHeader — prevents leaking received signature in error logs.
      let sigValid = false;
      if (sigHeader) {
        const receivedBuf = Buffer.from(sigHeader, 'utf8');
        const expectedBuf = Buffer.from(expectedSig, 'utf8');
        // timingSafeEqual requires equal-length buffers — mismatched length = invalid.
        sigValid = receivedBuf.length === expectedBuf.length && timingSafeEqual(receivedBuf, expectedBuf);
      }
      if (!sigValid) {
        console.error('[tabby-webhook] Signature mismatch or missing header');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      const data = JSON.parse(body);

      // Extract Tabby event ID — use dedicated event field, fall back to payment ID + status composite
      eventId = data.event_id || data.id || `tabby-${data.payment?.id || randomUUID()}`;
      const tabbyStatus = (data.status || '').toLowerCase();
      eventType = `tabby.payment.${tabbyStatus}`;

      // --- IDEMPOTENCY CHECK (event-level, primary guard) ---
      const existingTabbyEvent = await withAdminContext(async (db) => {
        const rows = await db.execute(
          sql`SELECT id, status FROM webhook_events WHERE event_id = ${eventId} LIMIT 1`
        );
        return rows.rows[0] as { id: string; status: string } | undefined;
      });

      if (existingTabbyEvent) {
        console.log(`[tabby-webhook] Duplicate event ${eventId} (status: ${existingTabbyEvent.status}) — skipping`);
        return NextResponse.json({ received: true, note: 'duplicate event' });
      }

      // Register event as processing (non-blocking — race condition handled by UNIQUE constraint)
      try {
        await withAdminContext(async (db) => {
          await db.execute(
            sql`INSERT INTO webhook_events (event_id, gateway, event_type, status) VALUES (${eventId}, 'tabby', ${eventType}, 'processing')`
          );
        });
      } catch (insertErr: any) {
        // UNIQUE violation means a concurrent request beat us here — safe to exit
        console.warn(`[tabby-webhook] Concurrent insert for event ${eventId} — exiting`);
        return NextResponse.json({ received: true, note: 'concurrent duplicate' });
      }

      // Tabby webhooks use lowercase status ("authorized"), API uses uppercase ("AUTHORIZED")
      if (tabbyStatus === 'authorized') {
        // Find our payment by Tabby's reference_id (which is our payment.id)
        const referenceId = data.order?.reference_id || data.payment?.order?.reference_id;
        if (referenceId) {
          paymentId = referenceId;
          tabbyPaymentIdForCapture = data.id || data.payment?.id;
          status = 'completed';
          // Capture gateway-reported amount — Tabby sends decimal string (e.g. "250.00"), convert to minor units
          const rawAmount = data.payment?.amount ?? data.amount;
          if (rawAmount !== undefined && rawAmount !== null) {
            gatewayAmount = Math.round(parseFloat(String(rawAmount)) * 100);
          }
        }
      } else if (tabbyStatus === 'rejected' || tabbyStatus === 'expired') {
        const referenceId = data.order?.reference_id || data.payment?.order?.reference_id;
        if (referenceId) {
          paymentId = referenceId;
          status = 'failed';
        }
      }
    }

    if (!paymentId) {
      const noPaymentIdError = 'No payment ID found in event payload';
      // Mark event as failed if we registered it but couldn't extract a payment ID
      if (eventId) {
        await withAdminContext(async (db) => {
          await db.execute(
            sql`UPDATE webhook_events SET status = 'failed', error_message = ${noPaymentIdError} WHERE event_id = ${eventId}`
          );
        });
        // Alert Samer + Amin — non-blocking
        void alertWebhookFailure({
          gateway,
          eventType,
          eventId,
          error: noPaymentIdError,
        });
      }
      return NextResponse.json({ error: 'No payment ID found' }, { status: 400 });
    }

    // Auto-capture for Tabby (Option A strategy)
    if (gateway === 'tabby' && status === 'completed' && tabbyPaymentIdForCapture) {
      try {
        // Look up the payment to get amount and currency
        const pendingPayment = await withAdminContext(async (db) => {
          const rows = await db.execute(
            sql`SELECT amount, currency FROM payments WHERE id = ${paymentId} LIMIT 1`
          );
          return rows.rows[0] as { amount: number; currency: string } | undefined;
        });

        if (pendingPayment) {
          await captureTabbyPayment(
            tabbyPaymentIdForCapture,
            pendingPayment.amount,
            pendingPayment.currency
          );
          console.log(`[tabby-webhook] Captured payment ${tabbyPaymentIdForCapture}`);
        }
      } catch (captureErr: any) {
        console.error('[tabby-webhook] Capture failed:', captureErr.message);
        // Don't fail the webhook — Tabby auto-captures after 21 days as fallback
        // But log it for manual review
      }
    }

    // Update payment status
    const payment = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`UPDATE payments SET status = ${status} WHERE id = ${paymentId} RETURNING *`
      );
      return rows.rows[0] as any | undefined;
    });

    // 6.5.8 — Payment amount mismatch check (non-blocking: alert only, never prevents completion)
    if (status === 'completed' && payment && gatewayAmount !== null && payment.amount !== gatewayAmount) {
      console.warn(
        `[payment-webhook] Amount mismatch for ${payment.id}: expected ${payment.amount}, got ${gatewayAmount} (gateway: ${gateway})`
      );
      void alertPaymentMismatch({
        paymentId: payment.id,
        expectedAmount: payment.amount,
        actualAmount: gatewayAmount,
        currency: payment.currency,
        gateway,
      });
    }

    if (status === 'completed' && payment) {
      const meta = (payment.metadata || {}) as Record<string, any>;

      // Activate enrollment or confirm booking
      if (meta.item_type === 'course') {
        await withAdminContext(async (db) => {
          await db.execute(
            sql`INSERT INTO enrollments (user_id, course_id, status, enrollment_type) VALUES (${meta.user_id}, ${meta.item_id}, 'enrolled', 'recorded')`
          );
        });
      } else if (meta.item_type === 'booking') {
        await withAdminContext(async (db) => {
          await db.execute(
            sql`UPDATE bookings SET status = 'confirmed' WHERE id = ${meta.item_id}`
          );
        });
      } else if (meta.item_type === 'product' && meta.item_id && meta.user_id) {
        // Handle digital product purchases — generate download tokens
        try {
          const product = await withAdminContext(async (db) => {
            const rows = await db.execute(
              sql`SELECT id, product_type FROM products WHERE id = ${meta.item_id} LIMIT 1`
            );
            return rows.rows[0] as { id: string; product_type: string } | undefined;
          });

          if (product && (product.product_type === 'digital' || product.product_type === 'hybrid')) {
            // Find or create order for this product purchase
            const existingOrder = await withAdminContext(async (db) => {
              const rows = await db.execute(
                sql`SELECT id FROM orders WHERE payment_id = ${paymentId} LIMIT 1`
              );
              return rows.rows[0] as { id: string } | undefined;
            });

            let orderId = existingOrder?.id;

            if (!existingOrder) {
              const newOrder = await withAdminContext(async (db) => {
                const rows = await db.execute(
                  sql`INSERT INTO orders (customer_id, status, payment_id, total_amount, currency) VALUES (${meta.user_id}, 'paid', ${paymentId}, ${payment.amount}, ${payment.currency}) RETURNING id`
                );
                return rows.rows[0] as { id: string } | undefined;
              });
              orderId = newOrder?.id;
            }

            // Create order_item
            if (orderId) {
              const existingItem = await withAdminContext(async (db) => {
                const rows = await db.execute(
                  sql`SELECT id FROM order_items WHERE order_id = ${orderId} AND product_id = ${meta.item_id} LIMIT 1`
                );
                return rows.rows[0] as { id: string } | undefined;
              });

              if (!existingItem) {
                await withAdminContext(async (db) => {
                  await db.execute(
                    sql`INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (${orderId}, ${meta.item_id}, 1, ${payment.amount})`
                  );
                });
              }

              // Get order_item and create download token
              const orderItem = await withAdminContext(async (db) => {
                const rows = await db.execute(
                  sql`SELECT id FROM order_items WHERE order_id = ${orderId} AND product_id = ${meta.item_id} LIMIT 1`
                );
                return rows.rows[0] as { id: string } | undefined;
              });

              if (orderItem) {
                const asset = await withAdminContext(async (db) => {
                  const rows = await db.execute(
                    sql`SELECT id FROM digital_assets WHERE product_id = ${meta.item_id} ORDER BY created_at DESC LIMIT 1`
                  );
                  return rows.rows[0] as { id: string } | undefined;
                });

                if (asset) {
                  const config = await getBusinessConfig();
                  const token = randomUUID();
                  const expiresAt = new Date(
                    Date.now() + config.download_token_expiry_hours * 60 * 60 * 1000
                  ).toISOString();

                  await withAdminContext(async (db) => {
                    await db.execute(
                      sql`INSERT INTO download_tokens (order_item_id, user_id, asset_id, token, expires_at, download_count, max_downloads) VALUES (${orderItem.id}, ${meta.user_id}, ${asset.id}, ${token}, ${expiresAt}, 0, ${config.download_max_count})`
                    );
                  });

                  console.log(`[payment-webhook] Generated download token for product ${meta.item_id}`);
                }
              }
            }
          }
        } catch (tokenErr: any) {
          console.error('[payment-webhook] Failed to generate download token:', tokenErr.message);
          // Don't fail the webhook — token generation can be retried manually
        }
      }

      // Create Zoho Books invoice (non-blocking — don't fail the webhook)
      try {
        const invoiceResult = await createZohoInvoice({
          customerName: meta.user_email?.split('@')[0] || 'Customer',
          customerEmail: meta.user_email || '',
          itemName: meta.item_name || `${meta.item_type} - ${meta.item_id}`,
          amount: payment.amount,
          currency: payment.currency,
          paymentGateway: payment.gateway,
          paymentId: payment.id,
          itemType: meta.item_type,
          itemId: meta.item_id,
        });
        console.log(`[zoho-books] Invoice created: ${invoiceResult.invoice_number}`);
      } catch (invoiceErr: any) {
        console.error('[zoho-books] Invoice creation failed:', invoiceErr.message);
        // Don't fail the webhook — invoice can be created manually
      }

      // Send notifications
      await sendNotifications(payment);
    }

    // Mark event as completed in the audit trail
    if (eventId) {
      await withAdminContext(async (db) => {
        await db.execute(
          sql`UPDATE webhook_events SET status = 'completed', completed_at = NOW(), payment_id = ${payment?.id ?? null} WHERE event_id = ${eventId}`
        );
      });
    }

    return NextResponse.json({ received: true, payment_id: paymentId, status });
  } catch (err: any) {
    console.error('[payment-webhook] Error:', err);

    // Best-effort: mark the event as failed and alert — both non-blocking
    // eventId and eventType are declared before the try block so they are in scope here
    if (eventId) {
      void withAdminContext(async (db) => {
        await db.execute(
          sql`UPDATE webhook_events SET status = 'failed', error_message = ${err.message ?? 'Unknown error'} WHERE event_id = ${eventId}`
        );
      });
    }
    void alertWebhookFailure({
      gateway,
      eventType,
      eventId: eventId ?? 'unknown',
      error: err.message ?? 'Unknown error',
    });

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Detect gateway from request headers/body when x-gateway is not set */
function detectGateway(request: NextRequest): string {
  // Tabby sends X-Tabby-Signature header
  if (request.headers.get('x-tabby-signature')) return 'tabby';
  // Stripe sends stripe-signature header
  if (request.headers.get('stripe-signature')) return 'stripe';
  return 'stripe'; // default
}

async function sendNotifications(payment: any) {
  const meta = (payment.metadata || {}) as Record<string, any>;
  const userEmail = meta.user_email;
  const userName = meta.user_name || userEmail?.split('@')[0] || '';
  const gatewayLabel = payment.gateway === 'tabby' ? 'Tabby (4 installments)' : payment.gateway;

  // 1. Bilingual payment confirmation email (AR/EN via sendPaymentReceivedEmail)
  if (userEmail) {
    try {
      const { sendPaymentReceivedEmail } = await import('@kunacademy/email');
      // Derive locale from payment metadata; default to 'en' for unknown/missing values.
      const rawLocale = (meta.locale as string | undefined) || '';
      const locale: 'ar' | 'en' = rawLocale === 'ar' ? 'ar' : 'en';
      // Extract first name only (avoids leaking full name or email prefix into greeting).
      const firstName = (meta.user_name as string | undefined)?.split(' ')[0] || undefined;
      const transactionDate = new Date(payment.created_at || Date.now()).toISOString().split('T')[0];
      await sendPaymentReceivedEmail({
        to: userEmail,
        locale,
        first_name: firstName,
        item_name: meta.item_name || `${meta.item_type || 'item'} — ${meta.item_id || ''}`,
        amount_display: (payment.amount / 100).toFixed(2),
        currency: payment.currency,
        gateway: gatewayLabel,
        payment_id: payment.id,
        transaction_date: transactionDate,
      });
    } catch (e) { console.error('[notify] Email failed:', e); }
  }

  // 2. Telegram alert to Amin (finance)
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const aminChatId = process.env.TELEGRAM_AMIN_CHAT_ID;
  if (telegramToken && aminChatId) {
    try {
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: aminChatId,
          text: `Payment received!\n${userName} — ${(payment.amount / 100).toFixed(2)} ${payment.currency}\nGateway: ${gatewayLabel}\nType: ${meta.item_type}`,
        }),
      });
    } catch (e) { console.error('[notify] Telegram failed:', e); }
  }
}
