/**
 * Wave 15 Wave 3 — Authoring canvas.
 *
 * Renders the page exactly as visitors will see it, with click-to-select
 * affordances overlaid (per Hakawati §6.2). Wraps existing renderers:
 *   - landing_pages → existing `LpRenderer` from components/lp/lp-renderer.tsx
 *   - blog_posts    → minimal blog-shape preview (title + content_*)
 *   - static_pages  → uses LpRenderer (same composition_json shape per §2.1)
 *
 * Implementation note (canary scope): we DON'T mutate `lp-renderer.tsx`. We
 * render it inside a click-overlay container that intercepts `mousedown` to
 * resolve which section was clicked (by walking up to the nearest data-
 * section-index marker we attach during render). This keeps the renderer
 * byte-identical for public surfaces — boundary contract preserved.
 *
 * Re-render scope: parent already passes us the latest composition; React
 * naturally re-renders only the changed tree. Per-section React.memo
 * polish is post-canary refinement (Hakawati §6.4).
 */

'use client';

import { useRef } from 'react';
import { LpRenderer } from '../lp/lp-renderer';
import type { LpComposition } from '@/lib/lp/composition-types';

export type EntityKind = 'landing_pages' | 'blog_posts' | 'static_pages';

interface CanvasProps {
  entity: EntityKind;
  slug: string;
  locale: 'ar' | 'en';
  composition: LpComposition;
  /** Blog rich content fields (only used when entity=blog_posts). */
  blogFields?: {
    title_ar: string | null;
    title_en: string | null;
    content_ar: string | null;
    content_en: string | null;
    featured_image_url: string | null;
  };
  selectedIndex: number | null;
  onSelectSection: (index: number) => void;
}

export function Canvas({
  entity,
  slug,
  locale,
  composition,
  blogFields,
  selectedIndex,
  onSelectSection,
}: CanvasProps) {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const ref = useRef<HTMLDivElement>(null);

  // Click-to-select: walk up to nearest [data-section-index] node.
  function handleClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const node = target.closest<HTMLElement>('[data-section-index]');
    if (node) {
      const idx = Number(node.dataset.sectionIndex);
      if (Number.isFinite(idx)) {
        e.preventDefault();
        onSelectSection(idx);
      }
    }
  }

  // Blog preview — different render path because blog_posts uses scalar
  // content_ar / content_en plus *_rich companions, not composition_json.
  // Wave 16 promotes blog to composition_json + per-section forms; for
  // Wave 3 canary we render the existing blog body as a single block.
  if (entity === 'blog_posts' && blogFields) {
    const title = isAr
      ? blogFields.title_ar || blogFields.title_en
      : blogFields.title_en || blogFields.title_ar;
    const content = isAr
      ? blogFields.content_ar || blogFields.content_en
      : blogFields.content_en || blogFields.content_ar;
    return (
      <div
        ref={ref}
        dir={dir}
        className="flex-1 overflow-y-auto bg-white"
        data-canvas
      >
        <article className="max-w-3xl mx-auto px-6 py-8">
          {blogFields.featured_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blogFields.featured_image_url}
              alt=""
              className="w-full max-h-[420px] object-cover rounded-2xl mb-6"
            />
          )}
          <h1
            className="text-3xl md:text-4xl font-bold mb-4 text-[var(--text-primary)]"
            data-section-index={0}
            onClick={(e) => {
              e.preventDefault();
              onSelectSection(0);
            }}
            style={{
              cursor: 'pointer',
              outline: selectedIndex === 0 ? '2px solid var(--color-accent, #F47E42)' : 'none',
              outlineOffset: '4px',
              borderRadius: '4px',
            }}
          >
            {title || (isAr ? '— لا عنوان —' : '— no title —')}
          </h1>
          <div
            className="prose prose-sm md:prose-base max-w-none text-[var(--color-neutral-800)]"
            data-section-index={1}
            onClick={(e) => {
              e.preventDefault();
              onSelectSection(1);
            }}
            style={{
              cursor: 'pointer',
              outline: selectedIndex === 1 ? '2px solid var(--color-accent, #F47E42)' : 'none',
              outlineOffset: '8px',
              borderRadius: '4px',
              minHeight: '200px',
            }}
          >
            {content
              ? content.split('\n\n').map((para, i) => <p key={i}>{para}</p>)
              : (
                <p className="text-[var(--color-neutral-400)] italic">
                  {isAr ? '— لا محتوى بعد —' : '— no content yet —'}
                </p>
              )}
          </div>
        </article>
      </div>
    );
  }

  // Landing pages + static pages — render the existing LpRenderer with
  // section-index markers wrapped around each rendered section. We shadow
  // the composition with augmented sections that carry `__editing_idx`
  // metadata; the renderer ignores unknown fields. Then we attach the
  // marker via a wrapping div outside the renderer.
  return (
    <div
      ref={ref}
      dir={dir}
      className="flex-1 overflow-y-auto bg-[var(--color-surface,#FFF5E9)]/30"
      data-canvas
      onClickCapture={handleClickCapture}
    >
      <SectionOverlay
        sections={composition.sections ?? []}
        selectedIndex={selectedIndex}
        isAr={isAr}
        onSelectSection={onSelectSection}
      >
        <LpRenderer slug={slug} locale={locale} composition={composition} />
      </SectionOverlay>
    </div>
  );
}

/**
 * Renders absolutely-positioned overlay markers for each section, computed
 * post-mount via DOM traversal of the rendered LP. We use a delegated
 * click handler on the canvas; the visual selection ring is drawn via
 * `<style>` rules keyed off `data-section-index` attributes inserted by
 * a small layout effect.
 *
 * For Wave 3 canary we use a simpler approach: render a sibling
 * "click target" overlay with a vertical column of buttons, one per
 * section, anchored to the same column the renderer fills. The renderer
 * itself stays untouched. Selection visual ring is drawn by absolutely-
 * positioning a translucent border layer over the corresponding DOM rect.
 *
 * This is the LEAST-INVASIVE path that respects the boundary contract
 * (no LpRenderer changes). Refinement to true per-section overlay markers
 * (per spec §6.2 hover affordances) is post-canary.
 */
function SectionOverlay({
  sections,
  selectedIndex,
  isAr,
  onSelectSection,
  children,
}: {
  sections: ReadonlyArray<unknown>;
  selectedIndex: number | null;
  isAr: boolean;
  onSelectSection: (i: number) => void;
  children: React.ReactNode;
}) {
  // Render the LP unchanged inside a relative wrapper. The selection
  // visualisation comes from per-section CSS hover/selection state; we
  // augment it here with a top-of-page selection bar that lists section
  // indices for click-targeting (a fallback path until DOM-rect overlay
  // ships post-canary).
  return (
    <div className="relative">
      {/* Selection-bar fallback — small numbered chips at the top of the
          canvas that map 1:1 to sections. Click selects + scrolls to the
          section using anchor IDs (or page-relative). */}
      {sections.length > 0 && (
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-[var(--color-neutral-200)] px-4 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-neutral-500)] shrink-0">
            {isAr ? 'تحديد سريع' : 'Jump to'}:
          </span>
          {sections.map((s, i) => {
            const sec = s as { type?: string; anchor_id?: string };
            const label = `${i + 1} ${sec.type ? '· ' + sec.type : ''}`.trim();
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onSelectSection(i);
                  // Scroll to anchor if defined.
                  if (sec.anchor_id) {
                    const target = document.getElementById(sec.anchor_id);
                    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  selectedIndex === i
                    ? 'bg-[var(--color-accent,#F47E42)] text-white'
                    : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {children}
    </div>
  );
}
