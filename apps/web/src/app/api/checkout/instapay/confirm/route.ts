import { NextResponse, type NextRequest } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { payments } from '@kunacademy/db/schema';
import { eq } from 'drizzle-orm';
import { sendTelegramAlert } from '@kunacademy/email';

/** Customer confirms they've sent the InstaPay transfer */
export async function POST(request: NextRequest) {
  try {
    const { payment_id, sender_name, transaction_ref } = await request.json();

    if (!payment_id) {
      return NextResponse.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    // Fetch payment to verify it exists and is pending
    const [payment] = await withAdminContext(async (db) => {
      return db.select()
        .from(payments)
        .where(eq(payments.id, payment_id))
        .limit(1);
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status !== 'pending') {
      return NextResponse.json({ error: 'Payment already processed' }, { status: 400 });
    }

    const metadata = (payment.metadata || {}) as Record<string, unknown>;

    await withAdminContext(async (db) => {
      await db.update(payments)
        .set({
          metadata: {
            ...metadata,
            verification_status: 'customer_confirmed',
            sender_name: sender_name || null,
            transaction_ref: transaction_ref || null,
            confirmed_at: new Date().toISOString(),
          },
        })
        .where(eq(payments.id, payment_id));
    });

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
