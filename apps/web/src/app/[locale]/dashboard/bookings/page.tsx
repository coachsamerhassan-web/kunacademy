'use client';

import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string;
  provider_id?: string;
  service?: { name_ar: string; name_en: string; duration_minutes: number; price_aed?: number };
  coach?: { profile: { full_name_ar: string | null; full_name_en: string | null } | null } | null;
}

interface Slot {
  date: string;       // "2026-04-01"
  start_time: string; // "09:00"
  end_time: string;   // "10:00"
}

const statusLabels: Record<string, { ar: string; en: string; cls: string }> = {
  pending:   { ar: 'بانتظار التأكيد', en: 'Pending',   cls: 'bg-yellow-100 text-yellow-800' },
  confirmed: { ar: 'مؤكد',           en: 'Confirmed', cls: 'bg-blue-100 text-blue-800'   },
  completed: { ar: 'مكتمل',          en: 'Completed', cls: 'bg-green-100 text-green-800'  },
  cancelled: { ar: 'ملغي',           en: 'Cancelled', cls: 'bg-red-100 text-red-800'      },
  'no-show': { ar: 'لم يحضر',        en: 'No-Show',   cls: 'bg-gray-100 text-gray-600'    },
};

// ─── Inline slot picker ───────────────────────────────────────────────────────

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function formatTime12(time24: string, locale: string) {
  const [h, m] = time24.split(':').map(Number);
  if (locale === 'ar') return `${h}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

interface InlineSlotPickerProps {
  coachId: string;
  duration: number;
  locale: string;
  onSelect: (slot: Slot) => void;
  onCancel: () => void;
}

function InlineSlotPicker({ coachId, duration, locale, onSelect, onCancel }: InlineSlotPickerProps) {
  const isAr = locale === 'ar';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [weekStart, setWeekStart] = useState(new Date(today));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const start = isoDate(weekStart);
      const end = isoDate(addDays(weekStart, 6));
      const res = await fetch(`/api/availability?coach_id=${coachId}&start=${start}&end=${end}&duration=${duration}`);
      const data = await res.json();
      setSlots(data.slots || []);
    } finally {
      setLoading(false);
    }
  }, [coachId, duration, weekStart]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const slotsByDate = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.date] ||= []).push(s);
    return acc;
  }, {});

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const canGoPrev = weekStart > today;

  return (
    <div className="mt-3 rounded-xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[var(--color-primary)]">
          {isAr ? 'اختر موعدًا جديدًا' : 'Choose a new time'}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)] min-h-[44px] px-2"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setWeekStart(d => addDays(d, -7))}
          disabled={!canGoPrev}
          className="p-1.5 rounded-lg border border-[var(--color-neutral-200)] bg-white disabled:opacity-30 min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label={isAr ? 'الأسبوع السابق' : 'Previous week'}
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <span className="flex-1 text-xs text-center text-[var(--color-neutral-600)]">
          {weekStart.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
          {' — '}
          {addDays(weekStart, 6).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={() => setWeekStart(d => addDays(d, 7))}
          className="p-1.5 rounded-lg border border-[var(--color-neutral-200)] bg-white min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label={isAr ? 'الأسبوع التالي' : 'Next week'}
        >
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <p className="text-center py-4 text-xs text-[var(--color-neutral-500)]">
          {isAr ? 'جاري التحميل...' : 'Loading...'}
        </p>
      ) : (
        <div className="space-y-3">
          {days.map(d => {
            const ds = isoDate(d);
            const daySlots = slotsByDate[ds] || [];
            if (daySlots.length === 0) return null;
            return (
              <div key={ds}>
                <p className="text-xs font-medium text-[var(--color-neutral-600)] mb-1">
                  {d.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {daySlots.map((slot, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSelect(slot)}
                      className="rounded-full border border-[var(--color-primary)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors min-h-[36px]"
                    >
                      {formatTime12(slot.start_time, locale)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {days.every(d => !(slotsByDate[isoDate(d)]?.length)) && (
            <p className="text-center py-4 text-xs text-[var(--color-neutral-500)]">
              {isAr ? 'لا توجد مواعيد متاحة هذا الأسبوع' : 'No slots this week'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [reschedulingAction, setReschedulingAction] = useState<string | null>(null);
  const [rescheduleError, setRescheduleError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    supabase
      .from('bookings')
      .select(`
        id, start_time, end_time, status, notes, provider_id,
        coach:providers(profile:profiles(full_name_ar, full_name_en)),
        service:services(name_ar, name_en, duration_minutes, price_aed)
      `)
      .eq('customer_id', user.id)
      .order('start_time', { ascending: false })
      .then(({ data }: { data: any }) => {
        setBookings((data ?? []) as Booking[]);
        setLoading(false);
      });
  }, [user]);

  async function cancelBooking(id: string) {
    setCancelling(id);
    const supabase = createBrowserClient();
    // Defense-in-depth: filter by both id AND customer_id (the authenticated user).
    // RLS also enforces customer_id = auth.uid(), but explicit filter prevents any
    // horizontal privilege escalation if RLS is misconfigured.
    if (user) {
      await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('customer_id', user.id);
    }
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
    setCancelling(null);
  }

  async function handleReschedule(bookingId: string, slot: Slot) {
    setReschedulingAction(bookingId);
    setRescheduleError(prev => ({ ...prev, [bookingId]: '' }));

    try {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase!.auth.getSession();

      const res = await fetch('/api/bookings/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          booking_id: bookingId,
          new_start_time: `${slot.date}T${slot.start_time}:00`,
          new_end_time: `${slot.date}T${slot.end_time}:00`,
        }),
      });

      if (res.ok) {
        const { new_start_time, new_end_time } = await res.json();
        setBookings(prev =>
          prev.map(b =>
            b.id === bookingId
              ? { ...b, start_time: new_start_time, end_time: new_end_time }
              : b
          )
        );
        setRescheduling(null);
      } else {
        const { error } = await res.json();
        setRescheduleError(prev => ({
          ...prev,
          [bookingId]: error || (isAr ? 'فشل تغيير الموعد' : 'Reschedule failed'),
        }));
      }
    } catch {
      setRescheduleError(prev => ({
        ...prev,
        [bookingId]: isAr ? 'خطأ في الاتصال' : 'Connection error',
      }));
    } finally {
      setReschedulingAction(null);
    }
  }

  function canCancel(booking: Booking): boolean {
    if (booking.status !== 'pending' && booking.status !== 'confirmed') return false;
    const hoursUntil = (new Date(booking.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntil > 24;
  }

  function canReschedule(booking: Booking): boolean {
    if (booking.status !== 'confirmed') return false;
    const hoursUntil = (new Date(booking.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntil > 24;
  }

  return (
    <Section variant="white">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        {isAr ? 'حجوزاتي' : 'My Bookings'}
      </h1>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : bookings.length > 0 ? (
        <div className="space-y-4">
          {bookings.map((b) => {
            const s = statusLabels[b.status] ?? statusLabels.pending;
            const coachName = isAr ? b.coach?.profile?.full_name_ar : b.coach?.profile?.full_name_en;
            const serviceName = isAr ? b.service?.name_ar : b.service?.name_en;
            const isPast = new Date(b.start_time) < new Date();
            const showReschedule = canReschedule(b);
            const showCancel = canCancel(b);
            const isReschedulingThis = rescheduling === b.id;

            return (
              <Card key={b.id} accent className={`p-5 ${isPast && b.status !== 'completed' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {serviceName && (
                      <p className="font-semibold text-[var(--text-primary)] truncate">{serviceName}</p>
                    )}
                    <p className={`${serviceName ? 'text-sm text-[var(--color-neutral-600)] mt-0.5' : 'font-medium text-[var(--text-primary)]'}`}>
                      {new Date(b.start_time).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-sm text-[var(--color-neutral-500)] mt-0.5">
                      {new Date(b.start_time).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      {' — '}
                      {new Date(b.end_time).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {coachName && (
                      <p className="text-xs text-[var(--color-neutral-400)] mt-1">
                        {isAr ? 'مع' : 'with'} {coachName}
                      </p>
                    )}

                    {/* Reschedule inline picker */}
                    {isReschedulingThis && b.provider_id && b.service && (
                      <InlineSlotPicker
                        coachId={b.provider_id}
                        duration={b.service.duration_minutes}
                        locale={locale}
                        onSelect={(slot) => handleReschedule(b.id, slot)}
                        onCancel={() => setRescheduling(null)}
                      />
                    )}

                    {rescheduleError[b.id] && (
                      <p className="mt-2 text-xs text-red-600">{rescheduleError[b.id]}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
                      {isAr ? s.ar : s.en}
                    </span>

                    <div className="flex flex-col gap-1">
                      {showReschedule && !isReschedulingThis && (
                        <button
                          type="button"
                          onClick={() => {
                            setRescheduling(b.id);
                            setRescheduleError(prev => ({ ...prev, [b.id]: '' }));
                          }}
                          disabled={reschedulingAction === b.id}
                          className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-700)] font-medium disabled:opacity-50 min-h-[44px] px-2 flex items-center"
                        >
                          {reschedulingAction === b.id
                            ? (isAr ? 'جاري التغيير...' : 'Rescheduling...')
                            : (isAr ? 'تغيير الموعد' : 'Reschedule')}
                        </button>
                      )}

                      {showCancel && (
                        <button
                          type="button"
                          onClick={() => cancelBooking(b.id)}
                          disabled={cancelling === b.id}
                          className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50 min-h-[44px] px-2 flex items-center"
                        >
                          {cancelling === b.id
                            ? (isAr ? 'جارٍ الإلغاء...' : 'Cancelling...')
                            : (isAr ? 'إلغاء الحجز' : 'Cancel Booking')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{isAr ? 'لا توجد حجوزات بعد' : 'No bookings yet'}</h2>
          <p className="text-sm text-[var(--color-neutral-500)] mt-2 mb-6">{isAr ? 'احجز جلسة كوتشينج مع أحد كوتشز كُن' : "Book a coaching session with one of Kun's coaches"}</p>
          <a href={`/${locale}/coaching/book`} className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white min-h-[44px]">
            {isAr ? 'احجز جلسة' : 'Book a Session'}
          </a>
        </div>
      )}
    </Section>
  );
}
