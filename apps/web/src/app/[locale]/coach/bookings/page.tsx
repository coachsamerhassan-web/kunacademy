'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, useCallback } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
type TabFilter = 'upcoming' | 'past' | 'all';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string | null;
  notes: string | null;
  meeting_url: string | null;
  provider_id?: string;
  service: { name_ar: string; name_en: string; duration_minutes: number } | null;
  customer: { full_name_ar: string | null; full_name_en: string | null; email: string } | null;
}

interface Slot {
  date: string;       // "2026-04-01"
  start_time: string; // "09:00"
  end_time: string;   // "10:00"
}

const statusConfig: Record<BookingStatus, { labelAr: string; labelEn: string; className: string }> = {
  pending: { labelAr: 'بانتظار التأكيد', labelEn: 'Pending', className: 'bg-amber-100 text-amber-700' },
  confirmed: { labelAr: 'مؤكّد', labelEn: 'Confirmed', className: 'bg-green-100 text-green-700' },
  completed: { labelAr: 'مكتمل', labelEn: 'Completed', className: 'bg-blue-100 text-blue-700' },
  cancelled: { labelAr: 'ملغي', labelEn: 'Cancelled', className: 'bg-red-100 text-red-700' },
  no_show: { labelAr: 'لم يحضر', labelEn: 'No Show', className: 'bg-gray-100 text-gray-700' },
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

export default function CoachBookingsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, loading: authLoading } = useAuth();
  const isAr = locale === 'ar';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>('upcoming');
  const [coachProviderId, setCoachProviderId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [reschedulingAction, setReschedulingAction] = useState<string | null>(null);
  const [rescheduleError, setRescheduleError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;

    fetch('/api/coach/bookings')
      .then((r) => r.json())
      .then((data) => {
        setBookings((data.bookings || []) as Booking[]);
        if (data.provider_id) setCoachProviderId(data.provider_id);
        setLoading(false);
      });
  }, [user]);

  async function handleAction(bookingId: string, action: 'confirm' | 'cancel' | 'complete') {
    setActionLoading(bookingId);
    try {
      const res = await fetch('/api/coach/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, action }),
      });
      if (res.ok) {
        const statusMap: Record<string, string> = { confirm: 'confirmed', cancel: 'cancelled', complete: 'completed' };
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: statusMap[action] } : b));
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReschedule(bookingId: string, slot: Slot) {
    setReschedulingAction(bookingId);
    setRescheduleError(prev => ({ ...prev, [bookingId]: '' }));
    try {
      const res = await fetch('/api/bookings/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          new_start_time: `${slot.date}T${slot.start_time}:00`,
          new_end_time: `${slot.date}T${slot.end_time}:00`,
        }),
      });
      if (res.ok) {
        const { new_start_time, new_end_time } = await res.json();
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, start_time: new_start_time, end_time: new_end_time } : b));
        setRescheduling(null);
      } else {
        const { error } = await res.json();
        setRescheduleError(prev => ({ ...prev, [bookingId]: error || (isAr ? 'فشل تغيير الموعد' : 'Reschedule failed') }));
      }
    } catch {
      setRescheduleError(prev => ({ ...prev, [bookingId]: isAr ? 'خطأ في الاتصال' : 'Connection error' }));
    } finally {
      setReschedulingAction(null);
    }
  }

  const today = new Date().toISOString().split('T')[0];

  const filtered = bookings.filter((b) => {
    if (tab === 'upcoming') return b.start_time.split('T')[0] >= today && b.status !== 'cancelled';
    if (tab === 'past') return b.start_time.split('T')[0] < today || b.status === 'completed';
    return true;
  });

  if (authLoading || loading) {
    return (
      <Section variant="white">
        <div className="text-center py-12">
          <div className="h-8 w-8 mx-auto border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </Section>
    );
  }

  if (!user) {
    return (
      <Section variant="white">
        <div className="text-center py-12">
          <p className="text-[var(--color-neutral-500)]">{isAr ? 'يرجى تسجيل الدخول' : 'Please sign in'}</p>
          <a href={`/${locale}/auth/login?redirect=/${locale}/coach/bookings`} className="mt-3 inline-block text-[var(--color-primary)] font-medium hover:underline">
            {isAr ? 'تسجيل الدخول' : 'Sign in'}
          </a>
        </div>
      </Section>
    );
  }

  return (
    <main>
      <Section variant="white">
        <Heading level={1} className="mb-6">
          {isAr ? 'حجوزاتي' : 'My Bookings'}
        </Heading>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[var(--color-neutral-100)] p-1 rounded-xl w-fit">
          {(['upcoming', 'past', 'all'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                tab === t
                  ? 'bg-white text-[var(--color-primary)] shadow-sm'
                  : 'text-[var(--color-neutral-600)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t === 'upcoming' ? (isAr ? 'القادمة' : 'Upcoming')
                : t === 'past' ? (isAr ? 'السابقة' : 'Past')
                : (isAr ? 'الكل' : 'All')}
            </button>
          ))}
        </div>

        {/* Bookings list */}
        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((b) => {
              const s = statusConfig[(b.status ?? 'pending') as BookingStatus] || statusConfig.pending;
              const clientName = isAr
                ? (b.customer?.full_name_ar || b.customer?.full_name_en || b.customer?.email || '—')
                : (b.customer?.full_name_en || b.customer?.full_name_ar || b.customer?.email || '—');
              const serviceName = isAr ? b.service?.name_ar : b.service?.name_en;
              const dateObj = new Date(b.start_time.split('T')[0] + 'T00:00:00');
              const dateStr = dateObj.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
              });
              const fmtTime = (iso: string) => {
                const d = new Date(iso);
                return d.toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
              };
              const timeStr = `${fmtTime(b.start_time)} – ${fmtTime(b.end_time)}`;

              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--color-neutral-200)] p-4 hover:border-[var(--color-primary)]/30 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    {/* Date block */}
                    <div className="shrink-0 text-center sm:text-start sm:w-28">
                      <div className="text-sm font-medium text-[var(--text-primary)]">{dateStr}</div>
                      <div className="text-xs text-[var(--color-neutral-500)]">
                        {timeStr}
                      </div>
                    </div>

                    {/* Client & Service */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--text-primary)]">{clientName}</div>
                      {serviceName && (
                        <div className="text-sm text-[var(--color-neutral-600)] mt-0.5">
                          {serviceName}
                          {b.service?.duration_minutes && (
                            <span className="text-[var(--color-neutral-400)] mx-1">·</span>
                          )}
                          {b.service?.duration_minutes && (
                            <span>{b.service.duration_minutes} {isAr ? 'د' : 'min'}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status & Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${s.className}`}>
                        {isAr ? s.labelAr : s.labelEn}
                      </span>

                      <div className="flex flex-wrap gap-1">
                        {b.status === 'pending' && (
                          <button
                            onClick={() => handleAction(b.id, 'confirm')}
                            disabled={actionLoading === b.id}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 min-h-[36px]"
                          >
                            {actionLoading === b.id ? '...' : (isAr ? 'تأكيد' : 'Confirm')}
                          </button>
                        )}
                        {b.status === 'confirmed' && (
                          <button
                            onClick={() => handleAction(b.id, 'complete')}
                            disabled={actionLoading === b.id}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 min-h-[36px]"
                          >
                            {actionLoading === b.id ? '...' : (isAr ? 'اكتمل' : 'Complete')}
                          </button>
                        )}
                        {(b.status === 'pending' || b.status === 'confirmed') && (
                          <>
                            {rescheduling !== b.id && (
                              <button
                                onClick={() => { setRescheduling(b.id); setRescheduleError(prev => ({ ...prev, [b.id]: '' })); }}
                                disabled={reschedulingAction === b.id}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary-50)] text-[var(--color-primary)] hover:bg-[var(--color-primary-100)] disabled:opacity-50 min-h-[36px]"
                              >
                                {isAr ? 'تغيير الموعد' : 'Reschedule'}
                              </button>
                            )}
                            <button
                              onClick={() => handleAction(b.id, 'cancel')}
                              disabled={actionLoading === b.id}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 min-h-[36px]"
                            >
                              {actionLoading === b.id ? '...' : (isAr ? 'إلغاء' : 'Cancel')}
                            </button>
                          </>
                        )}
                        {b.meeting_url && b.status === 'confirmed' && (
                          <a
                            href={b.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary-600)] transition-colors min-h-[36px]"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M15 10l5-3v10l-5-3z" />
                              <rect x="1" y="5" width="14" height="14" rx="2" />
                            </svg>
                            {isAr ? 'انضم' : 'Join'}
                          </a>
                        )}
                      </div>

                      {rescheduleError[b.id] && (
                        <p className="text-xs text-red-600">{rescheduleError[b.id]}</p>
                      )}
                    </div>
                  </div>

                  {/* Inline slot picker for reschedule */}
                  {rescheduling === b.id && coachProviderId && (
                    <InlineSlotPicker
                      coachId={coachProviderId}
                      duration={b.service?.duration_minutes || 60}
                      locale={locale}
                      onSelect={(slot) => handleReschedule(b.id, slot)}
                      onCancel={() => setRescheduling(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-[var(--color-neutral-100)] flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--color-neutral-400)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <p className="text-[var(--color-neutral-500)]">
              {tab === 'upcoming'
                ? (isAr ? 'لا توجد حجوزات قادمة' : 'No upcoming bookings')
                : tab === 'past'
                ? (isAr ? 'لا توجد حجوزات سابقة' : 'No past bookings')
                : (isAr ? 'لا توجد حجوزات' : 'No bookings yet')}
            </p>
          </div>
        )}
      </Section>
    </main>
  );
}
