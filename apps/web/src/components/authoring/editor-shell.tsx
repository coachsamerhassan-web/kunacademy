/**
 * Wave 15 Wave 3 — Visual editor shell.
 *
 * Composes top bar + page tree (left) + canvas (center) + side panel (right)
 * for landing_pages, blog_posts, and static_pages. The same shell serves all
 * three entity types per spec §2.1 sibling-tables architecture.
 *
 * Wave 3 canary scope (post-canary refinement noted inline):
 *   ✓ Layout (canvas + side-panel + page-tree)
 *   ✓ Section selection bound to side panel
 *   ✓ Drag-reorder (page tree)
 *   ✓ Add section via picker (page tree footer button)
 *   ✓ Live preview (canvas re-renders on every state change)
 *   ✓ AR ⇄ EN toggle (canvas locale state)
 *   ✓ Autosave (5s idle / 30s active via useAutoSave)
 *   ✓ Submit-for-review + Publish via /transition (lint surfaces in panel)
 *
 *   POST-CANARY refinement:
 *   - DOM-rect overlay markers on canvas (Hakawati §6.2 affordances)
 *   - Per-agent accent borders on canvas section borders
 *   - Inline AI invocation (Hakawati §6.5 "Ask 🤖")
 *   - Diff view from content_edits.previous_value/new_value
 *   - Multi-agent coordination strip
 *   - 768px tablet drawer + <768px full-screen overlay (panel collapse)
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LpComposition, LpSection } from '@/lib/lp/composition-types';
import { TopBar, type RowStatus } from './top-bar';
import { PageTree, type AgentIdentity } from './page-tree';
import { Canvas, type EntityKind } from './canvas';
import { SidePanel } from './side-panel';
import { useAutoSave } from './use-autosave';
import { SectionTypePicker } from './section-type-picker';

interface EditorShellProps {
  entity: EntityKind;
  /** Row UUID — currently consumed by the mount components for fetch URLs;
   *  the EditorShell stores it for future per-section endpoints (post-canary). */
  rowId?: string;
  slug: string;
  title: string;
  initialStatus: RowStatus;
  initialComposition: LpComposition;
  /** ETag — server's row.updated_at ISO string at load time. */
  initialEtag?: string | null;
  /** Blog scalar fields (only used when entity=blog_posts). */
  initialBlogFields?: {
    title_ar: string | null;
    title_en: string | null;
    content_ar: string | null;
    content_en: string | null;
    featured_image_url: string | null;
  };
  /** Per-section provenance map index → agent identity. */
  initialProvenance?: Record<number, AgentIdentity | null>;
  /** Save handler — called by autosave. Returns the new etag on success. */
  onSave: (composition: LpComposition, blogFields: EditorShellProps['initialBlogFields'], etag?: string | null) => Promise<string | null>;
  /** Transition handler — called for submit-for-review / publish. Returns
   *  the response body (success row OR lint_block details). */
  onTransition: (to: 'review' | 'published') => Promise<TransitionResult>;
  /** Public preview href (e.g. /ar/lp/foo). Renders as "Open ↗" fallback when
   *  device-preview isn't wired. */
  previewHref: string | null;
  locale: string;
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
}: EditorShellProps) {
  const router = useRouter();
  const isAr = locale === 'ar';

  // Wave 15 W3 canary v2 (Issue 5B) — device-preview href.
  // When a rowId is available, link to the new preview-in-new-tab route with
  // device-size toggle. Fallback: keep the public previewHref.
  const devicePreviewHref = rowId ? `/${locale}/admin/preview/${entity}/${rowId}?as=draft` : null;

  // ── Authored state ─────────────────────────────────────────────────────
  const [composition, setComposition] = useState<LpComposition>(initialComposition);
  // Blog scalar fields. setBlogFields is held for post-canary scalar editing
  // (the blog scalar form lands in the side panel as a "Page-level" tab).
  const [blogFields] = useState(initialBlogFields ?? null);
  const [status, setStatus] = useState<RowStatus>(initialStatus);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Locale toggle. Initialized from URL locale; sticky during the session.
  const [canvasLocale, setCanvasLocale] = useState<'ar' | 'en'>(locale === 'ar' ? 'ar' : 'en');

  // Wave 15 W3 canary v2 (Issue 5A): page-tree icon-rail collapse.
  // Defaults to collapsed = stage gets the visual breathing room Samer
  // requested. Hamburger toggles to full-tree mode. Sticky per-session
  // via localStorage (best-effort — safe fallback if storage is denied).
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
      try {
        window.localStorage.setItem('kun:editor:tree-collapsed', next ? '1' : '0');
      } catch {
        /* localStorage may be denied — stickiness is best-effort */
      }
      return next;
    });
  }, []);

  // Lint state (last-known from a transition attempt).
  const [lintViolations, setLintViolations] = useState<TransitionResult['lints'] | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Sections derive from composition; canonical edits flow through composition.
  const sections: LpSection[] = composition.sections ?? [];

  // ── Autosave wiring ────────────────────────────────────────────────────
  const saveValue = useMemo(() => ({ composition, blogFields }), [composition, blogFields]);

  const saveHandler = useCallback(
    async (v: typeof saveValue, etag?: string | null) => {
      // onSave's blogFields type is the prop's initialBlogFields type
      // (object | undefined) — pass through, normalizing nullable state to
      // undefined for type compatibility.
      const next = await onSave(v.composition, v.blogFields ?? undefined, etag ?? null);
      return next;
    },
    [onSave],
  );

  const { status: saveStatus, lastSavedAt, save: saveNow } = useAutoSave({
    value: saveValue,
    etag: initialEtag,
    onSave: saveHandler,
  });

  // ── Mutation helpers ───────────────────────────────────────────────────
  const updateSections = useCallback((next: LpSection[]) => {
    setComposition((prev) => ({ ...prev, sections: next }));
  }, []);

  const handleSectionChange = useCallback((next: LpSection) => {
    if (selectedIndex === null) return;
    setComposition((prev) => {
      const cur = prev.sections ?? [];
      const updated = cur.slice();
      updated[selectedIndex] = next;
      return { ...prev, sections: updated };
    });
  }, [selectedIndex]);

  const handleAddSection = useCallback((newSection: LpSection) => {
    setComposition((prev) => {
      const cur = prev.sections ?? [];
      const next = [...cur, newSection];
      // Auto-select the newly-added section.
      setSelectedIndex(next.length - 1);
      return { ...prev, sections: next };
    });
  }, []);

  const handleDeleteSection = useCallback(() => {
    if (selectedIndex === null) return;
    if (
      !window.confirm(
        isAr
          ? `حذف القسم #${selectedIndex + 1}؟`
          : `Delete section #${selectedIndex + 1}?`,
      )
    ) return;
    setComposition((prev) => {
      const cur = prev.sections ?? [];
      const next = cur.slice();
      next.splice(selectedIndex, 1);
      return { ...prev, sections: next };
    });
    setSelectedIndex(null);
  }, [selectedIndex, isAr]);

  const handleDuplicateSection = useCallback(() => {
    if (selectedIndex === null) return;
    setComposition((prev) => {
      const cur = prev.sections ?? [];
      const target = cur[selectedIndex];
      if (!target) return prev;
      const copy = JSON.parse(JSON.stringify(target));
      const next = cur.slice();
      next.splice(selectedIndex + 1, 0, copy);
      setSelectedIndex(selectedIndex + 1);
      return { ...prev, sections: next };
    });
  }, [selectedIndex]);

  // Transition handler — submits to /transition; surfaces lint violations.
  const doTransition = useCallback(async (to: 'review' | 'published') => {
    // Save first to ensure the server lints the latest body.
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
      // Refresh the page on publish so server-driven state (published,
      // published_at) reflects in the URL/preview.
      if (to === 'published') router.refresh();
    } else {
      setLintViolations(result.lints ?? null);
      setTransitionError(result.error ?? null);
    }
  }, [saveNow, saveStatus, onTransition, isAr, router]);

  const lintHardBlock = (lintViolations?.hard_blocks ?? 0) > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] bg-white" data-wave-15-w3-editor>
      <TopBar
        title={title || slug}
        status={status}
        canvasLocale={canvasLocale}
        onLocaleToggle={() => setCanvasLocale((c) => (c === 'ar' ? 'en' : 'ar'))}
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

      {transitionError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-800">
          {transitionError}
        </div>
      )}
      {lintHardBlock && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-900">
          <span className="font-semibold">⛔ {isAr ? 'النشر محظور' : 'Publish blocked'}:</span>{' '}
          {isAr
            ? `${lintViolations?.hard_blocks} تنبيه/تنبيهات صلبة. حلّها قبل الإرسال للمراجعة.`
            : `${lintViolations?.hard_blocks} hard-block lint violation${(lintViolations?.hard_blocks ?? 0) === 1 ? '' : 's'}. Resolve before retrying.`}
          <span className="ms-2 text-xs text-red-700">
            {(lintViolations?.details ?? [])
              .filter((d) => d.severity === 'hard_block')
              .slice(0, 3)
              .map((d) => d.rule_id)
              .join(', ')}
          </span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <PageTree
          sections={sections}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onChange={updateSections}
          locale={locale}
          provenance={initialProvenance}
          onAdd={() => setPickerOpen(true)}
          collapsed={treeCollapsed}
          onToggleCollapsed={toggleTreeCollapsed}
        />
        <Canvas
          entity={entity}
          slug={slug}
          locale={canvasLocale}
          composition={composition}
          blogFields={blogFields ?? undefined}
          selectedIndex={selectedIndex}
          onSelectSection={setSelectedIndex}
        />
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
        />
      </div>

      <SectionTypePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
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
