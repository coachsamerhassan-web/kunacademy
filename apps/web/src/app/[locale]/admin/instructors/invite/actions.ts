'use server';

import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function inviteCoach(formData: FormData) {
  const email = formData.get('email') as string;
  const nameAr = formData.get('name_ar') as string;
  const nameEn = formData.get('name_en') as string;
  const coachLevel = formData.get('coach_level') as string;

  // 1. Create auth user directly in auth_users table
  // TODO Wave 9: Send invite email via Resend with password reset link
  const tempPassword = crypto.randomUUID();
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  let userId: string;
  try {
    const result = await withAdminContext(async (db) => {
      return db.execute(
        sql`
          INSERT INTO auth_users (id, email, password_hash, email_verified)
          VALUES (gen_random_uuid(), ${email}, ${hashedPassword}, NOW())
          RETURNING id
        `
      );
    });
    const row = result.rows[0] as { id: string } | undefined;
    if (!row?.id) return { success: false as const, error: 'Failed to create auth user' };
    userId = row.id;
  } catch (e: any) {
    return { success: false as const, error: e.message };
  }

  // 2. Create profile
  try {
    await withAdminContext(async (db) => {
      await db.execute(
        sql`
          INSERT INTO profiles (id, email, full_name_ar, full_name_en, role)
          VALUES (${userId}, ${email}, ${nameAr}, ${nameEn}, 'provider')
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name_ar = EXCLUDED.full_name_ar,
            full_name_en = EXCLUDED.full_name_en,
            role = EXCLUDED.role
        `
      );
    });
  } catch (e: any) {
    return { success: false as const, error: e.message };
  }

  // 3. Create instructor record
  const slug = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  try {
    await withAdminContext(async (db) => {
      await db.execute(
        sql`
          INSERT INTO instructors (profile_id, slug, title_ar, title_en, coach_level, is_visible)
          VALUES (${userId}, ${slug}, ${nameAr}, ${nameEn}, ${coachLevel}, false)
        `
      );
    });
  } catch (e: any) {
    return { success: false as const, error: e.message };
  }

  // 4. Create provider record
  await withAdminContext(async (db) => {
    await db.execute(
      sql`INSERT INTO providers (profile_id, is_visible) VALUES (${userId}, false)`
    );
  });

  return { success: true as const, userId };
}
