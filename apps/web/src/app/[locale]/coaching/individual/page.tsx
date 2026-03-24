import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* ── Hero ── */}
      <Section variant="surface" pattern="eight-star" hero>
        <div className="max-w-3xl mx-auto text-center">
          <Heading level={1}>
            {isAr ? 'كوتشينج فردي' : 'Individual Coaching'}
          </Heading>
          <p className="mt-6 text-lg text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'اكتشف المزيد عن هذا القسم وكيف يمكن أن يساعدك في رحلتك'
              : 'Discover more about this section and how it can help your journey'}
          </p>
        </div>
      </Section>

      {/* ── Content ── */}
      <Section variant="white">
        <div className="prose prose-lg max-w-4xl mx-auto rtl:prose-invert">
          <p className="text-[var(--color-neutral-600)]">
            {isAr ? 'المحتوى قيد التحديث — سيتم إضافته قريبًا' : 'Content coming soon'}
          </p>
        </div>
      </Section>

      {/* ── CTA ── */}
      <Section variant="dark" pattern="girih">
        <div className="text-center">
          <Heading level={2} className="!text-white">
            {isAr ? 'ابدأ رحلتك' : 'Start Your Journey'}
          </Heading>
          <p className="mt-4 text-white/80 max-w-xl mx-auto">
            {isAr ? 'تواصل معنا لتعرف المزيد' : 'Get in touch to learn more'}
          </p>
          <div className="mt-8">
            <Button variant="primary" size="lg">
              {isAr ? 'تواصل معنا' : 'Contact Us'}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
