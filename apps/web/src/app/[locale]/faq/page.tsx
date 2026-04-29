/**
 * Wave 15 Wave 4 Route 1 (2026-04-29) — /faq is now a static_pages-backed
 * thin renderer.
 *
 * What this REPLACES:
 *   - Hand-written JSX body (PageHero + Section + FAQSection + JSON-LD <script>)
 *   - 8 named imports from `@/data/faqs` (data now lives on the DB row)
 *   - Hand-written `generateMetadata()` literals (now sourced from
 *     static_pages.seo_meta_json)
 *   - 308 redirect at `next.config.ts:90` (removed in commit 5b5b75e)
 *
 * Architecture:
 *   1. Fetch the static_pages row by slug='faq'
 *   2. 404 if missing or unpublished (admin sees drafts via withAdminContext)
 *   3. Pre-resolve any DB-reading sections (none for /faq's faq_accordion)
 *      via `preloadStaticSectionData` — kept here so the renderer pattern
 *      generalizes to /about, /contact, /team, /methodology in subsequent
 *      Wave 4 dispatches without re-architecting
 *   4. Render: <PageHero> from hero_json, then iterate composition.sections
 *      through the same dispatcher logic LpRenderer uses
 *
 * The seed script that produced the row is `scripts/migrate-static-page-faq.ts`.
 *
 * Boundary contract: this file is a Server Component. It can call
 * `preloadStaticSectionData` (server-only). The section renderers themselves
 * are neutral — receive data as plain props.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { db } from '@kunacademy/db';
import { static_pages } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { PageHero } from '@/components/page-hero';
import { Section } from '@kunacademy/ui/section';
import { preloadStaticSectionData, type StaticSectionData } from '@/components/lp/sections/default/static-section-data';
import {
  StaticFaqAccordionSection,
  StaticMethodologyPillarSection,
  StaticPhilosophyStatementSection,
  StaticContactFormSection,
  StaticTeamGridSection,
  StaticTestimonialGridSection,
  StaticProgramCardStripSection,
} from '@/components/lp/sections/default/static-sections';
import {
  UniversalImageSection,
  UniversalVideoSection,
  UniversalHeaderSection,
  UniversalBodySection,
  UniversalQuoteSection,
  UniversalDividerSection,
} from '@/components/lp/sections/default/universal-sections';
import type { PatternName } from '@kunacademy/ui/patterns';

interface Props { params: Promise<{ locale: string }> }

// ── Row loader (mirrors apps/web/src/app/[locale]/lp/[slug]/page.tsx pattern)
//
// Public visitors → query via the `kunacademy` app role (RLS enforces
// `published=true`). Admin/super_admin/content_editor → withAdminContext
// for draft-preview parity with the editor canvas.
async function loadFaqPage(includeDrafts = false) {
  const query = async (database: typeof db) => {
    const rows = await database
      .select({
        id: static_pages.id,
        slug: static_pages.slug,
        published: static_pages.published,
        composition_json: static_pages.composition_json,
        hero_json: static_pages.hero_json,
        seo_meta_json: static_pages.seo_meta_json,
      })
      .from(static_pages)
      .where(eq(static_pages.slug, 'faq'))
      .limit(1);
    return rows[0] || null;
  };

  if (includeDrafts) {
    const { withAdminContext } = await import('@kunacademy/db');
    return withAdminContext(async (adminDb) => query(adminDb));
  }
  return query(db);
}

// ── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const row = await loadFaqPage();
  const isAr = locale === 'ar';
  // Fall back to the prior literal copy if the row is missing — keeps the
  // page indexable during a migration regression window.
  const seo = (row?.seo_meta_json ?? {}) as {
    meta_title_ar?: string;
    meta_title_en?: string;
    meta_description_ar?: string;
    meta_description_en?: string;
    og_image_url?: string;
    canonical_url?: string;
  };
  const title =
    (isAr ? seo.meta_title_ar : seo.meta_title_en) ||
    (isAr ? 'الأسئلة الشائعة | أكاديمية كُن' : 'FAQ | Kun Academy');
  const description =
    (isAr ? seo.meta_description_ar : seo.meta_description_en) ||
    (isAr
      ? 'إجابات على الأسئلة الشائعة حول برامج أكاديمية كُن والشهادات والتسجيل'
      : 'Frequently asked questions about Kun coaching programs, certifications, and enrollment.');
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: isAr ? 'أكاديمية كُن' : 'Kun Academy',
      locale,
      ...(seo.og_image_url ? { images: [{ url: seo.og_image_url }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(seo.og_image_url ? { images: [seo.og_image_url] } : {}),
    },
    alternates: {
      canonical: seo.canonical_url,
    },
  };
}

// ── Section dispatcher (default theme, static_pages-aware) ─────────────────
//
// Same dispatch logic as LpRenderer's DefaultSectionDispatcher, narrowed for
// the static-page case (no LP-only types like benefits/credibility/reframe —
// those would never appear on /faq). When /about, /contact, /team,
// /methodology migrate, this can be extracted to a shared component.
function StaticSectionDispatcher({
  section,
  isAr,
  locale,
  staticDataForSection,
}: {
  section: Record<string, unknown>;
  isAr: boolean;
  locale: string;
  staticDataForSection?: StaticSectionData;
}) {
  const t = section.type as string;

  // Universal types
  if (t === 'image')   return <UniversalImageSection section={section} isAr={isAr} />;
  if (t === 'video')   return <UniversalVideoSection section={section} isAr={isAr} />;
  if (t === 'header')  return <UniversalHeaderSection section={section} isAr={isAr} />;
  if (t === 'body')    return <UniversalBodySection section={section} isAr={isAr} />;
  if (t === 'quote')   return <UniversalQuoteSection section={section} isAr={isAr} />;
  if (t === 'divider') return <UniversalDividerSection section={section} isAr={isAr} />;

  // Static-specific types (Wave 4 PRECURSOR commit 2380f81)
  if (t === 'faq_accordion')
    return <StaticFaqAccordionSection section={section} isAr={isAr} locale={locale} />;
  if (t === 'methodology_pillar')
    return <StaticMethodologyPillarSection section={section} isAr={isAr} />;
  if (t === 'philosophy_statement')
    return <StaticPhilosophyStatementSection section={section} isAr={isAr} />;
  if (t === 'contact_form')
    return <StaticContactFormSection section={section} isAr={isAr} />;

  if (t === 'testimonial_grid') {
    const testimonials =
      staticDataForSection?.kind === 'testimonial_grid' ? staticDataForSection.testimonials : [];
    return <StaticTestimonialGridSection section={section} isAr={isAr} testimonials={testimonials} />;
  }
  if (t === 'team_grid') {
    const coaches =
      staticDataForSection?.kind === 'team_grid' ? staticDataForSection.coaches : [];
    return <StaticTeamGridSection section={section} isAr={isAr} locale={locale} coaches={coaches} />;
  }
  if (t === 'program_card_strip') {
    const programs =
      staticDataForSection?.kind === 'program_card_strip' ? staticDataForSection.programs : [];
    return <StaticProgramCardStripSection section={section} isAr={isAr} locale={locale} programs={programs} />;
  }

  // Unknown type — silently drop (admin will see this in the editor canvas
  // as a placeholder). Defensive: never crash a published page on a section
  // type that vocabulary hasn't shipped yet.
  return null;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function FAQPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getAuthUser();
  const isAdmin =
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'content_editor';

  const row = await loadFaqPage(isAdmin);
  if (!row) notFound();
  if (!row.published && !isAdmin) notFound();

  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  // Hero from hero_json (parity with landing_pages.hero_json shape).
  const hero = (row.hero_json ?? {}) as {
    title_ar?: string;
    title_en?: string;
    subtitle_ar?: string;
    subtitle_en?: string;
    eyebrow_ar?: string;
    eyebrow_en?: string;
    pattern?: PatternName;
  };

  // Sections from composition_json.
  const composition = (row.composition_json ?? {}) as {
    sections?: Array<Record<string, unknown>>;
  };
  const sections = Array.isArray(composition.sections) ? composition.sections : [];

  // Pre-resolve DB-reading section data (testimonial_grid / team_grid /
  // program_card_strip). For /faq this resolves to an empty Map (no
  // DB-reading sections in the seeded composition) — but the call is kept
  // so the pattern carries to /about, /contact, /team, /methodology
  // without a re-architecture.
  const staticData = await preloadStaticSectionData(sections);

  return (
    <main dir={dir} data-static-page="faq">
      {(hero.title_ar || hero.title_en) && (
        <PageHero
          locale={locale}
          titleAr={hero.title_ar ?? ''}
          titleEn={hero.title_en ?? ''}
          subtitleAr={hero.subtitle_ar}
          subtitleEn={hero.subtitle_en}
          eyebrowAr={hero.eyebrow_ar}
          eyebrowEn={hero.eyebrow_en}
          pattern={hero.pattern ?? 'flower-of-life'}
        />
      )}

      {sections.length > 0 && (
        <Section variant="white">
          {sections.map((section, i) => (
            <StaticSectionDispatcher
              key={`section-${i}`}
              section={section}
              isAr={isAr}
              locale={locale}
              staticDataForSection={staticData.get(i)}
            />
          ))}
        </Section>
      )}
    </main>
  );
}
