/**
 * Wave 15 Wave 3 — Page tree (left-rail navigator).
 *
 * Replaces the row-table chrome of `section-list.tsx` with a vertical sidebar
 * shape: each section is a clickable row showing icon + label + AR title +
 * agent provenance dot. Drag-reorder via @dnd-kit. Selecting a row notifies
 * the parent EditorShell which binds the right-side panel to that section.
 *
 * Why a fresh component (not a refactor of section-list.tsx):
 *   - section-list ships react-table columns optimized for an admin table
 *     row (5 columns + actions). The authoring shell wants a single-column
 *     vertical "tree" closer to a Notion outline.
 *   - section-list retires in Wave 4. Keeping it untouched in Wave 3 means
 *     the `?legacy=1` escape hatch keeps mounting it without risk.
 *
 * Pattern reused: deriveSectionKey from `_shared.tsx`, and the same DndContext
 * + SortableContext stack from section-list.tsx (battle-tested in Wave 14b S1).
 */

'use client';

import { useMemo } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { LpSection } from '@/lib/lp/composition-types';
import { SECTION_TYPE_LABELS, deriveSectionKey } from '../admin/lp-editor/_shared';
import { VOCAB_BY_ID } from '@/lib/authoring/section-vocabulary';

interface PageTreeProps {
  sections: LpSection[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onChange: (next: LpSection[]) => void;
  locale: string;
  /** Optional map of section index → agent identity (for provenance dots). */
  provenance?: Record<number, AgentIdentity | null>;
  /** Optional onAdd handler — when provided, renders an "+ Add section" CTA at the bottom. */
  onAdd?: () => void;
  /** Wave 15 W3 canary v2 (Issue 5A) — collapse to icon-rail.
   *  When true, hide labels + reduce width to 56px; show only icon glyphs.
   *  When undefined (default), behave as before — full 260px tree. */
  collapsed?: boolean;
  /** Toggle handler for the hamburger button at the top. */
  onToggleCollapsed?: () => void;
}

export type AgentIdentity = 'human' | 'hakima' | 'shahira' | 'hakawati' | 'nashit' | 'sani' | 'amin' | 'rafik';

const AGENT_ACCENT: Record<AgentIdentity, string> = {
  human: 'transparent',
  hakima: '#82C4E8',     // Sky Blue 20% — methodology guardian
  shahira: '#F47E42',    // Mandarin 20% — positioning
  hakawati: '#474099',   // Dark Slate Blue 20% — narrative
  nashit: '#2C2C2D',     // Charleston Green 15% — operations
  sani: '#82C4E8',       // Sky Blue 12% (cooler than Hakima)
  amin: '#FFF5E9',       // Cosmic Latte (Mandarin border applied separately)
  rafik: '#474099',      // DSB 30% — orchestration
};

export function PageTree({
  sections,
  selectedIndex,
  onSelect,
  onChange,
  locale,
  provenance = {},
  onAdd,
  collapsed = false,
  onToggleCollapsed,
}: PageTreeProps) {
  const isAr = locale === 'ar';

  const rows = useMemo(
    () =>
      sections.map((section, index) => ({
        __key: deriveSectionKey(section, index),
        __index: index,
        section,
      })),
    [sections],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((r) => r.__key === active.id);
    const newIndex = rows.findIndex((r) => r.__key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(sections, oldIndex, newIndex));
  }

  return (
    <aside
      className={`shrink-0 border-e border-[var(--color-neutral-200)] bg-white overflow-y-auto transition-[width] duration-200 ${
        collapsed ? 'w-[56px]' : 'w-full md:w-[260px]'
      }`}
      aria-label={isAr ? 'شجرة الصفحة' : 'Page tree'}
    >
      <div className="px-2 py-2 border-b border-[var(--color-neutral-100)] sticky top-0 bg-white z-10 flex items-center justify-between gap-1">
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-neutral-500)] truncate">
              {isAr ? 'الأقسام' : 'Sections'}
            </div>
            <div className="text-xs text-[var(--color-neutral-400)] mt-0.5 truncate">
              {isAr
                ? `${sections.length} ${sections.length === 1 ? 'قسم' : 'أقسام'}`
                : `${sections.length} section${sections.length === 1 ? '' : 's'}`}
            </div>
          </div>
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="shrink-0 rounded-lg p-1.5 hover:bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]"
            aria-label={
              collapsed
                ? isAr
                  ? 'توسيع شجرة الأقسام'
                  : 'Expand sections tree'
                : isAr
                ? 'طيّ شجرة الأقسام'
                : 'Collapse sections tree'
            }
            title={
              collapsed
                ? isAr
                  ? 'توسيع'
                  : 'Expand'
                : isAr
                ? 'طيّ'
                : 'Collapse'
            }
          >
            <span aria-hidden className="text-base leading-none">
              {collapsed ? '☰' : '←'}
            </span>
          </button>
        )}
      </div>

      {sections.length === 0 ? (
        !collapsed && (
          <div className="p-4 text-xs text-[var(--color-neutral-500)]">
            {isAr ? 'لا أقسام بعد' : 'No sections yet'}
          </div>
        )
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r.__key)} strategy={verticalListSortingStrategy}>
            <ul className="py-1">
              {rows.map((row) => (
                <TreeRow
                  key={row.__key}
                  rowKey={row.__key}
                  index={row.__index}
                  section={row.section}
                  isSelected={selectedIndex === row.__index}
                  onSelect={() => onSelect(row.__index)}
                  isAr={isAr}
                  agent={provenance[row.__index] ?? null}
                  collapsed={collapsed}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {onAdd && (
        <div className="px-2 pb-2 pt-1 border-t border-[var(--color-neutral-100)] sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onAdd}
            title={isAr ? 'إضافة قسم' : 'Add section'}
            aria-label={isAr ? 'إضافة قسم' : 'Add section'}
            className={`w-full rounded-lg border border-dashed border-[var(--color-neutral-300)] py-2 text-sm text-[var(--color-neutral-600)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-50,#fef4ec)] hover:text-[var(--color-accent)] ${
              collapsed ? 'px-0 text-center' : 'px-3 text-start'
            }`}
          >
            {collapsed ? '+' : `+ ${isAr ? 'إضافة قسم' : 'Add section'}`}
          </button>
        </div>
      )}
    </aside>
  );
}

interface TreeRowProps {
  rowKey: string;
  index: number;
  section: LpSection;
  isSelected: boolean;
  onSelect: () => void;
  isAr: boolean;
  agent: AgentIdentity | null;
  collapsed?: boolean;
}

function TreeRow({ rowKey, index, section, isSelected, onSelect, isAr, agent, collapsed = false }: TreeRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rowKey,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Resolve label — prefer universal vocabulary, fall back to LP labels.
  const universal = VOCAB_BY_ID[section.type];
  const lpLabel = SECTION_TYPE_LABELS[section.type];
  const label = universal
    ? isAr ? universal.label_ar : universal.label_en
    : lpLabel
    ? isAr ? lpLabel.ar : lpLabel.en
    : section.type;
  const icon = universal?.icon ?? '▢';

  // Title preview pulled from section (locale-preferred, with cross-fallback).
  const titlePreview = isAr
    ? (section.title_ar || section.title_en || '')
    : (section.title_en || section.title_ar || '');

  const accent = agent ? AGENT_ACCENT[agent] : 'transparent';
  const accentVisible = agent && agent !== 'human';

  return (
    <li ref={setNodeRef} style={style}>
      <div
        className={`flex items-stretch gap-0 ${isSelected ? 'bg-[var(--color-accent-50,#fef4ec)]' : 'hover:bg-[var(--color-neutral-50)]'}`}
      >
        {/* 3px left accent strip for agent provenance — Hakawati §4.1 */}
        <div
          aria-hidden
          className="w-1"
          style={{ background: accentVisible ? accent : 'transparent', opacity: 0.6 }}
        />
        <button
          type="button"
          onClick={onSelect}
          title={collapsed ? `${index + 1}. ${label}${titlePreview ? ' — ' + titlePreview : ''}` : undefined}
          aria-label={collapsed ? `${index + 1}. ${label}` : undefined}
          className={`flex-1 flex items-center gap-2 px-2 py-2 min-h-11 text-start ${
            isSelected
              ? 'text-[var(--color-accent)] font-semibold'
              : 'text-[var(--color-neutral-700)]'
          }`}
        >
          {/* Drag handle — hidden when collapsed (icon-rail mode) */}
          {!collapsed && (
            <span
              aria-label={isAr ? 'اسحب لإعادة الترتيب' : 'Drag to reorder'}
              {...attributes}
              {...listeners}
              className="shrink-0 cursor-grab active:cursor-grabbing text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-700)] text-base leading-none -ms-1"
              onClick={(e) => e.stopPropagation()}
            >
              ⋮⋮
            </span>
          )}
          <span aria-hidden className="shrink-0 text-base leading-none w-5 text-center">
            {icon}
          </span>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-xs leading-tight">
                <span className="font-medium">{label}</span>
                <span className="text-[var(--color-neutral-400)] font-mono ms-1">#{index + 1}</span>
              </div>
              {titlePreview && (
                <div
                  className="text-xs text-[var(--color-neutral-500)] truncate mt-0.5"
                  dir={isAr ? 'rtl' : 'ltr'}
                >
                  {titlePreview}
                </div>
              )}
            </div>
          )}
        </button>
      </div>
    </li>
  );
}
