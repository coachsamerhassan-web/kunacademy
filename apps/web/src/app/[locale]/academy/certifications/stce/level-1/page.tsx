import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { ProgramDetail } from '@/components/program-detail';
import { notFound } from 'next/navigation';

export default async function Level1Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const program = await cms.getProgram('stce-level-1-stic');
  if (!program) notFound();

  return (
    <ProgramDetail
      program={program}
      locale={locale}
      outcomesAr={[
        'أساسيات التفكير الحسّي وعلاقته بالكوتشينج',
        'الإشارات الحسّية الجسدية وكيفية قراءتها',
        'مهارات الكوتشينج الجوهرية وفق معايير ICF',
        'بناء جلسة كوتشينج متكاملة',
        'التطبيق العملي والتدريب الإشرافي',
      ]}
      outcomesEn={[
        'Fundamentals of Somatic Thinking and its relation to coaching',
        'Somatic body signals and how to read them',
        'Core ICF coaching competencies',
        'Building a complete coaching session',
        'Practical application and supervised practice',
      ]}
      audienceAr="كوتشز مبتدئون، ممارسون يريدون منهجية أصيلة، ومدربون يبحثون عن تأسيس قوي"
      audienceEn="Beginning coaches, practitioners seeking an authentic methodology, and trainers looking for a strong foundation"
    />
  );
}
