import { setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';

import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function RefundPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>

      <PageHero
        locale={locale}
        titleAr="سياسة الاسترداد"
        titleEn="Refund Policy"
        subtitleAr="سياستنا في الإلغاء والاسترداد"
        subtitleEn="Our cancellation and refund policy"
        
        
        pattern="flower-of-life"
      />
      <Section>
        <div className="mx-auto max-w-3xl">
          <Heading level={1}>{isAr ? 'سياسة الاسترداد' : 'Refund Policy'}</Heading>
          <p className="mt-4 text-[var(--color-neutral-700)]">
            {isAr
              ? 'نلتزم في أكاديمية كُن بالشفافية الكاملة فيما يخص سياسات الاسترداد والإلغاء.'
              : 'Kun Academy is committed to full transparency regarding our refund and cancellation policies.'}
          </p>
          <div className="mt-8 space-y-6 text-[var(--color-neutral-700)]">
            <p>{isAr ? 'المحتوى الكامل لسياسة الاسترداد قيد الإعداد القانوني.' : 'Full refund policy content is under legal review.'}</p>
          </div>
        </div>
      </Section>
    </main>
  );
}
