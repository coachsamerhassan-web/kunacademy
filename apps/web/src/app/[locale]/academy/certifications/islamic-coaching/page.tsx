import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function IslamicCoachingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'شهادة متخصصة' : 'Specialized Certification'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'شهادة متخصصة' : 'Specialized Certification'}
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'عن البرنامج' : 'About the Program'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'يقدّم هذا البرنامج إطارًا متكاملًا يجمع بين مفهوم النَّفْس في التراث الإسلامي والإشارات الحسّية الجسدية في منهجية التفكير الحسّي. يتعلّم الكوتش كيف يوظّف الآيات القرآنية والأحاديث النبوية كأدوات كوتشينج فعّالة — دون الخلط بين الكوتشينج والعلاج النفسي أو الإرشاد الديني.'
              : 'This program offers an integrated framework combining the concept of the self (al-nafs) in Islamic tradition with somatic body signals in the Somatic Thinking methodology. Coaches learn to utilize Qur\'anic verses and prophetic traditions as effective coaching tools — without confusing coaching with therapy or religious counseling.'}
          </p>
        </div>
      </Section>

      <Section variant="dark" pattern>
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'انضم إلى الدفعة القادمة' : 'Join the Next Cohort'}
          </Heading>
          <Button variant="primary" size="lg" className="mt-6">
            {isAr ? 'سجّل الآن' : 'Register Now'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
