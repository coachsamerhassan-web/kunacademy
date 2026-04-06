import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, withUserContext } from '@kunacademy/db';
import { isAdminRole, getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';

/**
 * Payment Schedules API
 * GET — list schedules for current user (or all for admin)
 * POST — create a deposit/installment schedule
 * PATCH — record a payment against a schedule
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`SELECT role FROM profiles WHERE id = ${user.id} LIMIT 1`
      );
      return rows.rows[0] as { role: string } | undefined;
    });

    const isAdmin = isAdminRole(profile?.role);

    const data = await withAdminContext(async (db) => {
      if (isAdmin) {
        const rows = await db.execute(
          sql`
            SELECT
              ps.id, ps.payment_id, ps.total_amount, ps.paid_amount, ps.remaining_amount,
              ps.schedule_type, ps.installments, ps.currency, ps.created_at,
              pay.id AS payment_payment_id, pay.course_id AS payment_course_id, pay.status AS payment_status,
              p.id AS user_id, p.full_name_en AS user_full_name, p.email AS user_email
            FROM payment_schedules ps
            LEFT JOIN payments pay ON pay.id = ps.payment_id
            LEFT JOIN profiles p ON p.id = ps.user_id
            ORDER BY ps.created_at DESC
          `
        );
        return rows.rows;
      } else {
        const rows = await db.execute(
          sql`
            SELECT
              ps.id, ps.payment_id, ps.total_amount, ps.paid_amount, ps.remaining_amount,
              ps.schedule_type, ps.installments, ps.currency, ps.created_at
            FROM payment_schedules ps
            WHERE ps.user_id = ${user.id}
            ORDER BY ps.created_at DESC
          `
        );
        return rows.rows;
      }
    });

    return NextResponse.json({ schedules: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { payment_id, schedule_type, installment_count, currency = 'AED' } = body;

    if (!payment_id || !schedule_type) {
      return NextResponse.json({ error: 'payment_id and schedule_type required' }, { status: 400 });
    }

    // Get payment details
    const payment = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`SELECT id, amount, currency, user_id FROM payments WHERE id = ${payment_id} LIMIT 1`
      );
      return rows.rows[0] as { id: string; amount: number; currency: string; user_id: string } | undefined;
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const totalAmount = payment.amount;
    let installments: Array<{ due_date: string; amount: number; status: string; paid_at: string | null }> = [];

    if (schedule_type === 'deposit_balance') {
      // 30% deposit now, remaining before program start
      const deposit = Math.round(totalAmount * 0.3);
      const balance = totalAmount - deposit;
      const balanceDue = new Date();
      balanceDue.setDate(balanceDue.getDate() + 30); // 30 days for balance

      installments = [
        { due_date: new Date().toISOString(), amount: deposit, status: 'paid', paid_at: new Date().toISOString() },
        { due_date: balanceDue.toISOString(), amount: balance, status: 'pending', paid_at: null },
      ];
    } else if (schedule_type === 'installment') {
      // Split evenly across installment_count (2-6)
      const count = Math.min(Math.max(installment_count || 3, 2), 6);
      const perInstallment = Math.floor(totalAmount / count);
      const remainder = totalAmount - perInstallment * count;

      for (let i = 0; i < count; i++) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + i);
        installments.push({
          due_date: dueDate.toISOString(),
          amount: perInstallment + (i === 0 ? remainder : 0), // first installment absorbs rounding
          status: i === 0 ? 'paid' : 'pending',
          paid_at: i === 0 ? new Date().toISOString() : null,
        });
      }
    }

    const paidAmount = installments.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);

    const schedule = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`
          INSERT INTO payment_schedules (payment_id, user_id, total_amount, paid_amount, remaining_amount, schedule_type, installments, currency)
          VALUES (${payment_id}, ${payment.user_id}, ${totalAmount}, ${paidAmount}, ${totalAmount - paidAmount}, ${schedule_type}, ${JSON.stringify(installments)}, ${currency})
          RETURNING id
        `
      );
      return rows.rows[0] as { id: string } | undefined;
    });

    if (!schedule) throw new Error('Failed to insert schedule');

    return NextResponse.json({ schedule_id: schedule.id, installments }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { schedule_id, installment_index, payment_amount } = body;

    if (!schedule_id || installment_index === undefined) {
      return NextResponse.json({ error: 'schedule_id and installment_index required' }, { status: 400 });
    }

    // Get current schedule
    const schedule = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`SELECT * FROM payment_schedules WHERE id = ${schedule_id} LIMIT 1`
      );
      return rows.rows[0] as any | undefined;
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const installments = typeof schedule.installments === 'string'
      ? JSON.parse(schedule.installments)
      : schedule.installments;

    if (installment_index < 0 || installment_index >= installments.length) {
      return NextResponse.json({ error: 'Invalid installment index' }, { status: 400 });
    }

    // Mark installment as paid
    installments[installment_index].status = 'paid';
    installments[installment_index].paid_at = new Date().toISOString();

    const paidAmount = installments.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + i.amount, 0);

    await withAdminContext(async (db) => {
      await db.execute(
        sql`
          UPDATE payment_schedules
          SET installments = ${JSON.stringify(installments)}, paid_amount = ${paidAmount}, remaining_amount = ${schedule.total_amount - paidAmount}
          WHERE id = ${schedule_id}
        `
      );
    });

    return NextResponse.json({ success: true, paid_amount: paidAmount, remaining: schedule.total_amount - paidAmount });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
