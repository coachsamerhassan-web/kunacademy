import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc } from 'drizzle-orm';
import { earnings } from '@kunacademy/db/schema';

/** GET /api/coach/earnings — authenticated coach's earnings */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const earningRows = await db
      .select()
      .from(earnings)
      .where(eq(earnings.user_id, user.id))
      .orderBy(desc(earnings.created_at))
      .limit(200);

    return NextResponse.json({ earnings: earningRows });
  } catch (err: any) {
    console.error('[api/coach/earnings]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
