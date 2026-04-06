'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Calendar, Clock, User, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Booking {
  id: string;
  status: string;
  start_time: string;
  end_time: string;
  service_name_en: string;
  service_name_ar: string;
  duration_minutes: number;
  price_aed: number | null;
  coach_name_en: string | null;
  coach_name_ar: string | null;
  coach_photo: string | null;
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(iso: string, locale: string) {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  if (locale === 'ar') return `${h}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function generateICS(booking: Booking, locale: string): string {
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('.000', '');
  const serviceName = locale === 'ar' ? booking.service_name_ar : booking.service_name_en;
  const coachName = locale === 'ar' ? booking.coach_name_ar : booking.coach_name_en;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kun Academy//Coaching//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${serviceName}${coachName ? ` — ${coachName}` : ''}`,
    `DESCRIPTION:Kun Academy Coaching Session\\nID: ${booking.id}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

function SuccessPageInner({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('booking_id') || searchParams.get('payment_id');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) { setLoading(false); return; }
    fetch(`/api/bookings/${bookingId}`)
      .then(r => r.json())
      .then(data => {
        if (data.booking) setBooking(data.booking);
        else setError(data.error || 'Booking not found');
      })
      .catch(() => setError('Failed to load booking'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  function downloadICS() {
    if (!booking) return;
    const blob = new Blob([generateICS(booking, locale)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `booking-${booking.id}.ics`; a.click();
    URL.revokeObjectURL(url);
  }

  function googleCalendarUrl() {
    if (!booking) return '#';
    const title = encodeURIComponent(locale === 'ar' ? booking.service_name_ar : booking.service_name_en);
    const start = new Date(booking.start_time).toISOString().replace(/[-:]/g, '').replace('.000', '');
    const end = new Date(booking.end_time).toISOString().replace(/[-:]/g, '').replace('.000', '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]" aria-busy="true">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || (!bookingId && !loading)) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          {isAr ? 'تعذّر تحميل تفاصيل الحجز' : 'Could not load booking details'}
        </h1>
        <p className="text-sm text-[var(--color-neutral-500)] mb-6">
          {isAr
            ? 'قد يكون الحجز منتهيًا أو الرابط غير صحيح.'
            : 'The booking may be expired or the link is invalid.'}
        </p>
        <Link
          href={`/${locale}/portal/student/bookings`}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] text-white font-semibold px-6 py-3 min-h-[44px] hover:opacity-90 transition-opacity"
        >
          {isAr ? 'عرض حجوزاتي' : 'View My Bookings'}
        </Link>
      </div>
    );
  }

  const coachName = isAr ? booking?.coach_name_ar : booking?.coach_name_en;
  const serviceName = isAr ? booking?.service_name_ar : booking?.service_name_en;
  const isPaid = booking && booking.price_aed && booking.price_aed > 0;

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-center" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Checkmark animation */}
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="w-20 h-20 rounded-full bg-green-100" style={{ animation: 'ping-once 0.6s ease-out' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600" style={{ animation: 'pop-in 0.4s 0.2s both cubic-bezier(.175,.885,.32,1.275)' }} />
        </div>
      </div>

      <style>{`
        @keyframes ping-once { 0% { transform: scale(0.5); opacity: 0; } 70% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pop-in { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
        {isAr ? 'تم تأكيد الحجز!' : 'Booking Confirmed!'}
      </h1>
      <p className="text-[var(--color-neutral-500)] text-sm mb-8">
        {isPaid
          ? (isAr ? 'تم استلام دفعتك وتأكيد الجلسة.' : 'Your payment was received and session is confirmed.')
          : (isAr ? 'تم تأكيد جلستك المجانية.' : 'Your free session has been confirmed.')}
      </p>

      {/* Booking detail card */}
      {booking && (
        <div className="rounded-2xl border border-[var(--color-neutral-200)] bg-white p-5 text-start space-y-4 mb-6 shadow-sm">
          {coachName && (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--color-neutral-100)] overflow-hidden flex-shrink-0">
                {booking.coach_photo ? (
                  <img src={booking.coach_photo} alt={coachName} className="w-full h-full object-cover object-[center_15%]" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--color-neutral-400)] font-semibold text-lg">
                    {coachName[0]}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-[var(--color-neutral-400)] uppercase tracking-wide mb-0.5">
                  {isAr ? 'الكوتش' : 'Coach'}
                </p>
                <p className="font-semibold text-[var(--text-primary)]">{coachName}</p>
              </div>
            </div>
          )}

          <div className="border-t border-[var(--color-neutral-100)]" />

          <div className="flex items-start gap-3">
            <User className="w-4 h-4 text-[var(--color-neutral-400)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-[var(--color-neutral-400)]">{isAr ? 'الخدمة' : 'Service'}</p>
              <p className="font-medium text-[var(--text-primary)] text-sm">{serviceName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-[var(--color-neutral-400)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-[var(--color-neutral-400)]">{isAr ? 'التاريخ' : 'Date'}</p>
              <p className="font-medium text-[var(--text-primary)] text-sm">{formatDate(booking.start_time, locale)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-[var(--color-neutral-400)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-[var(--color-neutral-400)]">{isAr ? 'الوقت' : 'Time'}</p>
              <p className="font-medium text-[var(--text-primary)] text-sm">
                {formatTime(booking.start_time, locale)}
                {booking.duration_minutes ? ` · ${booking.duration_minutes} ${isAr ? 'دقيقة' : 'min'}` : ''}
              </p>
            </div>
          </div>

          {isPaid && (
            <>
              <div className="border-t border-[var(--color-neutral-100)]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {isAr ? 'المبلغ المدفوع' : 'Amount Paid'}
                </span>
                <span className="text-lg font-bold text-[var(--color-primary)]">
                  {((booking.price_aed ?? 0) / 100).toFixed(0)} AED
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Calendar buttons */}
      {booking && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <button
            type="button"
            onClick={downloadICS}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors min-h-[44px]"
          >
            <Calendar className="w-4 h-4" />
            {isAr ? 'أضف إلى التقويم' : 'Add to Calendar (.ics)'}
          </button>
          <a
            href={googleCalendarUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors min-h-[44px]"
          >
            <Calendar className="w-4 h-4" />
            Google Calendar
          </a>
        </div>
      )}

      {/* Navigation links */}
      <div className="flex flex-col gap-2">
        <Link
          href={`/${locale}/portal/student/bookings`}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] text-white font-semibold px-6 py-3 min-h-[44px] hover:opacity-90 transition-opacity"
        >
          {isAr ? 'عرض جميع حجوزاتي' : 'View My Bookings'}
        </Link>
        <Link
          href={`/${locale}/coaching/book`}
          className="inline-flex items-center justify-center rounded-xl border border-[var(--color-neutral-200)] px-6 py-3 text-sm font-medium text-[var(--color-neutral-600)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors min-h-[44px]"
        >
          {isAr ? 'احجز جلسة أخرى' : 'Book Another Session'}
        </Link>
      </div>
    </div>
  );
}

export default function BookingSuccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState('ar');
  useEffect(() => { params.then(p => setLocale(p.locale)); }, [params]);
  return (
    <main>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
      }>
        <SuccessPageInner locale={locale} />
      </Suspense>
    </main>
  );
}
