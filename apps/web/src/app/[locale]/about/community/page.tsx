import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { Card } from '@kunacademy/ui/card';
import { Users, BookOpen, Handshake, Star, Link as LinkIcon } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'مجتمع كُن | أكاديمية كُن' : 'Kun Community | Kun Academy',
    description: isAr ? 'أكثر من ٥٠٠ كوتش في ١٣ دولة — انضم لأكبر مجتمع عربي للكوتشينج' : '500+ coaches across 13 countries — join the largest Arab coaching community',
  };
}

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const iconClass = "w-6 h-6";
  const benefits = isAr
    ? [
        { icon: <Users className={iconClass} aria-hidden="true" />, text: 'جلسات إشراف جماعي شهرية' },
        { icon: <BookOpen className={iconClass} aria-hidden="true" />, text: 'مكتبة موارد حصرية للخرّيجين' },
        { icon: <Handshake className={iconClass} aria-hidden="true" />, text: 'فرص منتورنغ مع كوتشز MCC و PCC' },
        { icon: <Star className={iconClass} aria-hidden="true" />, text: 'أولوية التسجيل في البرامج المتقدمة' },
        { icon: <LinkIcon className={iconClass} aria-hidden="true" />, text: 'شبكة إحالات مهنية' },
      ]
    : [
        { icon: <Users className={iconClass} aria-hidden="true" />, text: 'Monthly group supervision sessions' },
        { icon: <BookOpen className={iconClass} aria-hidden="true" />, text: 'Exclusive alumni resource library' },
        { icon: <Handshake className={iconClass} aria-hidden="true" />, text: 'Mentoring opportunities with MCC and PCC coaches' },
        { icon: <Star className={iconClass} aria-hidden="true" />, text: 'Priority enrollment in advanced programs' },
        { icon: <LinkIcon className={iconClass} aria-hidden="true" />, text: 'Professional referral network' },
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
              <span className="shrink-0 text-[var(--color-primary)]">{item.icon}</span>
              <p className="text-[var(--color-neutral-700)] leading-relaxed">{item.text}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── STATS ── */}
      <Section variant="primary" pattern="flower-of-life">
        <div className="grid grid-cols-3 gap-8 text-center">
          {[
            { num: '٥٠٠+', numEn: '500+', ar: 'خرّيج', en: 'Graduates' },
            { num: '١٣', numEn: '13', ar: 'دولة', en: 'Countries' },
            { num: '~مليون', numEn: '~1M', ar: 'حياة تأثّرت', en: 'Lives touched' },
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
