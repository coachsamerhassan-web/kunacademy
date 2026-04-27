/**
 * Wave 15 Wave 3 — /admin/static-pages list view.
 *
 * Lists all static_pages rows. New row creation hits the agent-API POST
 * route (no admin POST endpoint required at canary — the agent route
 * works under admin auth too via the dual-auth shim once Wave 4 lands).
 * For Wave 3 canary we use a small admin-side POST helper to seed a
 * row, then redirect to /admin/static-pages/[id].
 */

'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Section } from '@kunacademy/ui/section';

interface StaticPageRow {
  id: string;
  slug: string;
  kind: string;
  status: string;
  published: boolean;
  updated_at: string;
}

export default function AdminStaticPagesListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const [rows, setRows] = useState<StaticPageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/static-pages')
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          setError(b.error || `HTTP ${r.status}`);
          return;
        }
        const b = await r.json();
        setRows(b.rows ?? []);
      })
      .catch(() => setError(isAr ? 'فشل التحميل' : 'Failed to load'));
  }, [isAr]);

  return (
    <Section variant="white">
      <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
            {isAr ? 'الصفحات الثابتة' : 'Static pages'}
          </h1>
          <Link
            href={`/${locale}/admin/static-pages/new`}
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--color-accent-500)]"
          >
            + {isAr ? 'صفحة جديدة' : 'New static page'}
          </Link>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        {!rows ? (
          <p className="text-[var(--color-neutral-500)]">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-neutral-300)] bg-[var(--color-neutral-50)] p-8 text-center">
            <p className="text-sm text-[var(--color-neutral-600)]">
              {isAr ? 'لا توجد صفحات ثابتة بعد.' : 'No static pages yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-neutral-200)] bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <tr>
                  <th className="px-3 py-2.5 text-start font-semibold">{isAr ? 'الرابط' : 'Slug'}</th>
                  <th className="px-3 py-2.5 text-start font-semibold">{isAr ? 'النوع' : 'Kind'}</th>
                  <th className="px-3 py-2.5 text-start font-semibold">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-3 py-2.5 text-start font-semibold">{isAr ? 'آخر تعديل' : 'Updated'}</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                    <td className="px-3 py-2.5 font-mono text-xs">{r.slug}</td>
                    <td className="px-3 py-2.5"><span className="text-xs font-mono text-[var(--color-neutral-600)]">{r.kind}</span></td>
                    <td className="px-3 py-2.5"><StatusPill status={r.status} isAr={isAr} /></td>
                    <td className="px-3 py-2.5 text-xs text-[var(--color-neutral-500)] whitespace-nowrap">
                      {new Date(r.updated_at).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-3 py-2.5 text-end">
                      <Link
                        href={`/${locale}/admin/static-pages/${r.id}`}
                        className="rounded-lg border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-3 py-1 text-xs font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]"
                      >
                        {isAr ? 'تحرير ←' : 'Edit →'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  );
}

function StatusPill({ status, isAr }: { status: string; isAr: boolean }) {
  const map: Record<string, { ar: string; en: string; bg: string; fg: string }> = {
    draft: { ar: 'مسودّة', en: 'Draft', bg: '#F3F4F6', fg: '#374151' },
    review: { ar: 'مراجعة', en: 'In review', bg: '#FEF3C7', fg: '#92400E' },
    published: { ar: 'منشور', en: 'Live', bg: '#D1FAE5', fg: '#065F46' },
    archived: { ar: 'مؤرشف', en: 'Archived', bg: '#E5E7EB', fg: '#6B7280' },
  };
  const m = map[status] ?? { ar: status, en: status, bg: '#E5E7EB', fg: '#374151' };
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: m.bg, color: m.fg }}>
      {isAr ? m.ar : m.en}
    </span>
  );
}
