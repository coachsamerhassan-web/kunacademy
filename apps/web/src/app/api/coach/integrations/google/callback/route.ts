import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { withAdminContext } from '@kunacademy/db';
import { coach_integrations } from '@kunacademy/db/schema';
import { and, eq } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';

/**
 * GET /api/coach/integrations/google/callback
 *
 * Google redirects here after the coach grants calendar access.
 * We exchange the code for tokens and upsert into coach_integrations.
 *
 * Query params: code, state (= user.id for CSRF)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');         // user.id passed in OAuth initiation
  const error = searchParams.get('error');

  const redirectBase = process.env.NEXTAUTH_URL || '';

  // User denied access
  if (error) {
    console.warn('[google-callback] OAuth error from Google:', error);
    return NextResponse.redirect(`${redirectBase}/en/coach/settings?error=google_calendar_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}/en/coach/settings?error=google_calendar_invalid`);
  }

  // CSRF check — verify state matches the authenticated user
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.redirect(`${redirectBase}/en/auth/signin`);
  }

  if (user.id !== state) {
    console.error('[google-callback] CSRF state mismatch. Expected', user.id, 'got', state);
    return NextResponse.redirect(`${redirectBase}/en/coach/settings?error=google_calendar_csrf`);
  }

  const redirectUri = `${redirectBase}/api/coach/integrations/google/callback`;

  try {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    );

    const { tokens } = await oauth2.getToken(code);

    const accessToken = tokens.access_token ?? null;
    const refreshToken = tokens.refresh_token ?? null;
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null;

    if (!accessToken) {
      console.error('[google-callback] No access_token returned from Google');
      return NextResponse.redirect(`${redirectBase}/en/coach/settings?error=google_calendar_no_token`);
    }

    // Upsert the integration record
    await withAdminContext(async (db) => {
      // Check for existing record
      const [existing] = await db.select({ id: coach_integrations.id })
        .from(coach_integrations)
        .where(
          and(
            eq(coach_integrations.coach_id, user.id),
            eq(coach_integrations.provider, 'google_calendar'),
          )
        )
        .limit(1);

      if (existing) {
        await db.update(coach_integrations)
          .set({
            access_token: accessToken,
            refresh_token: refreshToken ?? undefined,
            token_expires_at: expiresAt,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .where(eq(coach_integrations.id, existing.id));
      } else {
        await db.insert(coach_integrations).values({
          coach_id: user.id,
          provider: 'google_calendar',
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          calendar_id: 'primary',
          is_active: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    });

    console.log('[google-callback] Calendar integration saved for coach', user.id);
    return NextResponse.redirect(`${redirectBase}/en/coach/settings?connected=google_calendar`);
  } catch (err: any) {
    console.error('[google-callback] Token exchange failed:', err);
    return NextResponse.redirect(`${redirectBase}/en/coach/settings?error=google_calendar_exchange_failed`);
  }
}
