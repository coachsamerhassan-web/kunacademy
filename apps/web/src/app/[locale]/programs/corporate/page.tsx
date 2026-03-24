import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

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
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'الحلول المؤسسية' : 'Corporate Solutions'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'حلول كوتشينج مخصّصة للمؤسسات والقيادات — مبنية على منهجية التفكير الحسّي'
              : 'Tailored coaching solutions for organizations and leaders — built on the Somatic Thinking methodology'}
          </p>
        </div>
      </Section>

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
