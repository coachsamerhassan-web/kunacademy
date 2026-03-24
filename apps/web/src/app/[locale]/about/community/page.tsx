import { setRequestLocale } from 'next-intl/server';
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
      <Section variant="surface" pattern="eight-star" hero>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-medium tracking-widest uppercase text-[var(--color-accent)] mb-4">
            {isAr ? 'مجتمعنا' : 'Our Community'}
          </p>
          <Heading level={1} className="!text-[var(--color-primary)] !leading-[1.15]">
            {isAr ? 'مجتمع الخرّيجين' : 'Alumni & Community'}
          </Heading>
          <p className="mt-6 text-lg text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'أكثر من 500 كوتش تخرّجوا من أكاديمية كُن ويشكّلون اليوم مجتمعًا حيًا يمتد عبر 4 قارات — مجتمع مبني على الإحسان والممارسة الحسّية المستمرة.'
              : 'Over 500 coaches have graduated from Kun Academy, forming a living community spanning 4 continents — built on Ihsan and continuous somatic practice.'}
          </p>
        </div>
      </Section>

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
