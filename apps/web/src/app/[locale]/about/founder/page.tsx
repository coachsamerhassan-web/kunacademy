import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import type { Metadata } from 'next';
import { Card } from '@kunacademy/ui/card';
import { Award, Trophy, MessageCircle, GraduationCap, Brain } from 'lucide-react';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'سامر حسن — المؤسس | أكاديمية كُن' : 'Samer Hassan — Founder | Kun Academy',
    description: isAr
      ? 'أول عربي MCC — مؤسس التفكير الحسّي® وأكاديمية كُن. أكثر من ١٠ آلاف جلسة و٥٠٠+ كوتش متخرّج'
      : 'First Arab MCC. Founder of Somatic Thinking® and Kun Academy. 10,000+ sessions, 500+ coaches graduated.',
  };
}

export default async function FounderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'المؤسس' : 'Founder'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'المؤسس' : 'Founder'}
          </p>
        </div>
      </section>

      {/* ── CREDENTIALS — Cards on white ── */}
      <Section variant="white">
        <Heading level={2} className="text-center mb-8">
          {isAr ? 'الإنجازات' : 'Credentials'}
        </Heading>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(isAr
            ? [
                { icon: <Award className="w-6 h-6" aria-hidden="true" />, text: 'أول عربي يحصل على شهادة Master Certified Coach (MCC) من ICF' },
                { icon: <Trophy className="w-6 h-6" aria-hidden="true" />, text: 'حائز على جائزة القائد الشاب من ICF لعام 2019' },
                { icon: <MessageCircle className="w-6 h-6" aria-hidden="true" />, text: 'أكثر من 10,000 جلسة كوتشنغ فردية' },
                { icon: <GraduationCap className="w-6 h-6" aria-hidden="true" />, text: 'تخريج أكثر من 500 كوتش في 13 دولة' },
                { icon: <Brain className="w-6 h-6" aria-hidden="true" />, text: 'مؤسس منهجية التفكير الحسّي® — إطار كوتشنغ يربط الفكر بالإشارات الحسّية الجسدية' },
              ]
            : [
                { icon: <Award className="w-6 h-6" aria-hidden="true" />, text: 'ICF Master Certified Coach (MCC) — first Arab to hold this credential' },
                { icon: <Trophy className="w-6 h-6" aria-hidden="true" />, text: 'ICF Young Leader Award 2019' },
                { icon: <MessageCircle className="w-6 h-6" aria-hidden="true" />, text: '10,000+ individual coaching sessions' },
                { icon: <GraduationCap className="w-6 h-6" aria-hidden="true" />, text: '500+ coaches graduated across 13 countries' },
                { icon: <Brain className="w-6 h-6" aria-hidden="true" />, text: 'Creator of Somatic Thinking® — connecting thought to somatic bodily signals' },
              ]
          ).map((item, i) => (
            <Card key={i} accent className="p-6 flex items-start gap-4">
              <span className="shrink-0 text-[var(--color-primary)]">{item.icon}</span>
              <p className="text-[var(--color-neutral-700)] leading-relaxed">{item.text}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── BIOGRAPHY — Tonal surface ── */}
      <Section variant="surface-high" pattern="flower-of-life">
        <div className="max-w-3xl mx-auto">
          <Heading level={2} className="text-center mb-6">
            {isAr ? 'عن سامر' : 'About Samer'}
          </Heading>
          <div className="space-y-4 text-[var(--color-neutral-700)] leading-relaxed text-lg">
            <p>
              {isAr
                ? 'سامر حسن كوتش ومدرّب كوتشنغ إيطالي-مصري مقيم في دبي. طوّر منهجية التفكير الحسّي® من واقع آلاف الجلسات والتجارب العملية — منهجية تُعيد الجسد إلى مركز عملية التغيير، لأن التحوّل الحقيقي لا يبدأ بالفكرة بل بالإحساس.'
                : 'Samer Hassan is an Italian-Egyptian coach and coaching educator based in Dubai. He developed Somatic Thinking® from thousands of sessions and lived experience — a methodology that places the body at the center of the change process, because real transformation begins with sensation, not idea.'}
            </p>
            <p>
              {isAr
                ? 'يعمل سامر بثلاث لغات ويُدرّب كوتشز في الخليج والشرق الأوسط وأوروبا وأفريقيا. يقود من خلال أكاديمية كُن برامج معتمدة من ICF لتأهيل كوتشز يجسّدون الإحسان في ممارستهم المهنية.'
                : 'Working in three languages, Samer trains coaches across the Gulf, Middle East, Europe, and Africa. Through Kun Academy, he leads ICF-accredited programs that develop coaches who embody Ihsan in their professional practice.'}
            </p>
          </div>
        </div>
      </Section>

      {/* ── CTA ── */}
      <Section variant="dark" pattern="girih">
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'ابدأ رحلتك مع سامر' : 'Start Your Journey with Samer'}
          </Heading>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="primary" size="lg">
              {isAr ? 'استكشف البرامج' : 'Explore Programs'}
            </Button>
            <Button variant="white" size="lg">
              {isAr ? 'احجز جلسة' : 'Book a Session'}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
