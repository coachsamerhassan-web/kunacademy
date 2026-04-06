import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { instructors } from '@kunacademy/db/schema';

/** GET /api/coach/profile — return the authenticated coach's instructor record */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await db
      .select()
      .from(instructors)
      .where(eq(instructors.profile_id, user.id))
      .limit(1);

    const instructor = rows[0] ?? null;
    return NextResponse.json({ instructor });
  } catch (err: any) {
    console.error('[api/coach/profile GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
