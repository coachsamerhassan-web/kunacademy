'use client';

import { use } from 'react';
import { Section } from '@kunacademy/ui/section';
import { LpForm } from '../_form';

export default function AdminLpNewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  return (
    <Section variant="white">
      <div dir={isAr ? 'rtl' : 'ltr'}>
        <div className="mb-6">
          <a
            href={`/${locale}/admin/lp`}
            className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)]"
          >
            {isAr ? '← القائمة' : '← Back to list'}
          </a>
        </div>
        <h1
          className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-6"
          style={{ fontFamily: headingFont }}
        >
          {isAr ? 'صفحة هبوط جديدة' : 'New Landing Page'}
        </h1>
        <LpForm
          locale={locale}
          mode="new"
          initial={{
            slug: '',
            page_type: 'landing',
            published: false,
            launch_lock: false,
            composition_json: '',
            lead_capture_config: '',
            payment_config: '',
            analytics_config: '',
            seo_meta_json: '',
            program_slug: '',
          }}
        />
      </div>
    </Section>
  );
}
