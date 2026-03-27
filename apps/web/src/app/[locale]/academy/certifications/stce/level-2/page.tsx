import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { ProgramDetail } from '@/components/program-detail';
import { notFound } from 'next/navigation';

export default async function Level2Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const program = await cms.getProgram('stce-level-2-staic');
  if (!program) notFound();

  return (
    <ProgramDetail
      program={program}
      locale={locale}
      urlPath="academy/certifications/stce/level-2"
      outcomesAr={[
        'منهجية S-Work المتقدّمة',
        'المسح الحسّي الجسدي (Somatic Scan)',
        'نموذج Omni-Sphere للكوتشينج الشامل',
        'كوتشينج حقيقي للعملاء تحت إشراف',
        'بناء هويتك المهنية ككوتش متقدّم',
      ]}
      outcomesEn={[
        'Advanced S-Work methodology',
        'Somatic Scan technique',
        'Omni-Sphere model for holistic coaching',
        'Real client coaching under supervision',
        'Building your professional identity as an advanced coach',
      ]}
      audienceAr="خريجو المستوى الأول + هويّتك — كوتشز يسعون لمسار PCC"
      audienceEn="Level 1 + Your Identity graduates — coaches pursuing the PCC pathway"
    />
  );
}
