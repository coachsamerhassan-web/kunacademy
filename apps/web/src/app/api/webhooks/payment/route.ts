// @ts-nocheck — Generated DB types lack instapay/tabby gateway values. Fix with: supabase gen types
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { captureTabbyPayment } from '@kunacademy/payments';
import { createZohoInvoice } from '@/lib/zoho-books';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Unified payment webhook — handles Stripe, Tabby
export async function POST(request: NextRequest) {
  const gateway = request.headers.get('x-gateway') || detectGateway(request);

  try {
    const body = await request.text();

    let paymentId: string | null = null;
    let status: 'completed' | 'failed' = 'completed';
    let tabbyPaymentIdForCapture: string | null = null;

    if (gateway === 'stripe') {
      // TODO: Verify Stripe webhook signature
      const event = JSON.parse(body);
      if (event.type === 'checkout.session.completed') {
        paymentId = event.data.object.metadata?.payment_id;
      } else if (event.type === 'checkout.session.expired') {
        paymentId = event.data.object.metadata?.payment_id;
        status = 'failed';
      }
    } else if (gateway === 'tabby') {
      // Verify Tabby webhook signature
      const sigHeader = request.headers.get('x-tabby-signature');
      const expectedSig = process.env.TABBY_WEBHOOK_SECRET;
      if (expectedSig && sigHeader !== expectedSig) {
        console.error('[tabby-webhook] Signature mismatch');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      const data = JSON.parse(body);
      // Tabby webhooks use lowercase status ("authorized"), API uses uppercase ("AUTHORIZED")
      const tabbyStatus = (data.status || '').toLowerCase();

      if (tabbyStatus === 'authorized') {
        // Find our payment by Tabby's reference_id (which is our payment.id)
        const referenceId = data.order?.reference_id || data.payment?.order?.reference_id;
        if (referenceId) {
          paymentId = referenceId;
          tabbyPaymentIdForCapture = data.id || data.payment?.id;
          status = 'completed';
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
      return NextResponse.json({ error: 'No payment ID found' }, { status: 400 });
    }

    // Auto-capture for Tabby (Option A strategy)
    if (gateway === 'tabby' && status === 'completed' && tabbyPaymentIdForCapture) {
      try {
        // Look up the payment to get amount and currency
        const { data: pendingPayment } = await supabase
          .from('payments')
          .select('amount, currency')
          .eq('id', paymentId)
          .single();

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
    const { data: payment } = await supabase
      .from('payments')
      .update({
        status,
        metadata: supabase.rpc ? undefined : undefined, // preserve existing metadata
      })
      .eq('id', paymentId)
      .select('*')
      .single();

    if (status === 'completed' && payment) {
      const meta = (payment.metadata || {}) as Record<string, any>;

      // Activate enrollment or confirm booking
      if (meta.item_type === 'course') {
        await supabase.from('enrollments').insert({
          user_id: meta.user_id,
          course_id: meta.item_id,
          status: 'enrolled',
          enrollment_type: 'recorded',
        });
      } else if (meta.item_type === 'booking') {
        await supabase.from('bookings')
          .update({ status: 'confirmed' })
          .eq('id', meta.item_id);
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

    return NextResponse.json({ received: true, payment_id: paymentId, status });
  } catch (err: any) {
    console.error('[payment-webhook] Error:', err);
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

  // 1. Email receipt
  if (userEmail) {
    try {
      const { sendEmail } = await import('@kunacademy/email');
      await sendEmail({
        to: userEmail,
        subject: 'Payment Receipt — Kun Academy',
        html: `<div style="font-family: system-ui; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #474099;">Payment Received</h1>
          <p>Thank you, ${userName}. Your payment of ${(payment.amount / 100).toFixed(2)} ${payment.currency} has been received.</p>
          <p>Payment method: ${gatewayLabel}</p>
          <p>Transaction ID: ${payment.id}</p>
        </div>`,
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
          text: `💰 Payment received!\n${userName} — ${(payment.amount / 100).toFixed(2)} ${payment.currency}\nGateway: ${gatewayLabel}\nType: ${meta.item_type}`,
        }),
      });
    } catch (e) { console.error('[notify] Telegram failed:', e); }
  }
}
