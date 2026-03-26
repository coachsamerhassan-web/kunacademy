import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { ProgramDetail } from '@/components/program-detail';
import { notFound } from 'next/navigation';

export default async function ManagersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const program = await cms.getProgram('stcm-managers');
  if (!program) notFound();

  return (
    <ProgramDetail
      program={program}
      locale={locale}
      outcomesAr={[
        'الانتقال من أسلوب الإدارة إلى أسلوب القيادة',
        'استخدام التفكير الحسّي في المحادثات اليومية مع الفريق',
        'تطوير الأفراد بدل إدارة العمليات',
        'التعامل مع المقاومة والصراعات داخل الفريق',
        'بناء ثقافة تنظيمية قائمة على الحوار',
        'قياس أثر التحول القيادي',
      ]}
      outcomesEn={[
        'Shifting from managing style to leadership style',
        'Using Somatic Thinking in daily team conversations',
        'Developing people instead of managing processes',
        'Handling resistance and team conflicts',
        'Building an organizational culture based on dialogue',
        'Measuring the impact of leadership transformation',
      ]}
      audienceAr="مديرون وسطى وعليا، قادة فرق، مديرون تنفيذيون"
      audienceEn="Middle and senior managers, team leads, directors"
    />
  );
}
