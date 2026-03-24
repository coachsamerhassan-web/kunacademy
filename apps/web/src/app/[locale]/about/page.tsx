import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { FAQSection, faqJsonLd } from '@kunacademy/ui/faq-section';
import { aboutFaqs } from '@/data/faqs';

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'عن أكاديمية كُن' : 'About Kun Academy'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'أكاديمية كُن هي المؤسسة الرائدة في تدريب الكوتشنغ المبني على التفكير الحسّي — منهجية تربط الفكر بالتجربة الجسدية لتحقيق تحوّل حقيقي ومستدام. أسّسها سامر حسن، أول عربي يحصل على شهادة MCC من الاتحاد الدولي للكوتشنغ.'
            : 'Kun Academy is the leading institution in coaching education built on Somatic Thinking® — a methodology that connects thought to bodily experience for authentic, lasting transformation. Founded by Samer Hassan, the first Arab to hold the ICF Master Certified Coach credential.'}
        </p>
      </Section>

      <Section>
        <Heading level={2}>{isAr ? 'رؤيتنا' : 'Our Vision'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'أن يصبح التفكير الحسّي الإطار المرجعي الأول للكوتشنغ في العالم العربي.'
            : 'To make Somatic Thinking® the primary coaching framework in the Arab world.'}
        </p>
      </Section>

      <Section>
        <Heading level={2}>{isAr ? 'مهمتنا' : 'Our Mission'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'تخريج كوتشز يقودون بالنَّفْس لا بالنظرية — كوتشز يُجسّدون الإحسان في كل جلسة.'
            : 'To graduate coaches who lead with the self, not theory — coaches who embody Ihsan in every session.'}
        </p>
      </Section>

      
      <Section variant="white">
        <FAQSection items={aboutFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(aboutFaqs, locale)) }}
        />
      </Section>

      <Section>
        <Heading level={2}>{isAr ? 'بالأرقام' : 'By the Numbers'}</Heading>
        <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
          {[
            { num: '500+', ar: 'كوتش متخرّج', en: 'Coaches graduated' },
            { num: '4', ar: 'قارات', en: 'Continents' },
            { num: '3', ar: 'لغات', en: 'Languages' },
            { num: '10,000+', ar: 'جلسة كوتشنغ', en: 'Coaching sessions' },
          ].map((stat) => (
            <div key={stat.en} className="text-center">
              <p className="text-3xl font-bold text-[var(--color-primary)]">{stat.num}</p>
              <p className="mt-1 text-[var(--color-neutral-600)]">{isAr ? stat.ar : stat.en}</p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
