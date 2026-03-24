import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function MethodologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[60vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'التفكير الحسّي®' : 'Somatic Thinking®'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'منهجية كوتشينج أصيلة تبدأ من الجسد — لأن التحوّل الحقيقي يُعاش، لا يُفكَّر فيه فقط'
              : 'An original coaching methodology that starts from the body — because real transformation is experienced, not just thought about'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'ما هو التفكير الحسّي؟' : 'What is Somatic Thinking?'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'التفكير الحسّي® هو منهجية كوتشينج طوّرها سامر حسن تعتمد على الإشارات الحسّية الجسدية كبوابة للوعي والتحوّل. الجسد يعرف قبل العقل — والمنهجية تعلّمك كيف تستمع لهذه المعرفة وتوظّفها في الكوتشينج والحياة.'
              : 'Somatic Thinking® is a coaching methodology developed by Samer Hassan that relies on somatic body signals as a gateway to awareness and transformation. The body knows before the mind — and this methodology teaches you how to listen to this knowledge and apply it in coaching and life.'}
          </p>
        </div>
      </Section>

      <Section variant="default">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'الأركان الثلاثة' : 'The Three Pillars'}
          </Heading>
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            {(isAr
              ? [
                { title: 'الجسد', desc: 'الإشارات الحسّية الجسدية كمصدر أول للمعلومات' },
                { title: 'النَّفْس', desc: 'فهم النَّفْس وطبقاتها من منظور توحيدي' },
                { title: 'العلاقة', desc: 'بناء علاقة كوتشينج قائمة على الحضور الحسّي' },
              ]
              : [
                { title: 'The Body', desc: 'Somatic body signals as the primary source of information' },
                { title: 'The Self', desc: 'Understanding the self and its layers from a Tawhidi perspective' },
                { title: 'The Relationship', desc: 'Building a coaching relationship grounded in somatic presence' },
              ]
            ).map((pillar, i) => (
              <div key={i} className="text-center p-6 rounded-[var(--card-radius)] bg-white shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary)] font-bold text-xl">
                  {i + 1}
                </div>
                <h3 className="font-bold text-lg">{pillar.title}</h3>
                <p className="text-[var(--color-neutral-600)] mt-2 text-sm">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section variant="dark" pattern>
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'ابدأ رحلتك مع التفكير الحسّي' : 'Begin Your Somatic Thinking Journey'}
          </Heading>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Button variant="primary" size="lg">
              {isAr ? 'استكشف البرامج' : 'Explore Programs'}
            </Button>
            <Button variant="secondary" size="lg">
              {isAr ? 'اقرأ البحث العلمي' : 'Read the Research'}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
