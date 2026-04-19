import { NextRequest, NextResponse } from 'next/server';
import { runDailyStatusRefresh }     from '@/lib/crm-sync';

/**
 * Cron: Zoho CRM daily activity status refresh.
 * Runs once daily at 06:00 Dubai time (02:00 UTC).
 *
 * Classifies every synced contact as New / Active / Passive and
 * pushes changed statuses to Zoho CRM via the Kun_Activity_Status custom field.
 *
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailyStatusRefresh(100);

    console.log('[cron/zoho-crm-status]', result);

    return NextResponse.json({
      ok:          true,
      checked:     result.checked,
      updated:     result.updated,
      error_count: result.errors.length,
      errors:      result.errors.slice(0, 10),
    });
  } catch (e) {
    console.error('[cron/zoho-crm-status] Fatal:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
