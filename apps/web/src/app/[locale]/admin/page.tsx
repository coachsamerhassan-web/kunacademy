'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';

interface Stats {
  students: number;
  coaches: number;
  enrollments: number;
  bookings: number;
  payments: number;
}

interface RecentBooking {
  id: string;
  start_time: string | null;
  status: string | null;
  customer: { full_name_ar: string | null; full_name_en: string | null; email: string | null } | null;
  service: { name_ar: string | null; name_en: string | null } | null;
}

/**
 * Admin landing page — Stitch×Kun shell, 2026-04-30
 *
 * Layout adopts Stitch's dashboard pattern (header + 4 stat cards +
 * quick-access tile grid + sales chart + recent bookings list) but uses
 * Kun's brand palette throughout. Cream-latte canvas with white cards.
 */
export default function AdminDashboardPage() {
  const { locale } = useParams<{ locale: string }>();
  const isAr = locale === 'ar';
  const { user } = useAuth();

  const [stats, setStats] = useState<Stats>({ students: 0, coaches: 0, enrollments: 0, bookings: 0, payments: 0 });
  const [bookingsList, setBookingsList] = useState<RecentBooking[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setStats({
            students: data.students ?? 0,
            coaches: data.coaches ?? 0,
            enrollments: data.enrollments ?? 0,
            bookings: data.bookings ?? 0,
            payments: data.payments ?? 0,
          });
        }
        setStatsLoading(false);
      })
      .catch(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/admin/bookings-list')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.bookings) setBookingsList((data.bookings as RecentBooking[]).slice(0, 5));
        setBookingsLoading(false);
      })
      .catch(() => setBookingsLoading(false));
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    if (isAr) {
      try {
        return new Intl.DateTimeFormat('ar-EG-u-ca-gregory', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(d);
      } catch {
        return d.toLocaleDateString('ar');
      }
    }
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  }, [isAr]);

  // 4 top metric cards — real data from /api/admin/stats
  const statCards = [
    {
      labelAr: 'الطلاب',
      labelEn: 'Students',
      value: stats.students,
      sparkColor: 'var(--shell-spark-primary)',
      sparkType: 'curve' as const,
    },
    {
      labelAr: 'الكوتشز',
      labelEn: 'Coaches',
      value: stats.coaches,
      sparkColor: 'var(--shell-spark-accent)',
      sparkType: 'curve' as const,
    },
    {
      labelAr: 'الحجوزات',
      labelEn: 'Bookings',
      value: stats.bookings,
      sparkColor: 'var(--shell-spark-secondary)',
      sparkType: 'bars' as const,
    },
    {
      labelAr: 'المدفوعات',
      labelEn: 'Payments',
      value: stats.payments,
      sparkColor: 'var(--shell-spark-success)',
      sparkType: 'progress' as const,
      progressPct: stats.enrollments > 0 ? Math.min(100, Math.round((stats.payments / stats.enrollments) * 100)) : 0,
    },
  ];

  // 9 quick-access tiles — Kun secondary palette tints
  const tiles = [
    {
      href: `/${locale}/admin/instructors`,
      labelAr: 'الكوتشز',
      labelEn: 'Coaches',
      hintAr: `${stats.coaches} كوتش`,
      hintEn: `${stats.coaches} coaches`,
      bg: 'var(--shell-tile-mandarin-bg)',
      iconBg: 'var(--shell-tile-mandarin-icon)',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
    {
      href: `/${locale}/admin/orders`,
      labelAr: 'الطلبات',
      labelEn: 'Orders',
      hintAr: `${stats.payments} طلب`,
      hintEn: `${stats.payments} orders`,
      bg: 'var(--shell-tile-sky-bg)',
      iconBg: 'var(--shell-tile-sky-icon)',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    },
    {
      href: `/${locale}/admin/courses`,
      labelAr: 'الدورات',
      labelEn: 'Courses',
      hintAr: `${stats.enrollments} تسجيل`,
      hintEn: `${stats.enrollments} enrollments`,
      bg: 'var(--shell-tile-primary-bg)',
      iconBg: 'var(--shell-tile-primary-icon)',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    },
    {
      href: `/${locale}/admin/products`,
      labelAr: 'المنتجات',
      labelEn: 'Products',
      hintAr: '',
      hintEn: '',
      bg: 'var(--shell-tile-charleston-bg)',
      iconBg: 'var(--shell-tile-charleston-icon)',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    },
    {
      href: `/${locale}/admin/testimonials`,
      labelAr: 'التوصيات',
      labelEn: 'Testimonials',
      hintAr: '',
      hintEn: '',
      bg: 'var(--shell-tile-rose-bg)',
      iconBg: 'var(--shell-tile-rose-icon)',
      icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
    },
    {
      href: `/${locale}/admin/content`,
      labelAr: 'المحتوى',
      labelEn: 'Content',
      hintAr: '',
      hintEn: '',
      bg: 'var(--shell-tile-deepsky-bg)',
      iconBg: 'var(--shell-tile-deepsky-icon)',
      icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    },
    {
      href: `/${locale}/admin/community`,
      labelAr: 'المجتمع',
      labelEn: 'Community',
      hintAr: '',
      hintEn: '',
      bg: 'var(--shell-tile-sand-bg)',
      iconBg: 'var(--shell-tile-sand-icon)',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    },
    {
      href: `/${locale}/admin/email-outbox`,
      labelAr: 'رسائل فاشلة',
      labelEn: 'Email Outbox',
      hintAr: '',
      hintEn: '',
      bg: 'var(--shell-tile-mist-bg)',
      iconBg: 'var(--shell-tile-mist-icon)',
      icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    },
    {
      href: `/${locale}/admin/lessons`,
      labelAr: 'مكتبة الدروس',
      labelEn: 'Lesson Library',
      hintAr: '',
      hintEn: '',
      bg: 'var(--shell-tile-violet-bg)',
      iconBg: 'var(--shell-tile-violet-icon)',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    },
  ];

  // Greeting wired so dashboard mirrors sidebar greeting once user resolves
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || '';

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Page header */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-2">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'لوحة القيادة' : 'Dashboard'}
          </h1>
          {displayName && (
            <p className="text-sm text-[var(--color-neutral-600)] mt-1">
              {isAr ? `أهلاً ${displayName}` : `Welcome back, ${displayName}`}
            </p>
          )}
        </div>
        <button
          type="button"
          className="kun-shell-card flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-neutral-700)] hover:text-[var(--text-primary)] transition-colors self-start sm:self-auto"
          aria-label={isAr ? 'تاريخ اليوم' : 'Today'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{today}</span>
        </button>
      </header>

      {/* Top metric cards */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
        aria-label={isAr ? 'مؤشرات رئيسية' : 'Top metrics'}
      >
        {statCards.map((card) => (
          <article
            key={card.labelEn}
            className="kun-shell-card p-5 md:p-6 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <h3 className="text-xs md:text-sm font-semibold text-[var(--color-neutral-600)] mb-1 truncate">
                {isAr ? card.labelAr : card.labelEn}
              </h3>
              <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
                {statsLoading ? '…' : card.value.toLocaleString(isAr ? 'ar-EG' : 'en-US')}
              </p>
            </div>
            <div className="w-20 h-12 shrink-0" aria-hidden="true">
              {card.sparkType === 'curve' && <SparkCurve color={card.sparkColor} />}
              {card.sparkType === 'bars' && <SparkBars color={card.sparkColor} />}
              {card.sparkType === 'progress' && (
                <SparkProgress color={card.sparkColor} pct={'progressPct' in card ? card.progressPct : 0} />
              )}
            </div>
          </article>
        ))}
      </section>

      {/* Lower grid: quick-access (1 col) + main column (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Quick-access tile grid */}
        <section className="kun-shell-card p-5 md:p-6" aria-label={isAr ? 'الوصول السريع' : 'Quick access'}>
          <h2 className="text-base md:text-lg font-bold text-[var(--text-primary)] mb-4 md:mb-6">
            {isAr ? 'الوصول السريع' : 'Quick Access'}
          </h2>
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {tiles.map((tile) => (
              <a
                key={tile.href}
                href={tile.href}
                className="rounded-xl p-3 md:p-4 flex flex-col items-center justify-center text-center aspect-square cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-sm"
                style={{ background: tile.bg }}
              >
                <div
                  className="w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-white mb-2 shadow-sm"
                  style={{ background: tile.iconBg }}
                  aria-hidden="true"
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={tile.icon} />
                  </svg>
                </div>
                <div className="font-bold text-[var(--text-primary)] text-xs md:text-sm leading-tight">
                  {isAr ? tile.labelAr : tile.labelEn}
                </div>
                {(isAr ? tile.hintAr : tile.hintEn) && (
                  <div className="text-[10px] text-[var(--color-neutral-600)] mt-0.5">
                    {isAr ? tile.hintAr : tile.hintEn}
                  </div>
                )}
              </a>
            ))}
          </div>
        </section>

        {/* Main column: sales chart + recent bookings */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Sales / activity chart — placeholder area, real chart wires later */}
          <section className="kun-shell-card p-5 md:p-6" aria-label={isAr ? 'أداء المبيعات' : 'Sales performance'}>
            <div className="mb-4">
              <h2 className="text-base md:text-lg font-bold text-[var(--text-primary)]">
                {isAr ? 'أداء المنصة' : 'Platform performance'}
              </h2>
              <p className="text-xs md:text-sm text-[var(--color-neutral-600)] mt-1">
                {isAr ? 'نظرة عامة على نشاط الشهر' : 'Month-to-date activity overview'}
              </p>
            </div>
            <PlatformChart isAr={isAr} />
            {/* TODO: wire real time-series data once /api/admin/stats-timeseries lands */}
          </section>

          {/* Recent bookings */}
          <section className="kun-shell-card p-5 md:p-6" aria-label={isAr ? 'الحجوزات الأخيرة' : 'Recent bookings'}>
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-base md:text-lg font-bold text-[var(--text-primary)]">
                {isAr ? 'الحجوزات الأخيرة' : 'Recent Bookings'}
              </h2>
              <a
                href={`/${locale}/admin/bookings`}
                className="text-xs md:text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-600)]"
              >
                {isAr ? 'عرض الكل' : 'View all'} →
              </a>
            </div>
            <RecentBookingsList
              isAr={isAr}
              loading={bookingsLoading}
              bookings={bookingsList}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-components — kept inline for clarity (admin landing only)
// ─────────────────────────────────────────────────────────────────

function SparkCurve({ color }: { color: string }) {
  return (
    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
      <defs>
        <linearGradient id={`sparkGrad-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,30 C10,30 20,10 30,20 C40,30 50,5 60,15 C70,25 80,10 100,5 L100,40 L0,40 Z"
        fill={`url(#sparkGrad-${color.replace(/[^a-z0-9]/gi, '')})`}
      />
      <path
        d="M0,30 C10,30 20,10 30,20 C40,30 50,5 60,15 C70,25 80,10 100,5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function SparkBars({ color }: { color: string }) {
  const heights = [4, 8, 6, 10, 7];
  return (
    <div className="w-full h-full flex items-end gap-1 justify-end">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-2.5 rounded-t"
          style={{ height: `${h * 4}px`, background: color, opacity: 0.7 + i * 0.05 }}
        />
      ))}
    </div>
  );
}

function SparkProgress({ color, pct }: { color: string; pct: number }) {
  const strokePct = Math.max(0, Math.min(100, pct));
  return (
    <div className="w-12 h-12 mx-auto">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="var(--color-neutral-100)"
          strokeWidth="4"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke={color}
          strokeDasharray={`${strokePct}, 100`}
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function PlatformChart({ isAr }: { isAr: boolean }) {
  const yLabels = ['800', '600', '400', '200', '0'];
  const xLabelsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
  const xLabelsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو'];
  return (
    <div className="h-48 md:h-64 relative">
      <div className="absolute inset-0 flex flex-col justify-between text-xs text-[var(--color-neutral-500)] z-0">
        {yLabels.map((l, i) => (
          <div key={i} className="border-b border-[var(--color-neutral-100)] pb-1 text-start w-8">
            {l}
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 inset-x-8 flex justify-between text-xs text-[var(--color-neutral-500)] pt-2 z-0">
        {(isAr ? xLabelsAr : xLabelsEn).map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <svg
        className="absolute inset-y-0 inset-x-8 w-[calc(100%-64px)] h-[calc(100%-24px)] z-10"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <defs>
          <linearGradient id="platformGradAccent" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="platformGradPrimary" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,60 C20,60 30,30 50,50 C70,70 80,20 100,40 L100,100 L0,100 Z"
          fill="url(#platformGradAccent)"
        />
        <path
          d="M0,60 C20,60 30,30 50,50 C70,70 80,20 100,40"
          fill="none"
          stroke="var(--color-accent)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M0,80 C20,90 40,20 60,60 C80,100 90,10 100,30 L100,100 L0,100 Z"
          fill="url(#platformGradPrimary)"
        />
        <path
          d="M0,80 C20,90 40,20 60,60 C80,100 90,10 100,30"
          fill="none"
          stroke="var(--color-primary)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function RecentBookingsList({
  isAr,
  loading,
  bookings,
}: {
  isAr: boolean;
  loading: boolean;
  bookings: RecentBooking[];
}) {
  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-neutral-500)]">
        {isAr ? 'جاري التحميل...' : 'Loading...'}
      </div>
    );
  }
  if (bookings.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-neutral-500)]">
        {isAr ? 'لا توجد حجوزات حديثة' : 'No recent bookings'}
      </div>
    );
  }
  return (
    <div className="space-y-3 md:space-y-4">
      {bookings.map((b) => {
        const customerName =
          (isAr ? b.customer?.full_name_ar : b.customer?.full_name_en) ||
          b.customer?.email ||
          (isAr ? 'عميل' : 'Customer');
        const initial = customerName.charAt(0).toUpperCase();
        const serviceName = (isAr ? b.service?.name_ar : b.service?.name_en) || '';
        const date = b.start_time ? formatDate(b.start_time, isAr) : '';
        const statusInfo = getStatusInfo(b.status, isAr);
        return (
          <div key={b.id} className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ background: 'var(--shell-sidebar-active-bg)' }}
                aria-hidden="true"
              >
                {initial}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[var(--text-primary)] text-sm truncate">{customerName}</div>
                <div className="text-xs text-[var(--color-neutral-600)] truncate">
                  {serviceName || (isAr ? 'حجز' : 'Booking')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-6 text-xs md:text-sm shrink-0">
              <span className="kun-shell-pill-active px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full kun-shell-pill-active-dot" />
                {statusInfo}
              </span>
              {date && <span className="text-[var(--color-neutral-600)]">{date}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getStatusInfo(status: string | null | undefined, isAr: boolean): string {
  const map: Record<string, { ar: string; en: string }> = {
    confirmed: { ar: 'مؤكد', en: 'Confirmed' },
    pending: { ar: 'قيد الانتظار', en: 'Pending' },
    completed: { ar: 'مكتمل', en: 'Completed' },
    cancelled: { ar: 'ملغي', en: 'Cancelled' },
  };
  const key = (status ?? '').toLowerCase();
  if (map[key]) return isAr ? map[key].ar : map[key].en;
  return status ?? (isAr ? 'حجز' : 'Booking');
}

function formatDate(iso: string, isAr: boolean): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(isAr ? 'ar-EG-u-ca-gregory' : 'en-US', {
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return '';
  }
}
