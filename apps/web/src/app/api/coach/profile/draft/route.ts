import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';

/** POST /api/coach/profile/draft — submit a profile edit for admin review */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { instructor_id, field_name, old_value, new_value } = await request.json();
    if (!instructor_id || !field_name || new_value === undefined) {
      return NextResponse.json({ error: 'instructor_id, field_name, and new_value required' }, { status: 400 });
    }

    await withAdminContext(async (db) => {
      await db.execute(
        sql`
          INSERT INTO instructor_drafts (instructor_id, field_name, old_value, new_value, status)
          VALUES (${instructor_id}, ${field_name}, ${old_value ?? null}, ${new_value}, 'pending')
        `
      );
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/coach/profile/draft POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
