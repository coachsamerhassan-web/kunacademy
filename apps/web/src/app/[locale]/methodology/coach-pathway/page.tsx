import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function CoachPathwayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'مسار الكوتش' : 'Coach Pathway'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'من المبتدئ إلى المشرف — مسارك المهني في التفكير الحسّي'
              : 'From beginner to supervisor — your professional path in Somatic Thinking'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {(isAr
              ? [
                { step: '١', title: 'الاكتشاف', desc: 'ابدأ بالموارد المجانية واكتشف المنهجية' },
                { step: '٢', title: 'التأسيس (STIC)', desc: '٧٩ ساعة — المهارات الجوهرية وشهادة ICF Level 1' },
                { step: '٣', title: 'التعمّق (STAIC)', desc: '١٠٦ ساعات — الأدوات المتقدمة وشهادة ICF Level 2' },
                { step: '٤', title: 'التوسّع (STGC)', desc: '٣٤ ساعة — كوتشينج المجموعات' },
                { step: '٥', title: 'القيادة (STOC)', desc: '٣٧ ساعة — الإشراف والمنتورينج' },
                { step: '٦', title: 'الممارسة', desc: 'انضم لمنصة الكوتشينج وابدأ ممارستك المهنية' },
              ]
              : [
                { step: '1', title: 'Discovery', desc: 'Start with free resources and discover the methodology' },
                { step: '2', title: 'Foundation (STIC)', desc: '79 hours — core skills and ICF Level 1 credential' },
                { step: '3', title: 'Deepening (STAIC)', desc: '106 hours — advanced tools and ICF Level 2 credential' },
                { step: '4', title: 'Expansion (STGC)', desc: '34 hours — group coaching' },
                { step: '5', title: 'Leadership (STOC)', desc: '37 hours — supervision and mentoring' },
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
