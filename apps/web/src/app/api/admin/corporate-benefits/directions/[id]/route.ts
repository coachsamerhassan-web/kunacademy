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

/** PATCH /api/admin/corporate-benefits/directions/[id] — update direction */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const {
      slug, title_ar, title_en, description_ar, description_en,
      icon, benefits_mode, display_order, published,
    } = body;

    const modeSql =
      benefits_mode === undefined
        ? sql`benefits_mode`
        : sql`${benefits_mode === 'all' ? 'all' : 'list'}::corporate_benefits_mode`;

    const row = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(sql`
        UPDATE corporate_benefit_directions SET
          slug            = COALESCE(${slug ?? null}, slug),
          title_ar        = COALESCE(${title_ar ?? null}, title_ar),
          title_en        = COALESCE(${title_en ?? null}, title_en),
          description_ar  = COALESCE(${description_ar ?? null}, description_ar),
          description_en  = COALESCE(${description_en ?? null}, description_en),
          icon            = COALESCE(${icon ?? null}, icon),
          benefits_mode   = ${modeSql},
          display_order   = COALESCE(${display_order ?? null}, display_order),
          published       = COALESCE(${published ?? null}, published),
          last_edited_by  = ${user.id},
          last_edited_at  = NOW(),
          updated_at      = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      return result.rows[0];
    });

    if (!row) return NextResponse.json({ error: 'Direction not found' }, { status: 404 });
    return NextResponse.json({ direction: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/corporate-benefits/directions/[id] PATCH]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/admin/corporate-benefits/directions/[id] — delete direction */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    await withAdminContext(async (adminDb) => {
      await adminDb.execute(sql`DELETE FROM corporate_benefit_directions WHERE id = ${id}`);
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/corporate-benefits/directions/[id] DELETE]', msg);
    if (msg.includes('foreign key') || msg.includes('violates')) {
      return NextResponse.json(
        { error: 'Cannot delete direction with existing benefits. Delete child benefits first.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
