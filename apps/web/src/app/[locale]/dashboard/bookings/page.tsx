'use client';

import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use } from 'react';

const statusLabels: Record<string, { ar: string; en: string; cls: string }> = {
  pending: { ar: 'بانتظار التأكيد', en: 'Pending', cls: 'bg-yellow-100 text-yellow-800' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed', cls: 'bg-blue-100 text-blue-800' },
  completed: { ar: 'مكتمل', en: 'Completed', cls: 'bg-green-100 text-green-800' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', cls: 'bg-red-100 text-red-800' },
};

export default function BookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Array<{ id: string; start_time: string; end_time: string; status: string; notes?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    supabase
      .from('bookings')
      .select('*')
      .eq('customer_id', user.id)
      .order('start_time', { ascending: false })
      .then(({ data }: { data: any }) => {
        setBookings((data ?? []) as typeof bookings);
        setLoading(false);
      });
  }, [user]);

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
            return (
              <Card key={b.id} accent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      {new Date(b.start_time).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-sm text-[var(--color-neutral-500)] mt-1">
                      {new Date(b.start_time).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      {' — '}
                      {new Date(b.end_time).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
                    {isAr ? s.ar : s.en}
                  </span>
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
