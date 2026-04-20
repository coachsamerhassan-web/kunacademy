/**
 * POST /api/admin/email-outbox/[id]/retry
 *
 * Resets a single failed email row back to pending so the drain cron picks it up.
 * Auth: admin + super_admin
 * Validates: row exists AND status='failed' (cannot retry pending/sent)
 * Audit: RETRY_FAILED_EMAIL logged with { email_id, template_key, previous_attempts }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql, db, eq, logAdminAction } from '@kunacademy/db';
import { profiles } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

interface EmailOutboxRow {
  id: string;
  status: string;
  template_key: string;
  attempts: number;
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

    const { id } = await context.params;

    // Fetch and validate row
    const row = await withAdminContext(async (dbConn) => {
      const result = await dbConn.execute(
        sql`SELECT id, status, template_key, attempts FROM email_outbox WHERE id = ${id} LIMIT 1`,
      );
      return result.rows[0] as EmailOutboxRow | undefined;
    });

    if (!row) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    if (row.status !== 'failed') {
      return NextResponse.json(
        { error: `Cannot retry email with status '${row.status}' — only 'failed' rows can be retried` },
        { status: 422 },
      );
    }

    // Reset to pending
    await withAdminContext(async (dbConn) => {
      await dbConn.execute(
        sql`
          UPDATE email_outbox
          SET    status          = 'pending',
                 attempts        = 0,
                 last_error      = NULL,
                 last_attempt_at = NULL
          WHERE  id = ${id}
        `,
      );
    });

    // Audit log (non-blocking)
    await logAdminAction({
      adminId: user.id,
      action: 'RETRY_FAILED_EMAIL',
      targetType: 'email_outbox',
      targetId: id,
      metadata: {
        email_id: id,
        template_key: row.template_key,
        previous_attempts: row.attempts,
      },
    });

    return NextResponse.json({ ok: true, email_id: id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/email-outbox/[id]/retry]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
