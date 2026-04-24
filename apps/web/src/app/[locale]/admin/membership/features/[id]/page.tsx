'use client';

import { use, useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { FeatureForm, type FeatureFormState } from '@/components/admin/membership/feature-form';

export default function AdminMembershipFeatureEdit({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const [initial, setInitial] = useState<FeatureFormState | null>(null);
  const [tiersCount, setTiersCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/membership/features/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          setError(b.error || `HTTP ${r.status}`);
          return;
        }
        const b = await r.json();
        const f = b.feature;
        setInitial({
          id: f.id,
          feature_key: f.feature_key,
          name_ar: f.name_ar,
          name_en: f.name_en,
          description_ar: f.description_ar ?? '',
          description_en: f.description_en ?? '',
          feature_type: f.feature_type,
        });
        setTiersCount(b.tiers_count ?? 0);
      })
      .catch(() => setError(isAr ? 'فشل التحميل' : 'Failed to load'));
  }, [id, isAr]);

  if (error) {
    return (
      <Section variant="white">
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">{error}</div>
      </Section>
    );
  }
  if (!initial) {
    return (
      <Section variant="white">
        <p className="text-[var(--color-neutral-500)]">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
      </Section>
    );
  }

  return (
    <Section variant="white">
      <div dir={dir}>
        <div className="mb-6">
          <a
            href={`/${locale}/admin/membership/features`}
            className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)]"
          >
            {isAr ? '← قائمة الميزات' : '← Features list'}
          </a>
        </div>
        <h1
          className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2"
          style={{ fontFamily: headingFont }}
        >
          {isAr ? 'تعديل الميزة: ' : 'Edit feature: '}
          <span className="font-mono">{initial.feature_key}</span>
        </h1>
        <p className="text-[var(--color-neutral-600)] mb-8">
          {isAr
            ? `مفعّلة في ${tiersCount} مرتبة.`
            : `Included in ${tiersCount} tier(s).`}
        </p>

        <FeatureForm locale={locale} mode="edit" initial={initial} />
      </div>
    </Section>
  );
}
