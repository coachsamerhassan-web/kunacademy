/**
 * Cron 2: package-expiry-enforcement
 * Schedule: daily 05:05 UTC (09:05 Dubai UTC+4)
 *
 * Finds package_instances where expires_at < now() and journey_state is
 * not a terminal state. Calls transitionPackageState(id, 'expired', 'cron').
 *
 * Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';
import { transitionPackageState } from '@/lib/mentoring/state-machine';

interface ExpiredCandidate {
  id: string;
  journey_state: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  let candidates: ExpiredCandidate[] = [];
  const errors: string[] = [];

  try {
    candidates = await withAdminContext(async (db) => {
      const rows = await db.execute(sql`
        SELECT id, journey_state
        FROM package_instances
        WHERE expires_at < ${now}
          AND journey_state NOT IN ('completed', 'expired', 'terminated')
      `);
      return rows.rows as ExpiredCandidate[];
    });
  } catch (e) {
    return NextResponse.json({ processed: 0, errors: [String(e)] }, { status: 500 });
  }

  let processed = 0;

  for (const candidate of candidates) {
    try {
      await transitionPackageState(candidate.id, 'expired', 'cron');
      processed++;
      console.log(`[cron/package-expiry-enforcement] Expired: ${candidate.id}`);
    } catch (e) {
      errors.push(`${candidate.id}: ${String(e)}`);
    }
  }

  return NextResponse.json({ processed, errors });
}
