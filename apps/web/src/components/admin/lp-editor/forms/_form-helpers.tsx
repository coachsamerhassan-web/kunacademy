/**
 * Wave 14b LP-ADMIN-UX Session 2 — shared form helpers.
 *
 * Used by every per-section form to avoid 11x duplication of:
 *   - anchor_id + background scalar group
 *   - BilingualRichField (label + helper + bilingual rich editor wrapper)
 *   - ItemListEditor (generic items[] editor with bilingual rich + label + meta + icon + tier)
 *   - ScalarBilingualText (single-line bilingual scalar pair)
 *
 * Design: tiny named building blocks. Each form composes them with its own
 * scalar fields (kicker, title) on top.
 */

'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { LpSection, LpSectionItem } from '@/lib/lp/composition-types';
import { BilingualScalarField } from '../_shared';
import { useImageUpload } from '../use-image-upload';
import type { BilingualRichDoc } from '@kunacademy/ui/rich-editor';

// Dynamic import — keeps the TipTap bundle off SSR + off first-paint of the
// surrounding admin form. Same pattern as mirror-form.tsx.
export const BilingualRichEditor = dynamic(
  () => import('@kunacademy/ui/rich-editor').then((m) => m.BilingualRichEditor),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-[var(--color-neutral-200)] p-4 text-sm text-[var(--color-neutral-500)]">
        Loading editor…
      </div>
    ),
  },
);

const inputClasses =
  'block w-full rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-2.5 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none';
const selectClasses = inputClasses;
const labelClasses =
  'block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5';

// ── Background select options (default theme only) ─────────────────────────
type SectionBackground = NonNullable<LpSection['background']>;

const BACKGROUND_OPTIONS: ReadonlyArray<{ value: SectionBackground | ''; label: string }> = [
  { value: '', label: '— default —' },
  { value: 'white', label: 'white' },
  { value: 'surface', label: 'surface' },
  { value: 'surface-low', label: 'surface-low' },
  { value: 'primary', label: 'primary (dark)' },
  { value: 'dark', label: 'dark' },
  { value: 'accent-tint', label: 'accent-tint' },
];

// ── AnchorBackgroundGroup — anchor_id + background select pair ─────────────
export interface AnchorBackgroundGroupProps {
  section: LpSection;
  onChange: (next: LpSection) => void;
  isAr: boolean;
}

export function AnchorBackgroundGroup({ section, onChange, isAr }: AnchorBackgroundGroupProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className={labelClasses}>anchor_id</label>
        <input
          type="text"
          className={inputClasses}
          value={section.anchor_id ?? ''}
          onChange={(e) =>
            onChange({ ...section, anchor_id: e.target.value || undefined })
          }
          dir="ltr"
          placeholder="e.g. payment, lead-form"
        />
      </div>
      <div>
        <label className={labelClasses}>
          {isAr ? 'الخلفية (الموضوع الافتراضي فقط)' : 'Background (default theme only)'}
        </label>
        <select
          className={selectClasses}
          value={section.background ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...section,
              background: v ? (v as SectionBackground) : undefined,
            });
          }}
        >
          {BACKGROUND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── BilingualRichField — label + bilingual rich editor block ───────────────
export interface BilingualRichFieldProps {
  labelAr: string;
  labelEn: string;
  helperAr?: string;
  helperEn?: string;
  isAr: boolean;
  value: BilingualRichDoc;
  onChange: (next: BilingualRichDoc) => void;
}

export function BilingualRichField({
  labelAr,
  labelEn,
  helperAr,
  helperEn,
  isAr,
  value,
  onChange,
}: BilingualRichFieldProps) {
  const { onImagePick } = useImageUpload();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const wrappedOnImagePick = async (locale: 'ar' | 'en') => {
    setUploadError(null);
    try {
      return await onImagePick(locale);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
      return null;
    }
  };
  return (
    <div>
      <label className={labelClasses}>{isAr ? labelAr : labelEn}</label>
      {(helperAr || helperEn) && (
        <p className="text-xs text-[var(--color-neutral-500)] mb-2">
          {isAr ? helperAr : helperEn}
        </p>
      )}
      {uploadError && (
        <p className="text-xs text-red-700 mb-2">
          {isAr ? 'فشل رفع الصورة: ' : 'Image upload failed: '}
          {uploadError}
        </p>
      )}
      <BilingualRichEditor
        value={value}
        onChange={onChange}
        labelAr="AR"
        labelEn="EN"
        orientation="side-by-side"
        onImagePick={wrappedOnImagePick}
      />
    </div>
  );
}

// ── ScalarBilingualText — single-line bilingual scalar pair convenience ────
export interface ScalarBilingualTextProps {
  labelAr: string;
  labelEn: string;
  valueAr: string | undefined;
  valueEn: string | undefined;
  onChangeAr: (v: string | undefined) => void;
  onChangeEn: (v: string | undefined) => void;
  helperAr?: string;
  helperEn?: string;
  isAr: boolean;
  variant?: 'input' | 'textarea';
}

export function ScalarBilingualText({
  labelAr,
  labelEn,
  valueAr,
  valueEn,
  onChangeAr,
  onChangeEn,
  helperAr,
  helperEn,
  isAr,
  variant = 'input',
}: ScalarBilingualTextProps) {
  return (
    <BilingualScalarField
      labelAr={labelAr}
      labelEn={labelEn}
      valueAr={valueAr ?? ''}
      valueEn={valueEn ?? ''}
      onChangeAr={(v) => onChangeAr(v || undefined)}
      onChangeEn={(v) => onChangeEn(v || undefined)}
      helperText={isAr ? helperAr : helperEn}
      variant={variant}
    />
  );
}

// ── ItemListEditor — items[] editor with all the bells the items shape supports ──
//
// Used by `benefits`, `carry_out`, `who_for`/`who_not_for`, `format`, `price`,
// `group_alumni`, `objections`, `faq`, `mirror` (data-lines mode), `custom`
// (when needed). Per-form hidden columns let each form opt out of the fields
// that don't apply (e.g. format doesn't need rich body; price needs `tier`;
// faq doesn't want `icon`).
export interface ItemListEditorOptions {
  /** Render a rich editor for body alongside the scalar body inputs. */
  enableRichBody?: boolean;
  /** Show the icon scalar field. */
  enableIcon?: boolean;
  /** Show the meta_ar / meta_en bilingual scalar pair. */
  enableMeta?: boolean;
  /** Show the tier select (only meaningful for `price`). */
  enableTier?: boolean;
  /** Override the default "Add item" button label. */
  addLabelAr?: string;
  addLabelEn?: string;
  /** Override the default per-item header (defaults to "#1, #2, ..."). */
  itemHeaderAr?: string;
  itemHeaderEn?: string;
  /** Override scalar body variant. textarea = multi-line; input = single line. */
  bodyVariant?: 'input' | 'textarea';
  /** Hide the body scalar entirely (e.g. faq uses label as Q + body as A
   *  but some sections only want a label list). */
  hideBody?: boolean;
}

export interface ItemListEditorProps {
  items: LpSectionItem[];
  onChange: (next: LpSectionItem[]) => void;
  isAr: boolean;
  options?: ItemListEditorOptions;
  /** Override default labels for label_ar / label_en. */
  labelArHeader?: string;
  labelEnHeader?: string;
  /** Override default labels for body_ar / body_en. */
  bodyArHeader?: string;
  bodyEnHeader?: string;
}

const TIER_OPTIONS: ReadonlyArray<{ value: '' | 'early' | 'regular' | 'late'; label: string }> = [
  { value: '', label: '— none —' },
  { value: 'early', label: 'early (gold accent)' },
  { value: 'regular', label: 'regular' },
  { value: 'late', label: 'late' },
];

export function ItemListEditor({
  items,
  onChange,
  isAr,
  options = {},
  labelArHeader = 'label (AR)',
  labelEnHeader = 'label (EN)',
  bodyArHeader = 'body (AR)',
  bodyEnHeader = 'body (EN)',
}: ItemListEditorProps) {
  const {
    enableRichBody = false,
    enableIcon = false,
    enableMeta = false,
    enableTier = false,
    addLabelAr = 'إضافة عنصر',
    addLabelEn = 'Add item',
    itemHeaderAr,
    itemHeaderEn,
    bodyVariant = 'textarea',
    hideBody = false,
  } = options;

  function update(index: number, next: LpSectionItem) {
    const copy = items.slice();
    copy[index] = next;
    onChange(copy);
  }
  function add() {
    onChange([...items, { label_ar: '', label_en: '', body_ar: '', body_en: '' }]);
  }
  function remove(index: number) {
    const copy = items.slice();
    copy.splice(index, 1);
    onChange(copy);
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const copy = items.slice();
    const [picked] = copy.splice(index, 1);
    copy.splice(target, 0, picked);
    onChange(copy);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className={labelClasses + ' mb-0'}>
          {isAr ? 'العناصر' : 'Items'}
        </span>
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]"
        >
          + {isAr ? addLabelAr : addLabelEn}
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => {
          const headerLabel = isAr
            ? (itemHeaderAr ? `${itemHeaderAr} #${i + 1}` : `#${i + 1}`)
            : (itemHeaderEn ? `${itemHeaderEn} #${i + 1}` : `#${i + 1}`);
          const richBodyValue: BilingualRichDoc = {
            ar: item.body_ar_rich ?? null,
            en: item.body_en_rich ?? null,
          };
          return (
            <div
              key={i}
              className="rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  {headerLabel}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={isAr ? 'إلى الأعلى' : 'Move up'}
                    className="rounded-lg border border-[var(--color-neutral-300)] px-2 py-1 text-xs text-[var(--color-neutral-700)] hover:border-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed min-w-11 min-h-9"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                    aria-label={isAr ? 'إلى الأسفل' : 'Move down'}
                    className="rounded-lg border border-[var(--color-neutral-300)] px-2 py-1 text-xs text-[var(--color-neutral-700)] hover:border-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed min-w-11 min-h-9"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="rounded-lg border border-[var(--color-neutral-300)] px-2 py-1 text-xs text-[var(--color-neutral-700)] hover:border-red-300 hover:text-red-700"
                  >
                    {isAr ? 'حذف' : 'Remove'}
                  </button>
                </div>
              </div>
              <BilingualScalarField
                labelAr={labelArHeader}
                labelEn={labelEnHeader}
                valueAr={item.label_ar ?? ''}
                valueEn={item.label_en ?? ''}
                onChangeAr={(v) => update(i, { ...item, label_ar: v || undefined })}
                onChangeEn={(v) => update(i, { ...item, label_en: v || undefined })}
              />
              {!hideBody && (
                <BilingualScalarField
                  labelAr={bodyArHeader}
                  labelEn={bodyEnHeader}
                  valueAr={item.body_ar ?? ''}
                  valueEn={item.body_en ?? ''}
                  onChangeAr={(v) => update(i, { ...item, body_ar: v || undefined })}
                  onChangeEn={(v) => update(i, { ...item, body_en: v || undefined })}
                  variant={bodyVariant}
                />
              )}
              {enableRichBody && !hideBody && (
                <BilingualRichField
                  labelAr="نص عنصر منسّق (يحلّ محلّ body_ar/body_en)"
                  labelEn="Rich item body (replaces body_ar/body_en at render)"
                  helperAr="استخدم هذا للنص الثري — يُفضَّل على الحقول النصية البسيطة في العرض."
                  helperEn="Use this for rich content — preferred over the scalar body at render time."
                  isAr={isAr}
                  value={richBodyValue}
                  onChange={(next) =>
                    update(i, { ...item, body_ar_rich: next.ar, body_en_rich: next.en })
                  }
                />
              )}
              {(enableIcon || enableMeta || enableTier) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {enableIcon && (
                    <div>
                      <label className={labelClasses}>
                        {isAr ? 'أيقونة (إيموجي)' : 'Icon (emoji)'}
                      </label>
                      <input
                        type="text"
                        className={inputClasses}
                        value={item.icon ?? ''}
                        onChange={(e) =>
                          update(i, { ...item, icon: e.target.value || undefined })
                        }
                        placeholder="🎯"
                      />
                    </div>
                  )}
                  {enableTier && (
                    <div>
                      <label className={labelClasses}>tier</label>
                      <select
                        className={selectClasses}
                        value={item.tier ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          update(i, {
                            ...item,
                            tier: v === '' ? undefined : (v as 'early' | 'regular' | 'late'),
                          });
                        }}
                      >
                        {TIER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
              {enableMeta && (
                <BilingualScalarField
                  labelAr="meta (AR)"
                  labelEn="meta (EN)"
                  valueAr={item.meta_ar ?? ''}
                  valueEn={item.meta_en ?? ''}
                  onChangeAr={(v) => update(i, { ...item, meta_ar: v || undefined })}
                  onChangeEn={(v) => update(i, { ...item, meta_en: v || undefined })}
                  helperText={isAr ? 'تعليق صغير، مثل سعر فرعي.' : 'Small annotation, e.g. price subtext.'}
                />
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-sm text-[var(--color-neutral-500)] italic">
            {isAr ? `لا عناصر — اضغط «${addLabelAr}».` : `No items — click "${addLabelEn}".`}
          </p>
        )}
      </div>
    </div>
  );
}
