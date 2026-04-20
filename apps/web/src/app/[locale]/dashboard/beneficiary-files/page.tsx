'use client';

/**
 * /dashboard/beneficiary-files — Beneficiary Files root listing page.
 *
 * Bilingual AR (RTL) / EN (LTR).
 * Auth: any authenticated user — admin sees all, student/mentor sees own files.
 * Data: GET /api/beneficiary-files (created in route.ts companion)
 *
 * Sub-phase: S2-Layer-1 / listing
 */

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BeneficiaryFileItem {
  id:                 string;
  client_number:      number;
  client_alias:       string | null;
  first_session_date: string | null;
  updated_at:         string;
  student_id:         string;
  session_count:      number;
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const t = {
  ar: {
    title:       'ملفات المستفيدين',
    subtitle:    'جميع ملفات عملاء التطوع — اضغط على أي ملف للاطلاع على التفاصيل.',
    colAlias:    'اسم المستفيد',
    colSessions: 'الجلسات',
    colUpdated:  'آخر تحديث',
    viewLink:    'عرض',
    noAlias:     '(بدون اسم مستعار)',
    client:      (n: number) => `العميل ${n}`,
    sessions:    (n: number) => `${n} جلسات`,
    loading:     'جاري التحميل...',
    error:       'تعذّر تحميل الملفات.',
    empty:       'لا توجد ملفات بعد. ستظهر هنا بعد إنشاء أول ملف.',
  },
  en: {
    title:       'Beneficiary Files',
    subtitle:    'All volunteer-client files — click any row to view details.',
    colAlias:    'Beneficiary Name',
    colSessions: 'Sessions',
    colUpdated:  'Last Updated',
    viewLink:    'View',
    noAlias:     '(No alias)',
    client:      (n: number) => `Client ${n}`,
    sessions:    (n: number) => `${n} session${n !== 1 ? 's' : ''}`,
    loading:     'Loading...',
    error:       'Failed to load beneficiary files.',
    empty:       "No beneficiary files yet. They'll appear here once the first is created.",
  },
} as const;

// ─── Status badge ─────────────────────────────────────────────────────────────

// session_count alone doesn't carry status from the listing endpoint.
// We surface it numerically — detailed status lives on the detail page.

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BeneficiaryFilesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir  = isAr ? 'rtl' : 'ltr';
  const l    = isAr ? t.ar : t.en;

  const { user } = useAuth();
  const [files,   setFiles]   = useState<BeneficiaryFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch('/api/beneficiary-files')
      .then((r) => {
        if (!r.ok) throw new Error('non-ok');
        return r.json();
      })
      .then((data: { files: BeneficiaryFileItem[] }) => {
        setFiles(data.files ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(l.error);
        setLoading(false);
      });
  }, [user, l.error]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(isAr ? 'ar-AE' : 'en-AE', {
      year:  'numeric',
      month: 'short',
      day:   'numeric',
    });
  }

  return (
    <Section variant="white">
      {/* Hero */}
      <div className="mb-8" dir={dir}>
        <h1
          className="text-2xl font-bold text-[var(--text-primary)] mb-1"
          style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
        >
          {l.title}
        </h1>
        <p className="text-sm text-[var(--color-neutral-500)]">{l.subtitle}</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Card className="py-12 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && files.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center" dir={dir}>
          <div className="mb-4 w-14 h-14 rounded-2xl bg-[var(--color-primary-50,#f0f4ff)] flex items-center justify-center">
            <svg
              className="w-7 h-7 text-[var(--color-primary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-sm text-[var(--color-neutral-500)] max-w-sm">{l.empty}</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && files.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]" dir={dir}>
          <table className="w-full text-sm" style={{ direction: dir }}>
            <thead>
              <tr className="bg-[var(--color-surface-dim)] border-b border-[var(--color-neutral-200)]">
                <th
                  className="px-4 py-3 font-semibold text-[var(--color-neutral-600)] text-start"
                  style={{ textAlign: isAr ? 'right' : 'left' }}
                >
                  {l.colAlias}
                </th>
                <th
                  className="px-4 py-3 font-semibold text-[var(--color-neutral-600)] text-start"
                  style={{ textAlign: isAr ? 'right' : 'left' }}
                >
                  {l.colSessions}
                </th>
                <th
                  className="px-4 py-3 font-semibold text-[var(--color-neutral-600)] text-start"
                  style={{ textAlign: isAr ? 'right' : 'left' }}
                >
                  {l.colUpdated}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-neutral-100)]">
              {files.map((file) => (
                <tr
                  key={file.id}
                  className="hover:bg-[var(--color-surface-dim)] transition-colors"
                >
                  {/* Beneficiary name / client number */}
                  <td className="px-4 py-3">
                    <span className="font-medium text-[var(--text-primary)]">
                      {file.client_alias ?? l.noAlias}
                    </span>
                    <span className="ml-2 text-xs text-[var(--color-neutral-400)]">
                      {l.client(file.client_number)}
                    </span>
                  </td>

                  {/* Session count */}
                  <td className="px-4 py-3 text-[var(--color-neutral-600)]">
                    {l.sessions(file.session_count)}
                  </td>

                  {/* Last updated */}
                  <td className="px-4 py-3 text-[var(--color-neutral-500)]">
                    {formatDate(file.updated_at)}
                  </td>

                  {/* Link */}
                  <td className="px-4 py-3" style={{ textAlign: isAr ? 'left' : 'right' }}>
                    <Link
                      href={`/${locale}/dashboard/beneficiary-files/${file.id}`}
                      className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {l.viewLink}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
