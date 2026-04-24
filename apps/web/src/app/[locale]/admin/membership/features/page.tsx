'use client';

import { use, useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { FeatureForm, type FeatureFormState } from '@/components/admin/membership/feature-form';

interface FeatureRow {
  id: string;
  feature_key: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  feature_type: string;
  updated_at: string;
  tiers_count: number;
}

const EMPTY: FeatureFormState = {
  feature_key: '',
  name_ar: '',
  name_en: '',
  description_ar: '',
  description_en: '',
  feature_type: 'access',
};

export default function AdminMembershipFeaturesList({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const [rows, setRows] = useState<FeatureRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    fetch('/api/admin/membership/features')
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          setError(b.error || `HTTP ${r.status}`);
          return;
        }
        const b = await r.json();
        setRows(b.features ?? []);
      })
      .catch(() => setError(isAr ? 'فشل التحميل' : 'Failed to load'));
  }, [isAr]);

  return (
    <Section variant="white">
      <div dir={dir}>
        <div className="mb-6">
          <a
            href={`/${locale}/admin/membership`}
            className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)]"
          >
            {isAr ? '← الاشتراكات' : '← Membership'}
          </a>
        </div>

        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1
              className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'الميزات' : 'Features'}
            </h1>
            <p className="text-[var(--color-neutral-600)]">
              {isAr
                ? 'كتالوج الميزات. كل ميزة لها مفتاح ثابت (feature_key) يُستدعى من الكود عبر hasFeature().'
                : 'Feature catalog. Each feature has a stable feature_key called from code via hasFeature().'}
            </p>
          </div>
          <button
            onClick={() => setShowNew(!showNew)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--color-accent-500)]"
          >
            {showNew ? (isAr ? 'إغلاق' : 'Close') : (isAr ? '+ ميزة جديدة' : '+ New feature')}
          </button>
        </div>

        {showNew && (
          <Card className="p-6 mb-6 border-2 border-[var(--color-accent)]/30">
            <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: headingFont }}>
              {isAr ? 'إنشاء ميزة جديدة' : 'Create new feature'}
            </h2>
            <FeatureForm locale={locale} mode="new" initial={EMPTY} />
          </Card>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 mb-6">
            {error}
          </div>
        )}

        {rows === null && !error && (
          <p className="text-[var(--color-neutral-500)]">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-neutral-100)] bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-primary-50)]/50">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'المفتاح' : 'Key'}</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'الاسم' : 'Name'}</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'النوع' : 'Type'}</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'المراتب' : 'Tiers'}</th>
                  <th className="px-4 py-3 text-end font-semibold text-[var(--color-neutral-700)]"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-neutral-100)] hover:bg-[var(--color-primary-50)]/10"
                  >
                    <td className="px-4 py-3">
                      <a
                        href={`/${locale}/admin/membership/features/${row.id}`}
                        className="font-mono text-xs font-medium text-[var(--color-primary)] hover:underline"
                      >
                        {row.feature_key}
                      </a>
                    </td>
                    <td className="px-4 py-3">{isAr ? row.name_ar : row.name_en}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.feature_type}</td>
                    <td className="px-4 py-3 font-semibold">{row.tiers_count}</td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      <a
                        href={`/${locale}/admin/membership/features/${row.id}`}
                        className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
                      >
                        {isAr ? 'تعديل' : 'edit'}
                      </a>
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
