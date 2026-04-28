/**
 * Wave 15 Wave 3 — Visual editor shell (post-canary Wave 3 complete).
 *
 * All post-canary refinement items wired:
 *   ✓ DOM-rect overlay markers on canvas (Hakawati §6.2) — Item 1
 *   ✓ React.memo per section + field debounce — Item 2 (via use-debounced-section)
 *   ✓ Inline AI invocation footer "Ask 🤖" — Item 3
 *   ✓ Diff view from content_edits — Item 4
 *   ✓ Multi-agent coordination strip — Item 5
 *   ✓ Tablet drawer (768–1023px) + mobile full-screen overlay (<768px) — Item 6
 *   ✓ AR-first RTL polish + 250ms locale crossfade — Item 7
 *   ✓ Brand language polish (Cosmic Latte/Platinum surfaces, Mandarin accent only) — Item 8
 */

'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { LpComposition, LpSection } from '@/lib/lp/composition-types';
import { TopBar, type RowStatus } from './top-bar';
import { PageTree, type AgentIdentity } from './page-tree';
import { Canvas, type EntityKind } from './canvas';
import { SidePanel } from './side-panel';
import { useAutoSave } from './use-autosave';
import { SectionTypePicker } from './section-type-picker';
import { MultiAgentStrip } from './multi-agent-strip';

interface EditorShellProps {
  entity: EntityKind;
  rowId?: string;
  slug: string;
  title: string;
  initialStatus: RowStatus;
  initialComposition: LpComposition;
  initialEtag?: string | null;
  initialBlogFields?: {
    title_ar: string | null;
    title_en: string | null;
    content_ar: string | null;
    content_en: string | null;
    featured_image_url: string | null;
  };
  initialProvenance?: Record<number, AgentIdentity | null>;
  onSave: (composition: LpComposition, blogFields: EditorShellProps['initialBlogFields'], etag?: string | null) => Promise<string | null>;
  onTransition: (to: 'review' | 'published') => Promise<TransitionResult>;
  previewHref: string | null;
  locale: string;
  /** AR-first default locale. When true (default for AR LPs), the canvas
   *  opens in AR. When false (EN LPs), opens in EN. Per Hakawati §6.1. */
  defaultLocaleFirst?: 'ar' | 'en';
}

export interface TransitionResult {
  ok: boolean;
  status?: RowStatus;
  lints?: {
    total: number;
    hard_blocks: number;
    soft_warns: number;
    details: Array<{
      rule_id: string;
      severity: string;
      message: string;
      path: string;
    }>;
  } | null;
  error?: string;
}

export function EditorShell({
  entity,
  rowId,
  slug,
  title,
  initialStatus,
  initialComposition,
  initialEtag,
  initialBlogFields,
  initialProvenance = {},
  onSave,
  onTransition,
  previewHref,
  locale,
  defaultLocaleFirst,
}: EditorShellProps) {
  const router = useRouter();
  const isAr = locale === 'ar';

  // Device preview href (wave 3 canary v2 Issue 5B).
  const devicePreviewHref = rowId
    ? `/${locale}/admin/preview/${entity}/${rowId}?as=draft`
    : null;

  // ── Authored state ──────────────────────────────────────────────────────
  const [composition, setComposition] = useState<LpComposition>(initialComposition);
  const [blogFields] = useState(initialBlogFields ?? null);
  const [status, setStatus] = useState<RowStatus>(initialStatus);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [pickerAfterIndex, setPickerAfterIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // AR-first locale: per Hakawati §6.1, AR-default LPs open in AR.
  // defaultLocaleFirst comes from the mount (derived from landing_pages.default_locale).
  const initialCanvasLocale = (defaultLocaleFirst ?? (locale === 'ar' ? 'ar' : 'en')) as 'ar' | 'en';
  const [canvasLocale, setCanvasLocale] = useState<'ar' | 'en'>(initialCanvasLocale);

  // Item 7: 250ms locale crossfade — fade-cross on locale switch.
  const [localeFading, setLocaleFading] = useState(false);
  const prevLocaleRef = useRef<'ar' | 'en'>(canvasLocale);

  function toggleLocale() {
    const next = canvasLocale === 'ar' ? 'en' : 'ar';
    setLocaleFading(true);
    prevLocaleRef.current = canvasLocale;
    // Apply the new locale after the first half of the crossfade.
    setTimeout(() => {
      setCanvasLocale(next);
      setTimeout(() => setLocaleFading(false), 125);
    }, 125);
  }

  // Tree collapse state (sticky localStorage).
  const [treeCollapsed, setTreeCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = window.localStorage.getItem('kun:editor:tree-collapsed');
      return stored === null ? true : stored === '1';
    } catch {
      return true;
    }
  });

  const toggleTreeCollapsed = useCallback(() => {
    setTreeCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem('kun:editor:tree-collapsed', next ? '1' : '0'); }
      catch { /* storage denied */ }
      return next;
    });
  }, []);

  // Item 6: Responsive panel state.
  // viewport: 'desktop' ≥1024px, 'tablet' 768–1023px, 'mobile' <768px
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [panelOpen, setPanelOpen] = useState(false); // tablet/mobile panel open state

  useEffect(() => {
    function measure() {
      const w = window.innerWidth;
      if (w >= 1024) setViewport('desktop');
      else if (w >= 768) setViewport('tablet');
      else setViewport('mobile');
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Auto-open panel on tablet/mobile when a section is selected.
  const prevSelectedIndexRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      viewport !== 'desktop' &&
      selectedIndex !== null &&
      selectedIndex !== prevSelectedIndexRef.current
    ) {
      setPanelOpen(true);
    }
    prevSelectedIndexRef.current = selectedIndex;
  }, [selectedIndex, viewport]);

  // Lint state.
  const [lintViolations, setLintViolations] = useState<TransitionResult['lints'] | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const sections: LpSection[] = composition.sections ?? [];

  // ── Autosave ─────────────────────────────────────────────────────────────
  const saveValue = useMemo(() => ({ composition, blogFields }), [composition, blogFields]);

  const saveHandler = useCallback(
    async (v: typeof saveValue, etag?: string | null) =>
      onSave(v.composition, v.blogFields ?? undefined, etag ?? null),
    [onSave],
  );

  const { status: saveStatus, lastSavedAt, save: saveNow } = useAutoSave({
    value: saveValue,
    etag: initialEtag,
    onSave: saveHandler,
  });

  // ── Mutation helpers ──────────────────────────────────────────────────────
  const updateSections = useCallback((next: LpSection[]) => {
    setComposition((prev) => ({ ...prev, sections: next }));
  }, []);

  const handleSectionChange = useCallback(
    (next: LpSection) => {
      if (selectedIndex === null) return;
      setComposition((prev) => {
        const cur = prev.sections ?? [];
        const updated = cur.slice();
        updated[selectedIndex] = next;
        return { ...prev, sections: updated };
      });
    },
    [selectedIndex],
  );

  const handleAddSection = useCallback((newSection: LpSection) => {
    setComposition((prev) => {
      const cur = prev.sections ?? [];
      const insertAfter = pickerAfterIndex !== null && pickerAfterIndex >= 0
        ? pickerAfterIndex
        : cur.length - 1;
      const next = [
        ...cur.slice(0, insertAfter + 1),
        newSection,
        ...cur.slice(insertAfter + 1),
      ];
      setSelectedIndex(insertAfter + 1);
      return { ...prev, sections: next };
    });
    setPickerAfterIndex(null);
  }, [pickerAfterIndex]);

  const handleDeleteSection = useCallback(
    (indexOverride?: number) => {
      const idx = indexOverride ?? selectedIndex;
      if (idx === null) return;
      if (
        !window.confirm(
          isAr ? `حذف القسم #${idx + 1}؟` : `Delete section #${idx + 1}?`,
        )
      ) return;
      setComposition((prev) => {
        const cur = prev.sections ?? [];
        const next = cur.slice();
        next.splice(idx, 1);
        return { ...prev, sections: next };
      });
      setSelectedIndex(null);
    },
    [selectedIndex, isAr],
  );

  const handleDuplicateSection = useCallback(
    (indexOverride?: number) => {
      const idx = indexOverride ?? selectedIndex;
      if (idx === null) return;
      setComposition((prev) => {
        const cur = prev.sections ?? [];
        const target = cur[idx];
        if (!target) return prev;
        const copy = JSON.parse(JSON.stringify(target)) as LpSection;
        const next = cur.slice();
        next.splice(idx + 1, 0, copy);
        setSelectedIndex(idx + 1);
        return { ...prev, sections: next };
      });
    },
    [selectedIndex],
  );

  const doTransition = useCallback(
    async (to: 'review' | 'published') => {
      const savedOk = await saveNow();
      if (!savedOk && saveStatus === 'error') {
        setTransitionError(isAr ? 'فشل الحفظ قبل الإرسال' : 'Save failed before transition');
        return;
      }
      setTransitionError(null);
      const result = await onTransition(to);
      if (result.ok) {
        setStatus(result.status ?? (to === 'review' ? 'review' : 'published'));
        setLintViolations(result.lints ?? null);
        if (to === 'published') router.refresh();
      } else {
        setLintViolations(result.lints ?? null);
        setTransitionError(result.error ?? null);
      }
    },
    [saveNow, saveStatus, onTransition, isAr, router],
  );

  const lintHardBlock = (lintViolations?.hard_blocks ?? 0) > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  // Item 7: Canvas wrapper gets 250ms opacity crossfade on locale switch.
  const canvasStyle: React.CSSProperties = localeFading
    ? { opacity: 0.1, transition: 'opacity 125ms ease-in-out' }
    : { opacity: 1, transition: 'opacity 125ms ease-in-out' };

  const isTablet = viewport === 'tablet';
  const isMobile = viewport === 'mobile';
  const isNarrow = isTablet || isMobile;

  return (
    // Item 8: Brand surface — Cosmic Latte bg for the full shell outer shell.
    <div
      className="flex flex-col bg-[#FFF5E9]"
      style={{ height: '100dvh' }}
      data-wave-15-w3-editor
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Top bar */}
      <TopBar
        title={title || slug}
        status={status}
        canvasLocale={canvasLocale}
        onLocaleToggle={toggleLocale}
        previewHref={previewHref}
        devicePreviewHref={devicePreviewHref}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        onSaveNow={() => { void saveNow(); }}
        onSubmitForReview={() => { void doTransition('review'); }}
        onPublish={() => { void doTransition('published'); }}
        publishDisabled={lintHardBlock}
        reviewDisabled={lintHardBlock}
        locale={locale}
      />

      {/* Multi-agent coordination strip (Item 5) */}
      {rowId && (
        <MultiAgentStrip
          entityId={rowId}
          entityKind={entity}
          locale={locale}
          onJumpToSection={(i) => {
            setSelectedIndex(i);
            if (isNarrow) setPanelOpen(true);
          }}
        />
      )}

      {/* Lint / transition error banners */}
      {transitionError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-800">
          {transitionError}
        </div>
      )}
      {lintHardBlock && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-900">
          <span className="font-semibold">
            ⛔ {isAr ? 'النشر محظور' : 'Publish blocked'}:
          </span>{' '}
          {isAr
            ? `${lintViolations?.hard_blocks} تنبيه/تنبيهات صلبة.`
            : `${lintViolations?.hard_blocks} hard-block violation${(lintViolations?.hard_blocks ?? 0) === 1 ? '' : 's'}.`}
          <span className="ms-2 text-xs text-red-700">
            {(lintViolations?.details ?? [])
              .filter((d) => d.severity === 'hard_block')
              .slice(0, 3)
              .map((d) => d.rule_id)
              .join(', ')}
          </span>
        </div>
      )}

      {/* Main editor body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Page tree — hidden on mobile behind hamburger */}
        {!isMobile && (
          <PageTree
            sections={sections}
            selectedIndex={selectedIndex}
            onSelect={(i) => {
              setSelectedIndex(i);
              if (isNarrow) setPanelOpen(true);
            }}
            onChange={updateSections}
            locale={locale}
            provenance={initialProvenance}
            onAdd={() => {
              setPickerAfterIndex(selectedIndex ?? sections.length - 1);
              setPickerOpen(true);
            }}
            collapsed={treeCollapsed || isTablet}
            onToggleCollapsed={toggleTreeCollapsed}
          />
        )}

        {/* Canvas — takes remaining space */}
        <div style={{ ...canvasStyle, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Canvas
            entity={entity}
            slug={slug}
            locale={canvasLocale}
            composition={composition}
            blogFields={blogFields ?? undefined}
            selectedIndex={selectedIndex}
            onSelectSection={(i) => {
              setSelectedIndex(i);
              if (isNarrow) setPanelOpen(true);
            }}
            onAddSection={(afterIndex) => {
              setPickerAfterIndex(afterIndex);
              setPickerOpen(true);
            }}
            onDuplicateSection={handleDuplicateSection}
            onDeleteSection={handleDeleteSection}
            provenanceMap={
              Object.fromEntries(
                Object.entries(initialProvenance).map(([k, v]) => [k, v ?? null]),
              )
            }
          />
        </div>

        {/* Desktop side panel — always visible, flex child */}
        {!isNarrow && (
          <SidePanel
            section={selectedIndex !== null ? sections[selectedIndex] ?? null : null}
            sectionIndex={selectedIndex}
            onChange={handleSectionChange}
            onDelete={handleDeleteSection}
            onDuplicate={handleDuplicateSection}
            canvasLocale={canvasLocale}
            locale={locale}
            provenance={
              selectedIndex !== null && initialProvenance[selectedIndex]
                ? { agent: initialProvenance[selectedIndex] as AgentIdentity, whenISO: null }
                : null
            }
            lintViolations={lintViolations?.details ?? []}
            lintHardBlock={lintHardBlock}
            entityId={rowId}
            entityKind={entity}
          />
        )}

        {/* Tablet drawer — slides from right, overlays canvas */}
        {isTablet && panelOpen && (
          <>
            {/* Scrim */}
            <div
              className="absolute inset-0 bg-black/20 z-40"
              onClick={() => setPanelOpen(false)}
            />
            {/* Drawer */}
            <div
              className="absolute top-0 bottom-0 z-50 bg-white shadow-2xl"
              style={{
                [isAr ? 'left' : 'right']: 0,
                width: 'min(420px, 85vw)',
                // Item 6: 220ms cubic-bezier slide — per §7.4 animation budget.
                animation: 'panel-slide-in 220ms cubic-bezier(0.32,0.72,0,1) forwards',
              }}
            >
              <style>{`
                @keyframes panel-slide-in {
                  from { transform: translateX(${isAr ? '-100%' : '100%'}); }
                  to { transform: translateX(0); }
                }
              `}</style>
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-neutral-200)]">
                <span className="text-xs font-semibold text-[var(--color-neutral-600)]">
                  {isAr ? 'التحرير' : 'Edit section'}
                </span>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-900)] p-1"
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                >
                  ✕
                </button>
              </div>
              <div className="overflow-y-auto h-[calc(100%-40px)]">
                <SidePanel
                  section={selectedIndex !== null ? sections[selectedIndex] ?? null : null}
                  sectionIndex={selectedIndex}
                  onChange={handleSectionChange}
                  onDelete={handleDeleteSection}
                  onDuplicate={handleDuplicateSection}
                  canvasLocale={canvasLocale}
                  locale={locale}
                  provenance={
                    selectedIndex !== null && initialProvenance[selectedIndex]
                      ? { agent: initialProvenance[selectedIndex] as AgentIdentity, whenISO: null }
                      : null
                  }
                  lintViolations={lintViolations?.details ?? []}
                  lintHardBlock={lintHardBlock}
                  inDrawer
                  entityId={rowId}
                  entityKind={entity}
                />
              </div>
            </div>
          </>
        )}

        {/* Mobile full-screen overlay */}
        {isMobile && panelOpen && (
          <div
            className="fixed inset-0 z-50 bg-white flex flex-col"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-neutral-200)] shrink-0">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {isAr ? 'تحرير القسم' : 'Edit section'}
              </span>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-900)] text-xl p-1"
                aria-label={isAr ? 'رجوع للصفحة' : 'Back to page'}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidePanel
                section={selectedIndex !== null ? sections[selectedIndex] ?? null : null}
                sectionIndex={selectedIndex}
                onChange={handleSectionChange}
                onDelete={(i) => { handleDeleteSection(i); setPanelOpen(false); }}
                onDuplicate={handleDuplicateSection}
                canvasLocale={canvasLocale}
                locale={locale}
                provenance={
                  selectedIndex !== null && initialProvenance[selectedIndex]
                    ? { agent: initialProvenance[selectedIndex] as AgentIdentity, whenISO: null }
                    : null
                }
                lintViolations={lintViolations?.details ?? []}
                lintHardBlock={lintHardBlock}
                inDrawer
                entityId={rowId}
                entityKind={entity}
              />
            </div>
          </div>
        )}

        {/* Mobile hamburger button (bottom right) — opens page tree sheet */}
        {isMobile && !panelOpen && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="fixed bottom-6 right-6 z-40 rounded-full bg-[var(--color-accent,#F47E42)] text-white w-12 h-12 flex items-center justify-center shadow-lg text-xl"
            aria-label={isAr ? 'إضافة قسم' : 'Add section'}
          >
            +
          </button>
        )}
      </div>

      {/* Section type picker */}
      <SectionTypePicker
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerAfterIndex(null); }}
        entity={entity}
        onPick={(s) => {
          handleAddSection(s);
          setPickerOpen(false);
        }}
        locale={locale}
      />
    </div>
  );
}

export type { EditorShellProps };
