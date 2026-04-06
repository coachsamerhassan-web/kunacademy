import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const row = await withAdminContext(async (db) => {
    const rows = await db.execute(sql`
      SELECT
        b.id, b.status, b.start_time, b.end_time, b.customer_id,
        s.name_en AS service_name_en, s.name_ar AS service_name_ar,
        s.duration_minutes, s.price_aed,
        p.full_name_en AS coach_name_en, p.full_name_ar AS coach_name_ar,
        p.avatar_url AS coach_photo
      FROM bookings b
      LEFT JOIN services s ON s.id = b.service_id
      LEFT JOIN providers pr ON pr.id = b.provider_id
      LEFT JOIN profiles p ON p.id = pr.profile_id
      WHERE b.id = ${id}
      LIMIT 1
    `);
    return rows.rows[0] as Record<string, unknown> | undefined;
  });

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.customer_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({ booking: row });
}
