import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { Card } from '@kunacademy/ui/card';

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const benefits = isAr
    ? [
        { icon: '👥', text: 'جلسات إشراف جماعي شهرية' },
        { icon: '📚', text: 'مكتبة موارد حصرية للخرّيجين' },
        { icon: '🤝', text: 'فرص منتورنغ مع كوتشز MCC و PCC' },
        { icon: '⭐', text: 'أولوية التسجيل في البرامج المتقدمة' },
        { icon: '🔗', text: 'شبكة إحالات مهنية' },
      ]
    : [
        { icon: '👥', text: 'Monthly group supervision sessions' },
        { icon: '📚', text: 'Exclusive alumni resource library' },
        { icon: '🤝', text: 'Mentoring opportunities with MCC and PCC coaches' },
        { icon: '⭐', text: 'Priority enrollment in advanced programs' },
        { icon: '🔗', text: 'Professional referral network' },
      ];

  return (
    <main>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'مجتمعنا' : 'Our Community'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'مجتمعنا' : 'Our Community'}
          </p>
        </div>
      </section>

      {/* ── BENEFITS — Cards on white ── */}
      <Section variant="white">
        <Heading level={2} className="text-center mb-8">
          {isAr ? 'مزايا العضوية' : 'Membership Benefits'}
        </Heading>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((item, i) => (
            <Card key={i} accent className="p-6 flex items-start gap-4">
              <span className="text-2xl shrink-0">{item.icon}</span>
              <p className="text-[var(--color-neutral-700)] leading-relaxed">{item.text}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── STATS ── */}
      <Section variant="primary" pattern="flower-of-life">
        <div className="grid grid-cols-3 gap-8 text-center">
          {[
            { num: '+٥٠٠', numEn: '500+', ar: 'خرّيج', en: 'Graduates' },
            { num: '٤', numEn: '4', ar: 'قارات', en: 'Continents' },
            { num: '٢٠+', numEn: '20+', ar: 'بلد', en: 'Countries' },
          ].map((stat) => (
            <div key={stat.en}>
              <p className="text-4xl md:text-5xl font-bold text-white">
                {isAr ? stat.num : stat.numEn}
              </p>
              <p className="mt-2 text-white/75 text-sm">{isAr ? stat.ar : stat.en}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── CTA ── */}
      <Section variant="dark" pattern="girih">
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'انضم إلى مجتمعنا' : 'Join Our Community'}
          </Heading>
          <div className="mt-8">
            <Button variant="primary" size="lg">
              {isAr ? 'ابدأ رحلتك' : 'Start Your Journey'}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
