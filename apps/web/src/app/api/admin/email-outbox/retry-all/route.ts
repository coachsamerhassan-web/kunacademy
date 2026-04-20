/**
 * POST /api/admin/email-outbox/retry-all
 *
 * Resets ALL failed email rows back to pending so the drain cron picks them up.
 * Auth: admin + super_admin
 * Audit: RETRY_FAILED_EMAIL logged once per reset row.
 *
 * Response: { ok: true, reset_count: N }
 */

import { NextResponse } from 'next/server';
import { withAdminContext, sql, db, eq, logAdminAction } from '@kunacademy/db';
import { profiles } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

interface FailedRow {
  id: string;
  template_key: string;
  attempts: number;
}

export async function POST() {
  try {
    // Auth check
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check
    const profileRows = await db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);
    const role = profileRows[0]?.role;
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all failed rows BEFORE resetting (for audit metadata)
    const failedRows = await withAdminContext(async (dbConn) => {
      const result = await dbConn.execute(
        sql`SELECT id, template_key, attempts FROM email_outbox WHERE status = 'failed'`,
      );
      return result.rows as FailedRow[];
    });

    if (failedRows.length === 0) {
      return NextResponse.json({ ok: true, reset_count: 0 });
    }

    // Bulk reset
    await withAdminContext(async (dbConn) => {
      await dbConn.execute(
        sql`
          UPDATE email_outbox
          SET    status          = 'pending',
                 attempts        = 0,
                 last_error      = NULL,
                 last_attempt_at = NULL
          WHERE  status = 'failed'
        `,
      );
    });

    // Audit each row (non-blocking, fire-and-forget pattern)
    await Promise.allSettled(
      failedRows.map((row) =>
        logAdminAction({
          adminId: user.id,
          action: 'RETRY_FAILED_EMAIL',
          targetType: 'email_outbox',
          targetId: row.id,
          metadata: {
            email_id: row.id,
            template_key: row.template_key,
            previous_attempts: row.attempts,
            bulk: true,
          },
        }),
      ),
    );

    return NextResponse.json({ ok: true, reset_count: failedRows.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/email-outbox/retry-all]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
