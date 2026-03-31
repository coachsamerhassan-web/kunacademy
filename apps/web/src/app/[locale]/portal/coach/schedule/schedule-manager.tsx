'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { createBrowserClient } from '@kunacademy/db';

/* ─── Constants ───────────────────────────────────────────────────── */

const DAYS = [
  { value: 0, labelAr: 'الأحد', labelEn: 'Sun' },
  { value: 1, labelAr: 'الإثنين', labelEn: 'Mon' },
  { value: 2, labelAr: 'الثلاثاء', labelEn: 'Tue' },
  { value: 3, labelAr: 'الأربعاء', labelEn: 'Wed' },
  { value: 4, labelAr: 'الخميس', labelEn: 'Thu' },
  { value: 5, labelAr: 'الجمعة', labelEn: 'Fri' },
  { value: 6, labelAr: 'السبت', labelEn: 'Sat' },
];

const HOUR_START = 6;   // 06:00
const HOUR_END = 22;    // 22:00
const SLOT_MINUTES = 30;
const TOTAL_SLOTS = ((HOUR_END - HOUR_START) * 60) / SLOT_MINUTES; // 32 slots

/** Convert slot index → "HH:MM" */
function slotToTime(slot: number): string {
  const totalMin = HOUR_START * 60 + slot * SLOT_MINUTES;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Convert "HH:MM" → slot index (or -1 if out of range) */
function timeToSlot(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const totalMin = h * 60 + m;
  const slot = (totalMin - HOUR_START * 60) / SLOT_MINUTES;
  return slot >= 0 && slot < TOTAL_SLOTS ? slot : -1;
}

/** Key for the availability grid: `day-slot` → boolean */
type GridKey = string;
function gridKey(day: number, slot: number): GridKey { return `${day}-${slot}`; }

/* ─── Types ───────────────────────────────────────────────────────── */

interface TimeOffEntry {
  id?: string;
  start_date: string;
  end_date: string;
  reason: string;
}

interface BookedCell {
  day: number;   // 0-6 (day of week, recurring)
  slot: number;  // slot index
}

/* ─── Month calendar helpers ──────────────────────────────────────── */

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/* ─── Main Component ──────────────────────────────────────────────── */

export function ScheduleManager({ locale }: { locale: string }) {
  const { user, loading: authLoading } = useAuth();
  const isAr = locale === 'ar';

  /* ── State ── */
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'schedule' | 'timeoff'>('schedule');

  // Week calendar: Set of "day-slot" keys that are available
  const [availGrid, setAvailGrid] = useState<Set<GridKey>>(new Set());
  // Booked cells (from bookings table, next 4 weeks)
  const [bookedCells, setBookedCells] = useState<BookedCell[]>([]);
  // Buffer toggle
  const [bufferEnabled, setBufferEnabled] = useState(false);

  // Mobile: active day tab (0-6)
  const [mobileDay, setMobileDay] = useState<number>(new Date().getDay());

  // Drag painting
  const isDragging = useRef(false);
  const dragValue = useRef<boolean>(true); // true = painting, false = erasing
  const dragStart = useRef<GridKey | null>(null);

  // Time-off
  const [timeOffs, setTimeOffs] = useState<TimeOffEntry[]>([]);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [popoverDay, setPopoverDay] = useState<string | null>(null);
  const [popoverReason, setPopoverReason] = useState('');
  const [savingTimeOff, setSavingTimeOff] = useState(false);

  /* ── Load data ── */
  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    if (!supabase) return;

    supabase
      .from('instructors')
      .select('id')
      .eq('profile_id', user.id)
      .single()
      .then(({ data: inst }) => {
        if (!inst) { setLoading(false); return; }
        setInstructorId(inst.id);

        const now = new Date();
        const fourWeeks = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
        const startStr = now.toISOString().split('T')[0];
        const endStr = fourWeeks.toISOString().split('T')[0];

        Promise.all([
          supabase
            .from('coach_schedules')
            .select('day_of_week, start_time, end_time')
            .eq('coach_id', inst.id)
            .eq('is_active', true) as unknown as Promise<{ data: Array<{ day_of_week: number; start_time: string; end_time: string; buffer_minutes?: number }> | null; error: unknown }>,
          supabase
            .from('bookings')
            .select('start_time, end_time')
            .eq('provider_id', inst.id)
            .gte('start_time', startStr)
            .lte('start_time', endStr + 'T23:59:59')
            .in('status', ['pending', 'confirmed']),
          supabase
            .from('coach_time_off')
            .select('*')
            .eq('coach_id', inst.id)
            .order('start_date'),
        ]).then(([schedRes, bookRes, offRes]) => {
          // Rebuild grid from schedules
          const grid = new Set<GridKey>();
          let hasBuffer = false;

          for (const s of schedRes.data || []) {
            if ((s as any).buffer_minutes > 0) hasBuffer = true;
            const startSlot = timeToSlot(s.start_time);
            const endSlot = timeToSlot(s.end_time);
            if (startSlot < 0 || endSlot < 0) continue;
            for (let slot = startSlot; slot < endSlot; slot++) {
              grid.add(gridKey(s.day_of_week, slot));
            }
          }
          setAvailGrid(grid);
          setBufferEnabled(hasBuffer);

          // Map bookings → day-of-week + slot (approximate — for visual indicator)
          const booked: BookedCell[] = [];
          for (const b of bookRes.data || []) {
            const dt = new Date(b.start_time);
            const day = dt.getDay();
            const timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            const slot = timeToSlot(timeStr);
            if (slot >= 0) booked.push({ day, slot });
          }
          setBookedCells(booked);

          setTimeOffs((offRes.data || []).map((t: any) => ({
            id: t.id,
            start_date: t.start_date,
            end_date: t.end_date,
            reason: t.reason || '',
          })));

          setLoading(false);
        });
      });
  }, [user]);

  /* ── Grid interaction ── */

  function handleCellPointerDown(day: number, slot: number) {
    isDragging.current = true;
    const key = gridKey(day, slot);
    const paintMode = !availGrid.has(key);
    dragValue.current = paintMode;
    dragStart.current = key;
    setAvailGrid(prev => {
      const next = new Set(prev);
      if (paintMode) next.add(key); else next.delete(key);
      return next;
    });
  }

  function handleCellPointerEnter(day: number, slot: number) {
    if (!isDragging.current) return;
    const key = gridKey(day, slot);
    setAvailGrid(prev => {
      const next = new Set(prev);
      if (dragValue.current) next.add(key); else next.delete(key);
      return next;
    });
  }

  function handlePointerUp() {
    isDragging.current = false;
  }

  /* ── Save schedule ── */

  async function handleSave() {
    if (!instructorId) return;
    setSaving(true);
    setSaveMsg(null);
    const supabase = createBrowserClient();
    if (!supabase) return;

    try {
      await supabase.from('coach_schedules').delete().eq('coach_id', instructorId);

      // Compress contiguous slots per day into schedule blocks
      const rows: Array<{
        coach_id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        timezone: string;
        is_active: boolean;
        buffer_minutes: number;
      }> = [];

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const bufferMins = bufferEnabled ? 15 : 0;

      for (const day of DAYS.map(d => d.value)) {
        let blockStart: number | null = null;

        for (let slot = 0; slot <= TOTAL_SLOTS; slot++) {
          const active = availGrid.has(gridKey(day, slot));

          if (active && blockStart === null) {
            blockStart = slot;
          } else if (!active && blockStart !== null) {
            rows.push({
              coach_id: instructorId,
              day_of_week: day,
              start_time: slotToTime(blockStart),
              end_time: slotToTime(slot),
              timezone,
              is_active: true,
              buffer_minutes: bufferMins,
            });
            blockStart = null;
          }
        }
      }

      if (rows.length > 0) {
        await supabase.from('coach_schedules').insert(rows);
      }

      setSaveMsg({ type: 'success', text: isAr ? 'تم حفظ المواعيد بنجاح' : 'Schedule saved successfully' });
    } catch {
      setSaveMsg({ type: 'error', text: isAr ? 'حدث خطأ أثناء الحفظ' : 'Error saving schedule' });
    } finally {
      setSaving(false);
      // UX-Pro: toast-dismiss — auto-clear success message after 4 seconds
      setTimeout(() => setSaveMsg(null), 4000);
    }
  }

  /* ── Time-off handlers ── */

  function isTimeOff(dateStr: string): TimeOffEntry | undefined {
    return timeOffs.find(t => t.start_date <= dateStr && t.end_date >= dateStr);
  }

  async function handleDayClick(dateStr: string) {
    const existing = isTimeOff(dateStr);
    if (existing) {
      // Toggle off
      if (!existing.id) return;
      setSavingTimeOff(true);
      const supabase = createBrowserClient();
      if (!supabase) return;
      await supabase.from('coach_time_off').delete().eq('id', existing.id);
      setTimeOffs(prev => prev.filter(t => t.id !== existing.id));
      setSavingTimeOff(false);
      setPopoverDay(null);
    } else {
      setPopoverDay(dateStr);
      setPopoverReason('');
    }
  }

  async function confirmTimeOff() {
    if (!instructorId || !popoverDay) return;
    setSavingTimeOff(true);
    const supabase = createBrowserClient();
    if (!supabase) return;
    const { data } = await supabase
      .from('coach_time_off')
      .insert({
        coach_id: instructorId,
        start_date: popoverDay,
        end_date: popoverDay,
        reason: popoverReason,
      })
      .select()
      .single();
    if (data) {
      setTimeOffs(prev => [...prev, {
        id: data.id,
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason || '',
      }]);
    }
    setSavingTimeOff(false);
    setPopoverDay(null);
    setPopoverReason('');
  }

  /* ── Render helpers ── */

  function getCellClass(day: number, slot: number): string {
    const key = gridKey(day, slot);
    const isBooked = bookedCells.some(b => b.day === day && b.slot === slot);
    const isAvail = availGrid.has(key);

    if (isBooked) return 'cell-booked';
    if (isAvail) return 'cell-available';
    return 'cell-empty';
  }

  /* ── Loading / Auth states ── */

  if (authLoading || loading) {
    return (
      <div className="py-12 text-center text-[var(--color-neutral-500)]">
        <div className="inline-block w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-2" />
        <p>{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    );
  }

  if (!instructorId) {
    return (
      <div className="py-12 text-center text-[var(--color-neutral-500)]">
        {isAr ? 'لم يتم العثور على ملف كوتش' : 'No coach profile found'}
      </div>
    );
  }

  /* ── Month grid ── */
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);
  const monthName = new Date(calYear, calMonth, 1).toLocaleString(isAr ? 'ar-SA' : 'en-US', { month: 'long' });

  /* ── Render ── */
  return (
    <div
      className="mt-6"
      dir={isAr ? 'rtl' : 'ltr'}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-neutral-200)]">
        {(['schedule', 'timeoff'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors min-h-[44px]',
              activeTab === tab
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)]',
            ].join(' ')}
          >
            {tab === 'schedule'
              ? (isAr ? 'الجدول الأسبوعي' : 'Weekly Schedule')
              : (isAr ? 'أيام الإجازة' : 'Time Off')}
          </button>
        ))}
      </div>

      {/* ══════════════════ WEEKLY SCHEDULE TAB ══════════════════ */}
      {activeTab === 'schedule' && (
        <div>
          {/* Controls bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-[var(--color-neutral-700)] cursor-pointer select-none min-h-[44px]">
                <span
                  role="checkbox"
                  aria-checked={bufferEnabled}
                  tabIndex={0}
                  onClick={() => setBufferEnabled(b => !b)}
                  onKeyDown={e => e.key === ' ' && setBufferEnabled(b => !b)}
                  className={[
                    'relative inline-flex items-center w-10 h-5 rounded-full transition-colors outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer',
                    bufferEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-300)]',
                  ].join(' ')}
                >
                  {/* UX-Pro: RTL toggle — use start/end logical values for correct direction */}
                  <span className={[
                    'absolute w-4 h-4 bg-white rounded-full shadow transition-transform',
                    bufferEnabled
                      ? (isAr ? 'translate-x-[-20px]' : 'translate-x-5')
                      : (isAr ? 'translate-x-[-2px]' : 'translate-x-0.5'),
                  ].join(' ')} />
                </span>
                {isAr ? 'فاصل 15 دقيقة بين الجلسات' : '15-min buffer between sessions'}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-[var(--color-neutral-500)]">
                <span className="w-3 h-3 rounded-sm bg-[#22C55E] inline-block" />
                {isAr ? 'متاح' : 'Available'}
              </div>
              <div className="flex items-center gap-1 text-xs text-[var(--color-neutral-500)]">
                <span className="w-3 h-3 rounded-sm bg-[#3B82F6] inline-block" />
                {isAr ? 'محجوز' : 'Booked'}
              </div>
              <div className="flex items-center gap-1 text-xs text-[var(--color-neutral-500)]">
                <span className="w-3 h-3 rounded-sm bg-[var(--color-neutral-200)] inline-block" />
                {isAr ? 'غير متاح' : 'Unavailable'}
              </div>
            </div>
          </div>

          {/* ── DESKTOP: 7-day grid ── */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Day headers */}
              <div
                className="grid gap-[1px]"
                style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}
              >
                <div /> {/* time axis placeholder */}
                {DAYS.map(d => (
                  <div
                    key={d.value}
                    className="text-center text-xs font-medium py-2 text-[var(--color-neutral-600)]"
                  >
                    {isAr ? d.labelAr : d.labelEn}
                  </div>
                ))}
              </div>

              {/* Grid body */}
              <div
                className="grid gap-[1px] bg-[var(--color-neutral-200)] border border-[var(--color-neutral-200)] rounded-lg overflow-hidden select-none"
                style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}
              >
                {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
                  <>
                    {/* Time label */}
                    <div
                      key={`time-${slot}`}
                      className="bg-[var(--color-surface-dim)] text-end pe-2 text-[10px] text-[var(--color-neutral-400)] flex items-center justify-end"
                      style={{ height: 28 }}
                    >
                      {slot % 2 === 0 ? slotToTime(slot) : ''}
                    </div>

                    {/* Day cells */}
                    {DAYS.map(d => {
                      const cls = getCellClass(d.value, slot);
                      return (
                        <div
                          key={`cell-${d.value}-${slot}`}
                          className={[
                            'transition-colors duration-75 cursor-pointer',
                            cls === 'cell-available' && 'bg-[#22C55E] hover:bg-[#16A34A]',
                            cls === 'cell-booked' && 'bg-[#3B82F6] cursor-not-allowed',
                            cls === 'cell-empty' && 'bg-white hover:bg-[var(--color-neutral-100)]',
                            bufferEnabled && cls === 'cell-available' && 'relative after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-[#F59E0B] after:opacity-60',
                          ].filter(Boolean).join(' ')}
                          style={{ height: 28 }}
                          onPointerDown={() => cls !== 'cell-booked' && handleCellPointerDown(d.value, slot)}
                          onPointerEnter={() => cls !== 'cell-booked' && handleCellPointerEnter(d.value, slot)}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          </div>

          {/* ── MOBILE: Single-day view with day tabs ── */}
          <div className="md:hidden">
            {/* Day tabs */}
            <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
              {DAYS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setMobileDay(d.value)}
                  className={[
                    'flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg min-h-[44px] min-w-[44px] transition-colors',
                    mobileDay === d.value
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)]',
                  ].join(' ')}
                >
                  {isAr ? d.labelAr : d.labelEn}
                </button>
              ))}
            </div>

            {/* Single day column */}
            <div className="border border-[var(--color-neutral-200)] rounded-lg overflow-hidden">
              {Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
                const cls = getCellClass(mobileDay, slot);
                return (
                  <div
                    key={slot}
                    className={[
                      'flex items-center gap-3 px-3 border-b border-[var(--color-neutral-100)] last:border-0 cursor-pointer transition-colors',
                      cls === 'cell-available' && 'bg-[#22C55E]/10 hover:bg-[#22C55E]/20',
                      cls === 'cell-booked' && 'bg-[#3B82F6]/10 cursor-not-allowed',
                      cls === 'cell-empty' && 'bg-white hover:bg-[var(--color-neutral-50)]',
                    ].filter(Boolean).join(' ')}
                    style={{ minHeight: 44 }}
                    onPointerDown={() => cls !== 'cell-booked' && handleCellPointerDown(mobileDay, slot)}
                  >
                    <span className="text-xs text-[var(--color-neutral-400)] w-12 shrink-0">
                      {slot % 2 === 0 ? slotToTime(slot) : ''}
                    </span>
                    <span
                      className={[
                        'w-2 h-2 rounded-full shrink-0',
                        cls === 'cell-available' && 'bg-[#22C55E]',
                        cls === 'cell-booked' && 'bg-[#3B82F6]',
                        cls === 'cell-empty' && 'bg-transparent',
                      ].filter(Boolean).join(' ')}
                    />
                    {cls === 'cell-booked' && (
                      <span className="text-xs text-[#3B82F6]">
                        {isAr ? 'محجوز' : 'Booked'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 mt-6">
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving
                ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                : (isAr ? 'حفظ الجدول' : 'Save Schedule')}
            </Button>
            {/* UX-Pro: toast-accessibility — aria-live for screen reader announcement */}
            <span
              role="status"
              aria-live="polite"
              className={`text-sm font-medium transition-opacity duration-300 ${saveMsg ? 'opacity-100' : 'opacity-0'} ${saveMsg?.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
            >
              {saveMsg?.text ?? ''}
            </span>
          </div>

          <p className="mt-3 text-xs text-[var(--color-neutral-400)]">
            {isAr
              ? 'انقر على الخلايا أو اسحب لرسم فترات التوفّر. الخلايا الزرقاء محجوزة ولا يمكن تعديلها.'
              : 'Click or drag cells to paint availability. Blue cells are booked and cannot be edited.'}
          </p>
        </div>
      )}

      {/* ══════════════════ TIME OFF TAB ══════════════════ */}
      {activeTab === 'timeoff' && (
        <div>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            {/* UX-Pro: aria-labels + icon-consistency — SVG chevrons instead of text chars */}
          <button
              onClick={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                else setCalMonth(m => m - 1);
              }}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] min-h-[44px]"
              aria-label={isAr ? 'الشهر السابق' : 'Previous month'}
            >
              <svg className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {monthName} {calYear}
            </h3>
            <button
              onClick={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                else setCalMonth(m => m + 1);
              }}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] min-h-[44px]"
              aria-label={isAr ? 'الشهر التالي' : 'Next month'}
            >
              <svg className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map(d => (
              <div
                key={d.value}
                className="text-center text-xs font-medium text-[var(--color-neutral-500)] py-1"
              >
                {isAr ? d.labelAr.slice(0, 2) : d.labelEn.slice(0, 2)}
              </div>
            ))}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Leading empty cells */}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const dayNum = i + 1;
              const dateStr = toDateStr(calYear, calMonth, dayNum);
              const off = isTimeOff(dateStr);
              const today = new Date().toISOString().split('T')[0];
              const isPast = dateStr < today;

              return (
                <button
                  key={dayNum}
                  onClick={() => !isPast && handleDayClick(dateStr)}
                  className={[
                    'aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                    isPast && 'opacity-30 cursor-not-allowed',
                    !isPast && off && 'bg-orange-400 text-white hover:bg-orange-500',
                    !isPast && !off && 'hover:bg-[var(--color-neutral-100)] text-[var(--color-text-primary)]',
                    dateStr === today && !off && 'ring-2 ring-[var(--color-primary)]',
                  ].filter(Boolean).join(' ')}
                  title={off ? `${isAr ? 'إجازة' : 'Time off'}${off.reason ? ': ' + off.reason : ''}` : undefined}
                  disabled={isPast}
                >
                  {dayNum}
                  {off && <span className="block w-1 h-1 rounded-full bg-white mt-0.5 opacity-80" />}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-[var(--color-neutral-400)]">
            {isAr
              ? 'انقر على يوم لتعيينه إجازة. انقر مرة أخرى لإلغاء الإجازة.'
              : 'Click a day to mark it as time off. Click again to remove.'}
          </p>

          {/* Time-off list */}
          {timeOffs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-[var(--color-neutral-600)] mb-3">
                {isAr ? 'قائمة الإجازات' : 'Scheduled Time Off'}
              </h3>
              <div className="space-y-2">
                {timeOffs.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50"
                  >
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {t.start_date === t.end_date ? t.start_date : `${t.start_date} → ${t.end_date}`}
                    </span>
                    {t.reason && (
                      <span className="text-sm text-[var(--color-neutral-500)] flex-1">{t.reason}</span>
                    )}
                    <button
                      onClick={() => {
                        if (!t.id) return;
                        const id = t.id;
                        void (async () => {
                          const supabase = createBrowserClient();
                          if (!supabase) return;
                          await supabase.from('coach_time_off').delete().eq('id', id);
                          setTimeOffs(prev => prev.filter(x => x.id !== id));
                        })();
                      }}
                      className="text-red-500 hover:text-red-700 text-xs min-h-[44px] px-2"
                    >
                      {isAr ? 'حذف' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ TIME-OFF POPOVER ══════════════════ */}
      {popoverDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setPopoverDay(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
            dir={isAr ? 'rtl' : 'ltr'}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
              {isAr ? 'تعيين إجازة' : 'Mark as Time Off'}
            </h3>
            <p className="text-sm text-[var(--color-neutral-500)] mb-4">{popoverDay}</p>
            <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
              {isAr ? 'السبب (اختياري)' : 'Reason (optional)'}
            </label>
            <input
              type="text"
              value={popoverReason}
              onChange={e => setPopoverReason(e.target.value)}
              placeholder={isAr ? 'مثال: إجازة رسمية' : 'e.g. Public holiday'}
              className="w-full rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 text-sm mb-4 min-h-[44px]"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="primary" onClick={confirmTimeOff} disabled={savingTimeOff} className="flex-1">
                {savingTimeOff ? '...' : (isAr ? 'تأكيد' : 'Confirm')}
              </Button>
              <Button variant="secondary" onClick={() => setPopoverDay(null)} className="flex-1">
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
