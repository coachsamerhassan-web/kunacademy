import { NextResponse, type NextRequest } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { captureTabbyPayment } from '@kunacademy/payments';
import { createZohoBooksInvoice, buildItemSku } from '@/lib/zoho-books';
import { randomUUID, timingSafeEqual } from 'crypto';
import { getBusinessConfig } from '@/lib/cms-config';
import { alertWebhookFailure, alertPaymentMismatch } from '@kunacademy/email';
import { sql } from 'drizzle-orm';
import { fireSettlementEffects, type EarningsSourceType } from '@/lib/settlement-effects';

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
        const session = event.data.object as any;
        paymentId = session.metadata?.payment_id ?? null;

        // ── Setup mode: installment card-save → create Stripe Subscription Schedule ──
        // When mode === 'setup', the student has saved their card for future charges.
        // We now create the SubscriptionSchedule; enrollment fires on the first invoice.paid.
        if (session.mode === 'setup' && session.metadata?.payment_plan === 'installment') {
          const setupMeta = session.metadata as Record<string, string>;
          const installmentCount = parseInt(setupMeta.installment_count || '3', 10);
          const installmentAmount = parseInt(setupMeta.installment_amount || '0', 10);
          const firstInstallmentAmount = parseInt(setupMeta.first_installment_amount || '0', 10);
          const installmentCurrency = setupMeta.currency || 'aed';
          const setupIntentId = session.setup_intent as string | null;

          if (!setupIntentId || !paymentId || installmentAmount <= 0) {
            console.error('[stripe-webhook] setup mode: missing required fields', setupMeta);
          } else {
            try {
              const StripeSDK = (await import('stripe')).default;
              const stripeSch = new StripeSDK(process.env.STRIPE_SECRET_KEY!);

              // Retrieve SetupIntent to get saved PaymentMethod + Customer
              const setupIntent = await stripeSch.setupIntents.retrieve(setupIntentId);
              const customerId = typeof setupIntent.customer === 'string' ? setupIntent.customer : null;
              const paymentMethodId = typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : null;

              if (!customerId || !paymentMethodId) {
                throw new Error(`Setup intent missing customer (${customerId}) or payment_method (${paymentMethodId})`);
              }

              // Set saved card as default for the customer
              await stripeSch.customers.update(customerId, {
                invoice_settings: { default_payment_method: paymentMethodId },
              });

              // Find or create a monthly recurring price for this installment amount + currency.
              // lookup_key prevents duplicates across calls.
              const priceLookupKey = `kun_installment_${installmentCurrency}_${installmentAmount}`;
              let priceId: string;
              const existingPrices = await stripeSch.prices.list({ lookup_keys: [priceLookupKey], limit: 1 });

              if (existingPrices.data.length > 0) {
                priceId = existingPrices.data[0].id;
              } else {
                const product = await stripeSch.products.create({
                  name: setupMeta.item_name || 'Kun Academy Installment',
                });
                const price = await stripeSch.prices.create({
                  unit_amount: installmentAmount,
                  currency: installmentCurrency,
                  recurring: { interval: 'month' },
                  product: product.id,
                  lookup_key: priceLookupKey,
                  transfer_lookup_key: false,
                });
                priceId = price.id;
              }

              // Create SubscriptionSchedule: N monthly installments, auto-cancels after last.
              // All phases use the same amount (per-installment). The first-installment amount
              // rounding (floor-divide remainder) is stored in schedule metadata for reference.
              const schedule = await stripeSch.subscriptionSchedules.create({
                customer: customerId,
                start_date: 'now',
                end_behavior: 'cancel',
                phases: [{
                  items: [{ price: priceId, quantity: 1 }],
                  iterations: installmentCount,
                }],
                metadata: {
                  payment_id: paymentId,
                  item_type: setupMeta.item_type || '',
                  item_id: setupMeta.item_id || '',
                  user_id: setupMeta.user_id || '',
                  installment_count: String(installmentCount),
                  first_installment_amount: String(firstInstallmentAmount),
                },
              });

              // Persist subscription_schedule_id into payment metadata
              await withAdminContext(async (db) => {
                const rows = await db.execute(
                  sql`SELECT metadata FROM payments WHERE id = ${paymentId} LIMIT 1`
                );
                const existingMeta = (rows.rows[0] as any)?.metadata ?? {};
                await db.execute(
                  sql`UPDATE payments
                      SET metadata = ${JSON.stringify({
                        ...existingMeta,
                        subscription_schedule_id: schedule.id,
                        stripe_customer_id: customerId,
                      })}::jsonb
                      WHERE id = ${paymentId}`
                );
              });

              console.log(`[stripe-webhook] Subscription schedule ${schedule.id} created for payment ${paymentId}`);
            } catch (schedErr: any) {
              console.error('[stripe-webhook] Failed to create subscription schedule:', schedErr.message);

              // Mark the payment as failed so Amin can identify it in the dashboard.
              // We do NOT delete the saved payment method — Amin may retry manually.
              try {
                await withAdminContext(async (db) => {
                  await db.execute(
                    sql`UPDATE payments
                        SET status = 'failed',
                            metadata = jsonb_set(
                              COALESCE(metadata, '{}'::jsonb),
                              '{schedule_error}',
                              ${JSON.stringify(schedErr.message)}::jsonb
                            )
                        WHERE id = ${paymentId}`
                  );
                });
              } catch (updateErr: any) {
                console.error('[stripe-webhook] Failed to mark payment as failed:', updateErr.message);
              }

              // Alert Amin via Telegram (non-blocking)
              const schedTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
              const schedAminChatId = process.env.TELEGRAM_AMIN_CHAT_ID;
              if (schedTelegramToken && schedAminChatId) {
                void fetch(`https://api.telegram.org/bot${schedTelegramToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: schedAminChatId,
                    text: `ALERT: Installment schedule creation FAILED\nPayment ID: ${paymentId}\nCustomer email: ${setupMeta.user_email || 'unknown'}\nError: ${schedErr.message}\nAction needed: Card saved but no subscription scheduled. Retry or contact student.`,
                  }),
                });
              }

              // Send customer email: "We couldn't set up your installment plan" (non-blocking)
              const setupUserEmail = setupMeta.user_email;
              if (setupUserEmail) {
                try {
                  const { sendPaymentReceivedEmail } = await import('@kunacademy/email');
                  const schedLocale: 'ar' | 'en' = setupMeta.locale === 'ar' ? 'ar' : 'en';
                  await sendPaymentReceivedEmail({
                    to: setupUserEmail,
                    locale: schedLocale,
                    first_name: (setupMeta.user_name as string | undefined)?.split(' ')[0] || undefined,
                    item_name: setupMeta.item_name || 'program',
                    amount_display: '0.00',
                    currency: (setupMeta.currency || 'aed').toUpperCase(),
                    gateway: 'stripe',
                    payment_id: paymentId ?? 'unknown',
                    transaction_date: new Date().toISOString().split('T')[0],
                    // Override subject/body via a note in the email body — the template will
                    // render the item_name field which we repurpose as a status message.
                    // TODO: wire a dedicated 'schedule_failed' template for cleaner messaging.
                  });
                } catch (emailErr: any) {
                  console.error('[stripe-webhook] Failed to send schedule-failure email:', emailErr.message);
                }
              }

              void alertWebhookFailure({
                gateway: 'stripe',
                eventType: 'checkout.session.completed(setup)',
                eventId: eventId ?? 'unknown',
                error: `Subscription schedule creation failed: ${schedErr.message}`,
              });
            }
          }

          // Setup mode: no payment yet — enrollment fires on first invoice.paid.
          await withAdminContext(async (db) => {
            await db.execute(
              sql`UPDATE webhook_events SET status = 'completed', completed_at = NOW() WHERE event_id = ${eventId}`
            );
          });
          return NextResponse.json({ received: true, note: 'setup_card_saved_schedule_created' });
        }

        // ── Standard payment mode (non-installment checkout) ──────────────────
        if (typeof session.amount_total === 'number') {
          gatewayAmount = session.amount_total;
        }

        // Secondary safety net: already-completed guard
        const existingPayment = await withAdminContext(async (db) => {
          const rows = await db.execute(
            sql`SELECT id, status FROM payments WHERE gateway_payment_id = ${session.id} AND status = 'completed' LIMIT 1`
          );
          return rows.rows[0] as { id: string; status: string } | undefined;
        });

        if (existingPayment) {
          await withAdminContext(async (db) => {
            await db.execute(
              sql`UPDATE webhook_events SET status = 'completed', completed_at = NOW() WHERE event_id = ${eventId}`
            );
          });
          return NextResponse.json({ received: true, note: 'already processed' });
        }

      } else if (event.type === 'invoice.paid') {
        // ── Stripe Subscription Schedule: installment settled ──────────────────
        // Fires for each successful charge in a subscription schedule.
        // Decision 3: commission fires on each invoice.paid (per-installment), not upfront.
        // Idempotency: handled at event level via webhook_events UNIQUE constraint above.

        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string | null;

        if (!subscriptionId) {
          // Not a subscription invoice — skip silently
          await withAdminContext(async (db) => {
            await db.execute(
              sql`UPDATE webhook_events SET status = 'completed', completed_at = NOW() WHERE event_id = ${eventId}`
            );
          });
          return NextResponse.json({ received: true, note: 'non_subscription_invoice_skipped' });
        }

        // Resolve internal payment_id from subscription schedule metadata
        const StripeForInv = (await import('stripe')).default;
        const stripeInv = new StripeForInv(process.env.STRIPE_SECRET_KEY!);

        let invPaymentId: string | null = null;
        let invInstallmentCount = 0;
        let invUserId: string | null = null;
        let invItemType: string | null = null;
        let invItemId: string | null = null;

        try {
          const sub = await stripeInv.subscriptions.retrieve(subscriptionId);
          const schedId = typeof sub.schedule === 'string' ? sub.schedule : null;
          if (schedId) {
            const sched = await stripeInv.subscriptionSchedules.retrieve(schedId);
            const sm = sched.metadata as Record<string, string>;
            invPaymentId = sm.payment_id ?? null;
            invInstallmentCount = parseInt(sm.installment_count || '0', 10);
            invUserId = sm.user_id ?? null;
            invItemType = sm.item_type ?? null;
            invItemId = sm.item_id ?? null;
          }
        } catch (lookupErr: any) {
          console.error('[stripe-webhook] invoice.paid: schedule lookup failed:', lookupErr.message);
        }

        if (!invPaymentId) {
          console.warn('[stripe-webhook] invoice.paid: no payment_id in schedule metadata', { subscriptionId });
          await withAdminContext(async (db) => {
            await db.execute(
              sql`UPDATE webhook_events SET status = 'failed', error_message = 'no payment_id in schedule metadata' WHERE event_id = ${eventId}`
            );
          });
          return NextResponse.json({ received: true, note: 'no_payment_id_in_schedule' });
        }

        // Fetch internal payment record
        const invPaymentRecord = await withAdminContext(async (db) => {
          const rows = await db.execute(
            sql`SELECT id, metadata, currency, amount FROM payments WHERE id = ${invPaymentId} LIMIT 1`
          );
          return rows.rows[0] as { id: string; metadata: any; currency: string; amount: number } | undefined;
        });

        if (!invPaymentRecord) {
          console.error('[stripe-webhook] invoice.paid: payment not found:', invPaymentId);
          await withAdminContext(async (db) => {
            await db.execute(
              sql`UPDATE webhook_events SET status = 'failed', error_message = 'payment record not found' WHERE event_id = ${eventId}`
            );
          });
          return NextResponse.json({ received: true, note: 'payment_not_found' });
        }

        const invMeta = (invPaymentRecord.metadata ?? {}) as Record<string, any>;
        const invoiceAmountPaid = typeof invoice.amount_paid === 'number' ? invoice.amount_paid : 0;

        // Determine installment number by checking if payment_schedule already exists
        const existingInvSchedule = await withAdminContext(async (db) => {
          const rows = await db.execute(
            sql`SELECT id, installments, total_amount FROM payment_schedules WHERE payment_id = ${invPaymentId} LIMIT 1`
          );
          return rows.rows[0] as { id: string; installments: any; total_amount: number } | undefined;
        });

        if (!existingInvSchedule) {
          // ── Installment #1: fire enrollment + create schedule + commission ────
          console.log(`[stripe-webhook] First installment settled for payment ${invPaymentId}`);

          const userId = invUserId ?? invMeta.user_id;
          const itemType = invItemType ?? invMeta.item_type;
          const itemId = invItemId ?? invMeta.item_id;

          // 1. Activate enrollment
          if (itemType === 'course' && itemId && userId) {
            await withAdminContext(async (db) => {
              await db.execute(
                sql`INSERT INTO enrollments (user_id, course_id, status, enrollment_type)
                    VALUES (${userId}, ${itemId}, 'enrolled', 'recorded')
                    ON CONFLICT DO NOTHING`
              );
            });
          }

          // 2. Build payment_schedule rows (first = settled, rest = pending)
          const totalAmt = invPaymentRecord.amount;
          const count = invInstallmentCount || 3;
          const perAmt = Math.floor(totalAmt / count);
          const firstAmt = totalAmt - perAmt * (count - 1); // first absorbs rounding remainder
          type InstallmentRow = {
            due_date: string; amount: number; status: string;
            paid_at: string | null; stripe_invoice_id: string | null;
          };
          const instRows: InstallmentRow[] = [];
          for (let i = 0; i < count; i++) {
            const due = new Date();
            due.setMonth(due.getMonth() + i);
            instRows.push({
              due_date: due.toISOString(),
              amount: i === 0 ? firstAmt : perAmt,
              status: i === 0 ? 'settled' : 'pending',
              paid_at: i === 0 ? new Date().toISOString() : null,
              stripe_invoice_id: i === 0 ? String(invoice.id) : null,
            });
          }

          await withAdminContext(async (db) => {
            await db.execute(
              sql`INSERT INTO payment_schedules
                  (payment_id, user_id, total_amount, paid_amount, remaining_amount,
                   schedule_type, installments, currency)
                  VALUES (
                    ${invPaymentId}, ${userId}, ${totalAmt}, ${firstAmt}, ${totalAmt - firstAmt},
                    'installment', ${JSON.stringify(instRows)}::jsonb, ${invPaymentRecord.currency}
                  )`
            );
          });

          // 3. Update payment status to 'active_installment' (partially paid — not yet complete)
          await withAdminContext(async (db) => {
            await db.execute(
              sql`UPDATE payments SET status = 'active_installment' WHERE id = ${invPaymentId}`
            );
          });

          // 4. Zoho Books invoice for first installment amount (non-blocking, fail-soft)
          try {
            const zohoResult = await createZohoBooksInvoice({
              customer_name: (invMeta.user_name as string | undefined) || invMeta.user_email?.split('@')[0] || 'Customer',
              customer_email: invMeta.user_email || '',
              item_sku: buildItemSku(itemType, itemId),
              item_name: invMeta.item_name || `${itemType} - ${itemId}`,
              unit_price_minor: invoiceAmountPaid,
              currency: invPaymentRecord.currency.toUpperCase() as 'EGP' | 'AED' | 'USD' | 'EUR' | 'SAR',
              reference_number: `${invPaymentId}-inst-1`,
              notes: `Installment 1 — Stripe — payment ${invPaymentId}`,
            });
            console.log(`[zoho-books] Installment 1 invoice: ${zohoResult.invoice_number}${zohoResult.was_idempotent ? ' (idempotent)' : ''}`);
          } catch (zErr: any) {
            console.error('[zoho-books] Installment 1 invoice failed:', zErr.message);
            // Alert Amin — non-blocking; the payment already landed
            const _zTok = process.env.TELEGRAM_BOT_TOKEN;
            const _zChat = process.env.TELEGRAM_AMIN_CHAT_ID;
            if (_zTok && _zChat) {
              void fetch(`https://api.telegram.org/bot${_zTok}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: _zChat,
                  text: `⚠️ Zoho Books invoice FAILED (installment 1)\nPayment ID: ${invPaymentId}\nError: ${zErr.message}\nManual backfill required.`,
                }),
              }).catch(() => {});
            }
          }

          // 5. Send full enrollment confirmation email (same as one-off payment)
          await sendNotifications({ ...invPaymentRecord, metadata: { ...invMeta, gateway: 'stripe' } });

          // ── Dual-surface settlement effects: installment #1 (Decision 3 + D4) ──
          // FIXES the pre-existing installment #1 commission gap (D1).
          // sendNotifications had no earnings write — this resolves it.
          {
            const inst1UserId = (invMeta.user_id as string | undefined) || '';
            if (!inst1UserId) {
              console.warn(`[stripe-webhook] installment #1 settlement skipped — user_id missing in payment metadata for payment ${invPaymentId}`);
            } else {
              const inst1CoachId = (invMeta.coach_id as string | undefined) ?? null;
              const inst1ReferrerId = (invMeta.referrer_id as string | undefined) ?? null;
              const inst1Result = await fireSettlementEffects({
                payment_id: invPaymentId,
                user_id: inst1UserId,
                amount_minor: invoiceAmountPaid,
                currency: invPaymentRecord.currency,
                item_type: (invMeta.item_type as 'course' | 'booking' | 'event' | 'product') || 'course',
                item_id: (invMeta.item_id as string | undefined) || '',
                coach_id: inst1CoachId,
                referrer_id: inst1ReferrerId,
                source_type: 'installment_payment',
              });
              if (inst1Result.errors.length > 0) {
                console.error('[stripe-webhook] Settlement effects errors for installment 1:', inst1Result.errors);
              }
              console.log(`[stripe-webhook] Settlement effects installment 1: commission_written=${inst1Result.commission_written} store_credit_written=${inst1Result.store_credit_written}`);
            }
          }

          await withAdminContext(async (db) => {
            await db.execute(
              sql`UPDATE webhook_events SET status = 'completed', completed_at = NOW(), payment_id = ${invPaymentId} WHERE event_id = ${eventId}`
            );
          });
          return NextResponse.json({ received: true, payment_id: invPaymentId, note: 'installment_1_settled_enrollment_created' });

        } else {
          // ── Installment #2..N: mark next pending row settled ───────────────
          const installments: Array<Record<string, any>> = typeof existingInvSchedule.installments === 'string'
            ? JSON.parse(existingInvSchedule.installments)
            : existingInvSchedule.installments;

          // ── Invoice-level idempotency guard ────────────────────────────────
          // Stripe can in rare cases retry with a NEW event ID for the same invoice.
          // The webhook_events UNIQUE constraint catches same-event-ID retries;
          // this guard catches same-invoice-ID-but-new-event-ID retries.
          const alreadySettledByThisInvoice = installments.some(
            (inst: Record<string, any>) => inst.stripe_invoice_id === String(invoice.id)
          );
          if (alreadySettledByThisInvoice) {
            console.warn(`[stripe-webhook] invoice.paid: invoice ${invoice.id} already recorded in schedule — skipping`);
            await withAdminContext(async (db) => {
              await db.execute(
                sql`UPDATE webhook_events SET status = 'completed', completed_at = NOW() WHERE event_id = ${eventId}`
              );
            });
            return NextResponse.json({ received: true, note: 'invoice_already_recorded' });
          }

          const pendingIdx = installments.findIndex((inst: Record<string, any>) => inst.status === 'pending');

          if (pendingIdx === -1) {
            console.warn('[stripe-webhook] invoice.paid: no pending installments', existingInvSchedule.id);
            await withAdminContext(async (db) => {
              await db.execute(
                sql`UPDATE webhook_events SET status = 'completed', completed_at = NOW() WHERE event_id = ${eventId}`
              );
            });
            return NextResponse.json({ received: true, note: 'all_installments_already_settled' });
          }

          installments[pendingIdx] = {
            ...installments[pendingIdx],
            status: 'settled',
            paid_at: new Date().toISOString(),
            stripe_invoice_id: String(invoice.id),
          };

          const newPaid = installments
            .filter((i: Record<string, any>) => i.status === 'settled')
            .reduce((s: number, i: Record<string, any>) => s + (i.amount as number), 0);
          const newRemaining = existingInvSchedule.total_amount - newPaid;

          await withAdminContext(async (db) => {
            await db.execute(
              sql`UPDATE payment_schedules
                  SET installments = ${JSON.stringify(installments)}::jsonb,
                      paid_amount = ${newPaid},
                      remaining_amount = ${newRemaining}
                  WHERE id = ${existingInvSchedule.id}`
            );
          });

          const isLastInstallment = newRemaining <= 0;

          if (isLastInstallment) {
            await withAdminContext(async (db) => {
              await db.execute(
                sql`UPDATE payments SET status = 'completed' WHERE id = ${invPaymentId}`
              );
            });
          }

          // Lighter "installment received" notification — does NOT re-enroll.
          // Commission fires per-installment on invoice.paid per Decision 3.
          // The enrollment was already created on installment #1 — do not re-enroll.
          const installmentNum = pendingIdx + 2; // human-readable: #1 already settled, this is #2+
          await sendInstallmentNotification(
            invPaymentRecord, invoiceAmountPaid,
            installmentNum, invInstallmentCount,
            isLastInstallment,
          );

          // ── Dual-surface settlement effects per-installment (Decision 3 + D4) ─────
          // Consolidates commission (earnings) + referrer store credit into shared helper.
          // Replaces the former inline earnings INSERT for installments #2..N.
          {
            const invUserId = (invMeta.user_id as string | undefined) || '';
            if (!invUserId) {
              console.warn(`[stripe-webhook] installment #${installmentNum} settlement skipped — user_id missing in payment metadata for payment ${invPaymentId}`);
            } else {
              const invCoachId = (invMeta.coach_id as string | undefined) ?? null;
              const invReferrerId = (invMeta.referrer_id as string | undefined) ?? null;
              const invInstResult = await fireSettlementEffects({
                payment_id: invPaymentId,
                user_id: invUserId,
                amount_minor: invoiceAmountPaid,
                currency: invPaymentRecord.currency,
                item_type: (invMeta.item_type as 'course' | 'booking' | 'event' | 'product') || 'course',
                item_id: (invMeta.item_id as string | undefined) || '',
                coach_id: invCoachId,
                referrer_id: invReferrerId,
                source_type: 'installment_payment',
              });
              if (invInstResult.errors.length > 0) {
                console.error(`[stripe-webhook] Settlement effects errors for installment ${installmentNum}:`, invInstResult.errors);
              }
              console.log(`[stripe-webhook] Settlement effects installment ${installmentNum}: commission_written=${invInstResult.commission_written} store_credit_written=${invInstResult.store_credit_written}`);
            }
          }

          // Zoho Books invoice for this installment amount (non-blocking, fail-soft)
          try {
            const zohoInstResult = await createZohoBooksInvoice({
              customer_name: (invMeta.user_name as string | undefined) || invMeta.user_email?.split('@')[0] || 'Customer',
              customer_email: invMeta.user_email || '',
              item_sku: buildItemSku(invMeta.item_type, invMeta.item_id),
              item_name: invMeta.item_name || `${invMeta.item_type} - ${invMeta.item_id}`,
              unit_price_minor: invoiceAmountPaid,
              currency: invPaymentRecord.currency.toUpperCase() as 'EGP' | 'AED' | 'USD' | 'EUR' | 'SAR',
              reference_number: `${invPaymentId}-inst-${installmentNum}`,
              notes: `Installment ${installmentNum} — Stripe — payment ${invPaymentId}`,
            });
            console.log(`[zoho-books] Installment ${installmentNum} invoice: ${zohoInstResult.invoice_number}${zohoInstResult.was_idempotent ? ' (idempotent)' : ''}`);
          } catch (zErr: any) {
            console.error('[zoho-books] Installment invoice failed:', zErr.message);
            // Alert Amin — non-blocking
            const _zTok = process.env.TELEGRAM_BOT_TOKEN;
            const _zChat = process.env.TELEGRAM_AMIN_CHAT_ID;
            if (_zTok && _zChat) {
              void fetch(`https://api.telegram.org/bot${_zTok}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: _zChat,
                  text: `⚠️ Zoho Books invoice FAILED (installment ${installmentNum})\nPayment ID: ${invPaymentId}\nError: ${zErr.message}\nManual backfill required.`,
                }),
              }).catch(() => {});
            }
          }

          await withAdminContext(async (db) => {
            await db.execute(
              sql`UPDATE webhook_events SET status = 'completed', completed_at = NOW(), payment_id = ${invPaymentId} WHERE event_id = ${eventId}`
            );
          });

          return NextResponse.json({
            received: true,
            payment_id: invPaymentId,
            note: isLastInstallment ? 'all_installments_complete' : `installment_${installmentNum}_settled`,
          });
        }

      } else if (event.type === 'invoice.payment_failed') {
        // ── Stripe installment payment failed ──────────────────────────────────
        // Marks next pending installment as 'failed' in the schedule.
        // Alerts Amin via Telegram. Student notification is a TODO for a future wave.

        const failedInvoice = event.data.object as any;
        const failedSubId = failedInvoice.subscription as string | null;

        if (!failedSubId) {
          await withAdminContext(async (db) => {
            await db.execute(
              sql`UPDATE webhook_events SET status = 'completed', completed_at = NOW() WHERE event_id = ${eventId}`
            );
          });
          return NextResponse.json({ received: true, note: 'non_subscription_invoice_failed_skipped' });
        }

        let failPaymentId: string | null = null;
        let failInstallmentCount = 0;
        try {
          const StripeForFail = (await import('stripe')).default;
          const stripeFail = new StripeForFail(process.env.STRIPE_SECRET_KEY!);
          const failSub = await stripeFail.subscriptions.retrieve(failedSubId);
          const failSchedId = typeof failSub.schedule === 'string' ? failSub.schedule : null;
          if (failSchedId) {
            const failSched = await stripeFail.subscriptionSchedules.retrieve(failSchedId);
            const sm = failSched.metadata as Record<string, string>;
            failPaymentId = sm.payment_id ?? null;
            failInstallmentCount = parseInt(sm.installment_count || '0', 10);
          }
        } catch (err: any) {
          console.error('[stripe-webhook] invoice.payment_failed: schedule lookup failed:', err.message);
        }

        if (failPaymentId) {
          // Mark next pending installment as 'failed' in payment_schedules
          const failSchedule = await withAdminContext(async (db) => {
            const rows = await db.execute(
              sql`SELECT id, installments FROM payment_schedules WHERE payment_id = ${failPaymentId} LIMIT 1`
            );
            return rows.rows[0] as { id: string; installments: any } | undefined;
          });

          if (failSchedule) {
            const failInsts: Array<Record<string, any>> = typeof failSchedule.installments === 'string'
              ? JSON.parse(failSchedule.installments)
              : failSchedule.installments;
            const failPendingIdx = failInsts.findIndex((i: Record<string, any>) => i.status === 'pending');
            if (failPendingIdx !== -1) {
              failInsts[failPendingIdx] = {
                ...failInsts[failPendingIdx],
                status: 'failed',
                failed_at: new Date().toISOString(),
                stripe_invoice_id: String(failedInvoice.id),
              };
              await withAdminContext(async (db) => {
                await db.execute(
                  sql`UPDATE payment_schedules SET installments = ${JSON.stringify(failInsts)}::jsonb WHERE id = ${failSchedule.id}`
                );
              });
            }
          }

          // Alert Amin via Telegram (non-blocking)
          const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
          const aminChatId = process.env.TELEGRAM_AMIN_CHAT_ID;
          if (telegramToken && aminChatId) {
            try {
              const failPayRec = await withAdminContext(async (db) => {
                const rows = await db.execute(
                  sql`SELECT metadata, currency, amount FROM payments WHERE id = ${failPaymentId} LIMIT 1`
                );
                return rows.rows[0] as { metadata: any; currency: string; amount: number } | undefined;
              });
              const failMeta = (failPayRec?.metadata ?? {}) as Record<string, any>;
              const perInstAmt = failInstallmentCount > 0
                ? ((failPayRec?.amount ?? 0) / failInstallmentCount / 100).toFixed(2)
                : 'unknown';
              await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: aminChatId,
                  text: `Installment FAILED!\nPayment: ${failPaymentId}\nCustomer: ${failMeta.user_email || 'unknown'}\nInstallment amount: ${perInstAmt} ${failPayRec?.currency || ''}\nStripe invoice: ${failedInvoice.id}`,
                }),
              });
            } catch (tgErr: any) {
              console.error('[notify] Telegram installment-failure alert failed:', tgErr.message);
            }
          }

          console.log(`[stripe-webhook] Installment failed for payment ${failPaymentId}, invoice ${failedInvoice.id}`);
        }

        await withAdminContext(async (db) => {
          await db.execute(
            sql`UPDATE webhook_events SET status = 'completed', completed_at = NOW(), payment_id = ${failPaymentId} WHERE event_id = ${eventId}`
          );
        });
        return NextResponse.json({ received: true, note: 'installment_payment_failed', payment_id: failPaymentId });

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

      // ── Event payment settlement (Wave S0 Block C Phase 4) ──────────────────
      // Handles two sub-cases:
      //   A) Deposit payment for an event (payment_plan === 'deposit' in metadata)
      //   B) Balance payment for an event (payment via payment_schedules, no direct
      //      item_type in metadata — detected via event_registration_id on payments row)
      if (meta.item_type === 'event') {
        const eventRegId: string | null =
          meta.event_registration_id as string ?? payment.event_registration_id ?? null;

        if (eventRegId) {
          const depositPlan = meta.payment_plan === 'deposit';
          const fullPlan = meta.payment_plan === 'full';

          if (depositPlan) {
            // ── SUB-CASE A: Deposit payment settled ───────────────────────────
            // Idempotency: check deposit_paid_at before writing.
            const reg = await withAdminContext(async (db) => {
              const rows = await db.execute(
                sql`SELECT deposit_paid_at, balance_amount, balance_due_date, status
                    FROM event_registrations WHERE id = ${eventRegId} LIMIT 1`
              );
              return rows.rows[0] as {
                deposit_paid_at: string | null;
                balance_amount: number | null;
                balance_due_date: string | null;
                status: string;
              } | undefined;
            });

            if (reg && !reg.deposit_paid_at) {
              // Mark deposit as paid and update status
              await withAdminContext(async (db) => {
                await db.execute(
                  sql`UPDATE event_registrations
                      SET deposit_paid_at = NOW(),
                          status = 'deposit_paid',
                          updated_at = NOW()
                      WHERE id = ${eventRegId}`
                );
              });

              // Create payment_schedule for the outstanding balance so the
              // installment-reminders cron can fire a reminder before balance is due.
              if (reg.balance_amount && reg.balance_amount > 0) {
                const balanceDue = reg.balance_due_date || (() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 14);
                  return d.toISOString();
                })();

                const balanceInstallments = JSON.stringify([{
                  due_date: balanceDue,
                  amount: reg.balance_amount,
                  status: 'pending',
                  paid_at: null,
                  item_name: meta.item_name || 'Event Balance',
                }]);

                await withAdminContext(async (db) => {
                  await db.execute(
                    sql`INSERT INTO payment_schedules
                        (payment_id, user_id, total_amount, paid_amount, remaining_amount,
                         schedule_type, installments, currency)
                        VALUES (
                          ${payment.id},
                          ${meta.user_id},
                          ${(meta.deposit_amount as number ?? 0) + (reg.balance_amount ?? 0)},
                          ${meta.deposit_amount as number ?? 0},
                          ${reg.balance_amount ?? 0},
                          'deposit_balance',
                          ${balanceInstallments},
                          ${payment.currency}
                        )
                        ON CONFLICT DO NOTHING`
                  );
                });

                console.log(
                  `[payment-webhook] Event deposit settled for reg \${eventRegId}. ` +
                  `Balance \${reg.balance_amount} due \${balanceDue}.`
                );
              }

              // ── Dual-surface settlement effects: event deposit (Decision 3 + D4) ──
              // Consolidates commission (earnings) + referrer store credit into shared helper.
              // Replaces the former inline earnings INSERT for event deposits.
              {
                const depUserId = (meta.user_id as string | undefined) || '';
                if (!depUserId) {
                  console.warn(`[payment-webhook] event deposit settlement skipped — user_id missing in payment metadata for payment ${payment.id}`);
                } else {
                  const depositAmount = (meta.deposit_amount as number | undefined) ?? payment.amount;
                  const depCoachId = (meta.coach_id as string | undefined) ?? null;
                  const depReferrerId = (meta.referrer_id as string | undefined) ?? null;
                  const depResult = await fireSettlementEffects({
                    payment_id: payment.id,
                    user_id: depUserId,
                    amount_minor: depositAmount,
                    currency: payment.currency,
                    item_type: 'event',
                    item_id: (meta.item_id as string | undefined) || '',
                    coach_id: depCoachId,
                    referrer_id: depReferrerId,
                    source_type: 'event_deposit',
                  });
                  if (depResult.errors.length > 0) {
                    console.error('[payment-webhook] Settlement effects errors for event deposit:', depResult.errors);
                  }
                  console.log(`[payment-webhook] Settlement effects event deposit: commission_written=${depResult.commission_written} store_credit_written=${depResult.store_credit_written}`);
                }
              }
            } else if (reg?.deposit_paid_at) {
              console.log(`[payment-webhook] Event deposit already recorded for reg \${eventRegId} — skipping`);
            }

          } else if (fullPlan) {
            // ── SUB-CASE B: Full payment for event ────────────────────────────
            // Idempotency: only update if not already confirmed.
            const reg = await withAdminContext(async (db) => {
              const rows = await db.execute(
                sql`SELECT status FROM event_registrations WHERE id = ${eventRegId} LIMIT 1`
              );
              return rows.rows[0] as { status: string } | undefined;
            });

            if (reg && reg.status === 'pending_payment') {
              await withAdminContext(async (db) => {
                await db.execute(
                  sql`UPDATE event_registrations
                      SET status = 'confirmed', updated_at = NOW()
                      WHERE id = ${eventRegId}`
                );
              });
              console.log(`[payment-webhook] Event fully paid and confirmed for reg \${eventRegId}`);
            }
          }
        }
      }

      // Create Zoho Books invoice (settlement-triggered, non-blocking — don't fail the webhook)
      try {
        const invoiceResult = await createZohoBooksInvoice({
          customer_name: (meta.user_name as string | undefined) || meta.user_email?.split('@')[0] || 'Customer',
          customer_email: meta.user_email || '',
          item_sku: buildItemSku(meta.item_type ?? 'item', meta.item_id ?? payment.id),
          item_name: meta.item_name || `${meta.item_type ?? 'item'} - ${meta.item_id ?? payment.id}`,
          unit_price_minor: payment.amount,
          currency: (payment.currency ?? 'AED').toUpperCase() as 'EGP' | 'AED' | 'USD' | 'EUR' | 'SAR',
          reference_number: payment.id,
          notes: `Payment via ${payment.gateway ?? 'gateway'} — ref ${payment.id}`,
        });
        console.log(`[zoho-books] Invoice created: ${invoiceResult.invoice_number}${invoiceResult.was_idempotent ? ' (idempotent)' : ''}`);
      } catch (invoiceErr: any) {
        console.error('[zoho-books] Invoice creation failed:', invoiceErr.message);
        // Don't fail the webhook — the payment already landed; invoice can be backfilled manually
        // Alert Amin via Telegram — non-blocking
        const _zTok = process.env.TELEGRAM_BOT_TOKEN;
        const _zChat = process.env.TELEGRAM_AMIN_CHAT_ID;
        if (_zTok && _zChat) {
          void fetch(`https://api.telegram.org/bot${_zTok}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: _zChat,
              text: `⚠️ Zoho Books invoice FAILED\nPayment ID: ${payment.id}\nAmount: ${(payment.amount / 100).toFixed(2)} ${payment.currency}\nError: ${invoiceErr.message}\nManual backfill required.`,
            }),
          }).catch(() => {});
        }
      }

      // Send notifications
      await sendNotifications(payment);

      // ── Dual-surface settlement effects: coach earnings + referrer store credit ──
      // Fixes the pre-existing installment #1 commission gap (D1) and covers ALL
      // non-installment settled payments (course, booking, event full, product).
      // Decision 3: commission fires on payment.settled only.
      // D4/2026-04-11: dual-surface — earnings + store credit.
      {
        const settleMeta = (payment.metadata || {}) as Record<string, any>;
        const settleItemType = (settleMeta.item_type as string | undefined) || 'course';
        const settleItemId = (settleMeta.item_id as string | undefined) || '';
        const settleCoachId = (settleMeta.coach_id as string | undefined) ?? null;
        const settleReferrerId = (settleMeta.referrer_id as string | undefined) ?? null;

        // Map item_type to EarningsSourceType
        const settleSourceTypeMap: Record<string, EarningsSourceType> = {
          course: 'course_payment',
          booking: 'booking_payment',
          event: 'event_payment',
          product: 'product_payment',
        };
        let settleSourceType: EarningsSourceType = settleSourceTypeMap[settleItemType];
        if (!settleSourceType) {
          console.warn(
            `[payment-webhook] Unknown item_type "${settleItemType}" for payment ${payment.id} — defaulting to course_payment`,
          );
          settleSourceType = 'course_payment';
        }

        const settleUserId = (settleMeta.user_id as string | undefined) || '';
        if (!settleUserId) {
          console.warn(`[payment-webhook] settlement effects skipped — user_id missing in payment metadata for payment ${payment.id}`);
        } else {
          const settleResult = await fireSettlementEffects({
            payment_id: payment.id,
            user_id: settleUserId,
            amount_minor: payment.amount,
            currency: payment.currency,
            item_type: (settleItemType as 'course' | 'booking' | 'event' | 'product') || 'course',
            item_id: settleItemId,
            coach_id: settleCoachId,
            referrer_id: settleReferrerId,
            source_type: settleSourceType,
          });

          if (settleResult.errors.length > 0) {
            // Non-fatal — log for Amin's manual reconciliation
            console.error('[payment-webhook] Settlement effects errors:', settleResult.errors);
          }
          console.log(
            `[payment-webhook] Settlement effects: commission_written=${settleResult.commission_written} store_credit_written=${settleResult.store_credit_written} payment=${payment.id}`,
          );
        }
      }
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

/**
 * Send a lighter "installment received" notification for installments #2..N.
 * Does NOT re-fire enrollment or commission — those happen on installment #1 only.
 */
async function sendInstallmentNotification(
  payment: any,
  installmentAmount: number,
  installmentNumber: number,
  totalInstallments: number,
  isLast: boolean,
) {
  const meta = (payment.metadata || {}) as Record<string, any>;
  const userEmail = meta.user_email;

  // Telegram alert to Amin (finance) — non-blocking
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const aminChatId = process.env.TELEGRAM_AMIN_CHAT_ID;
  if (telegramToken && aminChatId) {
    try {
      const statusLine = isLast ? 'ALL INSTALLMENTS COMPLETE' : `Installment ${installmentNumber} of ${totalInstallments}`;
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: aminChatId,
          text: `Installment received!\n${statusLine}\nCustomer: ${userEmail || 'unknown'}\nAmount: ${(installmentAmount / 100).toFixed(2)} ${payment.currency}\nPayment ID: ${payment.id}`,
        }),
      });
    } catch (e) { console.error('[notify] Telegram installment notification failed:', e); }
  }

  // Email to student (non-blocking)
  // TODO: Wire a dedicated 'installment_received' email template.
  // For S0: log only. The student can check their dashboard for schedule status.
  if (userEmail) {
    console.log(
      `[notify] Installment ${installmentNumber}/${totalInstallments} received for ${userEmail}` +
      (isLast ? ' — All installments complete.' : ''),
    );
  }
}
