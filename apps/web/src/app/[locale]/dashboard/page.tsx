'use client';

import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { Button } from '@kunacademy/ui/button';
import { useState, useEffect, use } from 'react';

interface DashboardStats {
  enrollments: number;
  bookings: number;
  certificates: number;
}

export default function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({ enrollments: 0, bookings: 0, certificates: 0 });
  const [profile, setProfile] = useState<{ full_name_ar: string | null; full_name_en: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        if (data.profile) setProfile(data.profile);
        setStats({
          enrollments: data.enrollments ?? 0,
          bookings: data.bookings ?? 0,
          certificates: data.certificates ?? 0,
        });
      });
  }, [user]);

  const name = profile ? (isAr ? profile.full_name_ar : profile.full_name_en) : '';
  const greeting = isAr
    ? `مرحبًا${name ? ` ${name}` : ''}`
    : `Welcome${name ? `, ${name}` : ''}`;

  const statCards = [
    {
      labelAr: 'دوراتي', labelEn: 'My Courses',
      value: stats.enrollments,
      href: `/${locale}/dashboard/courses`,
      iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    },
    {
      labelAr: 'الحجوزات', labelEn: 'Bookings',
      value: stats.bookings,
      href: `/${locale}/dashboard/bookings`,
      iconPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
    {
      labelAr: 'الشهادات', labelEn: 'Certificates',
      value: stats.certificates,
      href: `/${locale}/dashboard/certificates`,
      iconPath: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    },
  ];

  return (
    <Section variant="white">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {greeting}
          </h1>
          <p className="text-sm text-[var(--color-neutral-500)] mt-2">{user?.email}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={signOut}>
          {isAr ? 'تسجيل الخروج' : 'Sign Out'}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => (
          <a key={card.href} href={card.href} className="group">
            <Card accent className="p-5 transition-all duration-200 group-hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={card.iconPath} />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{card.value}</p>
                  <p className="text-sm text-[var(--color-neutral-500)]">{isAr ? card.labelAr : card.labelEn}</p>
                </div>
              </div>
            </Card>
          </a>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">
        {isAr ? 'إجراءات سريعة' : 'Quick Actions'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href={`/${locale}/coaching/book`}
          className="flex items-center gap-3 rounded-xl border border-[var(--color-neutral-200)] bg-white p-4 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-all min-h-[56px]"
        >
          <svg className="w-5 h-5 text-[var(--color-accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {isAr ? 'احجز جلسة كوتشينج' : 'Book a Coaching Session'}
          </span>
        </a>
        <a
          href={`/${locale}/academy/certifications/stce`}
          className="flex items-center gap-3 rounded-xl border border-[var(--color-neutral-200)] bg-white p-4 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-all min-h-[56px]"
        >
          <svg className="w-5 h-5 text-[var(--color-accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {isAr ? 'تصفّح البرامج' : 'Browse Programs'}
          </span>
        </a>
        <a
          href={`/${locale}/blog`}
          className="flex items-center gap-3 rounded-xl border border-[var(--color-neutral-200)] bg-white p-4 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-all min-h-[56px]"
        >
          <svg className="w-5 h-5 text-[var(--color-accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {isAr ? 'اقرأ المدوّنة' : 'Read the Blog'}
          </span>
        </a>
        <a
          href={`/${locale}/dashboard/profile`}
          className="flex items-center gap-3 rounded-xl border border-[var(--color-neutral-200)] bg-white p-4 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-all min-h-[56px]"
        >
          <svg className="w-5 h-5 text-[var(--color-accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {isAr ? 'ملفي الشخصي' : 'My Profile'}
          </span>
        </a>
      </div>
    </Section>
  );
}
