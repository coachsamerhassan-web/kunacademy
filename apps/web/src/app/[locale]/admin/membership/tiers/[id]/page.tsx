'use client';

import { use, useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { TierForm, type TierFormState } from '@/components/admin/membership/tier-form';

export default function AdminMembershipTierEdit({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const [initial, setInitial] = useState<TierFormState | null>(null);
  const [activeMembers, setActiveMembers] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/membership/tiers/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          setError(b.error || `HTTP ${r.status}`);
          return;
        }
        const b = await r.json();
        const t = b.tier;
        setInitial({
          id: t.id,
          slug: t.slug,
          name_ar: t.name_ar,
          name_en: t.name_en,
          description_ar: t.description_ar ?? '',
          description_en: t.description_en ?? '',
          price_monthly_cents: t.price_monthly_cents,
          price_annual_cents: t.price_annual_cents,
          currency: t.currency,
          sort_order: t.sort_order,
          is_public: !!t.is_public,
          is_active: !!t.is_active,
          stripe_product_id: t.stripe_product_id,
          stripe_price_id_monthly: t.stripe_price_id_monthly,
          stripe_price_id_annual: t.stripe_price_id_annual,
        });
        setActiveMembers(b.active_members ?? 0);
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
            href={`/${locale}/admin/membership/tiers`}
            className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)]"
          >
            {isAr ? '← قائمة المراتب' : '← Tiers list'}
          </a>
        </div>
        <h1
          className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2"
          style={{ fontFamily: headingFont }}
        >
          {isAr ? 'تعديل المرتبة: ' : 'Edit tier: '}
          <span className="font-mono">{initial.slug}</span>
        </h1>
        <p className="text-[var(--color-neutral-600)] mb-8">
          {isAr
            ? `${activeMembers} عضو فعّال حالياً.`
            : `${activeMembers} active member(s) on this tier.`}
        </p>

        <TierForm locale={locale} mode="edit" initial={initial} />
      </div>
    </Section>
  );
}
