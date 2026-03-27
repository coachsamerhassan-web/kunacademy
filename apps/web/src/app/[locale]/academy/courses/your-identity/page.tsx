import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { ProgramDetail } from '@/components/program-detail';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'هويّتك — دورة تطوير الهوية | أكاديمية كُن' : 'Your Identity — Identity Development Course | Kun Academy',
    description: isAr
      ? 'استكشف جذورك الثقافية وابنِ هوية مهنية متماسكة في الكوتشينج'
      : 'Explore your cultural roots and build a coherent professional coaching identity',
  };
}

export default async function YourIdentityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const program = await cms.getProgram('your-identity');
  if (!program) notFound();

  return (
    <ProgramDetail
      program={program}
      locale={locale}
      urlPath="academy/courses/your-identity"
      outcomesAr={[
        'استكشاف جذورك الثقافية والدينية كمصدر قوة',
        'بناء هوية مهنية متماسكة في الكوتشينج',
        'تحويل خلفيتك الفريدة إلى ميزة تنافسية',
        'أدوات الوعي الذاتي المتقدمة',
        'التحضير للمستوى الثاني من STCE',
      ]}
      outcomesEn={[
        'Exploring your cultural and faith roots as a source of strength',
        'Building a coherent professional coaching identity',
        'Turning your unique background into a competitive edge',
        'Advanced self-awareness tools',
        'Preparation for STCE Level 2',
      ]}
      audienceAr="خريجو المستوى الأول من STCE الذين يستعدون للمستويات المتقدمة"
      audienceEn="STCE Level 1 graduates preparing for advanced levels"
    />
  );
}
