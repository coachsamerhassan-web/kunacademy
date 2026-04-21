import { setRequestLocale } from 'next-intl/server';
import { db } from '@kunacademy/db';
import { pathfinder_responses } from '@kunacademy/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { calculateRoi } from '@/lib/pathfinder-scorer';
import { calculateCorporateRoi } from '@kunacademy/cms';
import type { Metadata } from 'next';
import { ResultsDisplay } from './results-display';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string; pdf?: string }>;
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
  const { id, pdf: pdfParam } = await searchParams;

  setRequestLocale(locale);

  if (!id) {
    redirect(`/${locale}/pathfinder`);
  }

  // Fetch pathfinder response using Drizzle (admin context via db — RLS bypassed at pool level for server)
  const [response] = await db
    .select()
    .from(pathfinder_responses)
    .where(eq(pathfinder_responses.id, id))
    .limit(1);

  if (!response) {
    redirect(`/${locale}/pathfinder`);
  }

  // NOTE: No auth ownership check here.
  // Results are accessed via opaque UUID (?id=...). The two-tier flow sends users directly
  // from the opt-in form to their results URL — they have never been asked to create an account.
  // The data (coaching program recommendations) is non-sensitive; the UUID itself is the
  // access control mechanism. Authenticated users who have previously enrolled see their results
  // via their dashboard, not via this public URL.

  // Calculate ROI for individual corporate path (legacy roi_inputs)
  let roi = null;
  if (response.type === 'corporate' && response.roi_inputs) {
    try {
      roi = calculateRoi(response.roi_inputs as any);
    } catch {
      // roi stays null — ROI section simply won't render
    }
  }

  // Calculate corporate ROI from benefits selection (new flow)
  let corporateRoi = null;
  if (
    response.type === 'corporate' &&
    response.selected_benefits &&
    Array.isArray(response.selected_benefits) &&
    (response.selected_benefits as any[]).length > 0 &&
    response.roi_inputs
  ) {
    try {
      // Map selected_benefits into SelectedBenefit shape expected by calculator
      const benefitsForCalc = (response.selected_benefits as any[]).map((b: {
        id: string;
        label_ar: string;
        label_en: string;
        benchmark_improvement_pct?: number;
        roi_category?: string;
        citation_ar?: string;
        citation_en?: string;
      }) => ({
        id: b.id,
        label_ar: b.label_ar,
        label_en: b.label_en,
        citation_ar: b.citation_ar ?? '',
        citation_en: b.citation_en ?? '',
        benchmark_improvement_pct: b.benchmark_improvement_pct ?? 20,
        roi_category: b.roi_category ?? 'productivity',
      }));

      // Corporate settings — use conservative defaults if not stored on record
      const settings = (response as any).corporate_settings ?? {
        corporate_multiplier: 2,
        per_leader_session_rate: 2000,
        per_leader_package_sessions: 6,
        base_program_price_aed: 15000,
      };

      corporateRoi = calculateCorporateRoi(response.roi_inputs as any, benefitsForCalc, settings);
    } catch {
      // corporateRoi stays null — corporate savings section simply won't render
    }
  }

  return (
    <ResultsDisplay
      name={response.name}
      locale={(response.locale ?? locale) as 'ar' | 'en'}
      type={response.type as 'corporate' | 'individual'}
      journeyStage={response.journey_stage ?? ''}
      recommendations={(response.recommendations as any) ?? []}
      roi={roi}
      corporateRoi={corporateRoi}
      proposalPdfUrl={response.proposal_pdf_url || pdfParam || null}
      direction={response.direction ?? null}
      selectedBenefits={(response.selected_benefits as any) ?? null}
      selfAssessment={(response.self_assessment as any) ?? null}
    />
  );
}
