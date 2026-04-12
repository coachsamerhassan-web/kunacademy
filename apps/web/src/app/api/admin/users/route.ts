import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc, sql } from 'drizzle-orm';
import { profiles, providers, instructors } from '@kunacademy/db/schema';
import { autoAssignServices } from '@/lib/auto-assign-services';

// ---------------------------------------------------------------------------
// Auth guard
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
// GET /api/admin/users
// Query params: ?role=student|provider|admin
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role');

    // Fetch all profiles with LEFT JOIN to providers and instructors
    const rows = await db.execute(sql`
      SELECT
        p.id,
        p.email,
        p.full_name_ar,
        p.full_name_en,
        p.role,
        p.created_at,
        CASE WHEN pv.id IS NOT NULL THEN true ELSE false END AS has_provider,
        CASE WHEN ins.id IS NOT NULL THEN true ELSE false END AS has_instructor,
        ins.kun_level,
        ins.icf_credential,
        pv.is_visible AS provider_is_visible,
        ins.is_visible AS instructor_is_visible
      FROM profiles p
      LEFT JOIN providers pv ON pv.profile_id = p.id
      LEFT JOIN instructors ins ON ins.profile_id = p.id
      ${roleFilter ? sql`WHERE p.role = ${roleFilter}` : sql``}
      ORDER BY p.created_at DESC
      LIMIT 500
    `);

    return NextResponse.json({ users: rows.rows });
  } catch (err: any) {
    console.error('[api/admin/users GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/users
// Body: { user_id, role?, kun_level?, icf_credential?, service_roles?, is_visible?, is_bookable? }
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      user_id,
      role,
      kun_level,
      icf_credential,
      service_roles,
      is_visible,
      is_bookable,
    } = body as {
      user_id?: string;
      role?: string;
      kun_level?: string;
      icf_credential?: string;
      service_roles?: string[];
      is_visible?: boolean;
      is_bookable?: boolean;
    };

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // Prevent assigning super_admin via this API
    if (role === 'super_admin') {
      return NextResponse.json(
        { error: 'super_admin role cannot be assigned via this endpoint' },
        { status: 400 }
      );
    }

    // Fetch current state
    const profileRows = await db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, user_id))
      .limit(1);

    if (!profileRows[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentRole = profileRows[0].role;
    const newRole = role ?? currentRole;

    await withAdminContext(async (adminDb) => {
      // 1. Update role if changed
      if (role && role !== currentRole) {
        await adminDb.execute(
          sql`UPDATE profiles SET role = ${role} WHERE id = ${user_id}`
        );
      }

      // 2. Upgrading to provider: ensure provider + instructor records exist
      if (newRole === 'provider') {
        // Check provider record
        const existingProvider = await adminDb.execute(
          sql`SELECT id FROM providers WHERE profile_id = ${user_id} LIMIT 1`
        );
        let providerId: string;
        if (existingProvider.rows.length === 0) {
          const inserted = await adminDb.execute(
            sql`INSERT INTO providers (profile_id, is_visible) VALUES (${user_id}, false) RETURNING id`
          );
          providerId = (inserted.rows[0] as { id: string }).id;
        } else {
          providerId = (existingProvider.rows[0] as { id: string }).id;
        }

        // Check instructor record
        const existingInstructor = await adminDb.execute(
          sql`SELECT id FROM instructors WHERE profile_id = ${user_id} LIMIT 1`
        );
        if (existingInstructor.rows.length === 0) {
          await adminDb.execute(
            sql`INSERT INTO instructors
              (profile_id, slug, title_en, title_ar, is_bookable, is_visible)
              VALUES (
                ${user_id},
                ${user_id},
                ${'New Coach'},
                ${'كوتش جديد'},
                false,
                false
              )`
          );
        }

        // Auto-assign services if kun_level is being set at the same time
        if (kun_level) {
          await autoAssignServices(providerId, kun_level);
        }
      }

      // 3. Downgrading FROM provider: hide records, do not delete
      if (currentRole === 'provider' && newRole !== 'provider') {
        await adminDb.execute(
          sql`UPDATE providers SET is_visible = false WHERE profile_id = ${user_id}`
        );
        await adminDb.execute(
          sql`UPDATE instructors SET is_bookable = false, is_visible = false WHERE profile_id = ${user_id}`
        );
      }

      // 4. Update instructors fields if provided
      const instructorUpdates: string[] = [];
      if (kun_level !== undefined) instructorUpdates.push(`kun_level = '${kun_level.replace(/'/g, "''")}'`);
      if (icf_credential !== undefined) instructorUpdates.push(`icf_credential = '${icf_credential.replace(/'/g, "''")}'`);
      if (service_roles !== undefined) {
        const arrLiteral = `ARRAY[${service_roles.map(r => `'${r.replace(/'/g, "''")}'`).join(',')}]`;
        instructorUpdates.push(`service_roles = ${arrLiteral}`);
      }
      // Note: is_bookable column does not exist in instructors table yet — skipped
      if (is_visible !== undefined) {
        instructorUpdates.push(`is_visible = ${is_visible}`);
        // Also mirror is_visible to providers table
        await adminDb.execute(
          sql`UPDATE providers SET is_visible = ${is_visible} WHERE profile_id = ${user_id}`
        );
      }

      if (instructorUpdates.length > 0) {
        await adminDb.execute(
          sql`UPDATE instructors SET ${sql.raw(instructorUpdates.join(', '))} WHERE profile_id = ${user_id}`
        );
      }

      // Auto-assign services when kun_level changes on an existing provider
      // (covers upgrades that don't change role, just level)
      if (kun_level !== undefined && newRole === 'provider' && currentRole === 'provider') {
        const providerRow = await adminDb.execute(
          sql`SELECT id FROM providers WHERE profile_id = ${user_id} LIMIT 1`
        );
        if (providerRow.rows.length > 0) {
          const existingProviderId = (providerRow.rows[0] as { id: string }).id;
          await autoAssignServices(existingProviderId, kun_level);
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/admin/users PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
