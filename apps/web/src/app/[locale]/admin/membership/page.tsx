'use client';

import { use, useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';

/**
 * /admin/membership — Wave F.3 index.
 *
 * 4 cards for F.3 surfaces (tiers, features, matrix, pricing).
 * Cards for /members + /activity are placeholders until Wave F.4/F.6
 * ship their own surfaces.
 */

interface IndexCounts {
  tiers: number;
  features: number;
  tier_features_included: number;
  pricing_rows: number;
}

export default function AdminMembershipIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const [counts, setCounts] = useState<IndexCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Parallel fetches; counts come from the existing list endpoints.
    Promise.all([
      fetch('/api/admin/membership/tiers').then((r) => r.json()),
      fetch('/api/admin/membership/features').then((r) => r.json()),
      fetch('/api/admin/membership/tier-features').then((r) => r.json()),
      fetch('/api/admin/membership/pricing').then((r) => r.json()),
    ])
      .then(([t, f, m, p]) => {
        const matrixIncluded = (m.matrix ?? []).filter((x: { included: boolean }) => x.included).length;
        setCounts({
          tiers: (t.tiers ?? []).length,
          features: (f.features ?? []).length,
          tier_features_included: matrixIncluded,
          pricing_rows: (p.pricing ?? []).length,
        });
      })
      .catch(() => setError(isAr ? 'فشل التحميل' : 'Failed to load'));
  }, [isAr]);

  const cards = [
    {
      href: `/${locale}/admin/membership/tiers`,
      labelAr: 'المراتب',
      labelEn: 'Tiers',
      summary: counts ? (isAr ? `${counts.tiers} مرتبة` : `${counts.tiers} tiers`) : '…',
      descAr: 'إدارة المراتب: Free, Paid-1…',
      descEn: 'Manage subscription tiers (Free, Paid-1…)',
    },
    {
      href: `/${locale}/admin/membership/features`,
      labelAr: 'الميزات',
      labelEn: 'Features',
      summary: counts ? (isAr ? `${counts.features} ميزة` : `${counts.features} features`) : '…',
      descAr: 'كتالوج الميزات القابل للتوسّع.',
      descEn: 'Extensible feature catalog.',
    },
    {
      href: `/${locale}/admin/membership/tier-features`,
      labelAr: 'مصفوفة الاستحقاق',
      labelEn: 'Entitlement matrix',
      summary: counts
        ? (isAr ? `${counts.tier_features_included} ربط مفعّل` : `${counts.tier_features_included} active mappings`)
        : '…',
      descAr: 'شبكة الميزات × المراتب.',
      descEn: 'Features × tiers grid.',
    },
    {
      href: `/${locale}/admin/membership/pricing`,
      labelAr: 'الأسعار القابلة للتحرير',
      labelEn: 'Editable pricing',
      summary: counts ? (isAr ? `${counts.pricing_rows} سعر` : `${counts.pricing_rows} rows`) : '…',
      descAr: 'تحرير أسعار الجلسات والاشتراكات والخصومات.',
      descEn: 'Edit coach rates, tier rates, discount %.',
    },
    {
      href: `/${locale}/admin/coupons`,
      labelAr: 'كوبونات الخصم',
      labelEn: 'Discount coupons',
      summary: isAr ? 'F.5' : 'F.5',
      descAr: 'إنشاء وإدارة الكوبونات وسجل الاستبدالات.',
      descEn: 'CRUD coupons + redemption log + CSV export.',
    },
  ];

  return (
    <Section variant="white">
      <div dir={dir}>
        <div className="mb-8">
          <h1
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'الاشتراكات والعضويّات' : 'Membership'}
          </h1>
          <p className="text-[var(--color-neutral-600)]">
            {isAr
              ? 'إدارة المراتب والميزات ومصفوفة الاستحقاق والأسعار (Wave F.3).'
              : 'Manage tiers, features, the entitlement matrix, and editable prices (Wave F.3).'}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className="block rounded-2xl border border-[var(--color-neutral-100)] bg-white p-5 hover:border-[var(--color-primary)]/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2
                  className="text-lg font-semibold text-[var(--text-primary)]"
                  style={{ fontFamily: headingFont }}
                >
                  {isAr ? c.labelAr : c.labelEn}
                </h2>
                <span className="text-xs font-mono text-[var(--color-neutral-400)]">{c.summary}</span>
              </div>
              <p className="text-sm text-[var(--color-neutral-600)]">
                {isAr ? c.descAr : c.descEn}
              </p>
            </a>
          ))}
        </div>

        {/* Future surfaces placeholder */}
        <div className="mt-8 rounded-xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)]/40 p-5 text-sm text-[var(--color-neutral-700)]">
          <p className="font-semibold text-[var(--text-primary)] mb-2">
            {isAr ? 'قادم في موجات لاحقة' : 'Coming in later waves'}
          </p>
          <ul className="list-disc list-inside leading-relaxed space-y-1">
            <li>{isAr ? 'قائمة الأعضاء (F.4)' : 'Members list (F.4)'}</li>
            <li>{isAr ? 'سجل النشاط: اشتراكات/إلغاءات/فواتير فاشلة (F.6)' : 'Activity log: subs, cancellations, failed payments (F.6)'}</li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
