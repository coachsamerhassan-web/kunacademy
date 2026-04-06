import { NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';

/** GET /api/user/credits — return the authenticated user's credit balance */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ${user.id}`
      );
      return rows.rows[0] as { balance: number } | undefined;
    });

    return NextResponse.json({ balance: Number(result?.balance ?? 0) });
  } catch (err: any) {
    console.error('[api/user/credits GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
