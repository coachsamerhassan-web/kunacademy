import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'مسار الكوتش | أكاديمية كُن' : 'Coach Pathway | Kun Academy',
    description: isAr ? 'خارطة طريق الكوتش من الصفر إلى الاعتماد الدولي — ACC, PCC, MCC' : 'Your coaching roadmap from zero to international accreditation — ACC, PCC, MCC',
  };
}

export default async function CoachPathwayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'مسار الكوتش' : 'Coach Pathway'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'من المبتدئ إلى المشرف — مسارك المهني في التفكير الحسّي' : 'From beginner to supervisor — your professional path in Somatic Thinking'}
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {(isAr
              ? [
                { step: '١', title: 'الاكتشاف', desc: 'ابدأ بالموارد المجانية واكتشف المنهجية' },
                { step: '٢', title: 'التأسيس (STIC)', desc: '٦٩ ساعة — المهارات الجوهرية وشهادة ICF Level 1' },
                { step: '٣', title: 'التعمّق (STAIC)', desc: '٧٥ ساعة — الأدوات المتقدمة وشهادة ICF Level 2' },
                { step: '٤', title: 'التوسّع (STGC)', desc: '٤٠ ساعة — كوتشينج المجموعات' },
                { step: '٥', title: 'القيادة (STOC)', desc: '٣٦ ساعة — الإشراف والمنتورينج' },
                { step: '٦', title: 'الممارسة', desc: 'انضم لمنصة الكوتشينج وابدأ ممارستك المهنية' },
              ]
              : [
                { step: '1', title: 'Discovery', desc: 'Start with free resources and discover the methodology' },
                { step: '2', title: 'Foundation (STIC)', desc: '69 hours — core skills and ICF Level 1 credential' },
                { step: '3', title: 'Deepening (STAIC)', desc: '75 hours — advanced tools and ICF Level 2 credential' },
                { step: '4', title: 'Expansion (STGC)', desc: '40 hours — group coaching' },
                { step: '5', title: 'Leadership (STOC)', desc: '36 hours — supervision and mentoring' },
                { step: '6', title: 'Practice', desc: 'Join the coaching platform and start your professional practice' },
              ]
            ).map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white font-bold">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{item.title}</h3>
                  <p className="text-[var(--color-neutral-600)] mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Button variant="primary" size="lg">
              {isAr ? 'ابدأ مسارك' : 'Start Your Path'}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
