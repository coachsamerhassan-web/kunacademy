import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

const faqs = [
  {
    ar: { q: 'ما هو التفكير الحسّي®؟', a: 'التفكير الحسّي® هو منهجية كوتشنغ طوّرها سامر حسن تربط الفكر بالإشارات الحسّية الجسدية. تعتمد على أن التحوّل الحقيقي يبدأ من الجسد لا من العقل وحده.' },
    en: { q: 'What is Somatic Thinking®?', a: 'Somatic Thinking® is a coaching methodology developed by Samer Hassan that connects thought to somatic bodily signals. It is built on the premise that real transformation starts from the body, not the mind alone.' },
  },
  {
    ar: { q: 'هل البرامج معتمدة من ICF؟', a: 'نعم، برامج أكاديمية كُن معتمدة من الاتحاد الدولي للكوتشنغ (ICF) في المستويين الأول والثاني.' },
    en: { q: 'Are the programs ICF-accredited?', a: 'Yes, Kun Academy programs are accredited by the International Coaching Federation (ICF) at both Level 1 and Level 2.' },
  },
  {
    ar: { q: 'هل أحتاج خبرة سابقة في الكوتشنغ؟', a: 'لا. برامج المستوى الأول مصمّمة للمبتدئين. نرحّب بالمهنيين من جميع الخلفيات الذين يرغبون في تعلّم الكوتشنغ.' },
    en: { q: 'Do I need prior coaching experience?', a: 'No. Level 1 programs are designed for beginners. We welcome professionals from all backgrounds who want to learn coaching.' },
  },
  {
    ar: { q: 'ما هي لغة التدريس؟', a: 'البرامج تُقدّم بالعربية والإنجليزية. بعض البرامج ثنائية اللغة.' },
    en: { q: 'What language are programs taught in?', a: 'Programs are offered in Arabic and English. Some programs are bilingual.' },
  },
  {
    ar: { q: 'كيف يمكنني التسجيل؟', a: 'يمكنك التسجيل عبر صفحة البرامج أو التواصل معنا مباشرة عبر صفحة الاتصال.' },
    en: { q: 'How can I enroll?', a: 'You can enroll through the programs page or contact us directly via the contact page.' },
  },
  {
    ar: { q: 'هل يوجد خيارات للدفع بالتقسيط؟', a: 'نعم، نوفّر خطط دفع مرنة لمعظم البرامج. تواصل معنا للتفاصيل.' },
    en: { q: 'Are payment plans available?', a: 'Yes, we offer flexible payment plans for most programs. Contact us for details.' },
  },
];

export default async function FAQPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'إجابات على الأسئلة الأكثر شيوعًا حول أكاديمية كُن وبرامجها.'
            : 'Answers to the most common questions about Kun Academy and its programs.'}
        </p>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl space-y-4">
          {faqs.map((faq, i) => {
            const item = isAr ? faq.ar : faq.en;
            return (
              <details
                key={i}
                className="group rounded-lg border border-[var(--color-neutral-200)] px-6 py-4"
              >
                <summary className="cursor-pointer font-medium text-[var(--color-neutral-800)] list-none flex items-center justify-between">
                  {item.q}
                  <span className="text-[var(--color-neutral-400)] group-open:rotate-180 transition-transform">
                    &#9662;
                  </span>
                </summary>
                <p className="mt-3 text-[var(--color-neutral-600)]">{item.a}</p>
              </details>
            );
          })}
        </div>
      </Section>
    </main>
  );
}
