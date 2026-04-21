import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms/server';
import type { Metadata } from 'next';
import { PathfinderEngine } from './pathfinder-engine';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'اكتشف مسارك | أكاديمية كُن' : 'Discover Your Path | Kun Academy',
    description: isAr
      ? 'أجب عن بضعة أسئلة واحصل على خارطة طريق مخصصة لرحلتك في الكوتشينج'
      : 'Answer a few questions and get a personalized roadmap for your coaching journey',
    robots: { index: false },
  };
}

export default async function PathfinderAssessPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // CMS Phase 3d (2026-04-21): corporate-benefits sourced from DB via cms
  // provider (was direct JSON import from data/cms/corporate-benefits.json).
  // getCorporateBenefitsData() emits the same legacy payload shape so the
  // PathfinderEngine client component stays unchanged.
  const [allQuestions, corporateBenefitsData] = await Promise.all([
    cms.getAllPathfinderQuestions(),
    cms.getCorporateBenefitsData(),
  ]);

  return (
    <PathfinderEngine
      locale={locale}
      questions={allQuestions}
      corporateBenefits={corporateBenefitsData as Parameters<typeof PathfinderEngine>[0]['corporateBenefits']}
    />
  );
}
