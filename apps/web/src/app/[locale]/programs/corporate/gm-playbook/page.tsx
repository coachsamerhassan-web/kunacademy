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
    title: isAr ? 'دليل المدير العام | أكاديمية كُن' : 'GM Playbook | Kun Academy',
    description: isAr ? 'GM Playbook — دليل عملي للمدراء العموميين في القيادة بالوعي الحسّي' : 'GM Playbook — a practical guide for general managers on leading with somatic intelligence',
  };
}

export default async function GMPlaybookPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'برنامج مؤسسي' : 'Corporate Program'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'برنامج مؤسسي' : 'Corporate Program'}
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
              ? 'يجمع دليل المدير العام بين أدوات التفكير الحسّي ومهارات القيادة التنفيذية في برنامج مكثّف مصمّم خصيصًا للمدراء العامّين ومن في حكمهم. يركّز على اتخاذ القرار من خلال الإشارات الحسّية الجسدية، وإدارة الضغوط، وبناء فرق عالية الأداء.'
              : 'The GM Playbook combines Somatic Thinking tools with executive leadership skills in an intensive program designed specifically for general managers and equivalent roles. It focuses on decision-making through somatic body signals, stress management, and building high-performance teams.'}
          </p>
          <Button variant="primary" size="lg" className="mt-8">
            {isAr ? 'اطلب عرض أسعار' : 'Request a Proposal'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
