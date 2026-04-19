/**
 * GET /api/admin/email-outbox/failed
 *
 * Returns the 50 most recent failed email rows for admin monitoring.
 * Auth: session + role must be 'admin' or 'super_admin'
 *
 * Response: { failed: [ { id, template_key, to_email, last_error, last_attempt_at, attempts }, ... ] }
 */

import { NextResponse } from 'next/server';
import { withAdminContext, sql, db, eq } from '@kunacademy/db';
import { profiles } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

interface FailedEmailRow {
  id: string;
  template_key: string;
  to_email: string;
  last_error: string | null;
  last_attempt_at: string | null;
  attempts: number;
}

export async function GET() {
  try {
    // Auth check
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check
    const profileRows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
    const role = profileRows[0]?.role;
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch 50 most recent failed rows
    const rows = await withAdminContext(async (dbConn) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await dbConn.execute(
        sql`
          SELECT id, template_key, to_email, last_error, last_attempt_at, attempts
          FROM   email_outbox
          WHERE  status = 'failed'
          ORDER  BY last_attempt_at DESC NULLS LAST
          LIMIT  50
        `,
      );
      return result.rows as FailedEmailRow[];
    });

    return NextResponse.json({ failed: rows });
  } catch (err: any) {
    console.error('[api/admin/email-outbox/failed]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
