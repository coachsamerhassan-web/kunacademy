import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { instructors, coach_schedules, coach_time_off, bookings } from '@kunacademy/db/schema';

/**
 * GET /api/coach/schedule
 * Returns: { instructor_id, schedules, bookings, time_offs }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const instRows = await db
      .select({ id: instructors.id })
      .from(instructors)
      .where(eq(instructors.profile_id, user.id))
      .limit(1);

    const inst = instRows[0] ?? null;
    if (!inst) return NextResponse.json({ instructor_id: null, schedules: [], bookings: [], time_offs: [] });

    const now = new Date();
    const fourWeeks = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);

    const [scheduleRows, bookingRows, timeOffRows] = await Promise.all([
      db
        .select({
          day_of_week: coach_schedules.day_of_week,
          start_time: coach_schedules.start_time,
          end_time: coach_schedules.end_time,
          buffer_minutes: coach_schedules.buffer_minutes,
        })
        .from(coach_schedules)
        .where(and(eq(coach_schedules.coach_id, user.id), eq(coach_schedules.is_active, true))),

      db
        .select({ start_time: bookings.start_time, end_time: bookings.end_time })
        .from(bookings)
        .where(
          and(
            eq(bookings.provider_id, inst.id),
            gte(bookings.start_time, now.toISOString()),
            lte(bookings.start_time, fourWeeks.toISOString())
          )
        ),

      db
        .select({
          id: coach_time_off.id,
          start_date: coach_time_off.start_date,
          end_date: coach_time_off.end_date,
          reason: coach_time_off.reason,
        })
        .from(coach_time_off)
        .where(eq(coach_time_off.coach_id, user.id))
        .orderBy(coach_time_off.start_date),
    ]);

    return NextResponse.json({
      instructor_id: inst.id,
      schedules: scheduleRows,
      bookings: bookingRows,
      time_offs: timeOffRows,
    });
  } catch (err: any) {
    console.error('[api/coach/schedule GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/coach/schedule
 * Body: { instructor_id, rows: Array<{day_of_week, start_time, end_time, timezone, buffer_minutes}> }
 * Full replace: delete all then insert.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { instructor_id, rows } = await request.json();
    if (!instructor_id) return NextResponse.json({ error: 'instructor_id required' }, { status: 400 });

    // Verify ownership
    const instRows = await db
      .select({ id: instructors.id })
      .from(instructors)
      .where(and(eq(instructors.id, instructor_id), eq(instructors.profile_id, user.id)))
      .limit(1);

    if (!instRows[0]) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await withAdminContext(async (adminDb) => {
      await adminDb.delete(coach_schedules).where(eq(coach_schedules.coach_id, user.id));
      if (rows?.length > 0) {
        await adminDb.insert(coach_schedules).values(
          rows.map((r: any) => ({
            coach_id: user.id,
            day_of_week: r.day_of_week,
            start_time: r.start_time,
            end_time: r.end_time,
            timezone: r.timezone ?? 'Asia/Dubai',
            is_active: true,
            buffer_minutes: r.buffer_minutes ?? 0,
          }))
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/coach/schedule PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/coach/schedule/time-off
 * Body: { instructor_id, start_date, end_date, reason }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { instructor_id, start_date, end_date, reason } = await request.json();
    if (!instructor_id || !start_date || !end_date) {
      return NextResponse.json({ error: 'instructor_id, start_date, end_date required' }, { status: 400 });
    }

    // Verify ownership
    const instRows = await db
      .select({ id: instructors.id })
      .from(instructors)
      .where(and(eq(instructors.id, instructor_id), eq(instructors.profile_id, user.id)))
      .limit(1);

    if (!instRows[0]) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const inserted = await withAdminContext(async (adminDb) => {
      return adminDb
        .insert(coach_time_off)
        .values({
          coach_id: user.id,
          start_date,
          end_date,
          reason: reason || null,
        })
        .returning({
          id: coach_time_off.id,
          start_date: coach_time_off.start_date,
          end_date: coach_time_off.end_date,
          reason: coach_time_off.reason,
        });
    });

    return NextResponse.json({ time_off: inserted[0] });
  } catch (err: any) {
    console.error('[api/coach/schedule POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/schedule?time_off_id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const time_off_id = searchParams.get('time_off_id');
    if (!time_off_id) return NextResponse.json({ error: 'time_off_id required' }, { status: 400 });

    // Verify ownership via instructor
    const instRows = await db
      .select({ id: instructors.id })
      .from(instructors)
      .where(eq(instructors.profile_id, user.id))
      .limit(1);

    if (!instRows[0]) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await withAdminContext(async (adminDb) => {
      await adminDb
        .delete(coach_time_off)
        .where(and(eq(coach_time_off.id, time_off_id), eq(coach_time_off.coach_id, user.id)));
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/coach/schedule DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
