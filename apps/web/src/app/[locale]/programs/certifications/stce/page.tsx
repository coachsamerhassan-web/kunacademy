import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { FAQSection, faqJsonLd } from '@kunacademy/ui/faq-section';
import { stceFaqs } from '@/data/faqs';

const levels = {
  ar: [
    { num: 1, name: 'STIC', title: 'مقدمة في التفكير الحسّي', hours: 79, href: '/programs/certifications/stce/level-1', desc: 'الأساسيات والمهارات الجوهرية للكوتشينج الحسّي' },
    { num: 2, name: 'STAIC', title: 'التفكير الحسّي المتقدم', hours: 106, href: '/programs/certifications/stce/level-2', desc: 'التعمّق في منهجية التفكير الحسّي وأدواته المتقدمة' },
    { num: 3, name: 'STGC', title: 'كوتشينج المجموعات', hours: 34, href: '/programs/certifications/stce/level-3', desc: 'تيسير جلسات الكوتشينج الجماعي بمنهجية التفكير الحسّي' },
    { num: 4, name: 'STOC', title: 'الإشراف على الكوتشينج', hours: 37, href: '/programs/certifications/stce/level-4', desc: 'الإشراف والمنتورينج للكوتشز المتدربين' },
  ],
  en: [
    { num: 1, name: 'STIC', title: 'Somatic Thinking Introduction to Coaching', hours: 79, href: '/programs/certifications/stce/level-1', desc: 'Foundational skills in somatic coaching methodology' },
    { num: 2, name: 'STAIC', title: 'Somatic Thinking Advanced Integrated Coaching', hours: 106, href: '/programs/certifications/stce/level-2', desc: 'Deep dive into advanced Somatic Thinking tools and techniques' },
    { num: 3, name: 'STGC', title: 'Somatic Thinking Group Coaching', hours: 34, href: '/programs/certifications/stce/level-3', desc: 'Facilitating group coaching sessions using Somatic Thinking' },
    { num: 4, name: 'STOC', title: 'Somatic Thinking Oversight of Coaching', hours: 37, href: '/programs/certifications/stce/level-4', desc: 'Supervising and mentoring trainee coaches' },
  ],
};

export default async function STCEPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const items = isAr ? levels.ar : levels.en;
  const totalHours = items.reduce((sum, l) => sum + l.hours, 0);

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'الشهادة الرئيسية' : 'Flagship Certification'}
          </p>
          <Heading level={1}>
            {isAr ? 'شهادة التفكير الحسّي في الكوتشينج (STCE)' : 'Somatic Thinking Coaching Education (STCE)'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? `${totalHours} ساعة تدريبية | ٤ مستويات | معتمد من ICF`
              : `${totalHours} training hours | 4 levels | ICF-Accredited`}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="text-center mb-12">
          <Heading level={2}>
            {isAr ? 'المستويات الأربعة' : 'The Four Levels'}
          </Heading>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {items.map((level) => (
            <div
              key={level.num}
              className="rounded-[var(--card-radius)] bg-white p-6 shadow-sm hover:shadow-md transition-shadow border border-[var(--color-neutral-200)]"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)] text-white font-bold text-lg">
                  {level.num}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{level.name}</h3>
                  <p className="text-sm text-[var(--color-accent)]">
                    {level.hours} {isAr ? 'ساعة' : 'hours'}
                  </p>
                </div>
              </div>
              <h4 className="font-semibold mb-2">{level.title}</h4>
              <p className="text-[var(--color-neutral-600)]">{level.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      
      <Section variant="white">
        <FAQSection items={stceFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(stceFaqs, locale)) }}
        />
      </Section>

      <Section variant="default">
        <div className="text-center">
          <Heading level={2}>
            {isAr ? 'الباقات' : 'Packages'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)] max-w-2xl mx-auto">
            {isAr
              ? 'وفّر أكثر مع باقاتنا المجمّعة — الباقة المهنية أو باقة الإتقان'
              : 'Save more with our bundled packages — Professional or Mastery'}
          </p>
          <Button variant="primary" size="lg" className="mt-6">
            {isAr ? 'استعرض الباقات' : 'View Packages'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
