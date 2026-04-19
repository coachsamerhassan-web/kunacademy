'use client';

/**
 * /[locale]/admin/audit-log
 *
 * Paginated audit log viewer for admins — compliance + debugging.
 *
 * Auth: role in ['admin', 'super_admin'] only — NOT mentor_manager.
 *       (enforced by middleware; page also redirects on mount if role insufficient)
 *
 * Features:
 *   - Filter bar: action multi-select, date range (from/to), actor search by UUID
 *   - Table: timestamp, action pill, actor, target, metadata excerpt
 *   - Pagination: Next / Prev with offset
 *   - Bilingual labels (AR/EN)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuditLogRow {
  id: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

interface AuditLogResponse {
  rows: AuditLogRow[];
  total: number;
  has_more: boolean;
}

// ── Action metadata ────────────────────────────────────────────────────────────

interface ActionMeta {
  ar: string;
  en: string;
  pillClass: string;
}

const ACTION_META: Record<string, ActionMeta> = {
  OVERRIDE_ASSESSMENT_DECISION: { ar: 'تجاوز قرار التقييم',         en: 'Override Decision',      pillClass: 'bg-purple-100 text-purple-800' },
  SUBMIT_ASSESSMENT:            { ar: 'تقديم تقييم',                 en: 'Submit Assessment',      pillClass: 'bg-sky-100 text-sky-800' },
  REQUEST_SECOND_OPINION:       { ar: 'طلب رأي ثانٍ',               en: 'Request 2nd Opinion',    pillClass: 'bg-blue-100 text-blue-800' },
  RESOLVE_SECOND_OPINION:       { ar: 'حسم الرأي الثاني',            en: 'Resolve 2nd Opinion',    pillClass: 'bg-green-100 text-green-800' },
  OVERRIDE_AUTO_UNPAUSE:        { ar: 'تجاوز الاستئناف التلقائي',   en: 'Override Auto-Unpause',  pillClass: 'bg-orange-100 text-orange-800' },
  PAUSE_JOURNEY:                { ar: 'إيقاف الرحلة مؤقتاً',        en: 'Pause Journey',          pillClass: 'bg-amber-100 text-amber-800' },
  UNPAUSE_JOURNEY:              { ar: 'استئناف الرحلة',              en: 'Unpause Journey',        pillClass: 'bg-teal-100 text-teal-800' },
  CREATE_BOOKING:               { ar: 'إنشاء حجز',                  en: 'Create Booking',         pillClass: 'bg-green-100 text-green-800' },
  UPDATE_BOOKING:               { ar: 'تحديث حجز',                  en: 'Update Booking',         pillClass: 'bg-blue-100 text-blue-800' },
  CANCEL_BOOKING:               { ar: 'إلغاء حجز',                  en: 'Cancel Booking',         pillClass: 'bg-red-100 text-red-800' },
  APPROVE_PAYOUT:               { ar: 'الموافقة على دفعة',           en: 'Approve Payout',         pillClass: 'bg-green-100 text-green-800' },
  REJECT_PAYOUT:                { ar: 'رفض دفعة',                   en: 'Reject Payout',          pillClass: 'bg-red-100 text-red-800' },
  COMPLETE_PAYOUT:              { ar: 'إتمام دفعة',                  en: 'Complete Payout',        pillClass: 'bg-teal-100 text-teal-800' },
  UPDATE_ORDER:                 { ar: 'تحديث طلب',                  en: 'Update Order',           pillClass: 'bg-blue-100 text-blue-800' },
  REFUND_ORDER:                 { ar: 'استرداد طلب',                 en: 'Refund Order',           pillClass: 'bg-rose-100 text-rose-800' },
  UPDATE_ENROLLMENT:            { ar: 'تحديث تسجيل',                en: 'Update Enrollment',      pillClass: 'bg-blue-100 text-blue-800' },
  CREATE_ENROLLMENT:            { ar: 'إنشاء تسجيل',                en: 'Create Enrollment',      pillClass: 'bg-green-100 text-green-800' },
  APPROVE_COACH:                { ar: 'الموافقة على مدرب',           en: 'Approve Coach',          pillClass: 'bg-green-100 text-green-800' },
  REJECT_COACH:                 { ar: 'رفض مدرب',                   en: 'Reject Coach',           pillClass: 'bg-red-100 text-red-800' },
  UPDATE_PROFILE_ROLE:          { ar: 'تحديث دور المستخدم',         en: 'Update Role',            pillClass: 'bg-purple-100 text-purple-800' },
  DECRYPT_BANK_DETAILS:         { ar: 'فك تشفير بيانات بنكية',      en: 'Decrypt Bank Details',   pillClass: 'bg-red-100 text-red-800' },
  CREATE_BLOG_POST:             { ar: 'إنشاء مقالة',                en: 'Create Blog Post',       pillClass: 'bg-green-100 text-green-800' },
  UPDATE_BLOG_POST:             { ar: 'تحديث مقالة',                en: 'Update Blog Post',       pillClass: 'bg-blue-100 text-blue-800' },
  DELETE_BLOG_POST:             { ar: 'حذف مقالة',                  en: 'Delete Blog Post',       pillClass: 'bg-red-100 text-red-800' },
  UPDATE_TESTIMONIAL:           { ar: 'تحديث توصية',                en: 'Update Testimonial',     pillClass: 'bg-blue-100 text-blue-800' },
  DELETE_TESTIMONIAL:           { ar: 'حذف توصية',                  en: 'Delete Testimonial',     pillClass: 'bg-red-100 text-red-800' },
};

const ALL_ACTIONS = Object.keys(ACTION_META);

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string, locale: string): string {
  const diff    = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);
  if (locale === 'ar') {
    if (days    >= 1) return `منذ ${days} يوم`;
    if (hours   >= 1) return `منذ ${hours} س`;
    if (minutes >= 1) return `منذ ${minutes} د`;
    return 'الآن';
  }
  if (days    >= 1) return `${days}d ago`;
  if (hours   >= 1) return `${hours}h ago`;
  if (minutes >= 1) return `${minutes}m ago`;
  return 'just now';
}

function metaExcerpt(metadata: Record<string, unknown>): string {
  try {
    const str = JSON.stringify(metadata);
    return str.length > 120 ? str.slice(0, 117) + '...' : str;
  } catch {
    return '';
  }
}

function targetLink(action: string, targetId: string | null, locale: string): string | null {
  if (!targetId) return null;
  if (
    action === 'OVERRIDE_ASSESSMENT_DECISION' ||
    action === 'REQUEST_SECOND_OPINION'       ||
    action === 'RESOLVE_SECOND_OPINION'       ||
    action === 'SUBMIT_ASSESSMENT'
  ) {
    return `/${locale}/admin/escalations/${targetId}`;
  }
  if (
    action === 'PAUSE_JOURNEY'        ||
    action === 'UNPAUSE_JOURNEY'      ||
    action === 'OVERRIDE_AUTO_UNPAUSE'
  ) {
    return `/${locale}/admin/escalations?instance=${targetId}`;
  }
  return null;
}

// ── Page ───────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  // ── State ──────────────────────────────────────────────────────────────────
  const [rows,     setRows]     = useState<AuditLogRow[]>([]);
  const [total,    setTotal]    = useState(0);
  const [hasMore,  setHasMore]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // Filters
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [actorId,         setActorId]         = useState('');
  const [fromDate,        setFromDate]        = useState('');
  const [toDate,          setToDate]          = useState('');
  const [offset,          setOffset]          = useState(0);

  // Action multi-select dropdown open state
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    const role = (profile as { role?: string } | null)?.role;
    if (!user || (role !== 'admin' && role !== 'super_admin')) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [user, profile, authLoading, locale, router]);

  // ── Close dropdown on outside click ───────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActionDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (currentOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedActions.length > 0) params.set('action', selectedActions.join(','));
      if (actorId.trim())             params.set('actor_id', actorId.trim());
      if (fromDate)                   params.set('from', fromDate);
      if (toDate)                     params.set('to', toDate + 'T23:59:59Z');
      params.set('limit',  String(PAGE_SIZE));
      params.set('offset', String(currentOffset));

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as AuditLogResponse;
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setHasMore(data.has_more ?? false);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [selectedActions, actorId, fromDate, toDate]);

  // Trigger fetch when filters or offset change
  useEffect(() => {
    if (authLoading) return;
    fetchData(offset);
  }, [authLoading, fetchData, offset]);

  // Reset to page 0 when filters change
  const applyFilters = useCallback(() => {
    setOffset(0);
    fetchData(0);
  }, [fetchData]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const page     = Math.floor(offset / PAGE_SIZE) + 1;
  const lastPage = Math.ceil(total / PAGE_SIZE);

  const goPrev = () => setOffset(Math.max(0, offset - PAGE_SIZE));
  const goNext = () => { if (hasMore) setOffset(offset + PAGE_SIZE); };

  // ── Render ─────────────────────────────────────────────────────────────────
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
            {isAr ? 'سجل التدقيق — عرض كامل' : 'Audit Log — Full View'}
          </Heading>
          <Link
            href={`/${locale}/admin/mentor-manager`}
            className="text-sm text-[var(--color-primary)] hover:underline min-h-[44px] inline-flex items-center"
          >
            {isAr ? 'العودة إلى لوحة مدير التوجيه' : 'Back to Mentor-Manager Dashboard'}
          </Link>
        </div>

        {/* ── Filter bar ── */}
        <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-surface-dim)] p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Action multi-select */}
            <div ref={dropdownRef} className="relative">
              <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">
                {isAr ? 'الإجراء' : 'Action'}
              </label>
              <button
                type="button"
                onClick={() => setActionDropdownOpen(o => !o)}
                className="w-full min-h-[44px] flex items-center justify-between gap-2 rounded-md border border-[var(--color-neutral-300)] bg-white px-3 py-2 text-sm text-start hover:border-[var(--color-primary)] transition"
                aria-haspopup="listbox"
                aria-expanded={actionDropdownOpen}
              >
                <span className="truncate text-[var(--color-neutral-700)]">
                  {selectedActions.length === 0
                    ? (isAr ? 'كل الإجراءات' : 'All actions')
                    : selectedActions.length === 1
                      ? (ACTION_META[selectedActions[0]]?.[isAr ? 'ar' : 'en'] ?? selectedActions[0])
                      : (isAr ? `${selectedActions.length} إجراءات` : `${selectedActions.length} actions`)}
                </span>
                <svg className="w-4 h-4 text-[var(--color-neutral-400)] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {actionDropdownOpen && (
                <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-[var(--color-neutral-200)] bg-white shadow-lg max-h-64 overflow-y-auto">
                  {/* Clear all */}
                  <button
                    type="button"
                    onClick={() => { setSelectedActions([]); setActionDropdownOpen(false); }}
                    className="w-full text-start px-3 py-2 text-xs text-[var(--color-neutral-500)] hover:bg-[var(--color-surface-dim)] border-b border-[var(--color-neutral-100)]"
                  >
                    {isAr ? 'الكل (بدون تصفية)' : 'All (no filter)'}
                  </button>
                  {ALL_ACTIONS.map(action => {
                    const meta    = ACTION_META[action];
                    const checked = selectedActions.includes(action);
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => {
                          setSelectedActions(prev =>
                            checked ? prev.filter(a => a !== action) : [...prev, action]
                          );
                        }}
                        className="w-full text-start px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--color-surface-dim)] transition"
                        role="option"
                        aria-selected={checked}
                      >
                        <span className={`inline-block w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${checked ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-neutral-300)]'}`}>
                          {checked && (
                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                              <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                            </svg>
                          )}
                        </span>
                        <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${meta?.pillClass ?? 'bg-neutral-100 text-neutral-700'}`}>
                          {meta ? (isAr ? meta.ar : meta.en) : action}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date from */}
            <div>
              <label htmlFor="audit-from" className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">
                {isAr ? 'من تاريخ' : 'From date'}
              </label>
              <input
                id="audit-from"
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full min-h-[44px] rounded-md border border-[var(--color-neutral-300)] bg-white px-3 py-2 text-sm text-[var(--color-neutral-700)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition"
              />
            </div>

            {/* Date to */}
            <div>
              <label htmlFor="audit-to" className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">
                {isAr ? 'إلى تاريخ' : 'To date'}
              </label>
              <input
                id="audit-to"
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full min-h-[44px] rounded-md border border-[var(--color-neutral-300)] bg-white px-3 py-2 text-sm text-[var(--color-neutral-700)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition"
              />
            </div>

            {/* Actor ID search */}
            <div>
              <label htmlFor="audit-actor" className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">
                {isAr ? 'معرّف المنفّذ (UUID)' : 'Actor ID (UUID)'}
              </label>
              <input
                id="audit-actor"
                type="text"
                value={actorId}
                onChange={e => setActorId(e.target.value)}
                placeholder={isAr ? 'xxxxxxxx-xxxx-...' : 'xxxxxxxx-xxxx-...'}
                className="w-full min-h-[44px] rounded-md border border-[var(--color-neutral-300)] bg-white px-3 py-2 text-sm text-[var(--color-neutral-700)] placeholder:text-[var(--color-neutral-400)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition font-mono"
              />
            </div>
          </div>

          {/* Apply button */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={applyFilters}
              className="min-h-[44px] px-6 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition"
            >
              {isAr ? 'تطبيق الفلاتر' : 'Apply Filters'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedActions([]);
                setActorId('');
                setFromDate('');
                setToDate('');
                setOffset(0);
              }}
              className="min-h-[44px] px-4 py-2 rounded-md border border-[var(--color-neutral-300)] text-sm text-[var(--color-neutral-600)] hover:border-[var(--color-neutral-400)] transition"
            >
              {isAr ? 'مسح الكل' : 'Clear all'}
            </button>
            <span className="text-xs text-[var(--color-neutral-400)] ms-auto">
              {isAr
                ? `${total.toLocaleString('ar-EG')} نتيجة`
                : `${total.toLocaleString()} result${total !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* ── Table ── */}
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
            {isAr ? 'لا توجد نتائج بهذه المعايير.' : 'No results for the selected filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-neutral-200)]">
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-[var(--color-neutral-200)] bg-[var(--color-surface-dim)] text-[var(--color-neutral-500)] text-xs uppercase tracking-wide">
                  <th className="py-3 px-4 text-start font-medium w-36">
                    {isAr ? 'التوقيت' : 'Timestamp'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium w-44">
                    {isAr ? 'الإجراء' : 'Action'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium">
                    {isAr ? 'المنفّذ' : 'Actor'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium w-36">
                    {isAr ? 'الهدف' : 'Target'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium">
                    {isAr ? 'البيانات الوصفية' : 'Metadata'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const meta    = ACTION_META[row.action];
                  const rel     = relativeTime(row.created_at, locale);
                  const absTs   = new Date(row.created_at).toLocaleString(
                    isAr ? 'ar-AE' : 'en-GB',
                    { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
                  );
                  const link    = targetLink(row.action, row.target_id, locale);
                  const excerpt = metaExcerpt(row.metadata ?? {});

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-surface-low)] transition"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 align-top">
                        <time
                          dateTime={row.created_at}
                          title={absTs}
                          className="text-xs text-[var(--color-neutral-500)] whitespace-nowrap"
                        >
                          {rel}
                        </time>
                        <div className="text-[10px] text-[var(--color-neutral-400)] mt-0.5 whitespace-nowrap">
                          {absTs}
                        </div>
                      </td>

                      {/* Action pill */}
                      <td className="py-3 px-4 align-top">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${meta?.pillClass ?? 'bg-neutral-100 text-neutral-700'}`}>
                          {meta ? (isAr ? meta.ar : meta.en) : row.action}
                        </span>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4 align-top">
                        <div className="font-medium text-[var(--color-neutral-900)] truncate max-w-[180px]">
                          {row.actor_name ?? (isAr ? 'مجهول' : 'Unknown')}
                        </div>
                        {row.actor_email && (
                          <div className="text-xs text-[var(--color-neutral-500)] truncate max-w-[180px]">
                            {row.actor_email}
                          </div>
                        )}
                      </td>

                      {/* Target */}
                      <td className="py-3 px-4 align-top">
                        {row.target_type && (
                          <div className="text-xs font-mono text-[var(--color-neutral-500)] mb-0.5 uppercase">
                            {row.target_type}
                          </div>
                        )}
                        {link ? (
                          <Link
                            href={link}
                            className="text-xs text-[var(--color-primary)] underline underline-offset-2 hover:opacity-80 font-mono truncate block max-w-[120px]"
                            title={row.target_id ?? ''}
                          >
                            {row.target_id?.slice(0, 8)}...
                          </Link>
                        ) : row.target_id ? (
                          <span className="text-xs font-mono text-[var(--color-neutral-600)] truncate block max-w-[120px]" title={row.target_id}>
                            {row.target_id.slice(0, 8)}...
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-neutral-400)]">—</span>
                        )}
                      </td>

                      {/* Metadata excerpt */}
                      <td className="py-3 px-4 align-top">
                        <span className="text-xs font-mono text-[var(--color-neutral-500)] break-all">
                          {excerpt || '{}'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={goPrev}
              disabled={offset === 0}
              className="min-h-[44px] px-5 py-2 rounded-md border border-[var(--color-neutral-300)] text-sm font-medium text-[var(--color-neutral-700)] disabled:opacity-40 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition"
            >
              {isAr ? 'السابق' : 'Previous'}
            </button>

            <span className="text-sm text-[var(--color-neutral-500)]">
              {isAr
                ? `صفحة ${page} من ${lastPage}`
                : `Page ${page} of ${lastPage}`}
            </span>

            <button
              type="button"
              onClick={goNext}
              disabled={!hasMore}
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
