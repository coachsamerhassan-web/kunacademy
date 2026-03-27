import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { ProgramDetail } from '@/components/program-detail';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'المستوى الثالث — STGC | أكاديمية كُن' : 'Level 3 — STGC | Kun Academy',
    description: isAr
      ? 'كوتشينج المجموعات بمنهجية التفكير الحسّي — المستوى الثالث من شهادة STCE'
      : 'Group coaching through Somatic Thinking — STCE Level 3',
  };
}

export default async function Level3Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const program = await cms.getProgram('stce-level-3-stgc');
  if (!program) notFound();

  return (
    <ProgramDetail
      program={program}
      locale={locale}
      urlPath="academy/certifications/stce/level-3"
      outcomesAr={[
        'تيسير جلسات كوتشينج جماعية فعّالة',
        'تصميم برامج تدريبية متكاملة',
        'إدارة ديناميكيات المجموعة',
        'بناء بيئة آمنة للتعلّم الجماعي',
        'الانتقال من الكوتشينج الفردي إلى الجماعي',
      ]}
      outcomesEn={[
        'Facilitating effective group coaching sessions',
        'Designing complete training programs',
        'Managing group dynamics',
        'Building safe environments for collective learning',
        'Transitioning from individual to group coaching',
      ]}
      audienceAr="خريجو المستوى الأول + هويّتك — كوتشز ومدربون يريدون العمل مع المجموعات"
      audienceEn="Level 1 + Your Identity graduates — coaches and trainers wanting to work with groups"
    />
  );
}
