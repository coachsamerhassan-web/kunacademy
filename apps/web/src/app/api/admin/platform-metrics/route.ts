import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { sql, eq, and, gte, count, desc } from 'drizzle-orm';
import { profiles, payments, bookings, enrollments, courses } from '@kunacademy/db/schema';

/**
 * Phase 1d-C (2026-04-30) — admin platform metrics
 *
 * GET /api/admin/platform-metrics
 *
 * Returns the 4 KPIs picked by Samer for the /admin landing page chart panel:
 *
 *   - top_courses              — Top 5 courses by enrollments in the current month
 *                                (Samer's pick "E"; courses are the data-keyed unit
 *                                since enrollments reference courses, not programs)
 *   - new_signups_daily        — New profile rows per day, last 30 days
 *                                (Samer's pick "B")
 *   - outstanding_payments     — Count + sum(amount) for payments where status='pending'
 *                                (Samer's pick "D")
 *   - active_coaches_daily     — DISTINCT coach_id with ≥1 booking per day, last 30 days
 *                                (Samer's pick "C")
 *
 * Admin-only. Aggregations only — no PII in payloads.
 *
 * What this REPLACES:
 *   - The placeholder PlatformChart in apps/web/src/app/[locale]/admin/page.tsx
 *     (cubic-curve SVG with hardcoded y-axis '800 600 400 200 0' and made-up
 *     x-axis 'Jan Feb Mar Apr May').
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const profileRows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
    const role = profileRows[0]?.role;
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // ── E. Top 5 courses by enrollments this month ─────────────────────────
    const topCoursesRows = await db
      .select({
        course_id: enrollments.course_id,
        title_ar: courses.title_ar,
        title_en: courses.title_en,
        enrollment_count: count(enrollments.id).as('enrollment_count'),
      })
      .from(enrollments)
      .leftJoin(courses, eq(enrollments.course_id, courses.id))
      .where(gte(enrollments.enrolled_at, startOfMonth))
      .groupBy(enrollments.course_id, courses.title_ar, courses.title_en)
      .orderBy(desc(sql`enrollment_count`))
      .limit(5);

    // ── B. New signups daily, last 30 days ─────────────────────────────────
    // db.execute() returns { rows, rowCount, ... } — NOT a plain array.
    // Access .rows for the result set.
    const signupsResult = await db.execute(sql`
      SELECT to_char(date_trunc('day', created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
             COUNT(*)::text AS count
        FROM profiles
       WHERE created_at >= ${start30}::timestamptz
    GROUP BY date_trunc('day', created_at)
    ORDER BY day ASC
    `);
    const signupsDaily = (signupsResult.rows as unknown as Array<{ day: string; count: string }>).map((r) => ({
      day: r.day,
      count: Number(r.count),
    }));

    // ── D. Outstanding payments — count + sum by currency ──────────────────
    const outstandingRows = await db
      .select({
        currency: payments.currency,
        cnt: count(payments.id).as('cnt'),
        total: sql<string>`coalesce(sum(${payments.amount}), 0)::text`.as('total'),
      })
      .from(payments)
      .where(eq(payments.status, 'pending'))
      .groupBy(payments.currency);

    const outstandingPayments = {
      total_count: outstandingRows.reduce((s, r) => s + Number(r.cnt), 0),
      by_currency: outstandingRows.map((r) => ({
        currency: r.currency,
        count: Number(r.cnt),
        amount: Number(r.total),
      })),
    };

    // ── C. Active coaches daily, last 30 days ──────────────────────────────
    const activeCoachesResult = await db.execute(sql`
      SELECT to_char(date_trunc('day', start_time) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
             COUNT(DISTINCT coach_id)::text AS count
        FROM bookings
       WHERE coach_id IS NOT NULL
         AND start_time >= ${start30}::timestamptz
    GROUP BY date_trunc('day', start_time)
    ORDER BY day ASC
    `);
    const activeCoachesDaily = (activeCoachesResult.rows as unknown as Array<{ day: string; count: string }>).map((r) => ({
      day: r.day,
      count: Number(r.count),
    }));

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      range_days: 30,
      month_start: startOfMonth,
      top_courses: topCoursesRows.map((r) => ({
        course_id: r.course_id,
        title_ar: r.title_ar ?? '',
        title_en: r.title_en ?? '',
        enrollments: Number(r.enrollment_count),
      })),
      new_signups_daily: signupsDaily,
      outstanding_payments: outstandingPayments,
      active_coaches_daily: activeCoachesDaily,
    });
  } catch (err) {
    console.error('[api/admin/platform-metrics GET]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
