import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, sql } from 'drizzle-orm';
import { profiles, providers, instructors } from '@kunacademy/db/schema';
import { autoAssignServices } from '@/lib/auto-assign-services';
import { enqueueEmail } from '@/lib/email-outbox';
import { createActivationToken } from '@/lib/activation-token';

// ---------------------------------------------------------------------------
// Role whitelist — must stay in sync with migration 0033 CHECK constraint.
// 'super_admin' is intentionally excluded from admin-UI assignment; only a
// DBA via BYPASSRLS can grant it.
// ---------------------------------------------------------------------------
const ASSIGNABLE_ROLES = [
  'student', 'provider', 'admin',
  'mentor',  'apprentice', 'assessor',
] as const;
type AssignableRole = typeof ASSIGNABLE_ROLES[number];

function isAssignableRole(r: unknown): r is AssignableRole {
  return typeof r === 'string' && (ASSIGNABLE_ROLES as readonly string[]).includes(r);
}

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
        p.phone,
        p.role,
        p.status,
        p.preferred_language,
        p.created_at,
        CASE WHEN pv.id IS NOT NULL THEN true ELSE false END AS has_provider,
        CASE WHEN ins.id IS NOT NULL THEN true ELSE false END AS has_instructor,
        ins.id AS instructor_id,
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
      full_name_ar,
      full_name_en,
      phone,
      status,
      reason,
    } = body as {
      user_id?: string;
      role?: string;
      kun_level?: string;
      icf_credential?: string;
      service_roles?: string[];
      is_visible?: boolean;
      is_bookable?: boolean;
      full_name_ar?: string;
      full_name_en?: string;
      phone?: string;
      status?: string;
      reason?: string;
    };

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // Validate assignable role (rejects 'super_admin' and any unknown string)
    if (role !== undefined && !isAssignableRole(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    if (status !== undefined && !['active', 'invited', 'deactivated'].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'active' | 'invited' | 'deactivated'" },
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
      // 0. Profile field updates (name, phone, status) — orthogonal to role change.
      // COALESCE keeps existing values for fields the admin didn't touch.
      if (
        full_name_ar !== undefined ||
        full_name_en !== undefined ||
        phone !== undefined ||
        status !== undefined
      ) {
        await adminDb.execute(sql`
          UPDATE profiles SET
            full_name_ar = COALESCE(${full_name_ar ?? null}, full_name_ar),
            full_name_en = COALESCE(${full_name_en ?? null}, full_name_en),
            phone        = COALESCE(${phone ?? null}, phone),
            status       = COALESCE(${status ?? null}, status)
          WHERE id = ${user_id}
        `);
      }

      // 1. Update role if changed + audit log the transition
      if (role && role !== currentRole) {
        await adminDb.execute(
          sql`UPDATE profiles SET role = ${role} WHERE id = ${user_id}`
        );
        await adminDb.execute(sql`
          INSERT INTO profile_role_changes (user_id, old_role, new_role, changed_by, reason)
          VALUES (${user_id}, ${currentRole}, ${role}, ${admin.id}, ${reason ?? null})
        `);
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

// ---------------------------------------------------------------------------
// POST /api/admin/users — Create a new user in any assignable role.
//
// Body: {
//   email:        string;            // required, lowercased + unique
//   full_name_ar?: string;
//   full_name_en?: string;
//   phone?:       string;
//   role:         AssignableRole;    // required, validated
//   preferred_language?: 'ar' | 'en'; // defaults to 'ar'
//   send_activation?: boolean;       // defaults to true
// }
//
// Side effects:
//   - Creates auth_users row with a random unguessable placeholder password
//     (the activation link lets the user pick their real password).
//   - Creates profiles row with status='invited' (or 'active' if
//     send_activation=false) and the requested role.
//   - Writes profile_role_changes row with old_role=null, new_role=role.
//   - If role === 'provider', ensures providers + instructors side-tables exist
//     (reuses the PATCH upgrade path semantics).
//   - If send_activation, enqueues a 'user-activation' email.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      email,
      full_name_ar,
      full_name_en,
      phone,
      role,
      preferred_language,
      send_activation = true,
    } = body as {
      email?:              string;
      full_name_ar?:       string;
      full_name_en?:       string;
      phone?:              string;
      role?:               string;
      preferred_language?: 'ar' | 'en';
      send_activation?:    boolean;
    };

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 });
    }
    if (!isAssignableRole(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    const locale = preferred_language === 'en' ? 'en' : 'ar';

    // Placeholder bcrypt hash of a cryptographically random string — ensures the
    // auth_users row has a non-null password_hash (the confirm endpoint reuses
    // UPDATE semantics on this column) while keeping the account inaccessible
    // until activation sets the real password.
    const { randomBytes } = await import('crypto');
    const placeholderHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    const result = await withAdminContext(async (adminDb) => {
      // Guard against duplicate email (in both tables — normally kept in sync).
      const existing = await adminDb.execute(
        sql`SELECT id FROM auth_users WHERE email = ${normalizedEmail} LIMIT 1`
      );
      if (existing.rows.length > 0) {
        return { duplicate: true as const };
      }

      // 1. auth_users
      const authRow = await adminDb.execute(sql`
        INSERT INTO auth_users (email, password_hash)
        VALUES (${normalizedEmail}, ${placeholderHash})
        RETURNING id
      `);
      const newUserId = (authRow.rows[0] as { id: string }).id;

      // 2. profiles
      const initialStatus = send_activation ? 'invited' : 'active';
      await adminDb.execute(sql`
        INSERT INTO profiles
          (id, email, full_name_ar, full_name_en, phone, role, status, preferred_language)
        VALUES
          (${newUserId}, ${normalizedEmail}, ${full_name_ar ?? null},
           ${full_name_en ?? null}, ${phone ?? null}, ${role}, ${initialStatus}, ${locale})
      `);

      // 3. Role-change audit (old=null → new=role, by admin)
      await adminDb.execute(sql`
        INSERT INTO profile_role_changes (user_id, old_role, new_role, changed_by, reason)
        VALUES (${newUserId}, NULL, ${role}, ${admin.id}, ${'admin-create'})
      `);

      // 4. Provider side-tables if role is provider
      if (role === 'provider') {
        const insP = await adminDb.execute(sql`
          INSERT INTO providers (profile_id, is_visible) VALUES (${newUserId}, false) RETURNING id
        `);
        void insP;
        await adminDb.execute(sql`
          INSERT INTO instructors
            (profile_id, slug, title_en, title_ar, is_bookable, is_visible)
          VALUES
            (${newUserId}, ${newUserId}, ${'New Coach'}, ${'كوتش جديد'}, false, false)
        `);
      }

      return { duplicate: false as const, user_id: newUserId };
    });

    if (result.duplicate) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // 5. Activation email — best-effort, non-blocking for the 201 response.
    let activation_sent = false;
    let activation_url: string | null = null;
    if (send_activation) {
      const secret = process.env.NEXTAUTH_SECRET;
      if (secret) {
        const token = createActivationToken(normalizedEmail, secret);
        const origin = process.env.NEXTAUTH_URL || 'https://kuncoaching.me';
        activation_url = `${origin}/${locale}/auth/reset-password/confirm?token=${encodeURIComponent(token)}`;
        try {
          await withAdminContext(async (adminDb) => {
            await enqueueEmail(adminDb, {
              template_key: 'user-activation',
              to_email: normalizedEmail,
              payload: {
                email: normalizedEmail,
                name: (locale === 'ar' ? full_name_ar : full_name_en) ?? full_name_en ?? full_name_ar ?? '',
                activation_url,
                role,
                preferred_language: locale,
              },
            });
          });
          activation_sent = true;
        } catch (enqueueErr) {
          console.error('[api/admin/users POST] activation enqueue failed:', enqueueErr);
        }
      } else {
        console.error('[api/admin/users POST] NEXTAUTH_SECRET missing — skipping activation email');
      }
    }

    return NextResponse.json(
      { success: true, user_id: result.user_id, activation_sent, activation_url },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[api/admin/users POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
