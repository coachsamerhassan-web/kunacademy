/**
 * Wave 14b LP-ADMIN-UX Session 1 — section list with drag-to-reorder.
 *
 * Stack: `@tanstack/react-table` for column model + cell rendering;
 * `@dnd-kit/core` + `@dnd-kit/sortable` for drag-reorder of rows.
 *
 * Per spec Q4 lock: building DataTable directly atop @tanstack/react-table
 * (the engine shadcn wraps). Sidesteps Tailwind 3 vs 4 config conflict.
 *
 * Columns: drag handle | type | AR title preview | EN title preview | anchor_id | actions
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
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { LpSection } from '@/lib/lp/composition-types';
import { SECTION_TYPE_LABELS, deriveSectionKey } from './_shared';

// ── Row identity ──────────────────────────────────────────────────────────
// dnd-kit + react-table each need a stable id per row. We carry it as the
// `__key` field on a thin wrapper around LpSection — never persisted, only
// used in-memory during the edit session.
interface SectionRow {
  __key: string;
  __index: number;
  section: LpSection;
}

interface SectionListProps {
  sections: LpSection[];
  onChange: (next: LpSection[]) => void;
  onEdit: (index: number) => void;
  locale: string;
}

export function SectionList({ sections, onChange, onEdit, locale }: SectionListProps) {
  const isAr = locale === 'ar';

  // Derive row data from the sections array. Re-derives on every render so
  // identity tracks index — stable enough for DnD because we update the
  // parent state synchronously on drag-end.
  const rows: SectionRow[] = useMemo(
    () =>
      sections.map((section, index) => ({
        __key: deriveSectionKey(section, index),
        __index: index,
        section,
      })),
    [sections],
  );

  // ── Columns
  const columns = useMemo<ColumnDef<SectionRow>[]>(
    () => [
      {
        id: 'handle',
        header: () => <span className="sr-only">{isAr ? 'مقبض السحب' : 'Drag handle'}</span>,
        cell: () => null, // rendered inline by SortableRow for accessibility
        size: 40,
      },
      {
        id: 'type',
        header: isAr ? 'النوع' : 'Type',
        accessorFn: (row) => row.section.type,
        cell: (info) => {
          const t = info.getValue() as LpSection['type'];
          const labels = SECTION_TYPE_LABELS[t] ?? { ar: t, en: t };
          return (
            <div>
              <div className="font-semibold text-[var(--text-primary)]">
                {isAr ? labels.ar : labels.en}
              </div>
              <div className="text-xs text-[var(--color-neutral-500)] font-mono">{t}</div>
            </div>
          );
        },
      },
      {
        id: 'title_ar',
        header: 'AR title',
        accessorFn: (row) => row.section.title_ar ?? '',
        cell: (info) => (
          <span className="text-sm text-[var(--color-neutral-700)] line-clamp-2" dir="rtl">
            {(info.getValue() as string) || (isAr ? '— لا عنوان —' : '— no title —')}
          </span>
        ),
      },
      {
        id: 'title_en',
        header: 'EN title',
        accessorFn: (row) => row.section.title_en ?? '',
        cell: (info) => (
          <span className="text-sm text-[var(--color-neutral-700)] line-clamp-2" dir="ltr">
            {(info.getValue() as string) || (isAr ? '— لا عنوان —' : '— no title —')}
          </span>
        ),
      },
      {
        id: 'anchor',
        header: 'anchor_id',
        accessorFn: (row) => row.section.anchor_id ?? '',
        cell: (info) => (
          <code className="text-xs text-[var(--color-neutral-500)]">
            {(info.getValue() as string) || '—'}
          </code>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{isAr ? 'إجراءات' : 'Actions'}</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => onEdit(row.original.__index)}
              className="rounded-lg border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]"
            >
              {isAr ? 'تحرير' : 'Edit'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    isAr
                      ? `حذف القسم #${row.original.__index + 1}؟`
                      : `Delete section #${row.original.__index + 1}?`,
                  )
                ) {
                  const next = sections.slice();
                  next.splice(row.original.__index, 1);
                  onChange(next);
                }
              }}
              className="rounded-lg border border-[var(--color-neutral-300)] px-3 py-1.5 text-sm text-[var(--color-neutral-700)] hover:border-red-300 hover:text-red-700"
            >
              {isAr ? 'حذف' : 'Delete'}
            </button>
          </div>
        ),
      },
    ],
    [isAr, sections, onChange, onEdit],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.__key,
  });

  // ── DnD sensors
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

  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-neutral-300)] bg-[var(--color-neutral-50)] p-8 text-center">
        <p className="text-sm text-[var(--color-neutral-600)]">
          {isAr
            ? 'لا أقسام بعد — اضغط «إضافة قسم» لإنشاء أوّل قسم.'
            : 'No sections yet — click "Add section" to create the first one.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-neutral-200)] overflow-hidden">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.__key)} strategy={verticalListSortingStrategy}>
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.column.getSize?.() }}
                      className="text-start px-3 py-2.5 font-semibold text-[var(--color-neutral-700)] text-xs uppercase tracking-wide"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <SortableRow key={row.id} row={row} isAr={isAr} />
              ))}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ── Sortable row — wraps a react-table row and exposes the drag handle.
interface SortableRowProps {
  row: ReturnType<ReturnType<typeof useReactTable<SectionRow>>['getRowModel']>['rows'][number];
  isAr: boolean;
}

function SortableRow({ row, isAr }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? 'var(--color-primary-50)' : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]"
    >
      {row.getVisibleCells().map((cell) => {
        const isHandleCol = cell.column.id === 'handle';
        return (
          <td
            key={cell.id}
            className={`px-3 py-3 align-middle ${isHandleCol ? 'cursor-grab active:cursor-grabbing' : ''}`}
          >
            {isHandleCol ? (
              <button
                type="button"
                aria-label={isAr ? 'اسحب لإعادة الترتيب' : 'Drag to reorder'}
                {...attributes}
                {...listeners}
                className="min-w-11 min-h-11 flex items-center justify-center text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-md"
              >
                <span aria-hidden className="text-lg leading-none">⋮⋮</span>
              </button>
            ) : (
              flexRender(cell.column.columnDef.cell, cell.getContext())
            )}
          </td>
        );
      })}
    </tr>
  );
}
