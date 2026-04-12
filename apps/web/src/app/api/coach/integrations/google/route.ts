import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthUser } from '@kunacademy/auth/server';

/**
 * GET /api/coach/integrations/google
 *
 * Returns a Google OAuth authorization URL for the calendar.events scope.
 * The coach is redirected to this URL to grant access.
 *
 * Response: { url: string }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only coaches (provider role) may connect a calendar
    if (user.role !== 'provider' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const redirectUri = `${process.env.NEXTAUTH_URL}/api/coach/integrations/google/callback`;

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    );

    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',                          // force consent so refresh_token is always returned
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      state: user.id,                             // CSRF protection — verified on callback
    });

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error('[api/coach/integrations/google GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
