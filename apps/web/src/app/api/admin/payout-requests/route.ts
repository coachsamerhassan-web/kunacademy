import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

/** GET /api/admin/payout-requests — list all payout requests */
export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(
        sql`
          SELECT
            pr.*,
            p.full_name_ar AS requester_full_name_ar,
            p.full_name_en AS requester_full_name_en,
            p.email AS requester_email
          FROM payout_requests pr
          LEFT JOIN profiles p ON p.id = pr.user_id
          ORDER BY pr.created_at DESC
          LIMIT 200
        `
      );
      return result.rows as any[];
    });

    const shaped = rows.map((r: any) => ({
      ...r,
      requester: r.requester_email
        ? { full_name_ar: r.requester_full_name_ar, full_name_en: r.requester_full_name_en, email: r.requester_email }
        : undefined,
    }));

    return NextResponse.json({ payouts: shaped });
  } catch (err: any) {
    console.error('[api/admin/payout-requests GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PATCH /api/admin/payout-requests — update payout status */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, status } = await request.json();
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

    const processedAt = (status === 'processed' || status === 'rejected')
      ? new Date().toISOString()
      : null;

    await withAdminContext(async (adminDb) => {
      if (processedAt) {
        await adminDb.execute(
          sql`UPDATE payout_requests SET status = ${status}, processed_by = ${user.id}, processed_at = ${processedAt} WHERE id = ${id}`
        );
      } else {
        await adminDb.execute(
          sql`UPDATE payout_requests SET status = ${status}, processed_by = ${user.id} WHERE id = ${id}`
        );
      }
    });

    return NextResponse.json({ success: true, processed_at: processedAt });
  } catch (err: any) {
    console.error('[api/admin/payout-requests PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
