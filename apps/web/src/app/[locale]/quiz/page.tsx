import { setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';

import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { QuizWidget } from './quiz-widget';

export default async function QuizPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>

      <PageHero
        locale={locale}
        titleAr="اختبار تحديد المسار"
        titleEn="Path Assessment Quiz"
        subtitleAr="أجب على بضعة أسئلة لنرشدك للبرنامج المناسب"
        subtitleEn="Answer a few questions and we'll guide you to the right program"
        
        
        pattern="girih"
      />
      <Section variant="default">
        <div className="text-center max-w-2xl mx-auto">
          <Heading level={1}>{isAr ? 'اكتشف برنامجك المناسب' : 'Find Your Perfect Program'}</Heading>
          <p className="mt-4 text-[var(--color-neutral-600)]">
            {isAr ? 'أجب على 5 أسئلة بسيطة وسنرشدك إلى البرنامج الأنسب لأهدافك' : 'Answer 5 simple questions and we\'ll match you to the right program'}
          </p>
        </div>
      </Section>
      <Section variant="white">
        <QuizWidget locale={locale} />
      </Section>
    </main>
  );
}
