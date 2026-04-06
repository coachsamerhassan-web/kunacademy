import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { notify } from '@kunacademy/email';
import { sql } from 'drizzle-orm';

/**
 * Cron: Send installment reminders 3 days before due date.
 * Called by Vercel Cron or external scheduler (daily at 9am Dubai).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find installments due in 3 days
    const now = new Date();
    const targetDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    // payment_schedules stores installments as JSONB — we query unpaid installments whose due_date is in the target window
    // Since installments is a JSON array, we use a raw SQL lateral join to unnest and filter
    const schedules = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`
          SELECT
            ps.id, ps.total_amount, ps.currency, ps.schedule_type,
            p.email AS user_email, p.full_name_ar AS user_full_name_ar, p.full_name_en AS user_full_name_en,
            c.name_ar AS course_name_ar, c.name_en AS course_name_en,
            inst.value AS installment_data
          FROM payment_schedules ps
          LEFT JOIN profiles p ON p.id = ps.user_id
          LEFT JOIN payments pay ON pay.id = ps.payment_id
          LEFT JOIN courses c ON c.id = pay.course_id
          CROSS JOIN LATERAL jsonb_array_elements(ps.installments) AS inst(value)
          WHERE ps.schedule_type = 'installment'
            AND (inst.value->>'status') = 'pending'
            AND (inst.value->>'due_date')::timestamptz >= ${dayStart.toISOString()}
            AND (inst.value->>'due_date')::timestamptz < ${dayEnd.toISOString()}
        `
      );
      return rows.rows as any[];
    });

    if (!schedules?.length) {
      return NextResponse.json({ sent: 0, message: 'No installments due in 3 days' });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const schedule of schedules) {
      const locale = 'ar'; // default — profiles don't carry preferred_locale in schema
      const isAr = locale === 'ar';
      const installment = schedule.installment_data;

      try {
        await notify({
          event: 'installment_due',
          locale,
          email: schedule.user_email,
          data: {
            name: (isAr ? schedule.user_full_name_ar : schedule.user_full_name_en) || '',
            program: isAr ? schedule.course_name_ar : schedule.course_name_en,
            amount: ((installment?.amount || schedule.total_amount || 0) / 100).toFixed(2),
            currency: schedule.currency || 'AED',
            dueDate: new Date(installment?.due_date).toLocaleDateString(isAr ? 'ar-AE' : 'en-US'),
            paymentUrl: `https://kunacademy.com/${locale}/dashboard/payments`,
          },
        });
        sent++;
      } catch (e) {
        errors.push(`Schedule ${schedule.id}: ${String(e)}`);
      }
    }

    return NextResponse.json({ sent, total: schedules.length, errors });
  } catch (e) {
    console.error('[cron/installment-reminders]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
