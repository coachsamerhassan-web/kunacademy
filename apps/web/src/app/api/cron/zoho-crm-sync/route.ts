import { NextRequest, NextResponse } from 'next/server';
import { runBatchContactSync }       from '@/lib/crm-sync';
import { checkZohoCustomFields }     from '@/lib/zoho-crm';

/**
 * Cron: Zoho CRM contact batch sync.
 * Runs every 15 minutes.
 *
 * - Syncs profiles not yet in CRM (created since last run)
 * - Drains the crm_sync_queue (retry failed contact upserts + deals)
 *
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
  console.log('[cron/zoho-crm-sync] GET request received');
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[cron/zoho-crm-sync] Starting health check');
    // Health check: verify custom fields exist in Zoho CRM
    const fieldCheck = await checkZohoCustomFields();
    console.log('[cron/zoho-crm-sync] Health check result:', fieldCheck);
    if (!fieldCheck.ok) {
      console.warn(
        '[zoho-crm] MISSING custom fields in Zoho CRM Settings:',
        fieldCheck.missing.join(', '),
        '— field values will be silently ignored until created.',
      );
    }

    const result = await runBatchContactSync(50);

    console.log('[cron/zoho-crm-sync]', result);

    return NextResponse.json({
      ok:            true,
      processed:     result.processed,
      created:       result.created,
      updated:       result.updated,
      queue_drained: result.queue_drained,
      error_count:   result.errors.length,
      errors:        result.errors.slice(0, 10), // cap log size
    });
  } catch (e) {
    console.error('[cron/zoho-crm-sync] Fatal:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
