import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';

/** POST /api/user/profile/preferred-language — update user's preferred notification language */
export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { language } = body;

    // Validate language is ar or en
    if (!language || !['ar', 'en'].includes(language)) {
      return NextResponse.json(
        { error: 'Invalid language. Must be "ar" or "en".' },
        { status: 400 }
      );
    }

    // Update the profile
    await db
      .update(profiles)
      .set({ preferred_language: language })
      .where(eq(profiles.id, user.id));

    return NextResponse.json({ preferred_language: language });
  } catch (err: any) {
    console.error('[api/user/profile/preferred-language POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
