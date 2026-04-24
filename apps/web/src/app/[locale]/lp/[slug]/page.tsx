import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { db } from '@kunacademy/db';
import { eq } from 'drizzle-orm';
import { landing_pages } from '@kunacademy/db/schema';
import { LpRenderer } from '@/components/lp/lp-renderer';
import { LpAnalytics } from '@/components/lp/lp-analytics';
import {
  isLpComposition,
  isLpLeadCaptureConfig,
  isLpAnalyticsConfig,
  type LpComposition,
  type LpLeadCaptureConfig,
  type LpAnalyticsConfig,
} from '@/lib/lp/composition-types';

/**
 * Wave 14 LP-INFRA — public LP route at /[locale]/lp/[slug]
 *
 * Standalone landing page driven by `landing_pages.composition_json` (DB).
 * Distinct from the legacy /[locale]/landing/[slug] route which renders the
 * generic hero+body+CTA `sections_json` shape (kept for backward compat).
 *
 * - Falls back to `notFound()` if the row is missing OR unpublished OR has
 *   no composition_json populated (so a placeholder LP slug doesn't render
 *   an empty page in production).
 * - SEO metadata sourced from `seo_meta_json`.
 * - Optional `composition_json.thank_you` is rendered at /thank-you (sibling route).
 */
interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export const revalidate = 300;

async function loadLp(slug: string) {
  const [row] = await db
    .select({
      id: landing_pages.id,
      slug: landing_pages.slug,
      published: landing_pages.published,
      composition_json: landing_pages.composition_json,
      lead_capture_config: landing_pages.lead_capture_config,
      analytics_config: landing_pages.analytics_config,
      seo_meta_json: landing_pages.seo_meta_json,
    })
    .from(landing_pages)
    .where(eq(landing_pages.slug, slug))
    .limit(1);
  return row || null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const lp = await loadLp(slug);
  if (!lp || !lp.published) return { title: locale === 'ar' ? 'أكاديمية كُن' : 'Kun Academy' };

  const isAr = locale === 'ar';
  const seo = (lp.seo_meta_json ?? {}) as {
    meta_title_ar?: string;
    meta_title_en?: string;
    meta_description_ar?: string;
    meta_description_en?: string;
    og_image_url?: string;
    canonical_url?: string;
  };
  const composition = (isLpComposition(lp.composition_json) ? lp.composition_json : null) as LpComposition | null;

  const title =
    (isAr ? seo.meta_title_ar : seo.meta_title_en) ||
    (isAr ? composition?.hero?.headline_ar : composition?.hero?.headline_en) ||
    slug;

  const description =
    (isAr ? seo.meta_description_ar : seo.meta_description_en) ||
    (isAr ? composition?.hero?.subheadline_ar : composition?.hero?.subheadline_en) ||
    '';

  return {
    title: title ? `${title}${isAr ? ' | أكاديمية كُن' : ' | Kun Academy'}` : 'Kun Academy',
    description,
    openGraph: {
      title: title ?? undefined,
      description,
      type: 'website',
      siteName: isAr ? 'أكاديمية كُن' : 'Kun Academy',
      locale,
      ...(seo.og_image_url ? { images: [{ url: seo.og_image_url }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: title ?? undefined,
      description,
      ...(seo.og_image_url ? { images: [seo.og_image_url] } : {}),
    },
    alternates: {
      canonical: seo.canonical_url,
    },
  };
}

export default async function LpPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const lp = await loadLp(slug);
  if (!lp || !lp.published) notFound();

  const composition = isLpComposition(lp.composition_json)
    ? (lp.composition_json as LpComposition)
    : null;
  if (!composition) notFound();

  const leadCaptureConfig = isLpLeadCaptureConfig(lp.lead_capture_config)
    ? (lp.lead_capture_config as LpLeadCaptureConfig)
    : null;
  const analyticsConfig = isLpAnalyticsConfig(lp.analytics_config)
    ? (lp.analytics_config as LpAnalyticsConfig)
    : null;

  return (
    <>
      <LpAnalytics slug={slug} locale={locale} config={analyticsConfig} />
      <LpRenderer
        slug={slug}
        locale={locale}
        composition={composition}
        leadCaptureConfig={leadCaptureConfig}
        analyticsConfig={analyticsConfig}
      />
    </>
  );
}
