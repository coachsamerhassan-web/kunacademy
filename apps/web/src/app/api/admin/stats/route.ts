import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, count } from 'drizzle-orm';
import { profiles, instructors, enrollments, bookings, payments } from '@kunacademy/db/schema';

/** GET /api/admin/stats — dashboard counts for admin */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify admin role
    const profileRows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
    const role = profileRows[0]?.role;
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [studentCount, coachCount, enrollmentCount, bookingCount, paymentCount] = await Promise.all([
      db.select({ value: count() }).from(profiles).where(eq(profiles.role, 'student')),
      db.select({ value: count() }).from(instructors),
      db.select({ value: count() }).from(enrollments),
      db.select({ value: count() }).from(bookings),
      db.select({ value: count() }).from(payments).where(eq(payments.status, 'completed')),
    ]);

    return NextResponse.json({
      students: studentCount[0]?.value ?? 0,
      coaches: coachCount[0]?.value ?? 0,
      enrollments: enrollmentCount[0]?.value ?? 0,
      bookings: bookingCount[0]?.value ?? 0,
      payments: paymentCount[0]?.value ?? 0,
    });
  } catch (err: any) {
    console.error('[api/admin/stats GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
