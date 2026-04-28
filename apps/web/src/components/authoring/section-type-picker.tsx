/**
 * Wave 15 Wave 3 — Section type picker.
 *
 * Per Hakawati §5.2: filtered by entity (LP shows all 15 LP types + 8 universal,
 * blog/static show 8 universal only — duplicates resolved). Modal popover.
 * Click → calls onPick with a default-empty section payload.
 *
 * For Wave 3 canary we ship a simple modal grid; popover anchored to the
 * "+Add section" CTA is post-canary refinement.
 */

'use client';

import type { LpSection } from '@/lib/lp/composition-types';
import {
  LP_SECTION_TYPES_ORDERED,
  LP_TYPE_DESCRIPTIONS,
  vocabularyForEntity,
  type EntityTarget,
} from '@/lib/authoring/section-vocabulary';

interface SectionTypePickerProps {
  open: boolean;
  onClose: () => void;
  entity: EntityTarget;
  onPick: (newSection: LpSection) => void;
  locale: string;
}

export function SectionTypePicker({ open, onClose, entity, onPick, locale }: SectionTypePickerProps) {
  if (!open) return null;
  const isAr = locale === 'ar';
  const universalForEntity = vocabularyForEntity(entity);
  // For LPs: also expose the 15 carry-forward LP types (§3b).
  const showLpTypes = entity === 'landing_pages';

  function handlePick(type: string, defaultPayload?: Record<string, unknown>) {
    const payload = defaultPayload ?? { type };
    // Bridge through unknown — universal types like 'header' / 'body' are
    // not in the LpSectionType union but are valid runtime discriminators
    // in composition_json.sections[].
    onPick(payload as unknown as LpSection);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="picker-title"
    >
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-[var(--color-neutral-200)]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-neutral-100)]">
          <h2 id="picker-title" className="text-base font-semibold text-[var(--text-primary)]">
            {isAr ? 'إضافة قسم' : 'Add section'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="rounded-lg p-2 hover:bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] min-w-11 min-h-11 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-xs text-[var(--color-neutral-500)]">
            {isAr
              ? 'اختر نوع القسم. سيُضاف فارغًا في النهاية — حرّره ثم اسحبه إلى مكانه.'
              : 'Pick a section type. It will be added empty at the end — edit, then drag to position.'}
          </p>

          {/* Universal types */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-neutral-500)] mb-2">
              {isAr ? 'أنواع شاملة' : 'Universal'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {universalForEntity.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handlePick(entry.id, entry.defaultPayload())}
                  className="text-start rounded-xl border border-[var(--color-neutral-200)] bg-white p-3 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-colors min-h-16"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none shrink-0">{entry.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[var(--text-primary)]">
                        {isAr ? entry.label_ar : entry.label_en}
                      </div>
                      <div className="text-xs text-[var(--color-neutral-500)] mt-0.5">
                        {isAr ? entry.description_ar : entry.description_en}
                      </div>
                      <div className="text-[10px] text-[var(--color-neutral-400)] mt-1 font-mono">
                        {entry.id}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* LP-specific types — only when entity=landing_pages */}
          {showLpTypes && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-neutral-500)] mb-2">
                {isAr ? 'أنواع صفحات الهبوط' : 'Landing-page beats'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {LP_SECTION_TYPES_ORDERED
                  // De-dupe with universal: skip mirror + cta from this list because they're already in universal.
                  .filter((t) => !['mirror', 'cta'].includes(t))
                  .map((type) => {
                    const desc = LP_TYPE_DESCRIPTIONS[type];
                    if (!desc) return null;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handlePick(type)}
                        className="text-start rounded-xl border border-[var(--color-neutral-200)] bg-white p-3 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-colors min-h-16"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg leading-none shrink-0">{desc.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-[var(--text-primary)]">
                              {isAr ? desc.label_ar : desc.label_en}
                            </div>
                            <div className="text-xs text-[var(--color-neutral-500)] mt-0.5">
                              {isAr ? desc.description_ar : desc.description_en}
                            </div>
                            <div className="text-[10px] text-[var(--color-neutral-400)] mt-1 font-mono">
                              {type}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
