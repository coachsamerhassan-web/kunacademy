import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { notify } from '@kunacademy/email';
import { isAdminRole, getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';

/**
 * POST /api/notifications/payout
 * Called by admin payouts page after status update.
 * Sends payout status notification to the coach.
 */
export async function POST(request: NextRequest) {
  // Auth via Auth.js session (cookie-based)
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify admin
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { payoutId, newStatus } = await request.json();
  if (!payoutId || !newStatus) {
    return NextResponse.json({ error: 'payoutId and newStatus required' }, { status: 400 });
  }

  // Fetch payout with coach profile
  const payout = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`
        SELECT pr.*, p.full_name_ar AS requester_full_name_ar, p.full_name_en AS requester_full_name_en, p.email AS requester_email
        FROM payout_requests pr
        LEFT JOIN profiles p ON p.id = pr.user_id
        WHERE pr.id = ${payoutId}
        LIMIT 1
      `
    );
    return rows.rows[0] as any | undefined;
  });

  if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });

  const requesterEmail = payout.requester_email;
  if (!requesterEmail) return NextResponse.json({ ok: true, skipped: 'no email' });

  const statusMap: Record<string, 'approved' | 'completed' | 'rejected'> = {
    approved: 'approved',
    processed: 'completed',
    rejected: 'rejected',
  };

  const results = await notify({
    event: 'payout_update',
    locale: 'ar',
    email: requesterEmail,
    data: {
      name: payout.requester_full_name_ar || payout.requester_full_name_en || requesterEmail,
      amount: String(payout.amount || 0),
      currency: payout.currency || 'AED',
      status: statusMap[newStatus] || newStatus,
      note: payout.notes || '',
    },
  });

  return NextResponse.json({ ok: true, results });
}
