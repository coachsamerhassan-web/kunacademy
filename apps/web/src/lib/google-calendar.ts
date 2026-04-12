/**
 * Google Calendar integration — push-only.
 *
 * All exported functions are NON-THROWING. Calendar failures must never
 * block a booking confirmation. Each function catches, logs, and returns
 * null on error.
 */

import { google } from 'googleapis';
import { withAdminContext } from '@kunacademy/db';
import { coach_integrations } from '@kunacademy/db/schema';
import { eq, and } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CalendarEventParams {
  bookingId: string;
  coachId: string;
  clientName: string;
  clientEmail: string;
  serviceName: string;
  durationMinutes: number;
  startTime: string;   // ISO 8601 with timezone
  endTime: string;     // ISO 8601 with timezone
  timezone?: string;
  meetingUrl?: string | null;
  calendarId?: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  integrationId: string;
}

export interface CalendarUpdateParams {
  calendarEventId: string;
  calendarId?: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  integrationId: string;
  // Carry through for description rebuild
  bookingId: string;
  clientName: string;
  clientEmail: string;
  serviceName: string;
  durationMinutes: number;
  meetingUrl?: string | null;
}

export interface CalendarDeleteParams {
  calendarEventId: string;
  calendarId?: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  integrationId: string;
}

// ─── OAuth2 client factory ────────────────────────────────────────────────────

function getOAuth2Client(accessToken: string) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2.setCredentials({ access_token: accessToken });
  return oauth2;
}

// ─── Token refresh ────────────────────────────────────────────────────────────

/**
 * Refresh an access token and persist the new tokens to the DB.
 * Returns the new access_token, or null if refresh fails.
 */
export async function refreshAccessToken(
  integrationId: string,
  refreshToken: string,
): Promise<string | null> {
  try {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await oauth2.refreshAccessToken();
    const newAccessToken = credentials.access_token;
    if (!newAccessToken) return null;

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : null;

    await withAdminContext(async (db) => {
      await db.update(coach_integrations)
        .set({
          access_token: newAccessToken,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .where(eq(coach_integrations.id, integrationId));
    });

    return newAccessToken;
  } catch (err) {
    console.error('[google-calendar] refreshAccessToken failed:', err);
    // Mark integration inactive so the coach knows to reconnect
    try {
      await withAdminContext(async (db) => {
        await db.update(coach_integrations)
          .set({ is_active: false, updated_at: new Date().toISOString() })
          .where(eq(coach_integrations.id, integrationId));
      });
    } catch {
      // best-effort
    }
    return null;
  }
}

// ─── Token expiry check ───────────────────────────────────────────────────────

function isTokenExpired(tokenExpiresAt: string | null | undefined): boolean {
  if (!tokenExpiresAt) return false; // no expiry info — assume valid
  // Add a 60-second buffer so we refresh slightly before actual expiry
  return new Date(tokenExpiresAt).getTime() - 60_000 < Date.now();
}

// ─── Ensure valid access token ────────────────────────────────────────────────

async function resolveAccessToken(params: {
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  integrationId: string;
}): Promise<string | null> {
  if (!isTokenExpired(params.tokenExpiresAt)) {
    return params.accessToken;
  }
  if (!params.refreshToken) return null;
  return refreshAccessToken(params.integrationId, params.refreshToken);
}

// ─── Event description builder ────────────────────────────────────────────────

function buildDescription(params: {
  clientName: string;
  clientEmail: string;
  serviceName: string;
  durationMinutes: number;
  bookingId: string;
  meetingUrl?: string | null;
}): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://kuncoaching.me';
  const bookingUrl = `${base}/en/coach/bookings/${params.bookingId}`;

  return [
    `Client: ${params.clientName} (${params.clientEmail})`,
    `Service: ${params.serviceName} (${params.durationMinutes} min)`,
    `Booking ID: ${params.bookingId}`,
    params.meetingUrl ? `Meeting: ${params.meetingUrl}` : null,
    '',
    `✅ Confirm: ${bookingUrl}?action=confirm`,
    `❌ Cancel: ${bookingUrl}?action=cancel`,
    `🔄 Reschedule: ${bookingUrl}?action=reschedule`,
    '',
    `Manage all bookings: ${base}/en/coach/bookings`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

// ─── Color ID mapping ─────────────────────────────────────────────────────────

function getColorId(serviceName: string): string {
  const lower = serviceName.toLowerCase();
  if (lower.includes('discovery')) return '2'; // sage/green
  if (lower.includes('individual')) return '9'; // blueberry/blue
  return '1'; // lavender (default)
}

// ─── Create event ─────────────────────────────────────────────────────────────

export async function createBookingEvent(
  params: CalendarEventParams,
): Promise<string | null> {
  try {
    const token = await resolveAccessToken(params);
    if (!token) {
      console.error('[google-calendar] createBookingEvent: no valid token for integration', params.integrationId);
      return null;
    }

    const auth = getOAuth2Client(token);
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = params.calendarId || 'primary';
    const tz = params.timezone || 'Asia/Dubai';

    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `Coaching Session: ${params.clientName} — ${params.serviceName}`,
        description: buildDescription(params),
        location: params.meetingUrl || undefined,
        colorId: getColorId(params.serviceName),
        start: {
          dateTime: params.startTime,
          timeZone: tz,
        },
        end: {
          dateTime: params.endTime,
          timeZone: tz,
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'popup', minutes: 10 },
          ],
        },
      },
    });

    const eventId = response.data.id;
    if (!eventId) return null;

    console.log('[google-calendar] event created:', eventId, 'for booking', params.bookingId);
    return eventId;
  } catch (err) {
    console.error('[google-calendar] createBookingEvent failed:', err);
    return null;
  }
}

// ─── Update event ─────────────────────────────────────────────────────────────

export async function updateBookingEvent(
  params: CalendarUpdateParams,
): Promise<boolean> {
  try {
    const token = await resolveAccessToken(params);
    if (!token) {
      console.error('[google-calendar] updateBookingEvent: no valid token for integration', params.integrationId);
      return false;
    }

    const auth = getOAuth2Client(token);
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = params.calendarId || 'primary';
    const tz = params.timezone || 'Asia/Dubai';

    await calendar.events.patch({
      calendarId,
      eventId: params.calendarEventId,
      requestBody: {
        description: buildDescription(params),
        start: {
          dateTime: params.startTime,
          timeZone: tz,
        },
        end: {
          dateTime: params.endTime,
          timeZone: tz,
        },
      },
    });

    console.log('[google-calendar] event updated:', params.calendarEventId);
    return true;
  } catch (err) {
    console.error('[google-calendar] updateBookingEvent failed:', err);
    return false;
  }
}

// ─── Delete event ─────────────────────────────────────────────────────────────

export async function deleteBookingEvent(
  params: CalendarDeleteParams,
): Promise<boolean> {
  try {
    const token = await resolveAccessToken(params);
    if (!token) {
      console.error('[google-calendar] deleteBookingEvent: no valid token for integration', params.integrationId);
      return false;
    }

    const auth = getOAuth2Client(token);
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = params.calendarId || 'primary';

    await calendar.events.delete({
      calendarId,
      eventId: params.calendarEventId,
    });

    console.log('[google-calendar] event deleted:', params.calendarEventId);
    return true;
  } catch (err) {
    console.error('[google-calendar] deleteBookingEvent failed:', err);
    return false;
  }
}

// ─── Fetch active integration for a coach ────────────────────────────────────

export async function getCoachCalendarIntegration(coachId: string) {
  try {
    const [integration] = await withAdminContext(async (db) => {
      return db.select()
        .from(coach_integrations)
        .where(
          and(
            eq(coach_integrations.coach_id, coachId),
            eq(coach_integrations.provider, 'google_calendar'),
            eq(coach_integrations.is_active, true),
          )
        )
        .limit(1);
    });
    return integration ?? null;
  } catch (err) {
    console.error('[google-calendar] getCoachCalendarIntegration failed:', err);
    return null;
  }
}
