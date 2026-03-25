import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { corporateFaqs } from '@/data/faqs';

export default async function CorporatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const services = isAr
    ? [
      { title: 'دليل المدير العام', desc: 'تطوير القيادة التنفيذية بمنهجية التفكير الحسّي', href: '/programs/corporate/gm-playbook' },
      { title: 'الكوتشينج التنفيذي والجماعي', desc: 'جلسات فردية وجماعية للقيادات', href: '/programs/corporate/executive-coaching' },
      { title: 'التحوّل الثقافي', desc: 'بناء ثقافة مؤسسية قائمة على الوعي الحسّي', href: '/programs/corporate/culture-transformation' },
      { title: 'تيسير مؤسسي', desc: 'أيام تيسير وورش عمل للقيادات', href: '/programs/corporate/facilitation' },
    ]
    : [
      { title: 'GM Playbook', desc: 'Executive leadership development through Somatic Thinking', href: '/programs/corporate/gm-playbook' },
      { title: 'Executive & Team Coaching', desc: 'Individual and team coaching for leaders', href: '/programs/corporate/executive-coaching' },
      { title: 'Culture Transformation', desc: 'Building an organization culture rooted in somatic awareness', href: '/programs/corporate/culture-transformation' },
      { title: 'Corporate Facilitation', desc: 'Facilitation days and leadership workshops', href: '/programs/corporate/facilitation' },
    ];

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'الحلول المؤسسية' : 'Corporate Solutions'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'حلول كوتشينج مخصّصة للمؤسسات والقيادات — مبنية على منهجية التفكير الحسّي' : 'Tailored coaching solutions for organizations and leaders — built on the Somatic Thinking methodology'}
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="grid md:grid-cols-2 gap-6">
          {services.map((service, i) => (
            <div
              key={i}
              className="rounded-[var(--card-radius)] bg-white p-6 shadow-sm hover:shadow-md transition-shadow border border-[var(--color-neutral-200)]"
            >
              <h3 className="font-bold text-xl mb-2">{service.title}</h3>
              <p className="text-[var(--color-neutral-600)]">{service.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      
      <Section variant="white">
        <FAQSection items={corporateFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(corporateFaqs, locale)) }}
        />
      </Section>

      <Section variant="dark" pattern>
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'تواصل مع فريقنا المؤسسي' : 'Contact Our Corporate Team'}
          </Heading>
          <Button variant="primary" size="lg" className="mt-6">
            {isAr ? 'اطلب عرض أسعار' : 'Request a Proposal'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
