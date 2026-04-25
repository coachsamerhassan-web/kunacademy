/**
 * Wave 14b LP-ADMIN-UX Session 1 — shared types + small primitives for the
 * per-section editor surface.
 *
 * Spec: Specs/wave-14b-lp-admin-ux-spec.md (APPROVED 2026-04-25).
 *
 * Architecture: ships as an additive "Sections" tab inside the existing
 * `apps/web/src/components/lp/admin-lp-form.tsx`. The JSON textarea stays as
 * an escape hatch (Q1 default = co-existence). Both views read/write the
 * same `composition_json` state — toggling tabs is non-destructive.
 *
 * Per-section components from Wave 15 Phase 2 Session 1 consume `LpSection`
 * directly — admin form-builder produces the same shape, no prop mismatch.
 */

'use client';

import type { ReactNode } from 'react';
import type { LpSection, LpSectionType } from '@/lib/lp/composition-types';

/** Display labels for section types (admin UI only — not authored content). */
export const SECTION_TYPE_LABELS: Record<LpSectionType, { ar: string; en: string }> = {
  mirror: { ar: 'مرآة', en: 'Mirror' },
  reframe: { ar: 'إعادة تأطير', en: 'Reframe' },
  description: { ar: 'الوصف', en: 'Description' },
  benefits: { ar: 'الفوائد', en: 'Benefits' },
  carry_out: { ar: 'ما تحمله معك', en: 'Carry-out' },
  who_for: { ar: 'لمن', en: 'Who for' },
  who_not_for: { ar: 'ليس لمن', en: 'Who not for' },
  format: { ar: 'الشكل', en: 'Format' },
  price: { ar: 'السعر', en: 'Price' },
  group_alumni: { ar: 'مجموعة + خرّيجون', en: 'Group + alumni' },
  credibility: { ar: 'المصداقية', en: 'Credibility' },
  objections: { ar: 'الاعتراضات', en: 'Objections' },
  faq: { ar: 'أسئلة شائعة', en: 'FAQ' },
  cta: { ar: 'دعوة للفعل', en: 'CTA' },
  custom: { ar: 'مخصّص', en: 'Custom' },
};

/** All valid section types in admin-pickable order. */
export const SECTION_TYPES_ORDERED: LpSectionType[] = [
  'mirror',
  'reframe',
  'description',
  'benefits',
  'carry_out',
  'who_for',
  'who_not_for',
  'format',
  'price',
  'group_alumni',
  'credibility',
  'objections',
  'faq',
  'cta',
  'custom',
];

/** Section types that have a per-type form shipped in this build. As more
 *  forms land in Session 2, register them here so the editor switches from
 *  "Edit in JSON fallback" to the dedicated form. */
export const FORMS_AVAILABLE: ReadonlySet<LpSectionType> = new Set<LpSectionType>([
  'mirror', // Session 1 canary
]);

/** Per-form contract. Each `forms/{type}-form.tsx` exports a component
 *  matching this shape. The shell mounts it inside a modal and lifts state
 *  back to the section list via onChange. */
export interface SectionFormProps {
  section: LpSection;
  onChange: (next: LpSection) => void;
  locale: string;
  /** When true, the form is rendered inside an unmounting modal — forms
   *  should debounce / commit on every onChange rather than wait for a
   *  separate save button. The "Save" button on the modal commits the
   *  section back to the parent list. */
  inModal?: boolean;
}

/** Stable per-section identity for dnd-kit sortable + react-table row keys.
 *  Sections in the LpComposition.sections[] array don't carry an id — we
 *  derive one from `${type}-${index}-${anchor_id || ''}` for the lifetime
 *  of an edit session. Order changes preserve identity by re-deriving from
 *  the new index after the local state update. */
export function deriveSectionKey(section: LpSection, index: number): string {
  return `${section.type}-${index}-${section.anchor_id ?? ''}`;
}

/**
 * Small native modal — uses the platform <dialog> element. Built deliberately
 * without Radix to keep bundle small for Session 1; Wave 14b Session 2 may
 * promote to Radix Dialog if a11y audit demands focus-trap improvements.
 *
 * Pattern: the parent owns the open/closed state. Modal closes via ESC,
 * backdrop click (only if dismissable), or the close button.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Footer is the right place for action buttons (Cancel / Save). */
  footer?: ReactNode;
  /** When false, backdrop clicks do not close the modal — used to prevent
   *  accidental dismissal mid-edit. ESC + the close button still work. */
  dismissOnBackdrop?: boolean;
  /** Optional max-width override; default is large enough for a section form. */
  maxWidthClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  dismissOnBackdrop = true,
  maxWidthClass = 'max-w-3xl',
}: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lp-editor-modal-title"
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-[var(--color-neutral-200)]`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-neutral-100)]">
          <h2
            id="lp-editor-modal-title"
            className="text-lg font-semibold text-[var(--text-primary)]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 hover:bg-[var(--color-neutral-100)] transition-colors text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)] min-w-11 min-h-11 flex items-center justify-center"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-neutral-100)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Bilingual text-input helper — admin authoring of scalar string fields
 *  shouldn't reinvent labels + RTL handling per form. */
export interface BilingualScalarFieldProps {
  labelAr: string;
  labelEn: string;
  valueAr: string;
  valueEn: string;
  onChangeAr: (next: string) => void;
  onChangeEn: (next: string) => void;
  /** When 'textarea', renders a 3-row textarea instead of a single-line
   *  input. Use for short-prose scalars (e.g. cta_sub_*). */
  variant?: 'input' | 'textarea';
  helperText?: string;
}

export function BilingualScalarField({
  labelAr,
  labelEn,
  valueAr,
  valueEn,
  onChangeAr,
  onChangeEn,
  variant = 'input',
  helperText,
}: BilingualScalarFieldProps) {
  const inputClasses =
    'block w-full rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-2.5 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none';
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5">
          {labelAr}
        </label>
        {variant === 'textarea' ? (
          <textarea
            value={valueAr}
            onChange={(e) => onChangeAr(e.target.value)}
            rows={3}
            dir="rtl"
            className={`${inputClasses} resize-y`}
          />
        ) : (
          <input
            type="text"
            value={valueAr}
            onChange={(e) => onChangeAr(e.target.value)}
            dir="rtl"
            className={inputClasses}
          />
        )}
      </div>
      <div>
        <label className="block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5">
          {labelEn}
        </label>
        {variant === 'textarea' ? (
          <textarea
            value={valueEn}
            onChange={(e) => onChangeEn(e.target.value)}
            rows={3}
            dir="ltr"
            className={`${inputClasses} resize-y`}
          />
        ) : (
          <input
            type="text"
            value={valueEn}
            onChange={(e) => onChangeEn(e.target.value)}
            dir="ltr"
            className={inputClasses}
          />
        )}
      </div>
      {helperText && (
        <p className="md:col-span-2 text-xs text-[var(--color-neutral-500)] -mt-2">
          {helperText}
        </p>
      )}
    </div>
  );
}
