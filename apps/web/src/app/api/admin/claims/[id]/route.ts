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
// PATCH /api/admin/claims/[id]
//
// Body: { action: 'approve' | 'reject' }
//
// On approve:
//   - Find or create a profile for the claimer's email
//   - Set community_members.profile_id to claimer's profile
//   - Set community_members.claimed_at = NOW()
//   - Update claim_requests.status = 'approved'
//
// On reject:
//   - Update claim_requests.status = 'rejected'
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // ── Fetch the claim request ──────────────────────────────────────────
    const claimRows = await db.execute(sql`
      SELECT cr.id, cr.member_id, cr.email, cr.status,
             cm.profile_id AS member_profile_id, cm.claimed_at AS member_claimed_at
      FROM claim_requests cr
      JOIN community_members cm ON cm.id = cr.member_id
      WHERE cr.id = ${id}
      LIMIT 1
    `);

    const claim = claimRows.rows[0] as {
      id: string;
      member_id: string;
      email: string;
      status: string;
      member_profile_id: string | null;
      member_claimed_at: string | null;
    } | undefined;

    if (!claim) {
      return NextResponse.json({ error: 'Claim request not found' }, { status: 404 });
    }

    if (claim.status !== 'pending') {
      return NextResponse.json(
        { error: `Claim already ${claim.status}` },
        { status: 409 }
      );
    }

    // ── Reject ───────────────────────────────────────────────────────────
    if (action === 'reject') {
      await withAdminContext(async (adminDb: any) =>
        adminDb.execute(sql`
          UPDATE claim_requests
          SET status = 'rejected',
              reviewed_by = ${user.id},
              reviewed_at = NOW()
          WHERE id = ${id}
        `)
      );

      return NextResponse.json({
        success: true,
        status: 'rejected',
        message: 'Claim request rejected.',
      });
    }

    // ── Approve ──────────────────────────────────────────────────────────

    // Check if member is already claimed (race condition guard)
    if (claim.member_profile_id || claim.member_claimed_at) {
      // Auto-reject this claim since member was claimed by someone else
      await withAdminContext(async (adminDb: any) =>
        adminDb.execute(sql`
          UPDATE claim_requests
          SET status = 'rejected',
              reviewed_by = ${user.id},
              reviewed_at = NOW()
          WHERE id = ${id}
        `)
      );
      return NextResponse.json(
        { error: 'Profile was already claimed by another user' },
        { status: 409 }
      );
    }

    // Find or note the claimer's profile
    const profileRows = await db.execute(sql`
      SELECT id FROM profiles
      WHERE LOWER(email) = ${claim.email.toLowerCase().trim()}
      LIMIT 1
    `);
    const profileId = (profileRows.rows[0] as any)?.id ?? null;

    // Update community_members: link profile + mark claimed
    await withAdminContext(async (adminDb: any) => {
      // Set claimed_at and optionally link profile_id
      if (profileId) {
        await adminDb.execute(sql`
          UPDATE community_members
          SET claimed_at = NOW(),
              profile_id = ${profileId},
              updated_at = NOW()
          WHERE id = ${claim.member_id}
        `);
      } else {
        await adminDb.execute(sql`
          UPDATE community_members
          SET claimed_at = NOW(),
              updated_at = NOW()
          WHERE id = ${claim.member_id}
        `);
      }

      // Update claim request status
      await adminDb.execute(sql`
        UPDATE claim_requests
        SET status = 'approved',
            reviewed_by = ${user.id},
            reviewed_at = NOW()
        WHERE id = ${id}
      `);

      // Also reject any other pending claims for the same member
      await adminDb.execute(sql`
        UPDATE claim_requests
        SET status = 'rejected',
            reviewed_by = ${user.id},
            reviewed_at = NOW()
        WHERE member_id = ${claim.member_id}
          AND id != ${id}
          AND status = 'pending'
      `);
    });

    return NextResponse.json({
      success: true,
      status: 'approved',
      profile_linked: !!profileId,
      message: profileId
        ? 'Claim approved. Profile linked to existing account.'
        : 'Claim approved. Profile marked as claimed (no matching account found).',
    });
  } catch (err: any) {
    console.error('[api/admin/claims/[id] PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
