'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams } from 'next/navigation';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
type TabFilter = 'upcoming' | 'past' | 'all';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string | null;
  notes: string | null;
  meeting_url: string | null;
  service: { name_ar: string; name_en: string; duration_minutes: number } | null;
  customer: { full_name_ar: string | null; full_name_en: string | null; email: string } | null;
}

const statusConfig: Record<BookingStatus, { labelAr: string; labelEn: string; className: string }> = {
  pending: { labelAr: 'بانتظار التأكيد', labelEn: 'Pending', className: 'bg-amber-100 text-amber-700' },
  confirmed: { labelAr: 'مؤكّد', labelEn: 'Confirmed', className: 'bg-green-100 text-green-700' },
  completed: { labelAr: 'مكتمل', labelEn: 'Completed', className: 'bg-blue-100 text-blue-700' },
  cancelled: { labelAr: 'ملغي', labelEn: 'Cancelled', className: 'bg-red-100 text-red-700' },
  no_show: { labelAr: 'لم يحضر', labelEn: 'No Show', className: 'bg-gray-100 text-gray-700' },
};

export default function CoachBookingsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, loading: authLoading } = useAuth();
  const isAr = locale === 'ar';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>('upcoming');

  useEffect(() => {
    if (!user) return;

    fetch('/api/coach/bookings')
      .then((r) => r.json())
      .then((data) => {
        setBookings((data.bookings || []) as Booking[]);
        setLoading(false);
      });
  }, [user]);

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
          <a href={`/${locale}/auth/login?redirect=/${locale}/portal/coach/bookings`} className="mt-3 inline-block text-[var(--color-primary)] font-medium hover:underline">
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
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4 hover:border-[var(--color-primary)]/30 transition-colors"
                >
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
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${s.className}`}>
                      {isAr ? s.labelAr : s.labelEn}
                    </span>
                    {b.meeting_url && b.status === 'confirmed' && (
                      <a
                        href={b.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary-600)] transition-colors min-h-[36px]"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 10l5-3v10l-5-3z" />
                          <rect x="1" y="5" width="14" height="14" rx="2" />
                        </svg>
                        {isAr ? 'انضم' : 'Join'}
                      </a>
                    )}
                  </div>
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
