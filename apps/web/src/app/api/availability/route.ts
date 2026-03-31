import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/availability?coach_id=xxx&start=2026-03-25&end=2026-04-22&duration=60
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const coachId = searchParams.get('coach_id');
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');
  const durationMinutes = parseInt(searchParams.get('duration') || '60');

  if (!coachId || !startDate || !endDate) {
    return NextResponse.json({ error: 'coach_id, start, and end are required' }, { status: 400 });
  }

  // 1. Get weekly schedule (include buffer_minutes)
  const { data: schedules } = await supabase
    .from('coach_schedules')
    .select('day_of_week, start_time, end_time, timezone, buffer_minutes')
    .eq('coach_id', coachId)
    .eq('is_active', true);

  if (!schedules || schedules.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  // 2. Determine buffer: use first schedule's buffer_minutes, default 15
  const bufferMinutes = (schedules[0] as any)?.buffer_minutes ?? 15;

  // 3. Get existing bookings in date range — exclude held slots that are still held
  //    A slot is "blocked" if:
  //      status in ('pending', 'confirmed'), OR
  //      status = 'held' AND held_until > now()
  const now = new Date().toISOString();
  const { data: bookings } = await supabase
    .from('bookings')
    .select('start_time, end_time, status, held_until')
    .eq('provider_id', coachId)
    .gte('start_time', startDate)
    .lte('start_time', endDate + 'T23:59:59');

  const activeBookings = (bookings || []).filter(b => {
    if (b.status === 'pending' || b.status === 'confirmed') return true;
    if (b.status === 'held' && b.held_until && b.held_until > now) return true;
    return false;
  });

  // 4. Get time-off days (range-aware)
  const { data: timeOffs } = await supabase
    .from('coach_time_off')
    .select('start_date, end_date')
    .eq('coach_id', coachId)
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  // Build a set of blocked dates from time-off ranges
  const timeOffDates = new Set<string>();
  for (const t of timeOffs || []) {
    const rangeStart = new Date(t.start_date);
    const rangeEnd = new Date(t.end_date);
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      timeOffDates.add(d.toISOString().split('T')[0]);
    }
  }

  const bookedSlots = activeBookings.map(b => ({
    date: b.start_time.split('T')[0],
    start: b.start_time.split('T')[1]?.slice(0, 5) || b.start_time,
    end: b.end_time.split('T')[1]?.slice(0, 5) || b.end_time,
  }));

  // 5. Generate available slots with buffer
  const slots: Array<{ date: string; start_time: string; end_time: string }> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const tz = (schedules[0] as any)?.timezone || 'Asia/Dubai';

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();

    // Skip time-off days
    if (timeOffDates.has(dateStr)) continue;

    // Find schedule blocks for this day
    const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeek);

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
          b =>
            b.date === dateStr &&
            b.start < slotEndTime &&
            b.end > slotStartTime
        );

        if (!isBooked) {
          slots.push({ date: dateStr, start_time: slotStartTime, end_time: slotEndTime });
        }

        // Advance by duration + buffer
        slotStart = slotEnd + bufferMinutes;
      }
    }
  }

  return NextResponse.json({ slots, timezone: tz, buffer_minutes: bufferMinutes });
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
