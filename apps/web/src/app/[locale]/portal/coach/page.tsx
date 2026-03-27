// @ts-nocheck — TODO: fix Supabase client types (types regenerated, needs 'as any' removal)
'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { useParams } from 'next/navigation';

interface CoachStats { upcomingBookings: number; totalSessions: number; pendingDrafts: number; totalEarnings: number }

export default function CoachDashboard() {
  const { locale } = useParams<{ locale: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const [stats, setStats] = useState<CoachStats>({ upcomingBookings: 0, totalSessions: 0, pendingDrafts: 0, totalEarnings: 0 });
  const [instructor, setInstructor] = useState<{ id: string; title_ar: string; title_en: string; is_visible: boolean } | null>(null);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient() as any;

    supabase.from('instructors').select('id, title_ar, title_en, is_visible').eq('profile_id', user.id).single().then(({ data }) => {
      if (!data) return;
      setInstructor(data);

      supabase.from('providers').select('id').eq('profile_id', user.id).single().then(async ({ data: provider }) => {
        if (!provider) return;
        const [upcoming, total, drafts, bookingsData] = await Promise.all([
          supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id).eq('status', 'confirmed'),
          supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id).eq('status', 'completed'),
          supabase.from('instructor_drafts').select('id', { count: 'exact', head: true }).eq('instructor_id', data.id).eq('status', 'pending'),
          supabase.from('bookings').select('id, booking_date, start_time, status, service:services(name_ar, name_en), customer:profiles(full_name_ar, full_name_en, email)')
            .eq('provider_id', provider.id).order('booking_date', { ascending: false }).limit(5),
        ]);
        setStats({
          upcomingBookings: upcoming.count ?? 0,
          totalSessions: total.count ?? 0,
          pendingDrafts: drafts.count ?? 0,
          totalEarnings: 0, // Wave D
        });
        setRecentBookings(bookingsData.data || []);
      });
    });
  }, [user]);

  if (authLoading) return <Section><p className="text-center py-12">{isAr ? 'جاري التحميل...' : 'Loading...'}</p></Section>;

  if (!instructor) {
    return (
      <main><Section variant="white">
        <div className="text-center py-12">
          <p className="text-[var(--color-neutral-500)]">{isAr ? 'ليس لديك ملف كوتش.' : 'You don\'t have a coach profile.'}</p>
          <a href={`/${locale}/portal/coach/onboarding`} className="inline-block mt-3 text-[var(--color-primary)] font-medium hover:underline">
            {isAr ? 'إكمال التسجيل' : 'Complete registration'}
          </a>
        </div>
      </Section></main>
    );
  }

  const cards = [
    { label: isAr ? 'جلسات قادمة' : 'Upcoming', value: stats.upcomingBookings },
    { label: isAr ? 'إجمالي الجلسات' : 'Total Sessions', value: stats.totalSessions },
    { label: isAr ? 'تعديلات معلّقة' : 'Pending Edits', value: stats.pendingDrafts },
  ];

  const quickLinks = [
    { href: `/${locale}/portal/coach/schedule`, labelAr: 'إدارة المواعيد', labelEn: 'Manage Schedule' },
    { href: `/${locale}/portal/coach/profile`, labelAr: 'تعديل الملف', labelEn: 'Edit Profile' },
    { href: `/${locale}/portal/coach/bookings`, labelAr: 'جميع الحجوزات', labelEn: 'All Bookings' },
    { href: `/${locale}/portal/coach/onboarding`, labelAr: 'معالج الإعداد', labelEn: 'Setup Wizard' },
  ];

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1}>{isAr ? `لوحة الكوتش` : `Coach Dashboard`}</Heading>
            <p className="text-[var(--color-neutral-600)]">{isAr ? instructor.title_ar : instructor.title_en}</p>
            {!instructor.is_visible && (
              <span className="inline-block mt-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs">
                {isAr ? 'الملف قيد المراجعة' : 'Profile under review'}
              </span>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={signOut}>
            {isAr ? 'خروج' : 'Sign Out'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {cards.map((c) => (
            <div key={c.label} className="rounded-lg border border-[var(--color-neutral-200)] p-6 text-center">
              <div className="text-3xl font-bold text-[var(--color-primary)]">{c.value}</div>
              <div className="text-sm text-[var(--color-neutral-600)] mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {quickLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg border border-[var(--color-neutral-200)] p-4 text-center text-sm font-medium hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition min-h-[44px] flex items-center justify-center"
            >
              {isAr ? link.labelAr : link.labelEn}
            </a>
          ))}
        </div>

        {/* Recent bookings */}
        {recentBookings.length > 0 && (
          <div>
            <h2 className="text-lg font-medium mb-3">{isAr ? 'آخر الحجوزات' : 'Recent Bookings'}</h2>
            <div className="space-y-2">
              {recentBookings.map((b: any) => (
                <div key={b.id} className="flex items-center gap-4 rounded-lg border border-[var(--color-neutral-200)] p-3 text-sm">
                  <div className="flex-1">
                    <span className="font-medium">{b.customer?.full_name_en || b.customer?.email || '-'}</span>
                    <span className="text-[var(--color-neutral-400)] mx-2">—</span>
                    <span className="text-[var(--color-neutral-600)]">{isAr ? b.service?.name_ar : b.service?.name_en}</span>
                  </div>
                  <span className="text-[var(--color-neutral-500)]">{b.booking_date} {b.start_time}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    b.status === 'confirmed' ? 'bg-green-100 text-green-700'
                    : b.status === 'completed' ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700'
                  }`}>{b.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>
    </main>
  );
}
