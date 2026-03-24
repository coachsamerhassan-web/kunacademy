// @ts-nocheck
'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams } from 'next/navigation';

interface CoachStats { upcomingBookings: number; totalSessions: number; pendingDrafts: number }

export default function CoachDashboard() {
  const { locale } = useParams<{ locale: string }>();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<CoachStats>({ upcomingBookings: 0, totalSessions: 0, pendingDrafts: 0 });
  const [instructor, setInstructor] = useState<{ id: string; title_ar: string; title_en: string } | null>(null);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient() as any;

    supabase.from('instructors').select('id, title_ar, title_en').eq('profile_id', user.id).single().then(({ data }) => {
      if (!data) return;
      setInstructor(data);

      // Get provider for bookings
      supabase.from('providers').select('id').eq('profile_id', user.id).single().then(async ({ data: provider }) => {
        if (!provider) return;
        const [upcoming, total, drafts] = await Promise.all([
          supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id).eq('status', 'confirmed'),
          supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id).eq('status', 'completed'),
          supabase.from('instructor_drafts').select('id', { count: 'exact', head: true }).eq('instructor_id', data.id).eq('status', 'pending'),
        ]);
        setStats({ upcomingBookings: upcoming.count ?? 0, totalSessions: total.count ?? 0, pendingDrafts: drafts.count ?? 0 });
      });
    });
  }, [user]);

  if (authLoading) return <Section><p className="text-center py-12">{isAr ? 'جاري التحميل...' : 'Loading...'}</p></Section>;

  if (!instructor) {
    return (
      <main><Section variant="white">
        <div className="text-center py-12">
          <p className="text-[var(--color-neutral-500)]">{isAr ? 'ليس لديك ملف كوتش. تواصل مع الإدارة.' : 'You don\'t have a coach profile. Contact admin.'}</p>
        </div>
      </Section></main>
    );
  }

  const cards = [
    { label: isAr ? 'جلسات قادمة' : 'Upcoming Sessions', value: stats.upcomingBookings, href: `/${locale}/portal/coach/bookings` },
    { label: isAr ? 'إجمالي الجلسات' : 'Total Sessions', value: stats.totalSessions, href: `/${locale}/portal/coach/bookings` },
    { label: isAr ? 'تعديلات معلّقة' : 'Pending Edits', value: stats.pendingDrafts, href: `/${locale}/portal/coach/profile` },
  ];

  return (
    <main>
      <Section variant="white">
        <Heading level={1}>{isAr ? `لوحة الكوتش — ${instructor.title_ar}` : `Coach Dashboard — ${instructor.title_en}`}</Heading>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((c) => (
            <a key={c.href} href={c.href} className="block rounded-lg border border-[var(--color-neutral-200)] p-6 hover:shadow-md transition-shadow text-center">
              <div className="text-3xl font-bold text-[var(--color-primary)]">{c.value}</div>
              <div className="text-sm text-[var(--color-neutral-600)] mt-1">{c.label}</div>
            </a>
          ))}
        </div>
      </Section>
    </main>
  );
}
