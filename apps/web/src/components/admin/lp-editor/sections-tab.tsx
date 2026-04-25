/**
 * Wave 14b LP-ADMIN-UX Session 1 — top-level "Sections" tab.
 *
 * Composes:
 *   - <SectionList> (drag-reorder + view)
 *   - <SectionTypePicker> (add new)
 *   - <SectionEditorShell> (modal — mounts per-type form when a section is opened)
 *
 * State contract: receives the FULL composition_json shape as `value` and
 * returns the FULL shape via `onChange`. The parent (admin-lp-form.tsx)
 * holds the shape as a JSON string in its existing state; this tab parses
 * on read and serializes back on write. Toggling between the JSON tab and
 * the Sections tab is non-destructive — both views write the same field.
 */

'use client';

import { useState } from 'react';
import type {
  LpComposition,
  LpSection,
} from '@/lib/lp/composition-types';
import { SectionList } from './section-list';
import { SectionTypePicker } from './section-type-picker';
import { SectionEditorShell } from './section-editor-shell';

interface SectionsTabProps {
  /** The FULL composition_json object. May be empty/null on a brand-new LP. */
  value: LpComposition | null;
  onChange: (next: LpComposition) => void;
  /** Called when an admin needs to fall back to the JSON view for a section
   *  type that doesn't yet have a per-type form (Session 1 ships only mirror). */
  onSwitchToJsonTab: () => void;
  locale: string;
}

export function SectionsTab({ value, onChange, onSwitchToJsonTab, locale }: SectionsTabProps) {
  const isAr = locale === 'ar';
  const composition = value ?? {};
  const sections: LpSection[] = composition.sections ?? [];

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  function updateSections(next: LpSection[]) {
    onChange({ ...composition, sections: next });
  }

  function handleAdd(newSection: LpSection) {
    updateSections([...sections, newSection]);
  }

  function handleEdit(index: number) {
    setEditingIndex(index);
  }

  function handleSaveEdit(next: LpSection) {
    if (editingIndex === null) return;
    const updated = sections.slice();
    updated[editingIndex] = next;
    updateSections(updated);
    setEditingIndex(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-[var(--text-primary)]">
            {isAr ? 'أقسام صفحة الهبوط' : 'Landing-page sections'}
          </h3>
          <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
            {isAr
              ? 'اسحب لإعادة الترتيب. اضغط «تحرير» لفتح النموذج المخصّص لكلّ نوع.'
              : 'Drag to reorder. Click "Edit" to open the per-type form.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--color-accent-500)]"
        >
          + {isAr ? 'إضافة قسم' : 'Add section'}
        </button>
      </div>

      <SectionList
        sections={sections}
        onChange={updateSections}
        onEdit={handleEdit}
        locale={locale}
      />

      <SectionTypePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handleAdd}
        locale={locale}
      />

      <SectionEditorShell
        open={editingIndex !== null}
        section={editingIndex !== null ? sections[editingIndex] ?? null : null}
        sectionIndex={editingIndex}
        onClose={() => setEditingIndex(null)}
        onSave={handleSaveEdit}
        onSwitchToJson={() => {
          setEditingIndex(null);
          onSwitchToJsonTab();
        }}
        locale={locale}
      />
    </div>
  );
}
