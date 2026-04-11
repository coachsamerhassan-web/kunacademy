import { NextResponse, type NextRequest } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { payments, bookings, orders, profiles } from '@kunacademy/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { notify } from '@kunacademy/email';
import { getAuthUser } from '@kunacademy/auth/server';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/** GET: List pending InstaPay payments awaiting verification */
export async function GET() {
  const sessionUser = await getAuthUser();
  if (!sessionUser || !isAdmin(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allPayments = await withAdminContext(async (db) => {
    return db.select()
      .from(payments)
      .where(
        and(
          eq(payments.gateway, 'instapay'),
          eq(payments.status, 'pending')
        )
      )
      .orderBy(sql`${payments.created_at} DESC`);
  });

  const result = (allPayments || [] as Array<typeof payments.$inferSelect>).map((p: typeof payments.$inferSelect) => {
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

  return NextResponse.json({ payments: result });
}

/** POST: Admin verifies or rejects an InstaPay payment */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getAuthUser();
    if (!sessionUser || !isAdmin(sessionUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { payment_id, action, admin_note } = await request.json();

    if (!payment_id || !action) {
      return NextResponse.json({ error: 'Missing payment_id or action' }, { status: 400 });
    }

    if (!['verify', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be verify or reject' }, { status: 400 });
    }

    const [payment] = await withAdminContext(async (db) => {
      return db.select()
        .from(payments)
        .where(eq(payments.id, payment_id))
        .limit(1);
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const metadata = (payment.metadata || {}) as Record<string, unknown>;
    const newStatus = action === 'verify' ? 'completed' : 'failed';

    // Update payment
    await withAdminContext(async (db) => {
      await db.update(payments)
        .set({
          status: newStatus,
          metadata: {
            ...metadata,
            verification_status: action === 'verify' ? 'verified' : 'rejected',
            verified_at: new Date().toISOString(),
            admin_note: admin_note || null,
          },
        })
        .where(eq(payments.id, payment_id));
    });

    // On verification: fulfill the purchase
    if (action === 'verify') {
      const itemType = metadata.item_type as string;
      const itemId = metadata.item_id as string;
      const userId = metadata.user_id as string;

      if (itemType === 'course' && itemId && userId) {
        // Upsert enrollment using raw SQL ON CONFLICT for portability
        await withAdminContext(async (db) => {
          await db.execute(sql`
            INSERT INTO enrollments (user_id, course_id, status, enrollment_type)
            VALUES (${userId}, ${itemId}, 'enrolled', 'recorded')
            ON CONFLICT (user_id, course_id) DO UPDATE
              SET status = 'enrolled'
          `);
        });
      }

      if (itemType === 'booking' && itemId) {
        await withAdminContext(async (db) => {
          await db.update(bookings)
            .set({ status: 'confirmed', payment_id })
            .where(eq(bookings.id, itemId));
        });
      }

      if (itemType === 'order' && itemId) {
        await withAdminContext(async (db) => {
          await db.update(orders)
            .set({ status: 'paid', payment_id })
            .where(eq(orders.id, itemId));
        });
      }

      // Send payment confirmation to customer (non-blocking)
      const userEmail = metadata.user_email as string;
      const itemName = metadata.item_name as string;
      if (userEmail && userId) {
        const [profile] = await withAdminContext(async (db) => {
          return db.select({ full_name_ar: profiles.full_name_ar, full_name_en: profiles.full_name_en })
            .from(profiles)
            .where(eq(profiles.id, userId))
            .limit(1);
        });
        const name = profile?.full_name_ar || profile?.full_name_en || userEmail;
        notify({
          event: 'payment_received',
          locale: 'ar',
          email: userEmail,
          data: {
            name,
            item: itemName || '',
            amount: String((payment.amount / 100).toFixed(0)),
            currency: payment.currency || 'EGP',
            method: 'InstaPay',
            transactionId: payment.id,
          },
        }).catch(e => console.error('[instapay] Notification failed:', e));
      }
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
