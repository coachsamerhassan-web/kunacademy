import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';

/**
 * Cron: Reap orphaned pending_uses reservations.
 *
 * Context:
 * When a customer confirms a booking with a discount code, we atomically
 * increment pending_uses to reserve capacity. If a Stripe webhook fails to
 * deliver (timeout, network error, etc.), the webhook handler never decrements
 * pending_uses, leaving it orphaned — and blocking future users from claiming
 * the discount.
 *
 * Strategy:
 * This job runs daily (9am UTC) and:
 * 1. Finds all discount codes with pending_uses > 0
 * 2. For each code, counts actual pending bookings (status='pending', created<30min ago)
 * 3. If pending_uses count exceeds actual pending bookings → reset to actual count
 * 4. Logs corrections to debug future webhook issues
 *
 * Why 30 minutes? Gives bookings time to transition to paid/failed status
 * after webhook processes. Webhooks fire ~instantly; 30min buffer accounts for:
 * - Stripe delays (rare but possible)
 * - Network retries
 * - Local processing/DB delays
 *
 * Authorization: Bearer CRON_SECRET (env var)
 */
export async function GET(req: NextRequest) {
  // Verify cron secret — must be set and match Authorization header
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find all discount codes with pending_uses > 0
    const codesWithPending = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`
          SELECT
            id,
            code,
            pending_uses,
            current_uses,
            max_uses
          FROM discount_codes
          WHERE pending_uses > 0
          ORDER BY created_at DESC
        `
      );
      return rows.rows as Array<{
        id: string;
        code: string;
        pending_uses: number;
        current_uses: number;
        max_uses: number | null;
      }>;
    });

    if (!codesWithPending.length) {
      return NextResponse.json({
        codes_checked: 0,
        codes_corrected: 0,
        message: 'No discount codes with pending_uses > 0'
      });
    }

    const corrections: Array<{ code: string; from: number; to: number }> = [];
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // For each code, count actual pending bookings and reconcile
    for (const codeRecord of codesWithPending) {
      // Count bookings that are still in 'pending' status and created OLDER than 30 mins
      // (created_at < thirtyMinutesAgo means created before the 30-min cutoff, i.e., older)
      const pendingBookings = await withAdminContext(async (db) => {
        const rows = await db.execute(
          sql`
            SELECT COUNT(*) as count
            FROM bookings
            WHERE discount_code_id = ${codeRecord.id}
              AND status = 'pending'
              AND created_at < ${thirtyMinutesAgo.toISOString()}
          `
        );
        return (rows.rows[0] as { count: number })?.count || 0;
      });

      // If pending_uses > actual pending bookings, we have orphans
      if (codeRecord.pending_uses > pendingBookings) {
        const correctedCount = pendingBookings;

        // Update pending_uses atomically
        await withAdminContext(async (db) => {
          await db.execute(
            sql`
              UPDATE discount_codes
              SET pending_uses = ${correctedCount}
              WHERE id = ${codeRecord.id}
            `
          );
        });

        corrections.push({
          code: codeRecord.code,
          from: codeRecord.pending_uses,
          to: correctedCount,
        });

        console.log(
          `[cron/reap-orphan-reservations] Code "${codeRecord.code}": ` +
          `pending_uses ${codeRecord.pending_uses} → ${correctedCount} ` +
          `(${codeRecord.pending_uses - correctedCount} orphaned reservations reaped)`
        );
      }
    }

    return NextResponse.json({
      codes_checked: codesWithPending.length,
      codes_corrected: corrections.length,
      corrections,
      message: corrections.length > 0
        ? `Reaped ${corrections.reduce((sum, c) => sum + (c.from - c.to), 0)} orphaned reservations across ${corrections.length} code(s)`
        : 'All pending_uses counts are reconciled',
    });
  } catch (e) {
    console.error('[cron/reap-orphan-reservations]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
