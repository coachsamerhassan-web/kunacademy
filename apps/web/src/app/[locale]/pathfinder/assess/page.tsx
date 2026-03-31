import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
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

  // Fetch all pathfinder questions from CMS (they come with branching structure)
  const allQuestions = await cms.getAllPathfinderQuestions();

  return <PathfinderEngine locale={locale} questions={allQuestions} />;
}
