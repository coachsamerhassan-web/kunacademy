import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function ExecutiveCoachingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'كوتشينج مؤسسي' : 'Corporate Coaching'}
          </p>
          <Heading level={1}>
            {isAr ? 'الكوتشينج التنفيذي والجماعي' : 'Executive & Team Coaching'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'جلسات كوتشينج فردية وجماعية للقيادات التنفيذية'
              : 'Individual and team coaching sessions for executive leaders'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'ما نقدّمه' : 'What We Offer'}
          </Heading>
          <div className="mt-6 grid gap-6">
            {(isAr
              ? [
                { title: 'كوتشينج تنفيذي فردي', desc: 'جلسات ١:١ مع كوتشز معتمدين من ICF' },
                { title: 'كوتشينج فريق القيادة', desc: 'تطوير ديناميكيات الفريق القيادي' },
                { title: 'كوتشينج انتقالي', desc: 'دعم القادة في المراحل الانتقالية' },
              ]
              : [
                { title: 'Individual Executive Coaching', desc: '1:1 sessions with ICF-credentialed coaches' },
                { title: 'Leadership Team Coaching', desc: 'Developing leadership team dynamics' },
                { title: 'Transition Coaching', desc: 'Supporting leaders through transitions' },
              ]
            ).map((item, i) => (
              <div key={i} className="p-4 rounded-[var(--card-radius)] bg-[var(--color-neutral-50)]">
                <h3 className="font-bold">{item.title}</h3>
                <p className="text-[var(--color-neutral-600)] mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
          <Button variant="primary" size="lg" className="mt-8">
            {isAr ? 'تواصل معنا' : 'Get in Touch'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
