'use client';

/**
 * /[locale]/coach/ratings — My Ratings
 *
 * Coach-facing self-service view of their own ratings.
 *
 * Sections:
 *   1. Summary hero — avg_stars, star visual, count_total, count_public,
 *      distribution bar chart (5 rows)
 *   2. Public reviews list — paginated, expandable text, localized date
 *   3. Privacy note — explains private ratings behaviour
 *
 * Auth: mirrors other /coach/* pages — useAuth() + guards behind session cookie.
 *       API routes themselves enforce coach_id == caller, so no client-side
 *       role redirect is required (same pattern as earnings/referrals/credits).
 *
 * Data: GET /api/coaches/[id]/ratings/summary + GET /api/coaches/[id]/ratings
 *
 * Wave S9 — 2026-04-20
 */

import { useState, useEffect, use, useCallback } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RatingSummary {
  avg_stars: number | null;
  count_total: number;
  count_public: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

interface PublicRating {
  id: string;
  stars: number;
  review_text: string | null;
  created_at: string;
  client_name_display: string;
}

interface RatingsListResponse {
  ratings: PublicRating[];
  total_public: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(
      locale === 'ar' ? 'ar-AE' : 'en-GB',
      { day: 'numeric', month: 'short', year: 'numeric' }
    );
  } catch {
    return iso;
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Inline star display — replicates StarDisplay from admin/coach-ratings */
function StarDisplay({ stars, size = 'sm' }: { stars: number; size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${stars} stars`}
      title={`${stars}/5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          className={`${dim} ${n <= stars ? 'text-amber-400' : 'text-[var(--color-neutral-200)]'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

/** Expandable review text — truncates at 200 chars */
function ExpandableText({ text, isAr }: { text: string; isAr: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 200;
  const needsTruncation = text.length > limit;

  return (
    <span className="text-[var(--color-neutral-700)]">
      {expanded || !needsTruncation ? text : text.slice(0, limit) + '…'}
      {needsTruncation && (
        <>
          {' '}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[var(--color-primary)] hover:underline focus:outline-none"
          >
            {expanded ? (isAr ? 'أقل' : 'less') : (isAr ? 'المزيد' : 'more')}
          </button>
        </>
      )}
    </span>
  );
}

/** Distribution bar chart — 5 horizontal bars */
function DistributionBars({
  distribution,
  countTotal,
  isAr,
}: {
  distribution: RatingSummary['distribution'];
  countTotal: number;
  isAr: boolean;
}) {
  const stars: Array<'5' | '4' | '3' | '2' | '1'> = ['5', '4', '3', '2', '1'];

  return (
    <div className="space-y-2 w-full">
      {stars.map((s) => {
        const count = distribution[s] ?? 0;
        const pct = countTotal > 0 ? Math.round((count / countTotal) * 100) : 0;
        return (
          <div key={s} className="flex items-center gap-3 text-sm">
            <span className="w-10 shrink-0 text-[var(--color-neutral-500)] text-end">
              {s} ★
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-[var(--color-neutral-100)] overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{ width: `${pct}%` }}
                aria-label={`${pct}%`}
              />
            </div>
            <span className="w-20 shrink-0 text-xs text-[var(--color-neutral-500)]">
              {isAr
                ? `${count.toLocaleString('ar-EG')} (${pct}%)`
                : `${count.toLocaleString()} (${pct}%)`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CoachRatingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();

  // ── Summary state
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // ── List state
  const [ratings, setRatings] = useState<PublicRating[]>([]);
  const [totalPublic, setTotalPublic] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // ── Fetch summary
  useEffect(() => {
    if (!user) {
      setSummaryLoading(false);
      return;
    }
    setSummaryLoading(true);
    setSummaryError(null);
    fetch(`/api/coaches/${user.id}/ratings/summary`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<RatingSummary>;
      })
      .then((data) => {
        setSummary(data);
      })
      .catch((err: unknown) => {
        setSummaryError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setSummaryLoading(false));
  }, [user]);

  // ── Fetch paginated list
  const fetchList = useCallback(
    async (targetPage: number) => {
      if (!user) {
        setListLoading(false);
        return;
      }
      setListLoading(true);
      setListError(null);
      try {
        const qs = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(PAGE_SIZE),
        });
        const res = await fetch(`/api/coaches/${user.id}/ratings?${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as RatingsListResponse;
        setRatings(data.ratings ?? []);
        setTotalPublic(data.total_public ?? 0);
      } catch (err: unknown) {
        setListError(err instanceof Error ? err.message : String(err));
      } finally {
        setListLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    fetchList(page);
  }, [fetchList, page]);

  // ── Derived
  const lastPage = Math.max(1, Math.ceil(totalPublic / PAGE_SIZE));
  const avgDisplay =
    summary?.avg_stars != null
      ? Number(summary.avg_stars).toFixed(1)
      : '—';
  const avgStarsRounded = summary?.avg_stars != null ? Math.round(summary.avg_stars) : 0;

  // ── Loading state (first load — summary not yet resolved)
  if (summaryLoading && !summary) {
    return (
      <Section variant="white">
        <p className="text-center py-12 text-[var(--color-neutral-500)]">
          {isAr ? 'جارٍ التحميل...' : 'Loading...'}
        </p>
      </Section>
    );
  }

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        {/* ── Header */}
        <div className="flex items-center justify-between mb-8">
          <Heading level={1} className={isAr ? 'font-[var(--font-arabic-heading)]' : ''}>
            {isAr ? 'تقييماتي' : 'My Ratings'}
          </Heading>
          <a
            href={`/${locale}/coach/earnings`}
            className="text-[var(--color-primary)] text-sm hover:underline"
          >
            {isAr ? '← أرباحي' : '← My Earnings'}
          </a>
        </div>

        {/* ── Section 1 — Summary hero */}
        {summaryError ? (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
            {isAr ? `خطأ في تحميل الملخص: ${summaryError}` : `Error loading summary: ${summaryError}`}
          </div>
        ) : (
          <div className="mb-8 rounded-2xl border border-[var(--color-neutral-100)] bg-white shadow-sm p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-8">

              {/* Left: big avg + stars */}
              <div className="flex flex-col items-center justify-center gap-2 md:min-w-[180px]">
                <p
                  className="text-6xl font-extrabold text-[var(--color-primary)]"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {avgDisplay}
                </p>
                <p className="text-sm text-[var(--color-neutral-400)]">{isAr ? '/ ٥' : '/ 5'}</p>
                <StarDisplay stars={avgStarsRounded} size="lg" />
                <div className="flex gap-6 mt-3 text-center">
                  <div>
                    <p
                      className="text-2xl font-bold text-[var(--color-neutral-800)]"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {isAr
                        ? (summary?.count_total ?? 0).toLocaleString('ar-EG')
                        : (summary?.count_total ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
                      {isAr ? 'إجمالي التقييمات' : 'Total Ratings'}
                    </p>
                  </div>
                  <div className="w-px bg-[var(--color-neutral-200)]" aria-hidden="true" />
                  <div>
                    <p
                      className="text-2xl font-bold text-[var(--color-neutral-800)]"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {isAr
                        ? (summary?.count_public ?? 0).toLocaleString('ar-EG')
                        : (summary?.count_public ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
                      {isAr ? 'تقييمات عامة' : 'Public Ratings'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px bg-[var(--color-neutral-200)]" aria-hidden="true" />
              <div className="md:hidden h-px bg-[var(--color-neutral-200)]" aria-hidden="true" />

              {/* Right: distribution bars */}
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-sm font-medium text-[var(--color-neutral-600)] mb-3">
                  {isAr ? 'توزيع التقييمات' : 'Rating Distribution'}
                </p>
                {summary ? (
                  <DistributionBars
                    distribution={summary.distribution}
                    countTotal={summary.count_total}
                    isAr={isAr}
                  />
                ) : (
                  <p className="text-sm text-[var(--color-neutral-400)]">
                    {isAr ? 'لا تتوفر بيانات' : 'No data available'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Section 2 — Public reviews list */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">
            {isAr ? 'آراء العملاء العامة' : 'Public Client Reviews'}
          </h2>

          {listError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
              {isAr ? `خطأ: ${listError}` : `Error: ${listError}`}
            </div>
          ) : listLoading ? (
            <div className="rounded-lg border border-[var(--color-neutral-200)] px-4 py-12 text-center text-sm text-[var(--color-neutral-400)]">
              {isAr ? 'جارٍ التحميل...' : 'Loading...'}
            </div>
          ) : ratings.length === 0 ? (
            <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-surface-dim)] px-6 py-12 text-center">
              <p className="text-sm text-[var(--color-neutral-500)]">
                {isAr
                  ? 'لم تتلقَّ تقييمات عامة بعد — ستظهر هنا بعد أول تقييم.'
                  : "You haven't received public reviews yet — they'll show here once clients rate you."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-neutral-100)] rounded-2xl border border-[var(--color-neutral-100)] overflow-hidden">
              {ratings.map((r, i) => (
                <div
                  key={r.id}
                  className={`px-5 py-4 ${i % 2 === 1 ? 'bg-[var(--color-neutral-50)]' : 'bg-white'}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-[var(--color-neutral-800)]">
                        {r.client_name_display}
                      </span>
                      <StarDisplay stars={r.stars} />
                    </div>
                    <time
                      dateTime={r.created_at}
                      className="text-xs text-[var(--color-neutral-400)] whitespace-nowrap"
                    >
                      {formatDate(r.created_at, locale)}
                    </time>
                  </div>
                  {r.review_text ? (
                    <p className="text-sm leading-relaxed">
                      <ExpandableText text={r.review_text} isAr={isAr} />
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--color-neutral-400)] italic">
                      {isAr ? 'لا يوجد نص للمراجعة' : 'No review text'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPublic > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="min-h-[44px] px-5 py-2 rounded-md border border-[var(--color-neutral-300)] text-sm font-medium text-[var(--color-neutral-700)] disabled:opacity-40 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition"
              >
                {isAr ? 'السابق' : 'Previous'}
              </button>

              <span className="text-sm text-[var(--color-neutral-500)]">
                {isAr
                  ? `${totalPublic.toLocaleString('ar-EG')} تقييم · صفحة ${page} من ${lastPage}`
                  : `${totalPublic.toLocaleString()} reviews · page ${page} of ${lastPage}`}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page >= lastPage}
                className="min-h-[44px] px-5 py-2 rounded-md border border-[var(--color-neutral-300)] text-sm font-medium text-[var(--color-neutral-700)] disabled:opacity-40 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition"
              >
                {isAr ? 'التالي' : 'Next'}
              </button>
            </div>
          )}
        </div>

        {/* ── Section 3 — Privacy note */}
        <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-surface-dim)] px-5 py-4 text-sm text-[var(--color-neutral-500)]">
          <p>
            {isAr
              ? 'التقييمات الخاصة لا تظهر هنا (ولا على صفحتك العامة). تُستخدم فقط في حساب المتوسط الرقمي.'
              : "Private ratings are not shown here (or on your public profile). They're used only to compute the numeric average."}
          </p>
        </div>
      </Section>
    </main>
  );
}
