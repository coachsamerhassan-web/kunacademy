/**
 * GET /api/cron/reap-orphan-voice-messages
 *
 * Sweeps for voice-message files on disk whose DB row no longer exists in
 * assessment_voice_messages. This happens when an assessor re-records: the
 * upload handler does a delete-then-insert of the DB row, leaving the old
 * file orphaned on disk.
 *
 * Strategy (conservative):
 * - Only removes files where the DB row is gone.
 * - Does NOT apply a retention policy (no max-age deletion yet).
 * - Dry-run mode: pass ?dry_run=1 to report without unlinking anything.
 *
 * File path convention (from Phase 2.6 upload handler):
 *   {UPLOAD_ROOT}/{assessmentId}/{timestamp}.{ext}
 *   Stored in DB as: uploads/voice-messages/{assessmentId}/{timestamp}.{ext}
 *
 * Auth: Bearer CRON_SECRET
 * Schedule: 0 0 * * * (00:00 UTC = 04:00 Dubai)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

// Root where voice-message files are stored on the VPS.
// Must match the upload handler's path. Override via VOICE_MESSAGE_UPLOAD_ROOT for tests.
const UPLOAD_ROOT =
  process.env.VOICE_MESSAGE_UPLOAD_ROOT ??
  '/var/www/kunacademy-git/uploads/voice-messages';

interface FileEntry {
  abs: string;   // absolute path on disk
  rel: string;   // relative path as stored in DB (uploads/voice-messages/...)
  bytes: number;
}

interface ReapResult {
  scanned: number;
  orphaned: number;
  freed_bytes: number;
  dry_run: boolean;
  files?: string[]; // only populated in dry_run mode
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

  // ── Guard: uploads dir may not exist yet (first deploy / no recordings yet) ─
  // Return 200 with scanned=0 — not a 500. The cron is idempotent; nothing to do.
  if (!fs.existsSync(UPLOAD_ROOT)) {
    return NextResponse.json<ReapResult>({
      scanned: 0,
      orphaned: 0,
      freed_bytes: 0,
      dry_run: dryRun,
    });
  }

  // ── Walk filesystem ────────────────────────────────────────────────────────
  // Expected layout: UPLOAD_ROOT/{assessmentId}/{timestamp}.{ext}
  // DB stores file_path as: uploads/voice-messages/{assessmentId}/{timestamp}.{ext}

  const fileEntries: FileEntry[] = [];

  let assessmentDirs: string[];
  try {
    assessmentDirs = fs.readdirSync(UPLOAD_ROOT);
  } catch (e) {
    console.error('[reap-orphan-voice-messages] Failed to read upload root:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  for (const dir of assessmentDirs) {
    const dirPath = path.join(UPLOAD_ROOT, dir);

    let dirStat: fs.Stats;
    try { dirStat = fs.statSync(dirPath); } catch { continue; }
    if (!dirStat.isDirectory()) continue;

    let files: string[];
    try { files = fs.readdirSync(dirPath); } catch { continue; }

    for (const file of files) {
      const absPath = path.join(dirPath, file);
      let fileStat: fs.Stats;
      try { fileStat = fs.statSync(absPath); } catch { continue; }
      if (!fileStat.isFile()) continue;

      // Relative path must match what the upload handler stores in DB
      const rel = `uploads/voice-messages/${dir}/${file}`;
      fileEntries.push({ abs: absPath, rel, bytes: fileStat.size });
    }
  }

  if (fileEntries.length === 0) {
    return NextResponse.json<ReapResult>({
      scanned: 0,
      orphaned: 0,
      freed_bytes: 0,
      dry_run: dryRun,
    });
  }

  // ── DB lookup: fetch all known file_paths in one round-trip ───────────────
  const knownPaths = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`SELECT file_path FROM assessment_voice_messages`,
    );
    return new Set(
      (rows.rows as Array<{ file_path: string }>).map((r) => r.file_path),
    );
  });

  // ── Identify and optionally remove orphans ─────────────────────────────────
  let orphaned = 0;
  let freedBytes = 0;
  const orphanList: string[] = [];

  for (const entry of fileEntries) {
    if (knownPaths.has(entry.rel)) continue; // DB row exists — keep it

    orphaned++;
    freedBytes += entry.bytes;
    orphanList.push(entry.rel);

    if (!dryRun) {
      try {
        fs.unlinkSync(entry.abs);
        console.log(
          `[reap-orphan-voice-messages] Removed orphan: ${entry.rel} (${entry.bytes} bytes)`,
        );
      } catch (e) {
        // Log + continue — one bad unlink should not abort the full sweep
        console.error(
          `[reap-orphan-voice-messages] Failed to unlink ${entry.abs}:`,
          e,
        );
      }
    } else {
      console.log(
        `[reap-orphan-voice-messages] DRY RUN — would remove: ${entry.rel} (${entry.bytes} bytes)`,
      );
    }
  }

  const result: ReapResult = {
    scanned: fileEntries.length,
    orphaned,
    freed_bytes: freedBytes,
    dry_run: dryRun,
  };
  if (dryRun) result.files = orphanList;

  return NextResponse.json(result);
}
