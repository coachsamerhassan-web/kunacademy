import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function WisalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'وِصال — كوتشينج الأسرة' : 'Wisal — Family Coaching'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'جلسات كوتشينج أسرية تعزّز التواصل والترابط من خلال الإشارات الحسّية الجسدية'
              : 'Family coaching sessions that strengthen communication and bonding through somatic body signals'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'عن وِصال' : 'About Wisal'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'برنامج وِصال يقدّم جلسات كوتشينج أسرية مبنية على منهجية التفكير الحسّي، تساعد الأسر على بناء تواصل أعمق وفهم أفضل للإشارات الحسّية الجسدية لكل فرد في الأسرة.'
              : 'Wisal offers family coaching sessions built on the Somatic Thinking methodology, helping families build deeper communication and better understanding of each family member\'s somatic body signals.'}
          </p>
          <Button variant="primary" size="lg" className="mt-8">
            {isAr ? 'احجز جلسة أسرية' : 'Book a Family Session'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
