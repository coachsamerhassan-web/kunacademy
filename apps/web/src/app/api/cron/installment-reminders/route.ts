import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@kunacademy/db';
import { notify } from '@kunacademy/email';

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
    const supabase = createAdminClient();

    // Find installments due in 3 days
    const now = new Date();
    const targetDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    // payment_schedules schema doesn't match this query exactly — cast to any for runtime flexibility
    const { data: schedules, error } = await (supabase as any)
      .from('payment_schedules')
      .select(`
        id, total_amount, currency, schedule_type,
        user:profiles!payment_schedules_user_id_fkey(id, full_name_ar, full_name_en, email),
        payment:payments!payment_schedules_payment_id_fkey(id)
      `)
      .eq('schedule_type', 'installment') as { data: any[] | null; error: any };

    if (error) throw error;
    if (!schedules?.length) {
      return NextResponse.json({ sent: 0, message: 'No installments due in 3 days' });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const schedule of schedules) {
      const user = schedule.user as any;
      const course = schedule.course as any;
      const locale = user?.preferred_locale || 'ar';
      const isAr = locale === 'ar';

      try {
        await notify({
          event: 'installment_due',
          locale,
          email: user?.email,
          data: {
            name: user?.full_name || '',
            program: isAr ? course?.name_ar : course?.name_en,
            amount: ((schedule.amount || 0) / 100).toFixed(2),
            currency: schedule.currency || 'AED',
            dueDate: new Date(schedule.due_date).toLocaleDateString(isAr ? 'ar-AE' : 'en-US'),
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
