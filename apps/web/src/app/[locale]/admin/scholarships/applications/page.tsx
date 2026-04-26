'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { Section } from '@kunacademy/ui/section';

/**
 * /[locale]/admin/scholarships/applications — Wave E.5 admin queue.
 *
 * Lists scholarship applications with filters: status, program_family,
 * date range, search (email/name). Click-through to detail page.
 *
 * CSV export via ?format=csv on the API.
 *
 * NOTE: this page is auth-gated by the admin layout (PortalSidebar variant=admin
 * requires admin session). RLS on scholarship_application_audit_events + the
 * GET route's isAdmin() check enforce the boundary at the data layer.
 */

interface AdminQueueRow {
  id: string;
  applicant_name: string;
  applicant_email: string;
  preferred_language: 'ar' | 'en';
  program_family: string;
  program_slug: string;
  scholarship_tier: 'partial' | 'full';
  status: string;
  source: string;
  financial_snippet: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: string; ar: string; en: string }> = [
  { value: 'any', ar: 'جميع الحالات', en: 'All statuses' },
  { value: 'pending', ar: 'في الانتظار', en: 'Pending' },
  { value: 'in_review', ar: 'قيد المراجعة', en: 'In review' },
  { value: 'info_requested', ar: 'بانتظار توضيح', en: 'Info requested' },
  { value: 'approved', ar: 'موافَق عليها', en: 'Approved' },
  { value: 'allocated', ar: 'تمّ التخصيص', en: 'Allocated' },
  { value: 'disbursed', ar: 'تمّ الصرف', en: 'Disbursed' },
  { value: 'rejected', ar: 'مرفوضة', en: 'Declined' },
  { value: 'waitlisted', ar: 'قائمة الانتظار', en: 'Waitlisted' },
  { value: 'withdrawn', ar: 'مسحوبة', en: 'Withdrawn' },
];

const FAMILY_OPTIONS: ReadonlyArray<{ value: string; ar: string; en: string }> = [
  { value: 'any', ar: 'جميع البرامج', en: 'All programs' },
  { value: 'gps', ar: 'GPS', en: 'GPS' },
  { value: 'ihya', ar: 'إحياء', en: 'Ihya' },
  { value: 'wisal', ar: 'وِصال', en: 'Wisal' },
  { value: 'seeds', ar: 'بذور', en: 'Seeds' },
];

export default function AdminApplicationsQueue({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const [rows, setRows] = useState<AdminQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<string>('any');
  const [family, setFamily] = useState<string>('any');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status && status !== 'any') params.set('status', status);
    if (family && family !== 'any') params.set('program_family', family);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (search.trim()) params.set('search', search.trim());
    return params.toString();
  }, [status, family, dateFrom, dateTo, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = `/api/admin/scholarships/applications${queryString ? `?${queryString}` : ''}`;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new Error(res.status === 401 ? 'unauthorized' : 'forbidden');
          }
          throw new Error('list-failed');
        }
        return (await res.json()) as { applications: AdminQueueRow[] };
      })
      .then((data) => {
        if (cancelled) return;
        setRows(data.applications);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message || 'list-failed');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const csvHref = `/api/admin/scholarships/applications?format=csv${queryString ? `&${queryString}` : ''}`;

  function statusLabel(s: string): string {
    const found = STATUS_OPTIONS.find((o) => o.value === s);
    if (!found) return s;
    return isAr ? found.ar : found.en;
  }

  function familyLabel(f: string): string {
    const found = FAMILY_OPTIONS.find((o) => o.value === f);
    if (!found) return f;
    return isAr ? found.ar : found.en;
  }

  function statusBadgeClass(s: string): string {
    switch (s) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_review':
        return 'bg-blue-100 text-blue-800';
      case 'info_requested':
        return 'bg-purple-100 text-purple-800';
      case 'approved':
        return 'bg-emerald-100 text-emerald-800';
      case 'allocated':
        return 'bg-indigo-100 text-indigo-800';
      case 'disbursed':
        return 'bg-teal-100 text-teal-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'waitlisted':
        return 'bg-orange-100 text-orange-800';
      case 'withdrawn':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  return (
    <Section variant="white">
      <div dir={dir}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-1">
              {isAr ? 'طلبات المنح' : 'Scholarship Applications'}
            </h1>
            <p className="text-sm text-[var(--color-neutral-600)]">
              {isAr ? `${rows.length} نتيجة` : `${rows.length} results`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/${locale}/admin/scholarships/applications/new`}
              className="inline-flex items-center justify-center rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm font-medium hover:border-[var(--color-primary)] transition"
            >
              {isAr ? 'إدخال يدوي' : 'Manual entry'}
            </a>
            <a
              href={csvHref}
              className="inline-flex items-center justify-center rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm font-medium hover:border-[var(--color-primary)] transition"
              download
            >
              {isAr ? 'تنزيل CSV' : 'Download CSV'}
            </a>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label htmlFor="filter-status" className="block text-xs text-[var(--color-neutral-600)] mb-1">
              {isAr ? 'الحالة' : 'Status'}
            </label>
            <select
              id="filter-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isAr ? opt.ar : opt.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-family" className="block text-xs text-[var(--color-neutral-600)] mb-1">
              {isAr ? 'العائلة' : 'Family'}
            </label>
            <select
              id="filter-family"
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 text-sm"
            >
              {FAMILY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isAr ? opt.ar : opt.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-date-from" className="block text-xs text-[var(--color-neutral-600)] mb-1">
              {isAr ? 'من' : 'From'}
            </label>
            <input
              id="filter-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="filter-date-to" className="block text-xs text-[var(--color-neutral-600)] mb-1">
              {isAr ? 'إلى' : 'To'}
            </label>
            <input
              id="filter-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="filter-search" className="block text-xs text-[var(--color-neutral-600)] mb-1">
              {isAr ? 'بحث' : 'Search'}
            </label>
            <input
              id="filter-search"
              type="text"
              placeholder={isAr ? 'الاسم أو البريد' : 'name or email'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={200}
              className="w-full rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Status messaging */}
        {loading && (
          <div className="rounded-xl bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] p-4 text-sm">
            {isAr ? 'جارٍ التحميل...' : 'Loading...'}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
            {error === 'unauthorized'
              ? isAr
                ? 'يرجى تسجيل الدخول.'
                : 'Please sign in.'
              : error === 'forbidden'
                ? isAr
                  ? 'لا تملك صلاحية الوصول.'
                  : 'You do not have access.'
                : isAr
                  ? 'تعذّر تحميل القائمة.'
                  : 'Could not load the list.'}
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-100)] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-neutral-50)]">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-600)]">
                    {isAr ? 'تاريخ' : 'Date'}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-600)]">
                    {isAr ? 'المتقدّم' : 'Applicant'}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-600)]">
                    {isAr ? 'البرنامج' : 'Program'}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-600)]">
                    {isAr ? 'النوع' : 'Tier'}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-600)]">
                    {isAr ? 'الحالة' : 'Status'}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-600)]">
                    {isAr ? 'سياق ماليّ' : 'Financial snippet'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-[var(--color-neutral-500)]"
                    >
                      {isAr ? 'لا توجد نتائج.' : 'No results.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const dt = new Date(row.created_at);
                    const dateStr = isAr
                      ? dt.toLocaleDateString('ar-AE', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : dt.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });
                    return (
                      <tr
                        key={row.id}
                        onClick={() => {
                          window.location.href = `/${locale}/admin/scholarships/applications/${row.id}`;
                        }}
                        className="cursor-pointer border-t border-[var(--color-neutral-100)] hover:bg-[var(--color-primary)]/5"
                      >
                        <td className="px-4 py-3 align-top text-xs text-[var(--color-neutral-600)] whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-[var(--color-neutral-900)]">
                            {row.applicant_name}
                          </div>
                          <div className="text-xs text-[var(--color-neutral-500)]" dir="ltr">
                            {row.applicant_email}
                          </div>
                          {row.source === 'manual_entry' && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                              {isAr ? 'إدخال يدوي' : 'manual'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          <div className="font-medium text-[var(--color-neutral-700)]">
                            {familyLabel(row.program_family)}
                          </div>
                          <div className="text-[var(--color-neutral-500)]">{row.program_slug}</div>
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          {row.scholarship_tier === 'partial'
                            ? isAr ? 'جزئيّة' : 'Partial'
                            : isAr ? 'كاملة' : 'Full'}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${statusBadgeClass(row.status)}`}
                          >
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-[var(--color-neutral-600)] max-w-md">
                          {row.financial_snippet ? (
                            <span className="line-clamp-2">{row.financial_snippet}</span>
                          ) : (
                            <span className="text-[var(--color-neutral-400)]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  );
}
