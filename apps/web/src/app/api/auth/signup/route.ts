import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { email, password, locale = 'ar' } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await withAdminContext(async (adminDb) => {
      // Check if user already exists
      const { rows: existing } = await adminDb.execute(
        sql`SELECT id FROM auth_users WHERE email = ${email}`
      );

      if (existing.length > 0) {
        throw new Error('already registered');
      }

      // Create auth user
      const { rows } = await adminDb.execute(
        sql`INSERT INTO auth_users (email, password_hash) VALUES (${email}, ${passwordHash}) RETURNING id`
      );
      const newUser = rows[0] as { id: string };

      // Create profile — locale stored for future personalisation
      await adminDb.execute(
        sql`INSERT INTO profiles (id, email, role) VALUES (${newUser.id}, ${email}, 'student')`
      );
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.message?.includes('already registered') || err?.message?.includes('duplicate key')) {
      return NextResponse.json({ error: 'This email is already registered' }, { status: 409 });
    }
    console.error('[signup] Error:', err);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
