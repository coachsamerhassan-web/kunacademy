'use client';

/**
 * /[locale]/admin/coach-ratings
 *
 * Paginated audit view of all coach ratings (public + private) for admins.
 *
 * Auth: role in ['admin', 'super_admin'] — mirrors audit-log pattern.
 *       useEffect guard redirects to /dashboard on insufficient role.
 *
 * Features:
 *   - URL-driven filters: coach_id (UUID), privacy (public|private), page
 *   - Table: coach name, client name, stars, privacy badge, review_text (expandable),
 *     rated_at (localized date), actions (empty — future wave)
 *   - Pagination: N rows · page X of Y, Prev/Next
 *   - Bilingual AR/EN, RTL/LTR direction
 *
 * Wave S9 — 2026-04-20
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RatingRow {
  id: string;
  coach_id: string;
  user_id: string;
  booking_id: string | null;
  stars: number;
  review_text: string | null;
  privacy: 'public' | 'private';
  is_published: boolean;
  rated_at: string;
  created_at: string;
  // Resolved names (fetched via enrichment)
  coach_name?: string | null;
  client_name?: string | null;
}

interface RatingsResponse {
  ratings: RatingRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 20;

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

function StarDisplay({ stars }: { stars: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${stars} stars`} title={`${stars}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          className={`w-3.5 h-3.5 ${n <= stars ? 'text-amber-400' : 'text-[var(--color-neutral-200)]'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ms-1 text-xs text-[var(--color-neutral-500)]">{stars}/5</span>
    </span>
  );
}

function PrivacyBadge({ privacy, isAr }: { privacy: 'public' | 'private'; isAr: boolean }) {
  const isPublic = privacy === 'public';
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
        isPublic
          ? 'bg-green-100 text-green-700'
          : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
      }`}
    >
      {isPublic
        ? (isAr ? 'عامة' : 'Public')
        : (isAr ? 'خاصة' : 'Private')}
    </span>
  );
}

function ExpandableText({ text, isAr }: { text: string; isAr: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 120;
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
            {expanded
              ? (isAr ? 'أقل' : 'less')
              : (isAr ? 'المزيد' : 'more')}
          </button>
        </>
      )}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CoachRatingsAdminPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isAr = locale === 'ar';

  // ── State ──────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state — initialised from URL
  const [coachIdInput, setCoachIdInput] = useState(searchParams.get('coach_id') ?? '');
  const [privacyInput, setPrivacyInput] = useState(searchParams.get('privacy') ?? '');
  const [coachIdError, setCoachIdError] = useState('');

  const currentPage = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  // ── Auth guard — same pattern as audit-log/page.tsx ───────────────────────
  useEffect(() => {
    if (authLoading) return;
    const role = (profile as { role?: string } | null)?.role;
    if (!user || (role !== 'admin' && role !== 'super_admin')) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [user, profile, authLoading, locale, router]);

  // ── URL helpers ────────────────────────────────────────────────────────────
  const buildUrl = useCallback(
    (overrides: { coach_id?: string; privacy?: string; page?: number }) => {
      const params = new URLSearchParams();
      const coachId = overrides.coach_id ?? searchParams.get('coach_id') ?? '';
      const privacy = overrides.privacy ?? searchParams.get('privacy') ?? '';
      const page = overrides.page ?? currentPage;
      if (coachId) params.set('coach_id', coachId);
      if (privacy) params.set('privacy', privacy);
      if (page > 1) params.set('page', String(page));
      const qs = params.toString();
      return `${pathname}${qs ? '?' + qs : ''}`;
    },
    [searchParams, currentPage, pathname]
  );

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const coachId = searchParams.get('coach_id') ?? '';
      const privacy = searchParams.get('privacy') ?? '';
      if (coachId) params.set('coach_id', coachId);
      if (privacy) params.set('privacy', privacy);
      params.set('page', String(currentPage));
      params.set('pageSize', String(PAGE_SIZE));

      const res = await fetch(`/api/admin/coach-ratings?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RatingsResponse;
      setRows(data.ratings ?? []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [searchParams, currentPage]);

  useEffect(() => {
    if (authLoading) return;
    fetchData();
  }, [authLoading, fetchData]);

  // ── Filter apply / clear ───────────────────────────────────────────────────
  function applyFilters() {
    if (coachIdInput && !UUID_RE.test(coachIdInput)) {
      setCoachIdError(isAr ? 'أدخل UUID صالحاً' : 'Enter a valid UUID');
      return;
    }
    setCoachIdError('');
    router.push(
      buildUrl({ coach_id: coachIdInput, privacy: privacyInput, page: 1 })
    );
  }

  function clearFilters() {
    setCoachIdInput('');
    setPrivacyInput('');
    setCoachIdError('');
    router.push(pathname);
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <Section>
        <p className="text-center py-16 text-[var(--color-neutral-500)]">
          {isAr ? 'جارٍ التحميل...' : 'Loading...'}
        </p>
      </Section>
    );
  }

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <Heading level={1}>
            {isAr ? 'تقييمات المدربين' : 'Coach Ratings'}
          </Heading>
          <Link
            href={`/${locale}/admin`}
            className="text-sm text-[var(--color-primary)] hover:underline min-h-[44px] inline-flex items-center"
          >
            {isAr ? '← لوحة الإدارة' : '← Admin Dashboard'}
          </Link>
        </div>

        {/* ── Filter bar ── */}
        <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-surface-dim)] p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Coach ID filter */}
            <div>
              <label
                htmlFor="cr-coach-id"
                className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1"
              >
                {isAr ? 'معرّف الكوتش (UUID)' : 'Coach ID (UUID)'}
              </label>
              <input
                id="cr-coach-id"
                type="text"
                value={coachIdInput}
                onChange={(e) => {
                  setCoachIdInput(e.target.value);
                  setCoachIdError('');
                }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className={`w-full min-h-[44px] rounded-md border px-3 py-2 text-sm font-mono placeholder:text-[var(--color-neutral-400)] bg-white hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition ${
                  coachIdError
                    ? 'border-red-400 text-red-700'
                    : 'border-[var(--color-neutral-300)] text-[var(--color-neutral-700)]'
                }`}
              />
              {coachIdError && (
                <p className="mt-1 text-xs text-red-600">{coachIdError}</p>
              )}
            </div>

            {/* Privacy filter */}
            <div>
              <label
                htmlFor="cr-privacy"
                className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1"
              >
                {isAr ? 'الخصوصية' : 'Privacy'}
              </label>
              <select
                id="cr-privacy"
                value={privacyInput}
                onChange={(e) => setPrivacyInput(e.target.value)}
                className="w-full min-h-[44px] rounded-md border border-[var(--color-neutral-300)] bg-white px-3 py-2 text-sm text-[var(--color-neutral-700)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition"
              >
                <option value="">{isAr ? 'الكل' : 'All'}</option>
                <option value="public">{isAr ? 'عامة' : 'Public'}</option>
                <option value="private">{isAr ? 'خاصة' : 'Private'}</option>
              </select>
            </div>
          </div>

          {/* Actions row */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={applyFilters}
              className="min-h-[44px] px-6 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition"
            >
              {isAr ? 'تطبيق الفلاتر' : 'Apply Filters'}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-[44px] px-4 py-2 rounded-md border border-[var(--color-neutral-300)] text-sm text-[var(--color-neutral-600)] hover:border-[var(--color-neutral-400)] transition"
            >
              {isAr ? 'مسح الكل' : 'Clear all'}
            </button>
            <span className="text-xs text-[var(--color-neutral-400)] ms-auto">
              {isAr
                ? `${total.toLocaleString('ar-EG')} تقييم`
                : `${total.toLocaleString()} rating${total !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* ── Table / States ── */}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
            {isAr ? `خطأ: ${error}` : `Error: ${error}`}
          </div>
        ) : loading ? (
          <div className="rounded-lg border border-[var(--color-neutral-200)] px-4 py-16 text-center text-sm text-[var(--color-neutral-400)]">
            {isAr ? 'جارٍ التحميل...' : 'Loading...'}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-[var(--color-neutral-200)] px-4 py-16 text-center text-sm text-[var(--color-neutral-400)]">
            {isAr ? 'لا توجد تقييمات بعد' : 'No ratings yet'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-neutral-200)]">
            <table className="w-full text-sm border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b border-[var(--color-neutral-200)] bg-[var(--color-surface-dim)] text-[var(--color-neutral-500)] text-xs uppercase tracking-wide">
                  <th className="py-3 px-4 text-start font-medium">
                    {isAr ? 'الكوتش' : 'Coach'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium">
                    {isAr ? 'العميل' : 'Client'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium w-32">
                    {isAr ? 'التقييم' : 'Stars'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium w-28">
                    {isAr ? 'الخصوصية' : 'Privacy'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium">
                    {isAr ? 'نص المراجعة' : 'Review'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium w-36">
                    {isAr ? 'تاريخ التقييم' : 'Rated At'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium w-28">
                    {isAr ? 'إجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-surface-low)] transition"
                  >
                    {/* Coach */}
                    <td className="py-3 px-4 align-top">
                      <span
                        className="font-mono text-xs text-[var(--color-neutral-600)]"
                        title={row.coach_id}
                      >
                        {row.coach_id.slice(0, 8)}…
                      </span>
                    </td>

                    {/* Client */}
                    <td className="py-3 px-4 align-top">
                      <span
                        className="font-mono text-xs text-[var(--color-neutral-600)]"
                        title={row.user_id}
                      >
                        {row.user_id.slice(0, 8)}…
                      </span>
                    </td>

                    {/* Stars */}
                    <td className="py-3 px-4 align-top">
                      <StarDisplay stars={row.stars} />
                    </td>

                    {/* Privacy */}
                    <td className="py-3 px-4 align-top">
                      <PrivacyBadge privacy={row.privacy} isAr={isAr} />
                    </td>

                    {/* Review text */}
                    <td className="py-3 px-4 align-top max-w-xs">
                      {row.review_text ? (
                        <ExpandableText text={row.review_text} isAr={isAr} />
                      ) : (
                        <span className="text-xs text-[var(--color-neutral-400)] italic">
                          {isAr ? 'لا يوجد نص' : 'No text'}
                        </span>
                      )}
                    </td>

                    {/* Rated At */}
                    <td className="py-3 px-4 align-top">
                      <time
                        dateTime={row.rated_at}
                        className="text-xs text-[var(--color-neutral-500)] whitespace-nowrap"
                      >
                        {formatDate(row.rated_at, locale)}
                      </time>
                    </td>

                    {/* Actions — empty, future wave */}
                    <td className="py-3 px-4 align-top">
                      <span className="text-xs text-[var(--color-neutral-300)]">—</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
            <button
              type="button"
              onClick={() =>
                router.push(buildUrl({ page: currentPage - 1 }))
              }
              disabled={currentPage <= 1}
              className="min-h-[44px] px-5 py-2 rounded-md border border-[var(--color-neutral-300)] text-sm font-medium text-[var(--color-neutral-700)] disabled:opacity-40 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition"
            >
              {isAr ? 'السابق' : 'Previous'}
            </button>

            <span className="text-sm text-[var(--color-neutral-500)]">
              {isAr
                ? `${total.toLocaleString('ar-EG')} تقييم · صفحة ${currentPage} من ${lastPage}`
                : `${total.toLocaleString()} rows · page ${currentPage} of ${lastPage}`}
            </span>

            <button
              type="button"
              onClick={() =>
                router.push(buildUrl({ page: currentPage + 1 }))
              }
              disabled={currentPage >= lastPage}
              className="min-h-[44px] px-5 py-2 rounded-md border border-[var(--color-neutral-300)] text-sm font-medium text-[var(--color-neutral-700)] disabled:opacity-40 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition"
            >
              {isAr ? 'التالي' : 'Next'}
            </button>
          </div>
        )}
      </Section>
    </main>
  );
}
