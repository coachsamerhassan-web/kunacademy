'use client';

import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use } from 'react';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string;
  coach?: { profile: { full_name_ar: string | null; full_name_en: string | null } | null } | null;
  service?: { name_ar: string; name_en: string; duration_minutes: number };
}

const statusLabels: Record<string, { ar: string; en: string; cls: string }> = {
  pending: { ar: 'بانتظار التأكيد', en: 'Pending', cls: 'bg-yellow-100 text-yellow-800' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed', cls: 'bg-blue-100 text-blue-800' },
  completed: { ar: 'مكتمل', en: 'Completed', cls: 'bg-green-100 text-green-800' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', cls: 'bg-red-100 text-red-800' },
  'no-show': { ar: 'لم يحضر', en: 'No-Show', cls: 'bg-gray-100 text-gray-600' },
};

export default function BookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    supabase
      .from('bookings')
      .select(`
        id, start_time, end_time, status, notes,
        coach:providers(profile:profiles(full_name_ar, full_name_en)),
        service:services(name_ar, name_en, duration_minutes)
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
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
    setCancelling(null);
  }

  function canCancel(booking: Booking): boolean {
    if (booking.status !== 'pending' && booking.status !== 'confirmed') return false;
    // Allow cancellation at least 24h before the session
    const sessionTime = new Date(booking.start_time);
    const now = new Date();
    const hoursUntil = (sessionTime.getTime() - now.getTime()) / (1000 * 60 * 60);
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

            return (
              <Card key={b.id} accent className={`p-5 ${isPast && b.status !== 'completed' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
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
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
                      {isAr ? s.ar : s.en}
                    </span>
                    {canCancel(b) && (
                      <button
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
          <p className="text-sm text-[var(--color-neutral-500)] mt-2 mb-6">{isAr ? 'احجز جلسة كوتشينج مع أحد كوتشز كُن' : 'Book a coaching session with one of Kun\'s coaches'}</p>
          <a href={`/${locale}/coaching/book`} className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white min-h-[44px]">
            {isAr ? 'احجز جلسة' : 'Book a Session'}
          </a>
        </div>
      )}
    </Section>
  );
}
