import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms/server';
import { ProgramDetail } from '@/components/program-detail';
import { notFound } from 'next/navigation';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'مقدمة التفكير الحسّي STI | أكاديمية كُن' : 'STI Introduction | Kun Academy',
    description: isAr
      ? 'مقدمة مسجّلة في التفكير الحسّي® — ٦ ساعات تأسيسية نحو شهادة الكوتشينج المعتمدة'
      : '6-hour recorded introduction to Somatic Thinking®. Your gateway to coaching certification.',
  };
}

export default async function IntroPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const program = await cms.getProgram('somatic-thinking-intro');
  if (!program) notFound();

  return (
    <ProgramDetail
      program={program}
      locale={locale}
      urlPath="academy/intro"
      outcomesAr={[
        'تاريخ الكوتشينج كمهنة وتطوّره عبر العقود',
        'ما هو التفكير الحسّي® وكيف وُلدت هذه المنهجية',
        'الفروقات الجوهرية بين الكوتشينج والإرشاد والعلاج والتدريب',
        'الكفاءات الجوهرية الثماني لدى ICF',
        'هل الكوتشينج مناسب لك؟ أدوات التقييم الذاتي',
      ]}
      outcomesEn={[
        'History of coaching as a profession and its evolution',
        'What is Somatic Thinking® and how this methodology was born',
        'Core differences between coaching, counseling, therapy, and training',
        'The eight ICF core competencies',
        'Is coaching right for you? Self-assessment tools',
      ]}
      audienceAr="أي شخص فضولي حول الكوتشينج أو التفكير الحسّي — لا تحتاج خبرة سابقة"
      audienceEn="Anyone curious about coaching or Somatic Thinking — no prior experience needed"
    />
  );
}
