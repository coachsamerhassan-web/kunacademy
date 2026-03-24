import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function GMPlaybookPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'برنامج مؤسسي' : 'Corporate Program'}
          </p>
          <Heading level={1}>
            {isAr ? 'دليل المدير العام' : 'The GM Playbook'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'برنامج تطوير قيادي مكثّف لمدراء العموم والقيادات العليا'
              : 'An intensive leadership development program for general managers and senior leaders'}
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
