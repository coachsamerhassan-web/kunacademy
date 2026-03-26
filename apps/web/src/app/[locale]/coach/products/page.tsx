'use client';

import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { use } from 'react';

export default function CoachProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';

  return (
    <Section variant="white">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{isAr ? 'منتجاتي' : 'My Products'}</h1>
      <div className="text-center py-16">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
          <svg className="w-7 h-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{isAr ? 'لا توجد منتجات بعد' : 'No products yet'}</h2>
        <p className="text-sm text-[var(--color-neutral-500)] mt-2">{isAr ? 'أضف خدماتك وباقاتك ليتمكّن العملاء من حجزها' : 'Add your services and packages for clients to book'}</p>
      </div>
    </Section>
  );
}
