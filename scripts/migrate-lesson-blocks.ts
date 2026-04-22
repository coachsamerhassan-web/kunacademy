#!/usr/bin/env npx tsx
/**
 * LESSON-BLOCKS Session A — backward-compat data migration.
 *
 * For each existing `lessons` row (12 as of 2026-04-22, all scaffolded empty),
 * create a matching `lesson_placements` row preserving legacy `course_id`,
 * `section_id`, and `order` (maps to `sort_order`). Leaves `lesson_blocks`
 * empty — these are empty scaffolds with no content to migrate.
 *
 * Idempotent via ON CONFLICT (course_id, lesson_id, section_id) DO NOTHING.
 *
 * Modes (match the existing migrate-pathfinder.ts / migrate-blog-posts.ts pattern):
 *   DATABASE_URL=...                    npx tsx scripts/migrate-lesson-blocks.ts
 *   DRY_RUN=1                            npx tsx scripts/migrate-lesson-blocks.ts
 *   EMIT_SQL=/tmp/lesson-placements.sql  npx tsx scripts/migrate-lesson-blocks.ts
 *     → emits an idempotent SQL seed file, safe to apply via:
 *       sudo -u postgres psql -d kunacademy -f <file>
 *
 * Verification after apply:
 *   SELECT count(*) FROM lesson_placements;   -- should equal SELECT count(*) FROM lessons;
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';

interface LessonRow {
  id: string;
  course_id: string | null;
  section_id: string | null;
  order: number;
}

const DRY_RUN = process.env.DRY_RUN === '1';
const EMIT_SQL = process.env.EMIT_SQL;

function sqlLiteral(v: string | number | null): string {
  if (v === null) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}

async function main() {
  // ── Source: SELECT existing lessons ───────────────────────────────────────
  if (!process.env.DATABASE_URL && !EMIT_SQL && !DRY_RUN) {
    console.error('DATABASE_URL required (or set EMIT_SQL or DRY_RUN).');
    process.exit(1);
  }

  let lessonRows: LessonRow[] = [];

  if (process.env.DATABASE_URL) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const res = await client.query<LessonRow>(
        `SELECT id, course_id, section_id, "order" FROM lessons ORDER BY course_id, "order"`
      );
      lessonRows = res.rows;
    } finally {
      await client.end();
    }
    console.log(`Found ${lessonRows.length} lessons to backfill.`);
  } else {
    console.log('No DATABASE_URL — EMIT_SQL/DRY_RUN mode will use a generic template.');
  }

  // ── Build the placement INSERTs ────────────────────────────────────────────
  // If we have live rows, emit specific INSERTs; otherwise emit a self-contained
  // SQL block that backfills via SELECT from lessons (safe to re-run).
  const sqlLines: string[] = [];
  sqlLines.push('-- Backward-compat data migration — LESSON-BLOCKS Session A');
  sqlLines.push('-- Creates one lesson_placements row per existing lesson,');
  sqlLines.push('-- preserving (course_id, section_id, order → sort_order).');
  sqlLines.push('-- Idempotent: ON CONFLICT DO NOTHING on the composite unique.');
  sqlLines.push('');
  sqlLines.push('BEGIN;');
  sqlLines.push('');

  if (lessonRows.length > 0) {
    // Specific INSERTs (deterministic, auditable).
    for (const l of lessonRows) {
      if (!l.course_id) {
        sqlLines.push(`-- SKIP lesson ${l.id} — course_id is NULL (post-0046 orphan).`);
        continue;
      }
      sqlLines.push(
        `INSERT INTO lesson_placements (course_id, section_id, lesson_id, sort_order) VALUES (` +
          `${sqlLiteral(l.course_id)}, ` +
          `${sqlLiteral(l.section_id)}, ` +
          `${sqlLiteral(l.id)}, ` +
          `${l.order}` +
          `) ON CONFLICT ON CONSTRAINT lesson_placements_course_lesson_section_unique DO NOTHING;`
      );
    }
  } else {
    // Fallback: backfill from lessons via SELECT. Useful when this script is
    // run without DATABASE_URL (e.g., during deploy on VPS via psql -f).
    sqlLines.push('INSERT INTO lesson_placements (course_id, section_id, lesson_id, sort_order)');
    sqlLines.push('  SELECT course_id, section_id, id, "order"');
    sqlLines.push('    FROM lessons');
    sqlLines.push('   WHERE course_id IS NOT NULL');
    sqlLines.push('ON CONFLICT ON CONSTRAINT lesson_placements_course_lesson_section_unique DO NOTHING;');
  }

  sqlLines.push('');
  sqlLines.push('-- Verification');
  sqlLines.push('DO $$');
  sqlLines.push('DECLARE');
  sqlLines.push('  v_lessons int;');
  sqlLines.push('  v_placements int;');
  sqlLines.push('BEGIN');
  sqlLines.push('  SELECT count(*) INTO v_lessons FROM lessons WHERE course_id IS NOT NULL;');
  sqlLines.push('  SELECT count(*) INTO v_placements FROM lesson_placements;');
  sqlLines.push('  IF v_placements < v_lessons THEN');
  sqlLines.push('    RAISE EXCEPTION ' +
    "'Backfill incomplete: % lessons have course_id but only % placements exist'" +
    ', v_lessons, v_placements;');
  sqlLines.push('  END IF;');
  sqlLines.push('  RAISE NOTICE ' +
    "'Lesson-placement backfill OK: % placements for % lessons'" +
    ', v_placements, v_lessons;');
  sqlLines.push('END $$;');
  sqlLines.push('');
  sqlLines.push('COMMIT;');

  const sqlText = sqlLines.join('\n') + '\n';

  // ── Emit ───────────────────────────────────────────────────────────────────
  if (EMIT_SQL) {
    const out = resolve(process.cwd(), EMIT_SQL);
    writeFileSync(out, sqlText);
    console.log(`Wrote SQL to ${out} (${sqlText.length} bytes).`);
    return;
  }

  if (DRY_RUN) {
    console.log('─── DRY RUN (no DB writes) ───');
    console.log(sqlText);
    return;
  }

  // Live apply via DATABASE_URL.
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sqlText);
    console.log('Backfill applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
