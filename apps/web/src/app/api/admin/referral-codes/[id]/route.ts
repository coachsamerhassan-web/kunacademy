import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { referral_codes, profiles } from '@kunacademy/db/schema';

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active (boolean) required' }, { status: 400 });
  }

  await db
    .update(referral_codes)
    .set({ is_active: body.is_active })
    .where(eq(referral_codes.id, id));

  return NextResponse.json({ ok: true });
}
