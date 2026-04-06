'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Service {
  id: string;
  name_ar: string;
  name_en: string;
  duration_minutes: number;
  price_aed: number | null;
  category_id: string | null;
  is_active: boolean;
}

interface Coach {
  id: string;           // instructors.id
  slug: string;         // for URL pre-selection
  provider_id: string;  // providers.id (needed for availability)
  title_ar: string;
  title_en: string;
  photo_url: string | null;
  coach_level: string | null;
  specialties: string[] | null;
}

interface Slot {
  date: string;         // "2026-04-01"
  start_time: string;   // "09:00"
  end_time: string;     // "10:00"
}

type Step = 1 | 2 | 3 | 4;

// ─── Hold timer hook ──────────────────────────────────────────────────────────

function useCountdown(target: Date | null) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!target) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, target.getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { remaining, label: `${m}:${String(s).padStart(2, '0')}` };
}

// ─── Week Calendar ────────────────────────────────────────────────────────────

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

interface WeekCalendarProps {
  slots: Slot[];
  loading: boolean;
  timezone: string;
  locale: string;
  onSelect: (slot: Slot) => void;
  isMobile: boolean;
}

function WeekCalendar({ slots, loading, timezone, locale, onSelect, isMobile }: WeekCalendarProps) {
  const isAr = locale === 'ar';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(today);
    return d;
  });
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const slotsByDate = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.date] ||= []).push(s);
    return acc;
  }, {});

  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));

  const canGoPrev = weekStart > today;

  // Mobile: show one day at a time via tabs
  if (isMobile) {
    const activeDay = days[activeDayIndex];
    const activeDateStr = isoDate(activeDay);
    const daySlots = slotsByDate[activeDateStr] || [];

    return (
      <div>
        {/* Day tabs */}
        <div className="flex overflow-x-auto gap-1 pb-2 mb-4 scrollbar-none">
          {days.map((d, i) => {
            const ds = isoDate(d);
            const hasSlots = (slotsByDate[ds]?.length ?? 0) > 0;
            const isActive = i === activeDayIndex;
            return (
              <button
                key={ds}
                type="button"
                onClick={() => setActiveDayIndex(i)}
                className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-sm min-h-[56px] min-w-[52px] transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white font-semibold'
                    : hasSlots
                    ? 'border border-[var(--color-neutral-200)] text-[var(--color-neutral-700)] hover:border-[var(--color-primary)]'
                    : 'border border-[var(--color-neutral-100)] text-[var(--color-neutral-300)]'
                }`}
              >
                <span className="text-xs">{d.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'short' })}</span>
                <span className="font-bold">{d.getDate()}</span>
              </button>
            );
          })}
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={prevWeek}
            disabled={!canGoPrev}
            className="p-2 rounded-lg border border-[var(--color-neutral-200)] disabled:opacity-30 min-h-[44px] min-w-[44px]"
            aria-label={isAr ? 'الأسبوع السابق' : 'Previous week'}
          >
            <ChevronLeft className={`w-4 h-4 ${isAr ? 'rtl:rotate-180' : ''}`} aria-hidden="true" />
          </button>
          <span className="text-sm text-[var(--color-neutral-500)]">
            {weekStart.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
            {' — '}
            {addDays(weekStart, 6).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
          </span>
          <button
            type="button"
            onClick={nextWeek}
            className="p-2 rounded-lg border border-[var(--color-neutral-200)] min-h-[44px] min-w-[44px]"
            aria-label={isAr ? 'الأسبوع التالي' : 'Next week'}
          >
            <ChevronRight className={`w-4 h-4 ${isAr ? 'rtl:rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <p className="text-center py-8 text-[var(--color-neutral-500)] text-sm">{isAr ? 'جاري تحميل المواعيد...' : 'Loading times...'}</p>
        ) : daySlots.length === 0 ? (
          <p className="text-center py-8 text-[var(--color-neutral-500)] text-sm">{isAr ? 'لا توجد مواعيد متاحة' : 'No slots available'}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {daySlots.map((slot, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(slot)}
                className="rounded-full border border-[var(--color-neutral-200)] px-4 py-2 text-sm font-medium hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-colors min-h-[44px]"
              >
                {formatTime12(slot.start_time, locale)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Desktop: 7-column grid
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevWeek}
          disabled={!canGoPrev}
          className="p-2 rounded-lg border border-[var(--color-neutral-200)] disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={isAr ? 'الأسبوع السابق' : 'Previous week'}
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
        </button>
        <span className="text-sm font-medium text-[var(--color-neutral-700)]">
          {weekStart.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={nextWeek}
          className="p-2 rounded-lg border border-[var(--color-neutral-200)] min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={isAr ? 'الأسبوع التالي' : 'Next week'}
        >
          <ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const ds = isoDate(d);
          const daySlots = slotsByDate[ds] || [];
          const dayLabel = d.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'short' });
          const isToday = ds === isoDate(new Date());

          return (
            <div key={ds} className="flex flex-col items-center">
              <div className={`text-xs font-medium mb-1 ${isToday ? 'text-[var(--color-primary)]' : 'text-[var(--color-neutral-500)]'}`}>
                {dayLabel}
              </div>
              <div className={`text-sm font-bold mb-2 ${isToday ? 'text-[var(--color-primary)]' : 'text-[var(--color-neutral-700)]'}`}>
                {d.getDate()}
              </div>
              {loading ? (
                <div className="w-8 h-8 rounded-full border-2 border-[var(--color-neutral-200)] border-t-[var(--color-primary)] animate-spin" />
              ) : daySlots.length === 0 ? (
                <span className="text-xs text-[var(--color-neutral-300)]">—</span>
              ) : (
                <div className="flex flex-col gap-1 w-full">
                  {daySlots.map((slot, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSelect(slot)}
                      // UX-Pro: touch-target-size — minimum 44px (was 36px)
                      className="rounded-full border border-[var(--color-neutral-200)] px-2 py-1.5 text-xs font-medium hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-colors text-center min-h-[44px]"
                    >
                      {formatTime12(slot.start_time, locale)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {timezone && (
        <p className="mt-3 text-xs text-[var(--color-neutral-400)] text-center">
          {isAr ? `التوقيت: ${timezone}` : `Times shown in ${timezone}`}
        </p>
      )}
    </div>
  );
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ step, total, locale }: { step: number; total: number; locale: string }) {
  const isAr = locale === 'ar';
  // UX-Pro: aria-labels — multi-step progress with accessible step counter
  const stepLabels = isAr
    ? ['اختر الخدمة', 'اختر الكوتش', 'اختر الموعد', 'تأكيد الحجز']
    : ['Choose Service', 'Choose Coach', 'Pick Time', 'Confirm Booking'];

  return (
    <div
      className="flex items-center justify-center gap-2 mb-8"
      role="progressbar"
      aria-valuenow={step}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuetext={isAr ? `الخطوة ${step} من ${total}: ${stepLabels[step - 1] ?? ''}` : `Step ${step} of ${total}: ${stepLabels[step - 1] ?? ''}`}
      aria-label={isAr ? 'تقدم الحجز' : 'Booking progress'}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`rounded-full transition-all duration-200 ${
            i + 1 === step
              ? 'w-6 h-2 bg-[var(--color-primary)]'
              : i + 1 < step
              ? 'w-2 h-2 bg-[var(--color-primary)] opacity-50'
              : 'w-2 h-2 bg-[var(--color-neutral-200)]'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main BookingFlow ─────────────────────────────────────────────────────────
// BookingFlowInner uses useSearchParams — must be wrapped in Suspense at export.

function BookingFlowInner({ locale }: { locale: string }) {
  const { user } = useAuth();
  const isAr = locale === 'ar';
  const searchParams = useSearchParams();
  const preSelectSlug = searchParams.get('service');
  const preSelectCoachSlug = searchParams.get('coach');

  const [step, setStep] = useState<Step>(1);
  const [isMobile, setIsMobile] = useState(false);

  // Data
  const [services, setServices] = useState<Service[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [timezone, setTimezone] = useState('Asia/Dubai');

  // Loading states
  const [servicesLoading, setServicesLoading] = useState(true);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Selections
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Hold state
  const [holdId, setHoldId] = useState<string | null>(null);
  const [heldUntil, setHeldUntil] = useState<Date | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);

  const { remaining, label: countdownLabel } = useCountdown(heldUntil);

  // Detect mobile
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Load services on mount
  useEffect(() => {
    fetch('/api/booking/services')
      .then((r) => r.json())
      .then((data) => {
        const loaded = (data.services as Service[]) || [];
        setServices(loaded);
        setServicesLoading(false);

        // Pre-select service from ?service=slug query param
        if (preSelectSlug && !selectedService) {
          const match = loaded.find(
            (s) =>
              s.name_en.toLowerCase().replace(/\s+/g, '-') === preSelectSlug ||
              s.name_ar === preSelectSlug ||
              (s as any).slug === preSelectSlug
          );
          if (match) {
            setSelectedService(match);
            setStep(2);
          }
        }
      })
      .catch(() => setServicesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load coaches when service selected (Step 2)
  // If ?coach=slug is in the URL, filter to that coach and auto-advance to step 3
  useEffect(() => {
    if (!selectedService) return;
    setCoachesLoading(true);

    const coachUrl = preSelectCoachSlug
      ? `/api/booking/coaches?slug=${encodeURIComponent(preSelectCoachSlug)}`
      : '/api/booking/coaches';

    fetch(coachUrl)
      .then((r) => r.json())
      .then((data) => {
        const loaded = (data.coaches as Coach[]) || [];
        setCoaches(loaded);
        setCoachesLoading(false);

        // Auto-select coach from ?coach= param and jump to step 3
        if (preSelectCoachSlug && loaded.length === 1 && !selectedCoach) {
          const match = loaded[0];
          if (match) {
            setSelectedCoach(match);
            if (selectedService) loadSlots(match, selectedService);
            setStep(3);
          }
        }
      })
      .catch(() => setCoachesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService]);

  // Load slots when coach selected (Step 3)
  const loadSlots = useCallback(async (coach: Coach, service: Service) => {
    setSlotsLoading(true);
    const start = isoDate(new Date());
    const end = isoDate(addDays(new Date(), 28));
    try {
      const res = await fetch(
        `/api/availability?coach_id=${coach.provider_id}&start=${start}&end=${end}&duration=${service.duration_minutes}`
      );
      const data = await res.json();
      setSlots(data.slots || []);
      if (data.timezone) setTimezone(data.timezone);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  // ── Step handlers ──

  function handleSelectService(svc: Service) {
    setSelectedService(svc);
    setSelectedCoach(null);
    setSelectedSlot(null);
    setSlots([]);
    setHoldId(null);
    setHeldUntil(null);
    setStep(2);
  }

  function handleSelectCoach(coach: Coach) {
    setSelectedCoach(coach);
    setSelectedSlot(null);
    setSlots([]);
    setHoldId(null);
    setHeldUntil(null);
    if (selectedService) loadSlots(coach, selectedService);
    setStep(3);
  }

  async function handleSelectSlot(slot: Slot) {
    setSelectedSlot(slot);
    setHoldError(null);

    if (!user) {
      // No hold possible without auth — will prompt on confirm
      setStep(4);
      return;
    }

    // Optimistic hold
    try {
      const startISO = `${slot.date}T${slot.start_time}:00`;
      const endISO = `${slot.date}T${slot.end_time}:00`;

      const res = await fetch('/api/bookings/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coach_id: selectedCoach!.provider_id,
          start_time: startISO,
          end_time: endISO,
          service_id: selectedService!.id,
        }),
      });

      if (res.ok) {
        const { hold_id, held_until } = await res.json();
        setHoldId(hold_id);
        setHeldUntil(new Date(held_until));
      } else if (res.status === 409) {
        setHoldError(isAr ? 'هذا الموعد محجوز، اختر وقتًا آخر' : 'This slot was just taken, please pick another time');
        setSelectedSlot(null);
        return;
      }
    } catch {
      // Non-blocking — proceed without hold
    }

    setStep(4);
  }

  async function handleConfirm() {
    if (!user || !selectedCoach || !selectedService || !selectedSlot) return;
    setConfirming(true);

    try {
      if (holdId) {
        // Confirm via hold API — uses session cookie auth
        const res = await fetch('/api/bookings/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hold_id: holdId,
            payment_method: selectedService.price_aed === 0 ? 'free' : 'stripe',
          }),
        });

        if (!res.ok) {
          const { error } = await res.json();
          if (res.status === 409) {
            setHoldError(isAr ? 'انتهت مدة الحجز المؤقت — اختر موعدًا جديدًا' : 'Hold expired — please select a new time');
            setSelectedSlot(null);
            setHoldId(null);
            setHeldUntil(null);
            setStep(3);
            return;
          }
          throw new Error(error || 'Confirm failed');
        }

        const result = await res.json();
        if (result.payment_url) {
          window.location.href = result.payment_url;
          return;
        }
      } else {
        // Fallback: direct insert via API (no hold — user authenticated at confirm step)
        const createRes = await fetch('/api/bookings/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider_id: selectedCoach.provider_id,
            service_id: selectedService.id,
            start_time: `${selectedSlot.date}T${selectedSlot.start_time}:00`,
            end_time: `${selectedSlot.date}T${selectedSlot.end_time}:00`,
            price_aed: selectedService.price_aed,
          }),
        });
        if (!createRes.ok) {
          const { error } = await createRes.json();
          throw new Error(error || 'Booking failed');
        }
      }

      setDone(true);
    } catch (e) {
      console.error('[BookingFlow] confirm error:', e);
      // UX-Pro: submit-feedback + error-recovery — show clear error with retry guidance
      setConfirmError(isAr
        ? 'حدث خطأ أثناء الحجز. تحقق من اتصالك وحاول مرة أخرى.'
        : 'Something went wrong. Check your connection and try again.'
      );
    } finally {
      setConfirming(false);
    }
  }

  // ── Render: done state ──
  if (done) {
    return (
      <div className="mt-8 rounded-2xl bg-green-50 p-8 text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-green-800 font-semibold text-lg">
          {selectedService?.price_aed === 0
            ? (isAr ? 'تم تأكيد الحجز!' : 'Booking confirmed!')
            : (isAr ? 'تم إنشاء الحجز — في انتظار الدفع' : 'Booking created — awaiting payment')}
        </p>
        <p className="mt-2 text-green-700 text-sm">
          {selectedSlot?.date} — {selectedSlot && formatTime12(selectedSlot.start_time, locale)}
        </p>
        {/* UX-Pro: touch-target-size — min 44px on link */}
        <a
          href={`/${locale}/dashboard/bookings`}
          className="inline-flex items-center justify-center mt-4 min-h-[44px] px-4 text-[var(--color-primary)] font-medium hover:underline"
        >
          {isAr ? 'عرض حجوزاتي' : 'View my bookings'}
        </a>
      </div>
    );
  }

  // ── Price display helper ──
  function formatPrice(price: number | null) {
    if (!price) return isAr ? 'مجاني' : 'Free';
    return `${(price / 100).toFixed(0)} AED`;
  }

  // ── Render: step content ──
  const showTabby =
    selectedService?.price_aed &&
    selectedService.price_aed >= 250000; // 2500 AED in minor units

  return (
    <div className="mt-6 max-w-2xl mx-auto">
      <ProgressDots step={step} total={4} locale={locale} />

      {/* ── Step 1: Choose Service ── */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            {isAr ? 'اختر الخدمة' : 'Choose a Service'}
          </h2>
          {servicesLoading ? (
            /* UX-Pro: progressive-loading — skeleton cards instead of text spinner */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-busy="true" aria-label={isAr ? 'جاري تحميل الخدمات' : 'Loading services'}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-[var(--color-neutral-100)] p-5 bg-white min-h-[80px] animate-pulse">
                  <div className="h-4 bg-[var(--color-neutral-100)] rounded w-2/3 mb-3" />
                  <div className="flex gap-2">
                    <div className="h-5 bg-[var(--color-neutral-100)] rounded-full w-16" />
                    <div className="h-5 bg-[var(--color-neutral-100)] rounded-full w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : services.length === 0 ? (
            <p className="text-center py-8 text-[var(--color-neutral-500)]">
              {isAr ? 'لا توجد خدمات متاحة' : 'No services available'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {services.map(svc => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => handleSelectService(svc)}
                  className="text-start rounded-2xl border border-[var(--color-neutral-200)] p-5 hover:border-[var(--color-primary)] hover:shadow-sm transition-all min-h-[44px] bg-white"
                >
                  <div className="font-semibold text-[var(--text-primary)]">
                    {isAr ? svc.name_ar : svc.name_en}
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full bg-[var(--color-neutral-100)] px-2.5 py-0.5 text-xs text-[var(--color-neutral-600)]">
                      {svc.duration_minutes} {isAr ? 'دقيقة' : 'min'}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[var(--color-primary-50)] px-2.5 py-0.5 text-xs text-[var(--color-primary)] font-medium">
                      {formatPrice(svc.price_aed)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Choose Coach ── */}
      {step === 2 && (
        <div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline mb-4 min-h-[44px]"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {isAr ? 'تغيير الخدمة' : 'Change service'}
          </button>

          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            {isAr ? 'اختر الكوتش' : 'Choose a Coach'}
          </h2>

          {coachesLoading ? (
            /* UX-Pro: progressive-loading — skeleton cards for coach list */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-busy="true" aria-label={isAr ? 'جاري تحميل الكوتشز' : 'Loading coaches'}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-[var(--color-neutral-100)] p-4 bg-white animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-neutral-100)] flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-4 bg-[var(--color-neutral-100)] rounded w-3/4 mb-1.5" />
                      <div className="h-3 bg-[var(--color-neutral-100)] rounded w-1/2" />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="h-5 bg-[var(--color-neutral-100)] rounded-full w-16" />
                    <div className="h-5 bg-[var(--color-neutral-100)] rounded-full w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : coaches.length === 0 ? (
            <p className="text-center py-8 text-[var(--color-neutral-500)]">
              {isAr ? 'لا يوجد كوتشز متاحون' : 'No coaches available'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {coaches.map(coach => (
                <button
                  key={coach.id}
                  type="button"
                  onClick={() => handleSelectCoach(coach)}
                  className="text-start rounded-2xl border border-[var(--color-neutral-200)] p-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all min-h-[44px] bg-white"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-neutral-100)] overflow-hidden flex-shrink-0">
                      {coach.photo_url ? (
                        // UX-Pro: alt-text — descriptive alt text with coach name
                        <img
                          src={coach.photo_url}
                          alt={isAr ? coach.title_ar : coach.title_en}
                          className="w-full h-full object-cover object-[center_15%]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--color-neutral-400)] font-medium text-lg">
                          {(isAr ? coach.title_ar : coach.title_en)?.[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">
                        {isAr ? coach.title_ar : coach.title_en}
                      </div>
                      {coach.coach_level && (
                        <span className="text-xs text-[var(--color-neutral-500)]">{coach.coach_level}</span>
                      )}
                    </div>
                  </div>

                  {coach.specialties && coach.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {coach.specialties.slice(0, 3).map(s => (
                        <span
                          key={s}
                          className="rounded-full bg-[var(--color-neutral-100)] px-2 py-0.5 text-xs text-[var(--color-neutral-600)]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Pick Time ── */}
      {step === 3 && (
        <div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline mb-4 min-h-[44px]"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {isAr ? 'تغيير الكوتش' : 'Change coach'}
          </button>

          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            {isAr ? 'اختر الموعد' : 'Pick a Time'}
          </h2>

          {holdError && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {holdError}
            </div>
          )}

          <WeekCalendar
            slots={slots}
            loading={slotsLoading}
            timezone={timezone}
            locale={locale}
            onSelect={handleSelectSlot}
            isMobile={isMobile}
          />
        </div>
      )}

      {/* ── Step 4: Confirm & Pay ── */}
      {step === 4 && selectedService && selectedCoach && selectedSlot && (
        <div>
          <button
            type="button"
            onClick={() => setStep(3)}
            className="flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline mb-4 min-h-[44px]"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {isAr ? 'تغيير الموعد' : 'Change time'}
          </button>

          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            {isAr ? 'تأكيد الحجز' : 'Confirm Booking'}
          </h2>

          {/* Hold countdown */}
          {heldUntil && remaining > 0 && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700 flex items-center justify-between">
              <span>{isAr ? 'محجوز مؤقتًا لمدة:' : 'Slot held for:'}</span>
              <span className="font-mono font-semibold">{countdownLabel}</span>
            </div>
          )}
          {heldUntil && remaining === 0 && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {isAr ? 'انتهت مدة الحجز المؤقت — اختر موعدًا جديدًا' : 'Hold expired — please select a new time'}
            </div>
          )}

          {/* Summary card */}
          <div className="rounded-2xl border border-[var(--color-neutral-200)] bg-white p-5 space-y-3 mb-5">
            <SummaryRow
              label={isAr ? 'الخدمة' : 'Service'}
              value={isAr ? selectedService.name_ar : selectedService.name_en}
            />
            <SummaryRow
              label={isAr ? 'الكوتش' : 'Coach'}
              value={isAr ? selectedCoach.title_ar : selectedCoach.title_en}
            />
            <SummaryRow
              label={isAr ? 'التاريخ' : 'Date'}
              value={new Date(selectedSlot.date).toLocaleDateString(
                isAr ? 'ar-SA' : 'en-US',
                { weekday: 'long', month: 'long', day: 'numeric' }
              )}
            />
            <SummaryRow
              label={isAr ? 'الوقت' : 'Time'}
              value={`${formatTime12(selectedSlot.start_time, locale)} — ${formatTime12(selectedSlot.end_time, locale)}`}
            />
            <SummaryRow
              label={isAr ? 'المدة' : 'Duration'}
              value={`${selectedService.duration_minutes} ${isAr ? 'دقيقة' : 'min'}`}
            />
            <div className="border-t border-[var(--color-neutral-200)] pt-3 flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)]">{isAr ? 'المبلغ' : 'Total'}</span>
              <span className="text-xl font-bold text-[var(--color-primary)]">
                {formatPrice(selectedService.price_aed)}
              </span>
            </div>
          </div>

          {/* Payment method note */}
          {selectedService.price_aed !== null && selectedService.price_aed > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wide">
                {isAr ? 'طرق الدفع' : 'Payment via'}
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-xs font-medium">
                  Stripe
                </span>
                {showTabby && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-xs font-medium">
                    Tabby {isAr ? '(تقسيط)' : '(pay later)'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* UX-Pro: submit-feedback + error-recovery — confirm error with retry */}
          {confirmError && (
            <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {confirmError}
            </div>
          )}

          {!user ? (
            <div className="text-center py-4">
              <p className="text-[var(--color-neutral-600)] mb-3 text-sm">
                {isAr ? 'يرجى تسجيل الدخول لإتمام الحجز' : 'Sign in to complete your booking'}
              </p>
              <a
                href={`/${locale}/auth/login?redirect=/${locale}/coaching/book`}
                className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] text-white font-semibold px-6 py-3 min-h-[44px] hover:opacity-90 transition-opacity"
              >
                {isAr ? 'تسجيل الدخول' : 'Sign In'}
              </a>
            </div>
          ) : (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => { setConfirmError(null); handleConfirm(); }}
              disabled={confirming || (heldUntil !== null && remaining === 0)}
            >
              {confirming
                ? (isAr ? 'جاري الحجز...' : 'Processing...')
                : selectedService.price_aed === 0
                ? (isAr ? 'تأكيد الحجز' : 'Confirm Booking')
                : (isAr ? 'المتابعة للدفع' : 'Proceed to Payment')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Exported wrapper — Suspense required because BookingFlowInner calls useSearchParams
export function BookingFlow({ locale }: { locale: string }) {
  return (
    <Suspense fallback={null}>
      <BookingFlowInner locale={locale} />
    </Suspense>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[var(--color-neutral-500)]">{label}</span>
      <span className="text-sm font-medium text-[var(--text-primary)] text-end">{value}</span>
    </div>
  );
}
