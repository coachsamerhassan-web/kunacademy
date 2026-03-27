import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { ProgramDetail } from '@/components/program-detail';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'المستوى الرابع — STOC | أكاديمية كُن' : 'Level 4 — STOC | Kun Academy',
    description: isAr
      ? 'كوتشينج المؤسسات بمنهجية التفكير الحسّي — المستوى الرابع من شهادة STCE'
      : 'Organizational coaching through Somatic Thinking — STCE Level 4',
  };
}

export default async function Level4Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const program = await cms.getProgram('stce-level-4-stoc');
  if (!program) notFound();

  return (
    <ProgramDetail
      program={program}
      locale={locale}
      urlPath="academy/certifications/stce/level-4"
      outcomesAr={[
        'كوتشينج القيادات التنفيذية',
        'التنقّل بين أصحاب المصلحة المتعددين',
        'تصميم تدخّلات مؤسسية فعّالة',
        'بناء ثقافة الكوتشينج داخل المؤسسة',
        'قياس الأثر المؤسسي للكوتشينج',
      ]}
      outcomesEn={[
        'Executive leadership coaching',
        'Navigating multiple stakeholders',
        'Designing effective organizational interventions',
        'Building coaching culture within organizations',
        'Measuring organizational coaching impact',
      ]}
      audienceAr="خريجو المستوى الأول + هويّتك — كوتشز يعملون مع مؤسسات وقيادات"
      audienceEn="Level 1 + Your Identity graduates — coaches working with organizations and leadership"
    />
  );
}
