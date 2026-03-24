import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function IslamicCoachingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'شهادة متخصصة' : 'Specialized Certification'}
          </p>
          <Heading level={1}>
            {isAr ? 'إتقان الكوتشينج الإسلامي' : 'Islamic Coaching Mastery'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'دمج القيم الإسلامية مع منهجية التفكير الحسّي — معتمد ICF Level 2'
              : 'Integrating Islamic values with Somatic Thinking methodology — ICF Level 2 Accredited'}
          </p>
        </div>
      </Section>

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
