import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { notify } from '@kunacademy/email';
import { sql } from 'drizzle-orm';

/**
 * Cron: Send installment reminders 3 days before due date.
 * Called by Vercel Cron or external scheduler (daily at 9am Dubai).
 *
 * Supports THREE parent types via UNION ALL:
 *   1. booking   — payments.booking_id  → bookings → services
 *   2. event     — payments.event_registration_id → event_registrations
 *   3. order     — payments.order_id    → orders → order_items → products
 *
 * NOTE: `payments` has no `course_id` column. The original JOIN was invalid.
 * Course/program enrollments land via `orders` (order_items → products).
 *
 * Payment portal URL: kuncoaching.me dashboard (or custom per `payments.payment_portal_url`).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const targetDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    /**
     * UNION ALL across 3 parent types.
     *
     * Each branch selects:
     *   schedule_id, installment_data (JSONB), currency,
     *   student_id, student_name, student_email,
     *   parent_type, parent_label_ar, parent_label_en
     *
     * Rows where all 3 FKs are NULL are excluded by the WHERE filter
     * (no matching branch will emit them).
     */
    const schedules = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`
          -- ── Branch 1: Booking (individual session) ──────────────────────────
          SELECT
            ps.id                 AS schedule_id,
            ps.currency,
            inst.value            AS installment_data,
            p.id                  AS student_id,
            COALESCE(p.preferred_language, 'ar') AS preferred_language,
            COALESCE(
              NULLIF(p.full_name_en, ''),
              NULLIF(p.full_name_ar, ''),
              NULLIF(p.email,        '')
            )                     AS student_name,
            p.email               AS student_email,
            'booking'             AS parent_type,
            COALESCE(svc.name_ar, 'جلسة فردية')   AS parent_label_ar,
            COALESCE(svc.name_en, 'Individual Session') AS parent_label_en,
            pay.payment_portal_url
          FROM payment_schedules ps
          JOIN payments pay        ON pay.id = ps.payment_id
          JOIN bookings bk         ON bk.id  = pay.booking_id
          JOIN profiles p          ON p.id   = COALESCE(bk.customer_id,
                                        (SELECT id FROM profiles WHERE email = bk.guest_email LIMIT 1))
          LEFT JOIN services svc   ON svc.id = bk.service_id
          CROSS JOIN LATERAL jsonb_array_elements(ps.installments) AS inst(value)
          WHERE ps.schedule_type IN ('installment', 'deposit_balance')
            AND (inst.value->>'status') = 'pending'
            AND (inst.value->>'due_date')::timestamptz >= ${dayStart.toISOString()}
            AND (inst.value->>'due_date')::timestamptz <  ${dayEnd.toISOString()}
            AND pay.booking_id IS NOT NULL

          UNION ALL

          -- ── Branch 2: Event registration (programs / courses / workshops) ───
          SELECT
            ps.id                 AS schedule_id,
            ps.currency,
            inst.value            AS installment_data,
            p.id                  AS student_id,
            COALESCE(p.preferred_language, 'ar') AS preferred_language,
            COALESCE(
              NULLIF(p.full_name_en, ''),
              NULLIF(p.full_name_ar, ''),
              NULLIF(p.email,        ''),
              er.name
            )                     AS student_name,
            COALESCE(p.email, er.email) AS student_email,
            'event'               AS parent_type,
            er.event_slug         AS parent_label_ar,
            er.event_slug         AS parent_label_en,
            pay.payment_portal_url
          FROM payment_schedules ps
          JOIN payments pay              ON pay.id  = ps.payment_id
          JOIN event_registrations er    ON er.id   = pay.event_registration_id
          LEFT JOIN profiles p           ON p.id    = er.user_id
          CROSS JOIN LATERAL jsonb_array_elements(ps.installments) AS inst(value)
          WHERE ps.schedule_type IN ('installment', 'deposit_balance')
            AND (inst.value->>'status') = 'pending'
            AND (inst.value->>'due_date')::timestamptz >= ${dayStart.toISOString()}
            AND (inst.value->>'due_date')::timestamptz <  ${dayEnd.toISOString()}
            AND pay.event_registration_id IS NOT NULL

          UNION ALL

          -- ── Branch 3: Order (packages / digital products / bundles) ─────────
          SELECT
            ps.id                 AS schedule_id,
            ps.currency,
            inst.value            AS installment_data,
            p.id                  AS student_id,
            COALESCE(p.preferred_language, 'ar') AS preferred_language,
            COALESCE(
              NULLIF(p.full_name_en, ''),
              NULLIF(p.full_name_ar, ''),
              NULLIF(p.email,        '')
            )                     AS student_name,
            p.email               AS student_email,
            'order'               AS parent_type,
            -- Take the first product name on the order as the label
            COALESCE(
              (SELECT pr.name_ar FROM order_items oi
               JOIN products pr ON pr.id = oi.product_id
               WHERE oi.order_id = ord.id
               ORDER BY pr.name_ar LIMIT 1),
              'طلب شراء'
            )                     AS parent_label_ar,
            COALESCE(
              (SELECT pr.name_en FROM order_items oi
               JOIN products pr ON pr.id = oi.product_id
               WHERE oi.order_id = ord.id
               ORDER BY pr.name_en LIMIT 1),
              'Order'
            )                     AS parent_label_en,
            pay.payment_portal_url
          FROM payment_schedules ps
          JOIN payments pay        ON pay.id   = ps.payment_id
          JOIN orders ord          ON ord.id   = pay.order_id
          JOIN profiles p          ON p.id     = ord.customer_id
          CROSS JOIN LATERAL jsonb_array_elements(ps.installments) AS inst(value)
          WHERE ps.schedule_type IN ('installment', 'deposit_balance')
            AND (inst.value->>'status') = 'pending'
            AND (inst.value->>'due_date')::timestamptz >= ${dayStart.toISOString()}
            AND (inst.value->>'due_date')::timestamptz <  ${dayEnd.toISOString()}
            AND pay.order_id IS NOT NULL
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
      const installment = schedule.installment_data;

      // Use profile's preferred_language or default to 'ar'
      const locale: 'ar' | 'en' = (schedule.preferred_language as 'ar' | 'en') || 'ar';
      const isAr = locale === 'ar';

      const studentEmail = schedule.student_email as string | undefined;
      if (!studentEmail) {
        errors.push(`Schedule ${schedule.schedule_id}: no email — skipped`);
        continue;
      }

      const parentType = schedule.parent_type as string;
      const parentLabel = isAr
        ? (schedule.parent_label_ar as string)
        : (schedule.parent_label_en as string);

      try {
        const paymentUrl = schedule.payment_portal_url
          ? String(schedule.payment_portal_url)
          : `https://kuncoaching.me/${locale}/dashboard/payments`;

        await notify({
          event: 'installment_due',
          locale,
          email: studentEmail,
          data: {
            name: (schedule.student_name as string) || '',
            program: parentLabel,
            // installment.amount is stored in minor units (cents/halalas)
            amount: ((installment?.amount || 0) / 100).toFixed(2),
            currency: (schedule.currency as string) || 'AED',
            dueDate: new Date(installment?.due_date).toLocaleDateString(
              isAr ? 'ar-AE' : 'en-US'
            ),
            // Payment portal — students manage all instalments here.
            // Uses payment_portal_url if set; falls back to dashboard.
            paymentUrl,
            parentType,
          },
        });
        sent++;
      } catch (e) {
        errors.push(`Schedule ${schedule.schedule_id} (${parentType}): ${String(e)}`);
      }
    }

    return NextResponse.json({ sent, total: schedules.length, errors });
  } catch (e) {
    console.error('[cron/installment-reminders]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
