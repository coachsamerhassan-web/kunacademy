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

  // 1. Get weekly schedule
  const { data: schedules } = await supabase
    .from('coach_schedules')
    .select('day_of_week, start_time, end_time, timezone')
    .eq('coach_id', coachId)
    .eq('is_active', true);

  if (!schedules || schedules.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  // 2. Get existing bookings in date range
  const { data: bookings } = await supabase
    .from('bookings')
    .select('booking_date, start_time, end_time')
    .eq('provider_id', coachId)
    .gte('booking_date', startDate)
    .lte('booking_date', endDate)
    .in('status', ['pending', 'confirmed']);

  // 3. Get time-off days
  const { data: timeOffs } = await supabase
    .from('coach_time_off')
    .select('date')
    .eq('coach_id', coachId)
    .gte('date', startDate)
    .lte('date', endDate);

  const timeOffDates = new Set((timeOffs || []).map(t => t.date));
  const bookedSlots = (bookings || []).map(b => ({
    date: b.booking_date,
    start: b.start_time,
    end: b.end_time,
  }));

  // 4. Generate available slots
  const slots: Array<{ date: string; start_time: string; end_time: string }> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const tz = schedules[0]?.timezone || 'Asia/Dubai';

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();

    // Skip time-off days
    if (timeOffDates.has(dateStr)) continue;

    // Find schedule blocks for this day
    const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeek);

    for (const sched of daySchedules) {
      // Generate slots within the schedule block
      const [startH, startM] = sched.start_time.split(':').map(Number);
      const [endH, endM] = sched.end_time.split(':').map(Number);
      const blockStartMinutes = startH * 60 + startM;
      const blockEndMinutes = endH * 60 + endM;

      for (let slotStart = blockStartMinutes; slotStart + durationMinutes <= blockEndMinutes; slotStart += durationMinutes) {
        const slotStartTime = `${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')}`;
        const slotEndTime = `${String(Math.floor((slotStart + durationMinutes) / 60)).padStart(2, '0')}:${String((slotStart + durationMinutes) % 60).padStart(2, '0')}`;

        // Check if slot is already booked
        const isBooked = bookedSlots.some(b =>
          b.date === dateStr &&
          b.start < slotEndTime &&
          b.end > slotStartTime
        );

        if (!isBooked) {
          slots.push({ date: dateStr, start_time: slotStartTime, end_time: slotEndTime });
        }
      }
    }
  }

  return NextResponse.json({ slots, timezone: tz });
}
