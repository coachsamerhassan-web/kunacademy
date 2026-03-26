import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { ProgramDetail } from '@/components/program-detail';
import { notFound } from 'next/navigation';

export default async function Level5Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const program = await cms.getProgram('stce-level-5-stfc');
  if (!program) notFound();

  return (
    <ProgramDetail
      program={program}
      locale={locale}
      outcomesAr={[
        'ديناميكيات العلاقة الزوجية من منظور التفكير الحسّي',
        'تقنيات التيسير لجلسات الأزواج والعائلات',
        'إدارة التوترات والصراعات الأسرية بحضور جسدي',
        'بناء مساحة آمنة لكل أفراد المنظومة الأسرية',
        'التطبيق العملي مع عائلات حقيقية تحت الإشراف',
      ]}
      outcomesEn={[
        'Couple dynamics through the Somatic Thinking lens',
        'Facilitation techniques for couples and family sessions',
        'Managing tensions and family conflicts with somatic presence',
        'Building safe space for all members of the family system',
        'Practical application with real families under supervision',
      ]}
      audienceAr="خريجو STCE المتقدمون الذين لديهم خبرة في كوتشينج المجموعات"
      audienceEn="Advanced STCE graduates with group coaching experience"
    />
  );
}
