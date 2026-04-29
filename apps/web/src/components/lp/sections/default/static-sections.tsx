/**
 * Wave 15 Wave 4 PRECURSOR (2026-04-29) — Default-theme renderers for the 7
 * static-page-specific section types per spec §7.1.
 *
 * Types covered:
 *   - faq_accordion          (Q&A accordion + FAQPage JSON-LD)
 *   - team_grid              (coach cards — DB data passed in via props)
 *   - methodology_pillar     (icon + title + body tile, used in a grid block)
 *   - philosophy_statement   (long-form prose + optional pull-quote, IP-protected)
 *   - contact_form           (form fields + honeypot, posts to /api/static/contact)
 *   - testimonial_grid       (testimonial cards — DB data passed in via props)
 *   - program_card_strip     (program cards — DB data passed in via props)
 *
 * IMPORTANT — boundary contract:
 *   - This module is reachable from BOTH the public route (server tree) AND
 *     the editor canvas (client tree, via lp-renderer.tsx). It MUST be pure:
 *     no DB imports, no `'use client'`, no `'server-only'`. All DB-reading
 *     state arrives via props.
 *   - DB-reading sections (team_grid, testimonial_grid, program_card_strip)
 *     receive their data via the `staticData` prop. The lp-renderer
 *     pre-resolves this from `static-section-data.ts` (server-only) when
 *     used in a server tree; in the editor canvas (client tree), staticData
 *     is undefined → these sections render their empty state (the editor's
 *     preview shows the section frame + placeholder copy).
 *   - The PROGRAM-CANON.md source-of-truth boundary is preserved by
 *     `static-section-data.ts` reading via cms helpers only — never
 *     hardcoding program metadata.
 *
 * IP boundary (CLAUDE.md 2026-04-23):
 *   - philosophy_statement renders authored prose verbatim. The form-side
 *     placeholder copy reminds authors not to expose proprietary framework
 *     names. R12 lint (methodology-adjacent route to Hakima) lands in the
 *     Wave 4 lint expansion to enforce at publish time.
 */

import { BackgroundWrapper } from './universal-sections';
import { Card } from '@kunacademy/ui/card';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { StaticContactFormIsland } from './static-contact-form-island';
import type {
  ResolvedTestimonial,
  ResolvedCoach,
  ResolvedProgram,
} from './static-section-data';

type AnyRecord = Record<string, unknown>;

interface FaqItemShape {
  q_ar?: string;
  q_en?: string;
  a_ar?: string;
  a_en?: string;
}

// ── faq_accordion ─────────────────────────────────────────────────────────
//
// Reuses packages/ui/faq-section.tsx (the existing accordion component) —
// the same component the hand-written /faq route renders today. No
// behavioral diff for migrated content.
//
// Emits FAQPage JSON-LD inline so search engines pick up the Q&A regardless
// of where the section sits in the page. Set `disable_jsonld: true` on the
// section to suppress (rare).

export function StaticFaqAccordionSection({
  section,
  isAr,
  locale,
}: {
  section: AnyRecord;
  isAr: boolean;
  locale: string;
}) {
  const title = (isAr ? section.title_ar : section.title_en) as string | undefined;
  const itemsRaw = section.items;
  const items: FaqItemShape[] = Array.isArray(itemsRaw) ? (itemsRaw as FaqItemShape[]) : [];
  const validItems = items.filter((it) => {
    const q = isAr ? it.q_ar : it.q_en;
    const a = isAr ? it.a_ar : it.a_en;
    return typeof q === 'string' && q.length > 0 && typeof a === 'string' && a.length > 0;
  });

  if (validItems.length === 0) return null;

  const faqItems = validItems.map((it) => ({
    ar: { q: it.q_ar ?? '', a: it.a_ar ?? '' },
    en: { q: it.q_en ?? '', a: it.a_en ?? '' },
  }));

  const disableJsonld = section.disable_jsonld === true;
  const jsonLd = disableJsonld
    ? null
    : {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((it) => {
          const q = isAr ? it.ar.q : it.en.q;
          const a = isAr ? it.ar.a : it.en.a;
          return {
            '@type': 'Question',
            name: q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: a,
              inLanguage: isAr ? 'ar' : 'en',
            },
          };
        }),
      };

  return (
    <BackgroundWrapper background={section.background as never} anchor_id={section.anchor_id as string | undefined}>
      <div className="mx-auto max-w-3xl">
        {title && (
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-6 text-center">
            {title}
          </h2>
        )}
        <FAQSection items={faqItems} locale={locale} />
        {jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
      </div>
    </BackgroundWrapper>
  );
}

// ── methodology_pillar ────────────────────────────────────────────────────

export function StaticMethodologyPillarSection({
  section,
  isAr,
}: {
  section: AnyRecord;
  isAr: boolean;
}) {
  const icon = section.icon as string | undefined;
  const title = (isAr ? section.title_ar : section.title_en) as string | undefined;
  const body = (isAr ? section.body_ar : section.body_en) as string | undefined;

  if (!title && !body) return null;

  return (
    <BackgroundWrapper background={section.background as never} anchor_id={section.anchor_id as string | undefined}>
      <div className="mx-auto max-w-2xl">
        <Card accent className="p-6 h-full">
          {icon && (
            <div aria-hidden className="text-3xl mb-3" style={{ lineHeight: 1 }}>
              {icon}
            </div>
          )}
          {title && (
            <h3 className="font-bold text-xl text-[var(--text-primary)] mb-2">{title}</h3>
          )}
          {body && (
            <p className="text-[var(--color-neutral-700)] leading-relaxed">{body}</p>
          )}
        </Card>
      </div>
    </BackgroundWrapper>
  );
}

// ── philosophy_statement ──────────────────────────────────────────────────

export function StaticPhilosophyStatementSection({
  section,
  isAr,
}: {
  section: AnyRecord;
  isAr: boolean;
}) {
  const body = (isAr ? section.body_ar : section.body_en) as string | undefined;
  const pullquote = (isAr ? section.pullquote_ar : section.pullquote_en) as string | undefined;

  if (!body && !pullquote) return null;

  return (
    <BackgroundWrapper background={section.background as never} anchor_id={section.anchor_id as string | undefined}>
      <div className="mx-auto max-w-3xl">
        {body && (
          <div className="prose prose-base md:prose-lg text-[var(--color-neutral-800)] leading-relaxed">
            {body.split(/\n\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}
        {pullquote && (
          <blockquote className="mt-8 border-s-4 border-[var(--color-primary)] ps-6 py-4">
            <p className="text-2xl md:text-3xl italic text-[var(--color-primary)] leading-tight">
              {pullquote}
            </p>
          </blockquote>
        )}
      </div>
    </BackgroundWrapper>
  );
}

// ── contact_form ──────────────────────────────────────────────────────────

export function StaticContactFormSection({
  section,
  isAr,
}: {
  section: AnyRecord;
  isAr: boolean;
}) {
  const title = (isAr ? section.title_ar : section.title_en) as string | undefined;
  const subtitle = (isAr ? section.subtitle_ar : section.subtitle_en) as string | undefined;
  const submitLabel = (isAr ? section.submit_label_ar : section.submit_label_en) as string | undefined;
  const successMessage = (isAr ? section.success_message_ar : section.success_message_en) as string | undefined;

  return (
    <BackgroundWrapper background={section.background as never} anchor_id={section.anchor_id as string | undefined}>
      <div className="mx-auto max-w-xl">
        {title && (
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-3 text-center">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="text-lg text-[var(--color-neutral-600)] mb-6 text-center leading-relaxed">
            {subtitle}
          </p>
        )}
        <StaticContactFormIsland
          isAr={isAr}
          submitLabel={submitLabel || (isAr ? 'إرسال' : 'Send')}
          successMessage={successMessage || (isAr ? 'شكراً — وصلتنا رسالتك.' : 'Thank you — we received your message.')}
        />
      </div>
    </BackgroundWrapper>
  );
}

// ── testimonial_grid ──────────────────────────────────────────────────────
//
// Pure presentational. Receives resolved `testimonials` array from props
// (pre-fetched by lp-renderer's preload helper). When invoked from the editor
// canvas (no preload context), testimonials defaults to []  → renders empty.

export function StaticTestimonialGridSection({
  section,
  isAr,
  testimonials = [],
}: {
  section: AnyRecord;
  isAr: boolean;
  testimonials?: ResolvedTestimonial[];
}) {
  const title = (isAr ? section.title_ar : section.title_en) as string | undefined;

  if (testimonials.length === 0) {
    // Editor-mode placeholder: show section frame + helper text so authors
    // see the section "exists" even without server-side data resolution.
    if (!isInServerContext()) {
      return (
        <BackgroundWrapper background={section.background as never} anchor_id={section.anchor_id as string | undefined}>
          <div className="mx-auto max-w-3xl text-center">
            {title && (
              <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
                {title}
              </h2>
            )}
            <div className="rounded-2xl border-2 border-dashed border-[var(--color-neutral-200)] p-8 text-sm text-[var(--color-neutral-500)]">
              {isAr
                ? '⭐ معاينة شبكة الشهادات — ستظهر الشهادات من جدول البيانات في الإصدار المنشور.'
                : '⭐ Testimonial grid preview — testimonials from the database will appear on the published page.'}
            </div>
          </div>
        </BackgroundWrapper>
      );
    }
    return null;
  }

  return (
    <BackgroundWrapper background={section.background as never} anchor_id={section.anchor_id as string | undefined}>
      <div className="mx-auto max-w-6xl">
        {title && (
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-8 text-center">
            {title}
          </h2>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t) => {
            const name = (isAr ? t.name_ar : t.name_en) || t.name_ar || t.name_en;
            const content = (isAr ? t.content_ar : t.content_en) || t.content_ar;
            const role = isAr ? t.role_ar : t.role_en;
            return (
              <Card key={t.id} accent className="p-5 h-full flex flex-col">
                <p className="text-[var(--color-neutral-700)] leading-relaxed flex-1 italic">
                  &ldquo;{content}&rdquo;
                </p>
                <div className="mt-4 flex items-center gap-3 pt-4 border-t border-[var(--color-neutral-100)]">
                  {t.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.photo_url}
                      alt={name}
                      loading="lazy"
                      className="w-10 h-10 rounded-full object-cover bg-[var(--color-neutral-100)]"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[var(--text-primary)] truncate">
                      {name}
                    </div>
                    {role && (
                      <div className="text-xs text-[var(--color-neutral-500)] truncate">{role}</div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </BackgroundWrapper>
  );
}

// ── team_grid ─────────────────────────────────────────────────────────────

export function StaticTeamGridSection({
  section,
  isAr,
  locale,
  coaches = [],
}: {
  section: AnyRecord;
  isAr: boolean;
  locale: string;
  coaches?: ResolvedCoach[];
}) {
  const title = (isAr ? section.title_ar : section.title_en) as string | undefined;

  if (coaches.length === 0) {
    if (!isInServerContext()) {
      return (
        <BackgroundWrapper background={section.background as never} anchor_id={section.anchor_id as string | undefined}>
          <div className="mx-auto max-w-3xl text-center">
            {title && (
              <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
                {title}
              </h2>
            )}
            <div className="rounded-2xl border-2 border-dashed border-[var(--color-neutral-200)] p-8 text-sm text-[var(--color-neutral-500)]">
              {isAr
                ? '👥 معاينة شبكة الفريق — ستظهر بطاقات المدرّبين على الصفحة المنشورة.'
                : '👥 Team grid preview — coach cards will appear on the published page.'}
            </div>
          </div>
        </BackgroundWrapper>
      );
    }
    return null;
  }

  return (
    <BackgroundWrapper background={section.background as never} anchor_id={section.anchor_id as string | undefined}>
      <div className="mx-auto max-w-6xl">
        {title && (
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-8 text-center">
            {title}
          </h2>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {coaches.map((c) => {
            const name = (isAr ? c.name_ar : c.name_en) || c.name_ar;
            const role = isAr ? c.title_ar : c.title_en;
            const bio = isAr ? c.bio_ar : c.bio_en;
            return (
              <a key={c.slug} href={`/${locale}/coaches/${c.slug}`} className="group">
                <Card accent className="p-5 h-full flex flex-col">
                  {c.photo_url && (
                    <div className="relative aspect-square overflow-hidden rounded-lg mb-4 bg-[var(--color-neutral-100)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.photo_url}
                        alt={name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <h3 className="font-bold text-lg text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-1">
                    {name}
                  </h3>
                  {role && <div className="text-sm text-[var(--color-neutral-600)] mb-2">{role}</div>}
                  {bio && <p className="text-sm text-[var(--color-neutral-600)] line-clamp-3">{bio}</p>}
                </Card>
              </a>
            );
          })}
        </div>
      </div>
    </BackgroundWrapper>
  );
}

// ── program_card_strip ────────────────────────────────────────────────────

export function StaticProgramCardStripSection({
  section,
  isAr,
  locale,
  programs = [],
}: {
  section: AnyRecord;
  isAr: boolean;
  locale: string;
  programs?: ResolvedProgram[];
}) {
  const title = (isAr ? section.title_ar : section.title_en) as string | undefined;

  if (programs.length === 0) {
    if (!isInServerContext()) {
      return (
        <BackgroundWrapper background={section.background as never} anchor_id={section.anchor_id as string | undefined}>
          <div className="mx-auto max-w-3xl text-center">
            {title && (
              <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
                {title}
              </h2>
            )}
            <div className="rounded-2xl border-2 border-dashed border-[var(--color-neutral-200)] p-8 text-sm text-[var(--color-neutral-500)]">
              {isAr
                ? '📚 معاينة شريط البرامج — ستظهر بطاقات البرامج (من المصدر الموثوق) في الإصدار المنشور.'
                : '📚 Program card strip preview — program cards (from canon source) will appear on the published page.'}
            </div>
          </div>
        </BackgroundWrapper>
      );
    }
    return null;
  }

  return (
    <BackgroundWrapper background={section.background as never} anchor_id={section.anchor_id as string | undefined}>
      <div className="mx-auto max-w-6xl">
        {title && (
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-8 text-center">
            {title}
          </h2>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {programs.map((p) => {
            const programTitle = isAr ? p.title_ar : p.title_en;
            const subtitle = isAr ? p.subtitle_ar : p.subtitle_en;
            return (
              <a key={p.slug} href={`/${locale}/academy/courses/${p.slug}`} className="group">
                <Card accent className="p-5 h-full flex flex-col">
                  {p.thumbnail_url && (
                    <div className="relative aspect-[16/10] overflow-hidden rounded-lg mb-4 bg-[var(--color-neutral-100)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.thumbnail_url}
                        alt={programTitle}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <h3 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-1">
                    {programTitle}
                  </h3>
                  {p.duration && (
                    <p className="text-xs text-[var(--color-neutral-500)] mb-2">{p.duration}</p>
                  )}
                  {subtitle && (
                    <p className="text-sm text-[var(--color-neutral-600)] line-clamp-2 flex-1">
                      {subtitle}
                    </p>
                  )}
                  {p.is_free && (
                    <span className="mt-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 self-start">
                      {isAr ? 'مجاني' : 'Free'}
                    </span>
                  )}
                </Card>
              </a>
            );
          })}
        </div>
      </div>
    </BackgroundWrapper>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────
//
// Detects whether we're in a server execution context. In Next.js 16, server
// components run in Node where `window` is undefined; client components run
// in the browser. This is a pragmatic boundary check used to render preview
// placeholders in the editor canvas without DB access.
function isInServerContext(): boolean {
  return typeof window === 'undefined';
}
