import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext, sql } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

// ---------------------------------------------------------------------------
// GET /api/admin/claims
//
// List claim requests with optional filters.
// Query params:
//   ?status=pending|approved|rejected  (default: pending)
//   ?page=<number>                     (default: 1)
//   ?per_page=<number>                 (default: 50)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? 'pending';
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const per_page = Math.min(200, Math.max(1, Number(searchParams.get('per_page') ?? '50')));
    const offset = (page - 1) * per_page;

    // Validate status filter
    const validStatuses = ['pending', 'approved', 'rejected', 'all'];
    const filterStatus = validStatuses.includes(status) ? status : 'pending';

    const statusCondition = filterStatus === 'all'
      ? '1=1'
      : `cr.status = '${filterStatus}'`;

    const [dataRows, countRows] = await Promise.all([
      db.execute(sql`
        SELECT
          cr.id,
          cr.member_id,
          cr.email,
          cr.message,
          cr.status,
          cr.reviewed_by,
          cr.reviewed_at,
          cr.created_at,
          cm.name_ar AS member_name_ar,
          cm.name_en AS member_name_en,
          cm.email AS member_email,
          cm.slug AS member_slug,
          cm.photo_url AS member_photo_url,
          cm.claimed_at AS member_claimed_at,
          p.full_name_en AS reviewer_name
        FROM claim_requests cr
        JOIN community_members cm ON cm.id = cr.member_id
        LEFT JOIN profiles p ON p.id = cr.reviewed_by
        WHERE ${sql.raw(statusCondition)}
        ORDER BY cr.created_at DESC
        LIMIT ${per_page} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM claim_requests cr
        WHERE ${sql.raw(statusCondition)}
      `),
    ]);

    const total = (countRows.rows[0] as any)?.total ?? 0;
    const total_pages = Math.ceil(total / per_page);

    return NextResponse.json({
      claims: dataRows.rows,
      pagination: { page, per_page, total, total_pages },
    });
  } catch (err: any) {
    console.error('[api/admin/claims GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
