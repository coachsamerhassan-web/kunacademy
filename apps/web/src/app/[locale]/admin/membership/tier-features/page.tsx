'use client';

import { use, useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import {
  MatrixGrid,
  type TierLite,
  type FeatureLite,
  type MatrixRow,
} from '@/components/admin/membership/matrix-grid';

interface MatrixResp {
  tiers: TierLite[];
  features: FeatureLite[];
  matrix: Array<{
    tier_id: string;
    feature_id: string;
    included: boolean;
    quota: number | null;
  }>;
}

export default function AdminMembershipMatrix({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const [data, setData] = useState<MatrixResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/membership/tier-features')
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          setError(b.error || `HTTP ${r.status}`);
          return;
        }
        const b = (await r.json()) as MatrixResp;
        setData(b);
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
        <h1
          className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2"
          style={{ fontFamily: headingFont }}
        >
          {isAr ? 'مصفوفة الاستحقاق' : 'Entitlement matrix'}
        </h1>
        <p className="text-[var(--color-neutral-600)] mb-8">
          {isAr
            ? 'اضبط أيّ الميزات تحصل عليها كل مرتبة. التغييرات تُطبَّق بعد الحفظ دفعة واحدة.'
            : 'Toggle which tiers include each feature. Changes batch-save to audit cleanly.'}
        </p>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 mb-6">
            {error}
          </div>
        )}

        {!data && !error && (
          <p className="text-[var(--color-neutral-500)]">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        )}

        {data && (
          <MatrixGrid
            locale={locale}
            tiers={data.tiers}
            features={data.features}
            initialRows={data.matrix as MatrixRow[]}
          />
        )}
      </div>
    </Section>
  );
}
