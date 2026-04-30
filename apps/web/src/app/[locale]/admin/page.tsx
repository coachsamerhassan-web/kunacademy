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

interface QuickAccessTile {
  id: string;
  label_ar: string;
  label_en: string;
  href: string;
  icon_path: string;
  color_token: string;
  sort_order: number;
  is_active: boolean;
}

interface PlatformMetrics {
  top_courses: Array<{ course_id: string; title_ar: string; title_en: string; enrollments: number }>;
  new_signups_daily: Array<{ day: string; count: number }>;
  outstanding_payments: { total_count: number; by_currency: Array<{ currency: string; count: number; amount: number }> };
  active_coaches_daily: Array<{ day: string; count: number }>;
}

/**
 * Admin landing page — Stitch×Kun shell, 2026-04-30
 *
 * Layout adopts Stitch's dashboard pattern (header + 4 stat cards +
 * quick-access tile grid + 4-KPI panel + recent bookings list) but uses
 * Kun's brand palette throughout. Cream-latte canvas with white cards.
 *
 * Phase 1d-B (2026-04-30): quick-access tiles now fetched from
 * /api/admin/quick-access (DB-backed, admin-managed via /admin/quick-access).
 *
 * Phase 1d-C (2026-04-30): the placeholder PlatformChart is replaced by a
 * 4-KPI panel reading real time-series and aggregates from
 * /api/admin/platform-metrics (Samer's picks: top courses, new signups,
 * outstanding payments, active coaches).
 */
export default function AdminDashboardPage() {
  const { locale } = useParams<{ locale: string }>();
  const isAr = locale === 'ar';
  const { user } = useAuth();

  const [stats, setStats] = useState<Stats>({ students: 0, coaches: 0, enrollments: 0, bookings: 0, payments: 0 });
  const [bookingsList, setBookingsList] = useState<RecentBooking[]>([]);
  const [tiles, setTiles] = useState<QuickAccessTile[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [tilesLoading, setTilesLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);

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

  useEffect(() => {
    fetch('/api/admin/quick-access', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.items) {
          const active = (data.items as QuickAccessTile[])
            .filter((t) => t.is_active)
            .sort((a, b) => a.sort_order - b.sort_order);
          setTiles(active);
        }
        setTilesLoading(false);
      })
      .catch(() => setTilesLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/admin/platform-metrics', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setMetrics(data as PlatformMetrics);
        setMetricsLoading(false);
      })
      .catch(() => setMetricsLoading(false));
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

  // Quick-access tiles are now DB-backed (admin_quick_access table).
  // Admins manage at /admin/quick-access. See Phase 1d-B (2026-04-30).

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
        {/* Quick-access tile grid — DB-backed, admin-managed at /admin/quick-access */}
        <section className="kun-shell-card p-5 md:p-6" aria-label={isAr ? 'الوصول السريع' : 'Quick access'}>
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-base md:text-lg font-bold text-[var(--text-primary)]">
              {isAr ? 'الوصول السريع' : 'Quick Access'}
            </h2>
            <a
              href={`/${locale}/admin/quick-access`}
              className="text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-600)]"
              aria-label={isAr ? 'إدارة الوصول السريع' : 'Manage quick access'}
            >
              {isAr ? 'إدارة' : 'Manage'} →
            </a>
          </div>
          {tilesLoading ? (
            <div className="py-8 text-center text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : tiles.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'لا توجد اختصارات.' : 'No tiles configured.'}{' '}
              <a href={`/${locale}/admin/quick-access`} className="text-[var(--color-accent)] underline">
                {isAr ? 'أضف الأول' : 'Add the first one'}
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {tiles.map((tile) => {
                const href = tile.href.startsWith('http') ? tile.href : `/${locale}${tile.href}`;
                return (
                  <a
                    key={tile.id}
                    href={href}
                    className="rounded-xl p-3 md:p-4 flex flex-col items-center justify-center text-center aspect-square cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-sm"
                    style={{ background: `var(--shell-tile-${tile.color_token}-bg)` }}
                  >
                    <div
                      className="w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-white mb-2 shadow-sm"
                      style={{ background: `var(--shell-tile-${tile.color_token}-icon)` }}
                      aria-hidden="true"
                    >
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={tile.icon_path} />
                      </svg>
                    </div>
                    <div className="font-bold text-[var(--text-primary)] text-xs md:text-sm leading-tight">
                      {isAr ? tile.label_ar : tile.label_en}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* Main column: 4-KPI panel + recent bookings */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* 4-KPI panel — Phase 1d-C real-data wiring (top courses + signups + outstanding payments + active coaches) */}
          <section className="kun-shell-card p-5 md:p-6" aria-label={isAr ? 'أداء المنصة' : 'Platform performance'}>
            <div className="mb-4">
              <h2 className="text-base md:text-lg font-bold text-[var(--text-primary)]">
                {isAr ? 'أداء المنصة' : 'Platform performance'}
              </h2>
              <p className="text-xs md:text-sm text-[var(--color-neutral-600)] mt-1">
                {isAr ? 'مؤشرات حقيقية — آخر 30 يوماً' : 'Live indicators — last 30 days'}
              </p>
            </div>
            <PlatformKPIPanel isAr={isAr} loading={metricsLoading} metrics={metrics} />
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

function PlatformKPIPanel({
  isAr,
  loading,
  metrics,
}: {
  isAr: boolean;
  loading: boolean;
  metrics: PlatformMetrics | null;
}) {
  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-neutral-500)]">
        {isAr ? 'جاري تحميل المؤشرات...' : 'Loading metrics...'}
      </div>
    );
  }
  if (!metrics) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-neutral-500)]">
        {isAr ? 'تعذّر تحميل المؤشرات' : 'Could not load metrics'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
      {/* E. Top 5 courses by enrollments this month */}
      <div className="bg-[var(--color-neutral-50)] rounded-xl p-4">
        <div className="text-xs font-semibold text-[var(--color-neutral-700)] uppercase tracking-wide mb-2">
          {isAr ? 'أعلى 5 دورات (الشهر)' : 'Top 5 Courses (this month)'}
        </div>
        {metrics.top_courses.length === 0 ? (
          <div className="text-sm text-[var(--color-neutral-500)] py-4">
            {isAr ? 'لا توجد تسجيلات هذا الشهر' : 'No enrollments this month'}
          </div>
        ) : (
          <ul className="space-y-2">
            {metrics.top_courses.map((c) => {
              const max = metrics.top_courses[0]?.enrollments || 1;
              const pct = Math.round((c.enrollments / max) * 100);
              return (
                <li key={c.course_id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="truncate text-[var(--text-primary)]">
                      {(isAr ? c.title_ar : c.title_en) || (isAr ? '(بدون عنوان)' : '(untitled)')}
                    </span>
                    <span className="font-bold text-[var(--color-accent)] tabular-nums shrink-0">
                      {c.enrollments.toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-neutral-100)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* D. Outstanding payments — count + amount by currency */}
      <div className="bg-[var(--color-neutral-50)] rounded-xl p-4">
        <div className="text-xs font-semibold text-[var(--color-neutral-700)] uppercase tracking-wide mb-2">
          {isAr ? 'مدفوعات قيد الانتظار' : 'Outstanding Payments'}
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">
            {metrics.outstanding_payments.total_count.toLocaleString(isAr ? 'ar-EG' : 'en-US')}
          </span>
          <span className="text-sm text-[var(--color-neutral-600)]">
            {isAr ? 'دفعة' : 'pending'}
          </span>
        </div>
        {metrics.outstanding_payments.by_currency.length === 0 ? (
          <div className="text-sm text-[var(--color-neutral-500)]">
            {isAr ? 'لا شيء مستحق' : 'Nothing pending'}
          </div>
        ) : (
          <ul className="space-y-1 text-sm">
            {metrics.outstanding_payments.by_currency.map((c) => (
              <li key={c.currency} className="flex items-baseline justify-between gap-2">
                <span className="text-[var(--color-neutral-700)] uppercase font-medium">{c.currency}</span>
                <span className="tabular-nums text-[var(--text-primary)] font-semibold">
                  {c.amount.toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* B. New signups daily — sparkline */}
      <KPISparkline
        isAr={isAr}
        labelAr="تسجيلات جديدة (30 يوم)"
        labelEn="New Signups (30d)"
        data={metrics.new_signups_daily}
        color="var(--color-primary)"
      />

      {/* C. Active coaches daily — sparkline */}
      <KPISparkline
        isAr={isAr}
        labelAr="كوتشز نشطون (30 يوم)"
        labelEn="Active Coaches (30d)"
        data={metrics.active_coaches_daily}
        color="var(--color-accent)"
      />
    </div>
  );
}

function KPISparkline({
  isAr,
  labelAr,
  labelEn,
  data,
  color,
}: {
  isAr: boolean;
  labelAr: string;
  labelEn: string;
  data: Array<{ day: string; count: number }>;
  color: string;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const max = data.reduce((m, d) => Math.max(m, d.count), 1);
  const last = data[data.length - 1]?.count ?? 0;

  // Build sparkline points; if data is empty, show a flat line at zero.
  const points = data.length > 0
    ? data.map((d, i) => {
        const x = (i / Math.max(1, data.length - 1)) * 100;
        const y = 100 - (d.count / max) * 100;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ')
    : '0,100 100,100';

  return (
    <div className="bg-[var(--color-neutral-50)] rounded-xl p-4">
      <div className="text-xs font-semibold text-[var(--color-neutral-700)] uppercase tracking-wide mb-2">
        {isAr ? labelAr : labelEn}
      </div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div>
          <div className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">
            {total.toLocaleString(isAr ? 'ar-EG' : 'en-US')}
          </div>
          <div className="text-xs text-[var(--color-neutral-600)]">
            {isAr ? `اليوم: ${last.toLocaleString('ar-EG')}` : `Today: ${last.toLocaleString('en-US')}`}
          </div>
        </div>
      </div>
      <svg viewBox="0 0 100 30" className="w-full h-12" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          transform="scale(1, 0.3)"
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
