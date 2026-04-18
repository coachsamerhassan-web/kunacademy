import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@kunacademy/db';
import { eq, and, gte, lte } from 'drizzle-orm';
import { providers, coach_schedules, bookings, coach_time_off } from '@kunacademy/db/schema';
import { format, parseISO } from 'date-fns-tz';

// Build IANA timezone allowlist at module load (cached)
const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

function sanitizeUserTz(raw: string | null | undefined): string {
  if (!raw || !VALID_TIMEZONES.has(raw)) {
    if (raw) console.warn('[availability] Invalid user_tz received:', raw);
    return 'Asia/Dubai';
  }
  return raw;
}

// GET /api/availability?coach_id=xxx&start=2026-03-25&end=2026-04-22&duration=60&user_tz=America/New_York
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const coachId = searchParams.get('coach_id');
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');
  const durationMinutes = parseInt(searchParams.get('duration') || '60');
  const userTz = sanitizeUserTz(searchParams.get('user_tz'));

  if (!coachId || !startDate || !endDate) {
    return NextResponse.json({ error: 'coach_id, start, and end are required' }, { status: 400 });
  }

  // Resolve provider_id → profile_id for coach_schedules / coach_time_off lookup
  const providerRows = await db
    .select({ profile_id: providers.profile_id })
    .from(providers)
    .where(eq(providers.id, coachId))
    .limit(1);

  const provider = providerRows[0] ?? null;

  if (!provider?.profile_id) {
    return NextResponse.json({ slots: [] });
  }

  const profileId = provider.profile_id;

  // 1. Get weekly schedule (include buffer_minutes)
  const schedules = await db
    .select({
      day_of_week: coach_schedules.day_of_week,
      start_time: coach_schedules.start_time,
      end_time: coach_schedules.end_time,
      timezone: coach_schedules.timezone,
      buffer_minutes: coach_schedules.buffer_minutes,
    })
    .from(coach_schedules)
    .where(and(eq(coach_schedules.coach_id, profileId), eq(coach_schedules.is_active, true)));

  if (!schedules.length) {
    return NextResponse.json({ slots: [] });
  }

  // 2. Determine buffer: use first schedule's buffer_minutes, default 15
  const bufferMinutes = schedules[0]?.buffer_minutes ?? 15;

  // 3. Get existing bookings in date range
  const now = new Date().toISOString();
  const bookingRows = await db
    .select({
      start_time: bookings.start_time,
      end_time: bookings.end_time,
      status: bookings.status,
      held_until: bookings.held_until,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.provider_id, coachId),
        gte(bookings.start_time, new Date(startDate).toISOString()),
        lte(bookings.start_time, new Date(endDate + 'T23:59:59').toISOString())
      )
    );

  const activeBookings = bookingRows.filter((b) => {
    if (b.status === 'pending' || b.status === 'confirmed') return true;
    if (b.status === 'held' && b.held_until && b.held_until > now) return true;
    return false;
  });

  // 4. Get time-off days (range-aware)
  const timeOffRows = await db
    .select({ start_date: coach_time_off.start_date, end_date: coach_time_off.end_date })
    .from(coach_time_off)
    .where(
      and(
        eq(coach_time_off.coach_id, profileId),
        lte(coach_time_off.start_date, endDate),
        gte(coach_time_off.end_date, startDate)
      )
    );

  // Build a set of blocked dates from time-off ranges
  const timeOffDates = new Set<string>();
  for (const t of timeOffRows) {
    const rangeStart = new Date(t.start_date);
    const rangeEnd = new Date(t.end_date);
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      timeOffDates.add(d.toISOString().split('T')[0]);
    }
  }

  const bookedSlots = activeBookings.map((b) => {
    const startStr = b.start_time;
    const endStr = b.end_time;
    return {
      date: startStr.split('T')[0],
      start: startStr.split('T')[1]?.slice(0, 5) || startStr,
      end: endStr.split('T')[1]?.slice(0, 5) || endStr,
    };
  });

  // 5. Generate available slots with buffer, returning both UTC and local times
  const coachTz = schedules[0]?.timezone || 'Asia/Dubai';

  interface SlotWithTimes {
    date: string;
    start_time: string;
    end_time: string;
    start_utc: string;
    end_utc: string;
    start_local_coach: string;
    end_local_coach: string;
    start_local_user: string;
    end_local_user: string;
  }

  const slots: SlotWithTimes[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();

    // Skip time-off days
    if (timeOffDates.has(dateStr)) continue;

    // Find schedule blocks for this day
    const daySchedules = schedules.filter((s) => s.day_of_week === dayOfWeek);

    for (const sched of daySchedules) {
      const [startH, startM] = sched.start_time.split(':').map(Number);
      const [endH, endM] = sched.end_time.split(':').map(Number);
      const blockStartMinutes = startH * 60 + startM;
      const blockEndMinutes = endH * 60 + endM;

      // Generate slots with buffer: after each slot, advance by duration + buffer
      let slotStart = blockStartMinutes;
      while (slotStart + durationMinutes <= blockEndMinutes) {
        const slotEnd = slotStart + durationMinutes;

        const slotStartTime = minutesToTime(slotStart);
        const slotEndTime = minutesToTime(slotEnd);

        // Check if slot overlaps any booked block
        const isBooked = bookedSlots.some(
          (b) =>
            b.date === dateStr &&
            b.start < slotEndTime &&
            b.end > slotStartTime
        );

        if (!isBooked) {
          try {
            // Convert coach local time (dateStr + slotStartTime) in coach TZ to UTC ISO string
            const localDateTimeStr = `${dateStr}T${slotStartTime}:00`;
            const utcStartISO = toUTC(localDateTimeStr, coachTz);
            const utcEndISO = toUTC(`${dateStr}T${slotEndTime}:00`, coachTz);

            // Format UTC instants back to local times for display
            const userLocalStart = format(parseISO(utcStartISO), 'HH:mm', { timeZone: userTz });
            const userLocalEnd = format(parseISO(utcEndISO), 'HH:mm', { timeZone: userTz });
            const coachLocalStart = format(parseISO(utcStartISO), 'HH:mm', { timeZone: coachTz });
            const coachLocalEnd = format(parseISO(utcEndISO), 'HH:mm', { timeZone: coachTz });

            slots.push({
              date: dateStr,
              start_time: slotStartTime,
              end_time: slotEndTime,
              start_utc: utcStartISO,
              end_utc: utcEndISO,
              start_local_coach: coachLocalStart,
              end_local_coach: coachLocalEnd,
              start_local_user: userLocalStart,
              end_local_user: userLocalEnd,
            });
          } catch (error) {
            console.warn('[availability] Failed to convert slot times for', { dateStr, slotStartTime, coachTz }, error);
            // Fallback: emit slot in coach TZ ISO format, skip user TZ conversion
            const fallbackStart = `${dateStr}T${slotStartTime}:00Z`;
            const fallbackEnd = `${dateStr}T${slotEndTime}:00Z`;
            slots.push({
              date: dateStr,
              start_time: slotStartTime,
              end_time: slotEndTime,
              start_utc: fallbackStart,
              end_utc: fallbackEnd,
              start_local_coach: slotStartTime,
              end_local_coach: slotEndTime,
              start_local_user: slotStartTime,
              end_local_user: slotEndTime,
            });
          }
        }

        // Advance by duration + buffer
        slotStart = slotEnd + bufferMinutes;
      }
    }
  }

  return NextResponse.json({
    slots,
    timezone: coachTz,
    user_timezone: userTz,
    buffer_minutes: bufferMinutes,
  });
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Convert a local time string (YYYY-MM-DDTHH:mm:ss) in coach's TZ to UTC ISO string
 * date-fns-tz doesn't have a direct "local to UTC" function, so we:
 * 1. Create a naive Date from the local string
 * 2. Parse it as if it's in the coach's TZ using utcToZonedTime logic in reverse
 * 3. Calculate offset and convert to UTC
 */
function toUTC(localDateTimeStr: string, tz: string): string {
  // e.g. "2026-04-01T09:00:00" in "Asia/Dubai"
  // We need to find what UTC time corresponds to this local time in Dubai
  const localDate = parseISO(localDateTimeStr);

  // Use format to get what the UTC time would be if interpreted as the target TZ
  // Then reverse-calculate: if this UTC gives us localDateTimeStr when formatted in tz, it's correct
  // Simpler: create a Date in UTC, find its offset in the tz, adjust backwards

  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: tz,
  });

  // Binary search or iterative approach: find the UTC time that formats to localDateTimeStr in tz
  let utcTime = localDate;
  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    const parts = formatter.formatToParts(utcTime);
    const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const formatted =
      `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}`;

    if (formatted === localDateTimeStr) {
      return utcTime.toISOString();
    }

    // Adjust: if formatted is before target, move utcTime forward; else backward
    const diff = new Date(formatted).getTime() - new Date(localDateTimeStr).getTime();
    utcTime = new Date(utcTime.getTime() - diff);
    attempt++;
  }

  // Fallback: return original ISO (should not reach here in normal cases)
  return utcTime.toISOString();
}
