/**
 * Cron 8: second-try-deadline-enforcement
 * Schedule: daily 05:30 UTC (09:30 Dubai UTC+4)
 *
 * Finds second_try_pending packages whose second_try_deadline_at < now().
 * Calls transitionPackageState(id, 'terminated', 'cron') for each.
 *
 * Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';
import { transitionPackageState } from '@/lib/mentoring/state-machine';

interface DeadlinedCandidate {
  id: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  const errors: string[] = [];

  let candidates: DeadlinedCandidate[] = [];
  try {
    candidates = await withAdminContext(async (db) => {
      const rows = await db.execute(sql`
        SELECT id
        FROM package_instances
        WHERE journey_state = 'second_try_pending'
          AND second_try_deadline_at IS NOT NULL
          AND second_try_deadline_at < ${now}
      `);
      return rows.rows as DeadlinedCandidate[];
    });
  } catch (e) {
    return NextResponse.json({ processed: 0, errors: [String(e)] }, { status: 500 });
  }

  let processed = 0;

  for (const c of candidates) {
    try {
      await transitionPackageState(c.id, 'terminated', 'cron');
      processed++;
      console.log(`[cron/second-try-deadline-enforcement] Terminated: ${c.id}`);
    } catch (e) {
      errors.push(`${c.id}: ${String(e)}`);
    }
  }

  return NextResponse.json({ processed, errors });
}
