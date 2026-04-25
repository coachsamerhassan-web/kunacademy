/**
 * Wave 14b LP-ADMIN-UX Session 1 — modal shell that mounts the per-type form
 * for an editing section. Dispatches based on `section.type`.
 *
 * Pattern: shell holds DRAFT state for the section being edited; commits
 * back to the parent list only on Save. Cancel discards. This isolates the
 * draft from the live composition_json so a half-edit doesn't bleed into
 * the parent state until the admin commits.
 *
 * Session 1 ships ONE form (`mirror-form.tsx`) as the canary. Section types
 * not yet covered by a dedicated form fall back to "Edit in JSON textarea"
 * — the parent renders an inline notice + a button that switches the parent
 * tab to the JSON view.
 */

'use client';

import { useEffect, useState } from 'react';
import type { LpSection } from '@/lib/lp/composition-types';
import { Modal, FORMS_AVAILABLE, SECTION_TYPE_LABELS } from './_shared';
import { MirrorForm } from './forms/mirror-form';

interface SectionEditorShellProps {
  open: boolean;
  section: LpSection | null;
  /** Index of the section in the parent's sections[] array — used in the
   *  modal title for context. */
  sectionIndex: number | null;
  onClose: () => void;
  onSave: (next: LpSection) => void;
  onSwitchToJson: () => void;
  locale: string;
}

export function SectionEditorShell({
  open,
  section,
  sectionIndex,
  onClose,
  onSave,
  onSwitchToJson,
  locale,
}: SectionEditorShellProps) {
  const isAr = locale === 'ar';
  const [draft, setDraft] = useState<LpSection | null>(section);

  // When the modal opens with a fresh section, reset the draft.
  useEffect(() => {
    setDraft(section);
  }, [section, open]);

  if (!open || !section || !draft || sectionIndex === null) return null;

  const labels = SECTION_TYPE_LABELS[section.type] ?? { ar: section.type, en: section.type };
  const title = `${isAr ? labels.ar : labels.en} — #${sectionIndex + 1}`;
  const formAvailable = FORMS_AVAILABLE.has(section.type);

  function handleSave() {
    if (!draft) return;
    onSave(draft);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      dismissOnBackdrop={false}
      maxWidthClass="max-w-4xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--color-neutral-300)] px-5 py-2.5 font-medium text-[var(--color-neutral-700)] hover:border-[var(--color-primary)]"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          {formAvailable && (
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--color-accent-500)]"
            >
              {isAr ? 'تطبيق' : 'Apply'}
            </button>
          )}
        </>
      }
    >
      {formAvailable ? (
        renderForm(draft, setDraft, locale)
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-warning-200,#fbbf24)] bg-[var(--color-warning-50,#fffbeb)] p-5">
            <p className="text-sm font-semibold text-[var(--color-warning-900,#78350f)] mb-2">
              {isAr ? 'محرّر مخصّص لهذا النوع لم يُشحن بعد' : 'Per-type editor not yet shipped'}
            </p>
            <p className="text-sm text-[var(--color-warning-800,#92400e)]">
              {isAr
                ? `النوع «${labels.ar}» سيحصل على نموذج مخصّص في Session 2 من Wave 14b. حتى ذلك الحين، حرّر هذا القسم عبر تبويب «JSON».`
                : `The "${labels.en}" type gets a dedicated form in Wave 14b Session 2. Until then, edit this section via the "JSON" tab.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onSwitchToJson}
            className="rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-5 py-2.5 text-sm font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]"
          >
            {isAr ? 'فتح تبويب JSON ←' : 'Open JSON tab →'}
          </button>
        </div>
      )}
    </Modal>
  );
}

function renderForm(
  draft: LpSection,
  setDraft: (next: LpSection) => void,
  locale: string,
) {
  switch (draft.type) {
    case 'mirror':
      return <MirrorForm section={draft} onChange={setDraft} locale={locale} inModal />;
    // Session 2 lands additional case branches here.
    default:
      return null;
  }
}
