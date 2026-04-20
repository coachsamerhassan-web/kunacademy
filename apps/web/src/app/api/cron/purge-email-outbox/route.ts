/**
 * GET /api/cron/purge-email-outbox
 *
 * GDPR retention purge for the email_outbox table.
 * PII (to_email, payload) must not be retained indefinitely after delivery.
 *
 * Auth: Bearer CRON_SECRET
 * Frequency: 03:00 Dubai daily = 23:00 UTC (see scripts/setup-vps-crons.sh — Cron 14)
 *
 * Retention policy:
 *  - 'sent'   rows: purged after 30 days  (sent_at  < NOW() - 30 days)
 *  - 'failed' rows: purged after 90 days  (last_attempt_at < NOW() - 90 days)
 *
 * Dry-run mode (?dry_run=1): returns COUNT(*) without deleting anything.
 *
 * Returns: JSON { sent_purged, failed_purged }
 *          (in dry-run mode, field names are sent_to_purge, failed_to_purge)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';

/**
 * Batched DELETE helper: executes DELETE in chunks to avoid table locks.
 * @param db Database connection object
 * @param sqlFn Function that returns the DELETE query with LIMIT applied
 * @param limit Batch size (default 1000)
 * @param maxIterations Safety cap to prevent infinite loops (default 100)
 * @returns Total number of rows deleted
 */
async function batchedDelete(
  db: unknown,
  sqlFn: (limit: number) => ReturnType<typeof sql>,
  limit = 1000,
  maxIterations = 100,
): Promise<number> {
  let totalDeleted = 0;
  for (let i = 0; i < maxIterations; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await (db as any).execute(sqlFn(limit));
    const deleted = result.rowCount ?? 0;
    totalDeleted += deleted;
    if (deleted < limit) break; // finished: fewer rows than batch size
  }
  return totalDeleted;
}

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get('dry_run') === '1';

  try {
    if (dryRun) {
      // ── Dry-run: COUNT only — no deletes ─────────────────────────────────
      const { sentCount, failedCount } = await withAdminContext(async (db) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sentResult: any = await db.execute(
          sql`
            SELECT COUNT(*) AS count
            FROM   email_outbox
            WHERE  status = 'sent'
              AND  sent_at < NOW() - INTERVAL '30 days'
          `,
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const failedResult: any = await db.execute(
          sql`
            SELECT COUNT(*) AS count
            FROM   email_outbox
            WHERE  status = 'failed'
              AND  last_attempt_at < NOW() - INTERVAL '90 days'
          `,
        );
        return {
          sentCount:   parseInt(sentResult.rows[0]?.count   ?? '0', 10),
          failedCount: parseInt(failedResult.rows[0]?.count ?? '0', 10),
        };
      });

      const result = { sent_to_purge: sentCount, failed_to_purge: failedCount, dry_run: true };
      console.log('[cron/purge-email-outbox] DRY RUN', result);
      return NextResponse.json(result);
    }

    // ── Live purge ──────────────────────────────────────────────────────────
    const { sentPurged, failedPurged } = await withAdminContext(async (db) => {
      // Batched DELETE: sent rows older than 30 days
      const sentPurged = await batchedDelete(
        db,
        (limit) => sql`
          DELETE FROM email_outbox
          WHERE  id IN (
            SELECT id FROM email_outbox
            WHERE  status = 'sent'
              AND  sent_at < NOW() - INTERVAL '30 days'
            LIMIT ${limit}
          )
        `,
      );

      // Batched DELETE: failed rows older than 90 days
      const failedPurged = await batchedDelete(
        db,
        (limit) => sql`
          DELETE FROM email_outbox
          WHERE  id IN (
            SELECT id FROM email_outbox
            WHERE  status = 'failed'
              AND  last_attempt_at < NOW() - INTERVAL '90 days'
            LIMIT ${limit}
          )
        `,
      );

      return { sentPurged, failedPurged };
    });

    const result = { sent_purged: sentPurged, failed_purged: failedPurged };
    console.log('[cron/purge-email-outbox]', result);
    return NextResponse.json(result);

  } catch (fatalErr: unknown) {
    console.error('[cron/purge-email-outbox] Fatal:', fatalErr);
    return NextResponse.json({ error: String(fatalErr) }, { status: 500 });
  }
}
