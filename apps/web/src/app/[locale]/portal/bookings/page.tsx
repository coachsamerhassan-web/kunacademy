// @ts-nocheck — TODO: fix Supabase client types (types regenerated, needs 'as any' removal)
'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams } from 'next/navigation';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  service: { name_ar: string; name_en: string } | null;
  provider: { bio_ar: string; bio_en: string; profile: { full_name_ar: string; full_name_en: string } | null } | null;
}

export default function MyBookings() {
  const { locale } = useParams<{ locale: string }>();
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient() as any;
    supabase
      .from('bookings')
      .select('id, start_time, end_time, status, notes, service:services(name_ar, name_en), provider:providers(bio_ar, bio_en, profile:profiles(full_name_ar, full_name_en))')
      .eq('customer_id', user.id)
      .order('start_time', { ascending: false })
      .then(({ data }) => {
        setBookings((data as unknown as Booking[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  if (authLoading || loading) return <Section><p className="text-center py-12">{isAr ? 'جاري التحميل...' : 'Loading...'}</p></Section>;

  const statusLabels: Record<string, { ar: string; en: string; color: string }> = {
    pending: { ar: 'بانتظار التأكيد', en: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    confirmed: { ar: 'مؤكّد', en: 'Confirmed', color: 'bg-green-100 text-green-800' },
    completed: { ar: 'مكتمل', en: 'Completed', color: 'bg-blue-100 text-blue-800' },
    cancelled: { ar: 'ملغي', en: 'Cancelled', color: 'bg-red-100 text-red-800' },
  };

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between">
          <Heading level={1}>{isAr ? 'حجوزاتي' : 'My Bookings'}</Heading>
          <a href={`/${locale}/book`} className="text-[var(--color-primary)] font-medium hover:underline">
            {isAr ? '+ حجز جديد' : '+ New Booking'}
          </a>
        </div>
        {bookings.length === 0 ? (
          <div className="mt-8 text-center py-12 rounded-lg border-2 border-dashed border-[var(--color-neutral-200)]">
            <p className="text-[var(--color-neutral-500)]">{isAr ? 'لا توجد حجوزات' : 'No bookings yet'}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {bookings.map((b) => {
              const st = statusLabels[b.status] ?? statusLabels.pending;
              const date = new Date(b.start_time);
              return (
                <div key={b.id} className="rounded-lg border border-[var(--color-neutral-200)] p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{b.service ? (isAr ? b.service.name_ar : b.service.name_en) : (isAr ? 'جلسة كوتشينج' : 'Coaching Session')}</p>
                    <p className="text-sm text-[var(--color-neutral-500)] mt-1">
                      {date.toLocaleDateString(isAr ? 'ar-AE' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      {' — '}
                      {date.toLocaleTimeString(isAr ? 'ar-AE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${st.color}`}>
                    {isAr ? st.ar : st.en}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </main>
  );
}
