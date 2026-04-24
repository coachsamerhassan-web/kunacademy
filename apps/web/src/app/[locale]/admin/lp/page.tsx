'use client';

import { useEffect, useState, use } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';

interface LpRow {
  id: string;
  slug: string;
  page_type: string;
  published: boolean;
  launch_lock: boolean;
  composition_json: unknown;
  lead_capture_config: { enabled?: boolean } | null;
  updated_at: string;
  lead_count: number;
}

export default function AdminLpListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const [rows, setRows] = useState<LpRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/lp')
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          setError(b.error || `HTTP ${r.status}`);
          return;
        }
        const b = await r.json();
        setRows(b.landing_pages ?? []);
      })
      .catch(() => setError(isAr ? 'فشل التحميل' : 'Failed to load'));
  }, [isAr]);

  return (
    <Section variant="white">
      <div dir={dir}>
        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1
              className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'صفحات الهبوط' : 'Landing Pages'}
            </h1>
            <p className="text-[var(--color-neutral-600)]">
              {isAr
                ? 'إدارة صفحات الهبوط القائمة بذاتها (Wave 14 LP-INFRA).'
                : 'Manage standalone landing pages (Wave 14 LP-INFRA).'}
            </p>
          </div>
          <a
            href={`/${locale}/admin/lp/new`}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--color-accent-500)] transition-all"
          >
            {isAr ? '+ صفحة جديدة' : '+ New Landing Page'}
          </a>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 mb-6">
            {error}
          </div>
        )}

        {rows === null && !error && (
          <p className="text-[var(--color-neutral-500)]">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        )}

        {rows && rows.length === 0 && !error && (
          <Card className="p-10 text-center">
            <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              {isAr ? 'لا توجد صفحات بعد' : 'No landing pages yet'}
            </p>
            <p className="text-[var(--color-neutral-500)] mb-5">
              {isAr ? 'أنشئ أول صفحة هبوط.' : 'Create your first landing page.'}
            </p>
            <a
              href={`/${locale}/admin/lp/new`}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--color-accent-500)]"
            >
              {isAr ? '+ صفحة جديدة' : '+ New Landing Page'}
            </a>
          </Card>
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-neutral-100)] bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-primary-50)]/50">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">
                    {isAr ? 'الرابط' : 'Slug'}
                  </th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">
                    {isAr ? 'منشورة' : 'Published'}
                  </th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">
                    {isAr ? 'محظورة بالعزل' : 'Launch-locked'}
                  </th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">
                    {isAr ? 'النموذج' : 'Form'}
                  </th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">
                    {isAr ? 'العملاء' : 'Leads'}
                  </th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">
                    {isAr ? 'آخر تعديل' : 'Updated'}
                  </th>
                  <th className="px-4 py-3 text-end font-semibold text-[var(--color-neutral-700)]"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const hasComposition =
                    row.composition_json &&
                    typeof row.composition_json === 'object';
                  const formEnabled = row.lead_capture_config?.enabled === true;
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--color-neutral-100)] hover:bg-[var(--color-primary-50)]/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <a
                          href={`/${locale}/admin/lp/${row.id}`}
                          className="font-mono font-medium text-[var(--color-primary)] hover:underline"
                        >
                          {row.slug}
                        </a>
                        {!hasComposition && (
                          <span className="ms-2 inline-block px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800">
                            {isAr ? 'بدون محتوى' : 'no composition'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.published ? (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-600" aria-hidden />
                            {isAr ? 'نعم' : 'yes'}
                          </span>
                        ) : (
                          <span className="text-[var(--color-neutral-400)]">
                            {isAr ? 'مسودة' : 'draft'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.launch_lock ? (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            🔒 {isAr ? 'مفتوحة' : 'unlocked-in-gate'}
                          </span>
                        ) : (
                          <span className="text-[var(--color-neutral-400)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {formEnabled ? (
                          <span className="text-[var(--color-primary)]">
                            {isAr ? 'مفعّل' : 'enabled'}
                          </span>
                        ) : (
                          <span className="text-[var(--color-neutral-400)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                        {row.lead_count}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-neutral-500)] text-xs">
                        {new Date(row.updated_at).toLocaleString(
                          isAr ? 'ar-EG' : 'en-US',
                          { year: 'numeric', month: 'short', day: 'numeric' },
                        )}
                      </td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <a
                          href={`/${locale}/lp/${row.slug}`}
                          target="_blank"
                          rel="noopener"
                          className="text-xs text-[var(--color-neutral-500)] hover:text-[var(--color-primary)] me-3"
                        >
                          {isAr ? 'معاينة ↗' : 'preview ↗'}
                        </a>
                        <a
                          href={`/${locale}/admin/lp/${row.id}`}
                          className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
                        >
                          {isAr ? 'تعديل' : 'edit'}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 rounded-xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)]/40 p-5 text-sm text-[var(--color-neutral-700)]">
          <p className="font-semibold text-[var(--text-primary)] mb-2">
            {isAr ? 'وضع الإطلاق المحدود' : 'Launch isolation mode'}
          </p>
          <p className="leading-relaxed">
            {isAr
              ? 'عيّن المتغيّر LAUNCH_MODE=landing-only على الخادم لجعل صفحات الهبوط المتاحة فقط. كل المسارات الأخرى تُرجِع 404. أعد تشغيل pm2 بعد التغيير.'
              : 'Set LAUNCH_MODE=landing-only on the server to expose only landing pages. All other routes return 404. Restart pm2 after the change.'}
          </p>
        </div>
      </div>
    </Section>
  );
}
