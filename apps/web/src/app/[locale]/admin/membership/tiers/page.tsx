'use client';

import { use, useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { TierForm, type TierFormState } from '@/components/admin/membership/tier-form';

interface TierRow {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
  currency: string;
  sort_order: number;
  is_public: boolean;
  is_active: boolean;
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
  updated_at: string;
  active_members: number;
}

const EMPTY: TierFormState = {
  slug: '',
  name_ar: '',
  name_en: '',
  description_ar: '',
  description_en: '',
  price_monthly_cents: 0,
  price_annual_cents: 0,
  currency: 'AED',
  sort_order: 0,
  is_public: true,
  is_active: true,
};

export default function AdminMembershipTiersList({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const [rows, setRows] = useState<TierRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    fetch('/api/admin/membership/tiers')
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          setError(b.error || `HTTP ${r.status}`);
          return;
        }
        const b = await r.json();
        setRows(b.tiers ?? []);
      })
      .catch(() => setError(isAr ? 'فشل التحميل' : 'Failed to load'));
  }, [isAr]);

  function formatPrice(cents: number, currency: string) {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }

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
              {isAr ? 'المراتب' : 'Tiers'}
            </h1>
            <p className="text-[var(--color-neutral-600)]">
              {isAr
                ? 'مراتب الاشتراك. كل مرتبة ترتبط بمنتج Stripe + سعر شهري + سعر سنوي.'
                : 'Subscription tiers. Each tier maps to a Stripe Product + monthly/annual Price.'}
            </p>
          </div>
          <button
            onClick={() => setShowNew(!showNew)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--color-accent-500)]"
          >
            {showNew ? (isAr ? 'إغلاق' : 'Close') : (isAr ? '+ مرتبة جديدة' : '+ New tier')}
          </button>
        </div>

        {showNew && (
          <Card className="p-6 mb-6 border-2 border-[var(--color-accent)]/30">
            <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: headingFont }}>
              {isAr ? 'إنشاء مرتبة جديدة' : 'Create new tier'}
            </h2>
            <TierForm locale={locale} mode="new" initial={EMPTY} />
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
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'الرابط' : 'Slug'}</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'الاسم' : 'Name'}</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'شهري' : 'Monthly'}</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'سنوي' : 'Annual'}</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'أعضاء' : 'Members'}</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">Stripe</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'حالة' : 'Status'}</th>
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
                        href={`/${locale}/admin/membership/tiers/${row.id}`}
                        className="font-mono font-medium text-[var(--color-primary)] hover:underline"
                      >
                        {row.slug}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {isAr ? row.name_ar : row.name_en}
                    </td>
                    <td className="px-4 py-3">
                      {formatPrice(row.price_monthly_cents, row.currency)}
                    </td>
                    <td className="px-4 py-3">
                      {formatPrice(row.price_annual_cents, row.currency)}
                    </td>
                    <td className="px-4 py-3 font-semibold">{row.active_members}</td>
                    <td className="px-4 py-3 text-xs">
                      {row.stripe_product_id ? (
                        <span className="text-green-700">✓</span>
                      ) : (
                        <span className="text-[var(--color-neutral-400)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-col gap-0.5">
                        {row.is_active ? (
                          <span className="text-green-700">● {isAr ? 'فعّال' : 'active'}</span>
                        ) : (
                          <span className="text-[var(--color-neutral-400)]">○ {isAr ? 'معطّل' : 'inactive'}</span>
                        )}
                        {row.is_public ? (
                          <span className="text-[var(--color-neutral-500)]">{isAr ? 'عام' : 'public'}</span>
                        ) : (
                          <span className="text-[var(--color-neutral-400)]">{isAr ? 'مخفي' : 'hidden'}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      <a
                        href={`/${locale}/admin/membership/tiers/${row.id}`}
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
