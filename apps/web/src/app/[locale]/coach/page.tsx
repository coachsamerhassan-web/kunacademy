'use client';

import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use } from 'react';

export default function CoachDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ full_name_ar: string | null; full_name_en: string | null } | null>(null);
  const [stats, setStats] = useState({ bookings: 0, totalEarnings: 0, audioReviewPending: 0 });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch('/api/user/profile').then(r => r.ok ? r.json() : { profile: null }),
      fetch('/api/coach/dashboard').then(r => r.ok ? r.json() : null),
      // Audio-review queue count — non-blocking, 403 for non-instructors is
      // swallowed silently (card simply shows 0).
      fetch('/api/coach/audio-review/queue').then(r => r.ok ? r.json() : null),
    ]).then(([profileData, dashData, audioReviewData]) => {
      if (profileData.profile) setProfile(profileData.profile);
      setStats({
        bookings: dashData?.stats?.upcomingBookings ?? 0,
        totalEarnings: 0,
        audioReviewPending: audioReviewData?.total_pending ?? 0,
      });
    });
  }, [user]);

  const name = profile ? (isAr ? profile.full_name_ar : profile.full_name_en) : '';

  const cards = [
    { labelAr: 'الحجوزات', labelEn: 'Bookings', value: stats.bookings, href: `/${locale}/coach/bookings`, iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { labelAr: 'مراجعات الصوت', labelEn: 'Audio Reviews', value: stats.audioReviewPending, href: `/${locale}/coach/audio-review`, iconPath: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
    { labelAr: 'المواعيد', labelEn: 'Schedule', value: null, href: `/${locale}/coach/schedule`, iconPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { labelAr: 'الأرباح', labelEn: 'Earnings', value: null, href: `/${locale}/coach/earnings`, iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  return (
    <Section variant="white">
      <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-8" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
        {isAr ? `مرحبًا${name ? ` ${name}` : ''}` : `Welcome${name ? `, ${name}` : ''}`}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <a key={card.href} href={card.href} className="group">
            <Card accent className="p-5 transition-all duration-200 group-hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={card.iconPath} />
                  </svg>
                </div>
                <div>
                  {card.value !== null && <p className="text-2xl font-bold text-[var(--text-primary)]">{card.value}</p>}
                  <p className="text-sm text-[var(--color-neutral-500)]">{isAr ? card.labelAr : card.labelEn}</p>
                </div>
              </div>
            </Card>
          </a>
        ))}
      </div>

      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">{isAr ? 'إجراءات سريعة' : 'Quick Actions'}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href={`/${locale}/coach/schedule`} className="flex items-center gap-3 rounded-xl border border-[var(--color-neutral-200)] bg-white p-4 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-all min-h-[56px]">
          <svg className="w-5 h-5 text-[var(--color-accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          <span className="text-sm font-medium text-[var(--text-primary)]">{isAr ? 'إدارة المواعيد' : 'Manage Schedule'}</span>
        </a>
        <a href={`/${locale}/coach/profile`} className="flex items-center gap-3 rounded-xl border border-[var(--color-neutral-200)] bg-white p-4 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-all min-h-[56px]">
          <svg className="w-5 h-5 text-[var(--color-accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span className="text-sm font-medium text-[var(--text-primary)]">{isAr ? 'تعديل الملف الشخصي' : 'Edit Profile'}</span>
        </a>
      </div>
    </Section>
  );
}
