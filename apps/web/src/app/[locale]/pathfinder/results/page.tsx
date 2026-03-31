import { setRequestLocale } from 'next-intl/server';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { calculateRoi } from '@kunacademy/cms';
import type { Metadata } from 'next';
import { ResultsDisplay } from './results-display';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'نتائجك | المُرشد — أكاديمية كُن' : 'Your Results | Pathfinder — Kun Academy',
    description: isAr
      ? 'اكتشف توصياتك المخصصة وخارطة طريقك للنمو'
      : 'Discover your personalized recommendations and growth roadmap',
    robots: { index: false, follow: false }, // Results pages are personal — no indexing
  };
}

export default async function PathfinderResultsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { id } = await searchParams;

  setRequestLocale(locale);

  if (!id) {
    redirect(`/${locale}/pathfinder`);
  }

  // Fetch pathfinder response using service role (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: response, error } = await supabase
    .from('pathfinder_responses')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !response) {
    redirect(`/${locale}/pathfinder`);
  }

  // Calculate ROI for corporate path if roi_inputs present
  let roi = null;
  if (response.type === 'corporate' && response.roi_inputs) {
    try {
      roi = calculateRoi(response.roi_inputs);
    } catch {
      // roi stays null — ROI section simply won't render
    }
  }

  return (
    <ResultsDisplay
      name={response.name}
      locale={(response.locale ?? locale) as 'ar' | 'en'}
      type={response.type}
      journeyStage={response.journey_stage}
      recommendations={response.recommendations ?? []}
      roi={roi}
    />
  );
}
