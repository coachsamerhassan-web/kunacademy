/**
 * Wave 14b LP-ADMIN-UX Session 1 — section type picker.
 *
 * Modal that lets the admin add a new section to the LP. Lists all 15
 * `LpSectionType` values; types without a per-type form (Session 1 ships
 * only `mirror`) are still pickable but show a "Edit in JSON" hint so the
 * admin knows the dedicated form lands later.
 */

'use client';

import type { LpSection, LpSectionType } from '@/lib/lp/composition-types';
import {
  Modal,
  SECTION_TYPES_ORDERED,
  SECTION_TYPE_LABELS,
  FORMS_AVAILABLE,
} from './_shared';

interface SectionTypePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (newSection: LpSection) => void;
  locale: string;
}

export function SectionTypePicker({ open, onClose, onPick, locale }: SectionTypePickerProps) {
  const isAr = locale === 'ar';

  function handlePick(type: LpSectionType) {
    onPick({ type });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAr ? 'إضافة قسم' : 'Add section'}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-2">
        <p className="text-sm text-[var(--color-neutral-500)] mb-3">
          {isAr
            ? 'اختر نوع القسم. سيُضاف فارغًا في نهاية القائمة — حرّره ثم اسحبه إلى مكانه.'
            : 'Pick a section type. It will be added empty at the bottom of the list — edit it, then drag to position.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SECTION_TYPES_ORDERED.map((type) => {
            const labels = SECTION_TYPE_LABELS[type];
            const formAvailable = FORMS_AVAILABLE.has(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => handlePick(type)}
                className="text-start rounded-xl border border-[var(--color-neutral-200)] bg-white p-3 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-colors min-h-16"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">
                      {isAr ? labels.ar : labels.en}
                    </div>
                    <div className="text-xs text-[var(--color-neutral-500)] mt-0.5 font-mono">
                      {type}
                    </div>
                  </div>
                  {formAvailable ? (
                    <span className="shrink-0 inline-flex items-center rounded-full bg-[var(--color-success-100,#d1fae5)] px-2 py-0.5 text-xs font-medium text-[var(--color-success-800,#065f46)]">
                      {isAr ? 'محرّر مخصّص' : 'form ready'}
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center rounded-full bg-[var(--color-neutral-100)] px-2 py-0.5 text-xs font-medium text-[var(--color-neutral-600)]">
                      {isAr ? 'JSON' : 'JSON'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
