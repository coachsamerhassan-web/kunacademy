'use client';

import { Section } from '@kunacademy/ui/section';
import { use } from 'react';

export default function CertificatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';

  return (
    <Section variant="white">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        {isAr ? 'شهاداتي' : 'My Certificates'}
      </h1>
      <div className="text-center py-16">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
          <svg className="w-7 h-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{isAr ? 'لا توجد شهادات بعد' : 'No certificates yet'}</h2>
        <p className="text-sm text-[var(--color-neutral-500)] mt-2 mb-6">
          {isAr ? 'أكمل دورة أو برنامج للحصول على شهادتك' : 'Complete a course or program to earn your certificate'}
        </p>
        <a href={`/${locale}/academy`} className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white min-h-[44px]">
          {isAr ? 'تصفّح البرامج' : 'Browse Programs'}
        </a>
      </div>
    </Section>
  );
}
