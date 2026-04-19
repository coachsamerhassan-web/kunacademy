/**
 * GET /api/cron/drain-email-outbox
 *
 * Drains pending rows from the email_outbox table and dispatches each to the
 * appropriate @kunacademy/email template function.
 *
 * Auth: Bearer CRON_SECRET
 * Frequency: every 1 minute (see scripts/setup-vps-crons.sh — Cron 13)
 *
 * Behaviour:
 *  - Fetches up to 50 'pending' rows ORDER BY created_at ASC,
 *    using FOR UPDATE SKIP LOCKED to prevent double-drain across concurrent runs.
 *  - On send success: status → 'sent', sent_at = NOW()
 *  - On send error: attempts += 1, last_error saved, last_attempt_at = NOW().
 *    If attempts >= 5 after the increment: status → 'failed' (permanent failure).
 *    Otherwise: row stays 'pending' and will be retried on the next cron fire.
 *
 * Returns: JSON { processed, sent, failed, retrying }
 *
 * Observability gap: no alert is fired when rows reach status='failed'. Add a
 * Telegram alert (alertCriticalError) or a separate monitoring cron that counts
 * SELECT count(*) WHERE status='failed' AND sent_at IS NULL to close this gap.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql, eq } from '@kunacademy/db';
import { emailOutbox } from '@kunacademy/db/schema';
import {
  sendAssessmentResultEmail,
  type AssessmentResultEmailParams,
  sendRecordingReceivedEmail,
  type RecordingReceivedEmailParams,
  sendAssessorAssignmentEmail,
  type AssessorAssignmentEmailParams,
} from '@kunacademy/email';

const MAX_ATTEMPTS = 5;
const BATCH_SIZE   = 50;

// ── Row type returned from the SKIP LOCKED query ──────────────────────────────

interface OutboxRow {
  id:           string;
  template_key: string;
  to_email:     string;
  payload:      Record<string, unknown>;
  attempts:     number;
}

// ── Dispatch — route template_key to the right send function ──────────────────

async function dispatch(row: OutboxRow): Promise<void> {
  const { template_key, to_email, payload } = row;

  switch (template_key) {
    case 'assessment-result':
      await sendAssessmentResultEmail(
        to_email,
        payload as unknown as AssessmentResultEmailParams,
      );
      return;

    case 'recording-received':
      await sendRecordingReceivedEmail(
        to_email,
        payload as unknown as RecordingReceivedEmailParams,
      );
      return;

    case 'assessor-assignment':
      await sendAssessorAssignmentEmail(
        to_email,
        payload as unknown as AssessorAssignmentEmailParams,
      );
      return;

    default:
      throw new Error(`Unknown template_key: ${template_key}`);
  }
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let totalProcessed = 0;
  let totalSent      = 0;
  let totalFailed    = 0;
  let totalRetrying  = 0;

  try {
    // ── Fetch up to BATCH_SIZE pending rows, locking them for this drain run ───
    // FOR UPDATE SKIP LOCKED: if two cron instances overlap, the second skips
    // rows already locked by the first — no double-send, no deadlock.
    const rows = await withAdminContext(async (db) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await db.execute(
        sql`
          SELECT id, template_key, to_email, payload, attempts
          FROM   email_outbox
          WHERE  status = 'pending'
          ORDER  BY created_at ASC
          LIMIT  ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        `,
      );
      return result.rows as OutboxRow[];
    });

    totalProcessed = rows.length;

    // ── Process each row individually ─────────────────────────────────────────
    for (const row of rows) {
      const now = new Date().toISOString();

      try {
        await dispatch(row);

        // Mark sent
        await withAdminContext(async (db) => {
          await db
            .update(emailOutbox)
            .set({
              status:  'sent',
              sentAt:  now,
            })
            .where(eq(emailOutbox.id, row.id));
        });

        totalSent++;
      } catch (sendErr: unknown) {
        const errorMsg = sendErr instanceof Error
          ? sendErr.message.slice(0, 500)   // cap stored error length
          : String(sendErr).slice(0, 500);

        const newAttempts = row.attempts + 1;
        const isFinalFailure = newAttempts >= MAX_ATTEMPTS;

        await withAdminContext(async (db) => {
          await db
            .update(emailOutbox)
            .set({
              attempts:      newAttempts,
              lastError:     errorMsg,
              lastAttemptAt: now,
              ...(isFinalFailure ? { status: 'failed' } : {}),
            })
            .where(eq(emailOutbox.id, row.id));
        });

        if (isFinalFailure) {
          totalFailed++;
          console.error(
            `[drain-email-outbox] Row ${row.id} (${row.template_key}) permanently failed after ${newAttempts} attempts: ${errorMsg}`,
          );
        } else {
          totalRetrying++;
          console.warn(
            `[drain-email-outbox] Row ${row.id} (${row.template_key}) attempt ${newAttempts}/${MAX_ATTEMPTS} failed: ${errorMsg}`,
          );
        }
      }
    }

    const result = { processed: totalProcessed, sent: totalSent, failed: totalFailed, retrying: totalRetrying };
    console.log('[cron/drain-email-outbox]', result);
    return NextResponse.json(result);
  } catch (fatalErr: unknown) {
    console.error('[cron/drain-email-outbox] Fatal:', fatalErr);
    return NextResponse.json({ error: String(fatalErr) }, { status: 500 });
  }
}
