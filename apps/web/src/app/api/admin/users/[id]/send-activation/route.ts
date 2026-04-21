/**
 * POST /api/admin/users/[id]/send-activation
 *
 * Admin-gated endpoint to regenerate and email a fresh activation link for
 * an existing user. Mirrors the reset-password enqueue pattern but uses the
 * longer-lived (7-day) activation token and the 'user-activation' template.
 *
 * Body: { preferred_language?: 'ar' | 'en' }  (defaults to the user's stored
 *        preferred_language, falling back to 'ar')
 *
 * Returns: { success: true, activation_sent: boolean, activation_url?: string }
 * The activation_url is included for admin visibility (useful when the email
 * channel is misconfigured). It's the same URL the user receives via email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, sql } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';
import { enqueueEmail } from '@/lib/email-outbox';
import { createActivationToken } from '@/lib/activation-token';

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: user_id } = await context.params;
    if (!user_id) {
      return NextResponse.json({ error: 'user_id missing' }, { status: 400 });
    }

    let body: { preferred_language?: 'ar' | 'en' } = {};
    try { body = await request.json(); } catch { /* empty body is fine */ }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    // Fetch the target profile
    const rows = await db
      .select({
        id:    profiles.id,
        email: profiles.email,
        role:  profiles.role,
        name_ar: profiles.full_name_ar,
        name_en: profiles.full_name_en,
        pref:  profiles.preferred_language,
      })
      .from(profiles)
      .where(eq(profiles.id, user_id))
      .limit(1);

    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const locale: 'ar' | 'en' =
      body.preferred_language ?? (user.pref === 'en' ? 'en' : 'ar');

    const token = createActivationToken(user.email, secret);
    const origin = process.env.NEXTAUTH_URL || 'https://kuncoaching.me';
    const activation_url = `${origin}/${locale}/auth/reset-password/confirm?token=${encodeURIComponent(token)}`;

    // Flip status → invited if currently deactivated or active, so the list UI
    // reflects the pending state. Don't clobber a manually-set 'active' for an
    // already-activated account — but admins explicitly re-sending a link are
    // signaling "re-invite", so 'invited' is the correct snapshot.
    await withAdminContext(async (adminDb) => {
      await adminDb.execute(
        sql`UPDATE profiles SET status = 'invited' WHERE id = ${user_id}`
      );
      await enqueueEmail(adminDb, {
        template_key: 'user-activation',
        to_email: user.email,
        payload: {
          email: user.email,
          name:  (locale === 'ar' ? user.name_ar : user.name_en) ?? user.name_en ?? user.name_ar ?? '',
          activation_url,
          role:  user.role ?? 'student',
          preferred_language: locale,
        },
      });
    });

    return NextResponse.json({ success: true, activation_sent: true, activation_url });
  } catch (err: any) {
    console.error('[api/admin/users/[id]/send-activation POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
