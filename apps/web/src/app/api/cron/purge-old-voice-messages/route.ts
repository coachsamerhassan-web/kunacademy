/**
 * GET /api/cron/purge-old-voice-messages
 *
 * Deletes voice messages (DB row + file on disk) older than 180 days.
 * Implements Samer's 6-month retention policy per Phase 2.6 requirements.
 *
 * Strategy:
 * - Query for messages with created_at < NOW() - INTERVAL '180 days'
 * - Batch delete at 500 rows per run (idempotent across repeated calls)
 * - For each row: delete DB entry, then unlink file with error recovery
 * - File deletion is best-effort (catch + log, continue on failure)
 * - Dry-run mode: ?dry_run=1 returns COUNT only, no delete
 *
 * Edge cases handled:
 * - File already missing (orphan reaper ran first): continue silently
 * - Permission error on unlink: log and continue, do not revert DB delete
 * - DB delete fails: return 500 (we don't unlink)
 * - No messages in retention period: return 200 with processed=0
 *
 * Auth: Bearer CRON_SECRET
 * Schedule: 0 2 * * * (02:00 UTC = 06:00 Dubai daily)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';
import { assessmentVoiceMessages } from '@kunacademy/db/schema';
import * as fs from 'fs';
import * as path from 'path';

const UPLOAD_ROOT =
  process.env.VOICE_MESSAGE_UPLOAD_ROOT ??
  '/var/www/kunacademy-git/uploads/voice-messages';

const BATCH_SIZE = 500;
const RETENTION_DAYS = 180;

interface PurgeResult {
  processed: number;      // rows attempted to delete
  deleted: number;        // rows successfully deleted from DB
  freed_bytes: number;    // bytes freed from disk
  errors: number;         // file unlink errors (non-fatal)
  dry_run: boolean;
  messages?: string[];    // in dry_run, list of file paths to be deleted
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get('dry_run') === '1';

  try {
    const result = await withAdminContext(async (db) => {
      // ── Query: get oldest messages in this batch ──────────────────────────────
      const oldMessages = await db.execute(sql`
        SELECT id, file_path, size_bytes
        FROM assessment_voice_messages
        WHERE created_at < NOW() - INTERVAL '${sql.raw(RETENTION_DAYS.toString())} days'
        ORDER BY created_at ASC
        LIMIT ${BATCH_SIZE}
      `);

      const rows = oldMessages.rows as Array<{
        id: string;
        file_path: string;
        size_bytes: number;
      }>;

      let deletedCount = 0;
      let freedBytes = 0;
      let errorCount = 0;
      const fileList: string[] = [];

      // ── Process each row ──────────────────────────────────────────────────────
      for (const row of rows) {
        fileList.push(row.file_path);

        if (!dryRun) {
          try {
            // Delete DB row first
            await db
              .delete(assessmentVoiceMessages)
              .where(sql`id = ${row.id}`);

            deletedCount++;
            freedBytes += row.size_bytes;

            // Then delete file (with error recovery)
            const absPath = path.join(UPLOAD_ROOT, path.basename(row.file_path));
            try {
              if (fs.existsSync(absPath)) {
                fs.unlinkSync(absPath);
                console.log(
                  `[purge-old-voice-messages] Deleted: ${row.file_path} (${row.size_bytes} bytes)`,
                );
              } else {
                // File already gone (e.g., orphan reaper ran first) — that's OK
                console.log(
                  `[purge-old-voice-messages] File already missing: ${row.file_path}`,
                );
              }
            } catch (unlinkErr) {
              // Log but don't revert DB delete — DB row is gone and that's our goal
              errorCount++;
              console.error(
                `[purge-old-voice-messages] Failed to unlink ${absPath}:`,
                unlinkErr,
              );
            }
          } catch (dbErr) {
            // DB delete failed — this is fatal for this row, abort entire batch
            console.error(
              `[purge-old-voice-messages] Failed to delete DB row ${row.id}:`,
              dbErr,
            );
            throw dbErr;
          }
        }
      }

      const result: PurgeResult = {
        processed: rows.length,
        deleted: deletedCount,
        freed_bytes: freedBytes,
        errors: errorCount,
        dry_run: dryRun,
      };

      if (dryRun) {
        result.messages = fileList;
        console.log(
          `[purge-old-voice-messages] DRY RUN: would delete ${fileList.length} messages (${freedBytes} bytes)`,
        );
      }

      return result;
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[purge-old-voice-messages] Cron failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
