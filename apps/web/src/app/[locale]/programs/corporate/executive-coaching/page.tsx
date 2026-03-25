import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function ExecutiveCoachingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'كوتشينج مؤسسي' : 'Corporate Coaching'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'كوتشينج مؤسسي' : 'Corporate Coaching'}
          </p>
        </div>
      </section>

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
