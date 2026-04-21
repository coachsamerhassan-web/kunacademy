import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, sql } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

/**
 * POST /api/admin/pathfinder/publish
 * Body: { version_id: uuid }
 *
 * Flips the target version to is_active=true in a single transaction,
 * deactivating the current active version atomically. Enforced further by
 * the partial unique index: only one active row permitted.
 *
 * Users mid-assessment on the previously active version keep their
 * tree_version_id — their response row is pinned to what they saw. This
 * guarantee is encoded in pathfinder_responses.tree_version_id FK behavior.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { version_id } = await request.json();
    if (!version_id) return NextResponse.json({ error: 'version_id required' }, { status: 400 });

    const result = await withAdminContext(async (adminDb) => {
      // Verify the target version exists
      const exists = await adminDb.execute(sql`
        SELECT id, version_number, label, is_active FROM pathfinder_tree_versions WHERE id = ${version_id}::uuid
      `);
      const target = exists.rows[0] as { id: string; version_number: number; label: string; is_active: boolean } | undefined;
      if (!target) throw new Error('Version not found');
      if (target.is_active) {
        return { already_active: true, target };
      }

      // Atomic swap: deactivate all others first (partial unique index forbids
      // having two actives at the same instant), then activate the target.
      await adminDb.execute(sql`BEGIN`);
      try {
        await adminDb.execute(sql`
          UPDATE pathfinder_tree_versions SET is_active = false, updated_at = NOW()
           WHERE is_active = true
        `);
        await adminDb.execute(sql`
          UPDATE pathfinder_tree_versions SET
            is_active    = true,
            published_at = COALESCE(published_at, NOW()),
            updated_at   = NOW()
           WHERE id = ${version_id}::uuid
        `);
        await adminDb.execute(sql`COMMIT`);
      } catch (err) {
        await adminDb.execute(sql`ROLLBACK`);
        throw err;
      }
      return { already_active: false, target };
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/pathfinder/publish POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
