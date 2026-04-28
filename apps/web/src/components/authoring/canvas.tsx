/**
 * Wave 15 Wave 3 — Authoring canvas.
 *
 * Post-canary refinement (Item 1): Replaced the sticky chip-bar fallback with
 * proper DOM-rect overlay markers per Hakawati §6.2:
 *
 *   Hover  : 1px Mandarin border at 40% opacity, 8px outside section bounds.
 *            Drag handle (⋮⋮) at top-left (top-right in AR), 32×32 hit area.
 *            "+Add section" pill below the gap — 4px tall × 44px tap area.
 *   Select : Border thickens to 2px Mandarin at 70%.
 *            Floating section toolbar: drag · duplicate · ask AI · delete.
 *   +Add   : 1px hairline in every gap at 20% opacity. On hover within 24px →
 *            32×32 "+" button. Click opens section picker. Keyboard: "o".
 *   Drag   : 100ms hold initiates. 95% opacity drop. Gap zones highlight. Esc.
 *
 * Implementation notes:
 *   - Overlay markers are rendered as fixed-position siblings, NOT as children
 *     of section components — avoids layout shift.
 *   - getBoundingClientRect() measurements are taken on hover-entry (per
 *     sectionRects) and on scroll via rAF-throttled onScroll.
 *   - The state machine for hover/select/drag lives entirely in this component.
 *   - LpRenderer is rendered UNCHANGED — boundary contract preserved.
 *   - blog_posts path is unchanged from canary v2 (simplified blog preview).
 *
 * Prop `onAddSection(afterIndex)` is called when the user clicks a gap "+"
 * or presses "o" — the parent mounts the SectionTypePicker at that position.
 */

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { LpRenderer } from '../lp/lp-renderer';
import type { LpComposition } from '@/lib/lp/composition-types';

export type EntityKind = 'landing_pages' | 'blog_posts' | 'static_pages';

// ── Per-agent canvas accent tint (1px border on canvas section border) ──
export const AGENT_CANVAS_ACCENT: Record<string, string> = {
  human: 'transparent',
  hakima: '#82C4E8',
  shahira: '#F47E42',
  hakawati: '#474099',
  nashit: '#2C2C2D',
  sani: '#82C4E8',
  amin: '#F47E42',
  rafik: '#474099',
};

interface CanvasProps {
  entity: EntityKind;
  slug: string;
  locale: 'ar' | 'en';
  composition: LpComposition;
  blogFields?: {
    title_ar: string | null;
    title_en: string | null;
    content_ar: string | null;
    content_en: string | null;
    featured_image_url: string | null;
  };
  selectedIndex: number | null;
  onSelectSection: (index: number) => void;
  /** Called when user triggers "+ Add section" after a given section index.
   *  -1 means "add before first section". */
  onAddSection?: (afterIndex: number) => void;
  onDuplicateSection?: (index: number) => void;
  onDeleteSection?: (index: number) => void;
  /** Initiates drag-reorder from the overlay handle. */
  onDragStartSection?: (index: number) => void;
  /** Per-section agent provenance for canvas accent borders. */
  provenanceMap?: Record<number, string | null>;
}

export function Canvas({
  entity,
  slug,
  locale,
  composition,
  blogFields,
  selectedIndex,
  onSelectSection,
  onAddSection,
  onDuplicateSection,
  onDeleteSection,
  onDragStartSection,
  provenanceMap = {},
}: CanvasProps) {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  // Blog preview — different render path (same as canary v2).
  if (entity === 'blog_posts' && blogFields) {
    return (
      <BlogPreview
        blogFields={blogFields}
        isAr={isAr}
        dir={dir}
        selectedIndex={selectedIndex}
        onSelectSection={onSelectSection}
      />
    );
  }

  return (
    <OverlayCanvas
      slug={slug}
      locale={locale}
      isAr={isAr}
      dir={dir}
      composition={composition}
      selectedIndex={selectedIndex}
      onSelectSection={onSelectSection}
      onAddSection={onAddSection}
      onDuplicateSection={onDuplicateSection}
      onDeleteSection={onDeleteSection}
      onDragStartSection={onDragStartSection}
      provenanceMap={provenanceMap}
    />
  );
}

// ── OverlayCanvas — the full DOM-rect overlay implementation ──────────────

interface OverlayCanvasProps {
  slug: string;
  locale: 'ar' | 'en';
  isAr: boolean;
  dir: 'ltr' | 'rtl';
  composition: LpComposition;
  selectedIndex: number | null;
  onSelectSection: (index: number) => void;
  onAddSection?: (afterIndex: number) => void;
  onDuplicateSection?: (index: number) => void;
  onDeleteSection?: (index: number) => void;
  onDragStartSection?: (index: number) => void;
  provenanceMap: Record<number, string | null>;
}

type DragState = { active: false } | { active: true; index: number; startY: number };

function OverlayCanvas({
  slug,
  locale,
  isAr,
  dir,
  composition,
  selectedIndex,
  onSelectSection,
  onAddSection,
  onDuplicateSection,
  onDeleteSection,
  onDragStartSection,
  provenanceMap,
}: OverlayCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<HTMLDivElement>(null);

  // Index of the section the pointer is currently hovering over (-1 = none).
  const [hoverIndex, setHoverIndex] = useState<number>(-1);
  // Index of the gap the pointer is hovering near (for + affordance).
  const [hoverGapIndex, setHoverGapIndex] = useState<number>(-1);
  // Drag state.
  const [drag, setDrag] = useState<DragState>({ active: false });
  // Drag hold timer ref.
  const dragHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sections = useMemo(() => composition.sections ?? [], [composition.sections]);
  const sectionCount = sections.length;

  // ── Section rect measurement ──────────────────────────────────────────
  // We measure [data-section-index] nodes rendered inside rendererRef.
  // Called on scroll (rAF-throttled) and on pointer-entry.
  const [sectionRects, setSectionRects] = useState<DOMRect[]>([]);

  const measureRects = useCallback(() => {
    if (!rendererRef.current) return;
    const nodes = rendererRef.current.querySelectorAll<HTMLElement>(
      '[data-section-index]',
    );
    if (nodes.length === 0) return;
    const rects: DOMRect[] = new Array(sectionCount);
    nodes.forEach((node) => {
      const idx = Number(node.dataset.sectionIndex);
      if (Number.isFinite(idx) && idx >= 0 && idx < sectionCount) {
        rects[idx] = node.getBoundingClientRect();
      }
    });
    // Fill any unmeasured slots with an empty rect.
    for (let i = 0; i < sectionCount; i++) {
      if (!rects[i]) rects[i] = new DOMRect();
    }
    setSectionRects(rects);
  }, [sectionCount]);

  // Remeasure whenever composition changes.
  useEffect(() => {
    // After paint to ensure the renderer has updated the DOM.
    const id = requestAnimationFrame(measureRects);
    return () => cancelAnimationFrame(id);
  }, [composition, measureRects]);

  // Scroll listener — rAF-throttled.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        measureRects();
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [measureRects]);

  // ── Keyboard shortcut: "o" to add section after focused section ──────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when focus is inside an input/textarea/rich editor.
      if (
        e.key !== 'o' ||
        (document.activeElement &&
          (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA' ||
            (document.activeElement as HTMLElement).isContentEditable))
      )
        return;
      if (onAddSection && selectedIndex !== null) {
        onAddSection(selectedIndex);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onAddSection, selectedIndex]);

  // ── Drag cancel on Esc ────────────────────────────────────────────────
  useEffect(() => {
    if (!drag.active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dragHoldTimer.current) clearTimeout(dragHoldTimer.current);
        setDrag({ active: false });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drag.active]);

  // ── Pointer event on canvas ───────────────────────────────────────────
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const y = e.clientY;
    let nearGap = -1;

    for (let i = 0; i < sectionCount; i++) {
      const rect = sectionRects[i];
      if (!rect) continue;

      // Section hover: pointer inside section bounds.
      if (y >= rect.top && y <= rect.bottom) {
        if (hoverIndex !== i) setHoverIndex(i);
        // Within 24px of bottom edge → hover the gap below.
        if (rect.bottom - y < 24) nearGap = i;
        else if (y - rect.top < 24 && i === 0) nearGap = -1; // gap before first
        if (hoverGapIndex !== nearGap) setHoverGapIndex(nearGap);
        return;
      }

      // Gap zone between sections i and i+1.
      if (i < sectionCount - 1) {
        const nextRect = sectionRects[i + 1];
        if (nextRect && y > rect.bottom && y < nextRect.top) {
          if (hoverIndex !== -1) setHoverIndex(-1);
          if (hoverGapIndex !== i) setHoverGapIndex(i);
          return;
        }
      }
    }

    // Outside all sections.
    if (hoverIndex !== -1) setHoverIndex(-1);
    if (hoverGapIndex !== nearGap) setHoverGapIndex(nearGap);
  }

  function handlePointerLeave() {
    setHoverIndex(-1);
    setHoverGapIndex(-1);
    if (dragHoldTimer.current) {
      clearTimeout(dragHoldTimer.current);
      dragHoldTimer.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, index: number) {
    // 100ms hold → initiate drag.
    dragHoldTimer.current = setTimeout(() => {
      setDrag({ active: true, index, startY: e.clientY });
      if (onDragStartSection) onDragStartSection(index);
    }, 100);
  }

  function handlePointerUp() {
    if (dragHoldTimer.current) {
      clearTimeout(dragHoldTimer.current);
      dragHoldTimer.current = null;
    }
  }

  function handleSectionClick(e: React.MouseEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    onSelectSection(index);
  }

  // ── Mandarin color constants ──────────────────────────────────────────
  const MANDARIN = '#F47E42';
  const MANDARIN_40 = 'rgba(244,126,66,0.4)';
  const MANDARIN_70 = 'rgba(244,126,66,0.7)';
  const HAIRLINE = 'rgba(244,126,66,0.2)';

  // ── Overlay rendering ─────────────────────────────────────────────────
  // The overlay is a fixed-position `<div>` that is a sibling of the
  // scroll container, not a child. It uses the DOM rects measured above.
  // We render one overlay slab per section + one gap button per gap.

  const scrollerTop = scrollRef.current?.getBoundingClientRect().top ?? 0;
  const scrollerLeft = scrollRef.current?.getBoundingClientRect().left ?? 0;

  function sectionOverlayStyle(i: number): CSSProperties {
    const rect = sectionRects[i];
    if (!rect || rect.width === 0) return { display: 'none' };
    const isHovered = hoverIndex === i;
    const isSelected = selectedIndex === i;
    const OUTSET = 8;
    return {
      position: 'fixed',
      top: rect.top - OUTSET,
      left: rect.left - OUTSET,
      width: rect.width + OUTSET * 2,
      height: rect.height + OUTSET * 2,
      pointerEvents: 'none',
      borderRadius: 4,
      border: isSelected
        ? `2px solid ${MANDARIN_70}`
        : isHovered
        ? `1px solid ${MANDARIN_40}`
        : 'none',
      zIndex: 20,
      boxSizing: 'border-box',
      transition: 'border 150ms ease-out',
    };
  }

  function dragHandleStyle(i: number): CSSProperties {
    const rect = sectionRects[i];
    if (!rect || rect.width === 0) return { display: 'none' };
    const OUTSET = 8;
    const isVisible = hoverIndex === i || selectedIndex === i;
    return {
      position: 'fixed',
      // AR mode: top-right; LTR mode: top-left
      top: rect.top - OUTSET + 2,
      [isAr ? 'right' : 'left']: isAr
        ? window.innerWidth - (rect.right + OUTSET - 2)
        : rect.left - OUTSET + 2,
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'white',
      border: `1px solid ${MANDARIN}`,
      borderRadius: 6,
      cursor: 'grab',
      fontSize: 14,
      color: MANDARIN,
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 100ms linear',
      pointerEvents: isVisible ? 'auto' : 'none',
      zIndex: 30,
      userSelect: 'none',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    };
  }

  function floatingToolbarStyle(i: number): CSSProperties {
    const rect = sectionRects[i];
    if (!rect || rect.width === 0) return { display: 'none' };
    const OUTSET = 8;
    const isVisible = selectedIndex === i;
    return {
      position: 'fixed',
      top: rect.top - OUTSET - 36,
      left: rect.left - OUTSET,
      display: isVisible ? 'flex' : 'none',
      gap: 4,
      padding: '4px 6px',
      background: 'white',
      border: `1px solid ${MANDARIN_40}`,
      borderRadius: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
      zIndex: 40,
      pointerEvents: 'auto',
      alignItems: 'center',
    };
  }

  function gapButtonStyle(afterIndex: number): CSSProperties {
    const rect = sectionRects[afterIndex];
    const nextRect = afterIndex + 1 < sectionCount ? sectionRects[afterIndex + 1] : null;
    if (!rect || rect.width === 0) return { display: 'none' };

    const gapTop = rect.bottom;
    const gapHeight = nextRect ? Math.max(4, nextRect.top - rect.bottom) : 16;
    const isHovered = hoverGapIndex === afterIndex;

    return {
      position: 'fixed',
      top: gapTop,
      left: rect.left,
      width: rect.width,
      height: Math.max(44, gapHeight),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 25,
      pointerEvents: 'auto',
      cursor: 'pointer',
      // Hairline divider in every gap; brightens on hover.
      borderTop: `1px solid ${isHovered ? MANDARIN_40 : HAIRLINE}`,
      background: isHovered ? 'rgba(244,126,66,0.03)' : 'transparent',
      transition: 'background 100ms, border-top 100ms',
    };
  }

  return (
    <div
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
    >
      {/* Scroll container — holds the LP renderer */}
      <div
        ref={scrollRef}
        dir={dir}
        className="flex-1 overflow-y-auto bg-[var(--color-surface,#FFF5E9)]/30"
        data-canvas
        style={{ position: 'relative' }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerUp={handlePointerUp}
        onClickCapture={(e) => {
          // Delegated click — find nearest [data-section-index] node.
          const node = (e.target as HTMLElement).closest<HTMLElement>('[data-section-index]');
          if (node) {
            const idx = Number(node.dataset.sectionIndex);
            if (Number.isFinite(idx)) onSelectSection(idx);
          }
        }}
      >
        <div ref={rendererRef}>
          <LpRenderer slug={slug} locale={locale} composition={composition} />
        </div>

        {/* Empty state */}
        {sectionCount === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-8">
            <p className="text-lg font-semibold text-[var(--color-neutral-700)]">
              {isAr ? 'صفحة جديدة · جاهزة' : 'New page · ready'}
            </p>
            {onAddSection && (
              <button
                type="button"
                onClick={() => onAddSection(-1)}
                className="rounded-xl bg-[var(--color-accent,#F47E42)] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90"
              >
                {isAr ? '+ أضف القسم الأول' : '+ Add your first section'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Fixed-position overlay layer ────────────────────────────────── */}
      {/* Section hover/select borders */}
      {sectionRects.map((_, i) => {
        const provAgent = provenanceMap[i];
        const accentColor = provAgent ? (AGENT_CANVAS_ACCENT[provAgent] ?? 'transparent') : 'transparent';
        const showProvenance = provAgent && provAgent !== 'human';
        return (
          <div key={`overlay-${i}`} style={sectionOverlayStyle(i)}>
            {/* Provenance tint — 1px agent-accent border overlay on canvas */}
            {showProvenance && selectedIndex !== i && hoverIndex !== i && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 4,
                  border: `1px solid ${accentColor}`,
                  pointerEvents: 'none',
                  opacity: 0.7,
                }}
              />
            )}
          </div>
        );
      })}

      {/* Drag handles */}
      {sections.map((_, i) => (
        <div
          key={`handle-${i}`}
          style={dragHandleStyle(i)}
          title={isAr ? 'سحب لإعادة الترتيب' : 'Drag to reorder'}
          onPointerDown={(e) => handlePointerDown(e, i)}
          onPointerUp={handlePointerUp}
          role="button"
          aria-label={isAr ? `سحب القسم ${i + 1}` : `Drag section ${i + 1}`}
        >
          ⋮⋮
        </div>
      ))}

      {/* Floating section toolbars (visible only for selected section) */}
      {sections.map((_, i) => (
        <div key={`toolbar-${i}`} style={floatingToolbarStyle(i)}>
          <SectionToolbarButton
            title={isAr ? 'سحب' : 'Drag'}
            onClick={() => onDragStartSection?.(i)}
          >
            ⋮⋮
          </SectionToolbarButton>
          <SectionToolbarButton
            title={isAr ? 'مضاعفة' : 'Duplicate'}
            onClick={() => onDuplicateSection?.(i)}
          >
            □
          </SectionToolbarButton>
          <SectionToolbarButton
            title={isAr ? 'اطلب مساعدة الذكاء الاصطناعي' : 'Ask AI'}
            onClick={() => onSelectSection(i)}
          >
            🤖
          </SectionToolbarButton>
          <div style={{ width: 1, height: 16, background: MANDARIN_40, margin: '0 2px' }} />
          <SectionToolbarButton
            title={isAr ? 'حذف' : 'Delete'}
            onClick={() => onDeleteSection?.(i)}
            danger
          >
            ✕
          </SectionToolbarButton>
        </div>
      ))}

      {/* Click targets for section selection (invisible, but pointer-events-enabled) */}
      {sections.map((_, i) => {
        const rect = sectionRects[i];
        if (!rect || rect.width === 0) return null;
        return (
          <div
            key={`hit-${i}`}
            style={{
              position: 'fixed',
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              zIndex: 15,
              pointerEvents: selectedIndex === i ? 'none' : 'auto',
              cursor: 'default',
            }}
            onClick={(e) => handleSectionClick(e, i)}
            role="button"
            tabIndex={0}
            aria-label={isAr ? `تحديد القسم ${i + 1}` : `Select section ${i + 1}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectSection(i);
            }}
          />
        );
      })}

      {/* Gap "+" buttons */}
      {onAddSection && sections.map((_, i) => (
        <div
          key={`gap-${i}`}
          style={gapButtonStyle(i)}
          onClick={() => onAddSection(i)}
          role="button"
          aria-label={isAr ? `إضافة قسم بعد ${i + 1}` : `Add section after ${i + 1}`}
          title={isAr ? `إضافة قسم` : 'Add section'}
        >
          {hoverGapIndex === i && (
            <span
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'white',
                border: `1px solid ${MANDARIN}`,
                borderRadius: '50%',
                fontSize: 18,
                color: MANDARIN,
                fontWeight: 600,
                boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
                userSelect: 'none',
              }}
            >
              +
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionToolbarButton({
  children,
  title,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: 13,
        color: danger ? '#dc2626' : '#374151',
        transition: 'background 100ms',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = danger
          ? 'rgba(220,38,38,0.08)'
          : 'rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

// ── Blog preview (unchanged from canary v2) ───────────────────────────────

function BlogPreview({
  blogFields,
  isAr,
  dir,
  selectedIndex,
  onSelectSection,
}: {
  blogFields: NonNullable<CanvasProps['blogFields']>;
  isAr: boolean;
  dir: 'ltr' | 'rtl';
  selectedIndex: number | null;
  onSelectSection: (index: number) => void;
}) {
  const title = isAr
    ? blogFields.title_ar || blogFields.title_en
    : blogFields.title_en || blogFields.title_ar;
  const content = isAr
    ? blogFields.content_ar || blogFields.content_en
    : blogFields.content_en || blogFields.content_ar;

  return (
    <div
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
          onClick={(e) => { e.preventDefault(); onSelectSection(0); }}
          style={{
            cursor: 'pointer',
            outline: selectedIndex === 0 ? '2px solid #F47E42' : 'none',
            outlineOffset: 4,
            borderRadius: 4,
          }}
        >
          {title || (isAr ? '— لا عنوان —' : '— no title —')}
        </h1>
        <div
          className="prose prose-sm md:prose-base max-w-none text-[var(--color-neutral-800)]"
          data-section-index={1}
          onClick={(e) => { e.preventDefault(); onSelectSection(1); }}
          style={{
            cursor: 'pointer',
            outline: selectedIndex === 1 ? '2px solid #F47E42' : 'none',
            outlineOffset: 8,
            borderRadius: 4,
            minHeight: 200,
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
