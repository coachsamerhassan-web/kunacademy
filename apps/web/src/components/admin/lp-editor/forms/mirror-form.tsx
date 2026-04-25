/**
 * Wave 14b LP-ADMIN-UX Session 1 — `mirror` section per-field form (CANARY).
 *
 * Spec: Specs/wave-14b-lp-admin-ux-spec.md §6 Session 1.
 *
 * Surface for the `mirror` section type:
 *   - kicker_ar / kicker_en (scalar string, optional)
 *   - title_ar / title_en (scalar string)
 *   - body / close (bilingual rich text — primary content, with rich-over-string preference)
 *   - items[] (each with label_ar/en + body_ar/en/_rich + icon + meta_ar/en)
 *   - layout: 'data-lines' | 'cards'
 *   - anchor_id (scalar string, optional)
 *   - background (select)
 *
 * The rich-text fields write into `body_ar_rich` / `body_en_rich` / `close_ar_rich`
 * / `close_en_rich`. The renderer (Wave 15 P2 S1) prefers rich-over-string via
 * `hasRichContent()` guard, so legacy scalar `body_ar` / `body_en` / `close_ar`
 * / `close_en` stay populated for backwards compat — admins editing in this
 * canary form may leave the scalars unchanged or clear them; either is safe.
 */

'use client';

import dynamic from 'next/dynamic';
import type { LpSection, LpSectionItem, LpMirrorLayout } from '@/lib/lp/composition-types';
import { BilingualScalarField, type SectionFormProps } from '../_shared';
import type { BilingualRichDoc } from '@kunacademy/ui/rich-editor';

// Dynamic import — keeps the TipTap bundle off SSR + off first-paint.
const BilingualRichEditor = dynamic(
  () => import('@kunacademy/ui/rich-editor').then((m) => m.BilingualRichEditor),
  { ssr: false, loading: () => <div className="rounded-xl border border-[var(--color-neutral-200)] p-4 text-sm text-[var(--color-neutral-500)]">Loading editor…</div> },
);

const inputClasses =
  'block w-full rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-2.5 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none';
const selectClasses = inputClasses;
const labelClasses =
  'block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5';

type MirrorBackground = NonNullable<LpSection['background']>;

const BACKGROUND_OPTIONS: ReadonlyArray<{ value: MirrorBackground | ''; label: string }> = [
  { value: '', label: '— default (surface-low) —' },
  { value: 'white', label: 'white' },
  { value: 'surface', label: 'surface' },
  { value: 'surface-low', label: 'surface-low' },
  { value: 'primary', label: 'primary (dark)' },
  { value: 'dark', label: 'dark' },
  { value: 'accent-tint', label: 'accent-tint' },
];

const LAYOUT_OPTIONS: ReadonlyArray<{ value: LpMirrorLayout; label: string }> = [
  { value: 'data-lines', label: 'data-lines (world-mirror)' },
  { value: 'cards', label: 'cards (four-mirrors)' },
];

export function MirrorForm({ section, onChange, locale }: SectionFormProps) {
  const isAr = locale === 'ar';

  function update<K extends keyof LpSection>(key: K, value: LpSection[K]) {
    onChange({ ...section, [key]: value });
  }

  function updateBodyBilingual(next: BilingualRichDoc) {
    onChange({ ...section, body_ar_rich: next.ar, body_en_rich: next.en });
  }

  function updateCloseBilingual(next: BilingualRichDoc) {
    onChange({ ...section, close_ar_rich: next.ar, close_en_rich: next.en });
  }

  function updateItem(index: number, next: LpSectionItem) {
    const items = [...(section.items ?? [])];
    items[index] = next;
    onChange({ ...section, items });
  }

  function addItem() {
    onChange({
      ...section,
      items: [...(section.items ?? []), { label_ar: '', label_en: '', body_ar: '', body_en: '' }],
    });
  }

  function removeItem(index: number) {
    const items = [...(section.items ?? [])];
    items.splice(index, 1);
    onChange({ ...section, items });
  }

  const bodyValue: BilingualRichDoc = {
    ar: section.body_ar_rich ?? null,
    en: section.body_en_rich ?? null,
  };
  const closeValue: BilingualRichDoc = {
    ar: section.close_ar_rich ?? null,
    en: section.close_en_rich ?? null,
  };

  return (
    <div className="space-y-6">
      {/* Layout + anchor + background — small scalar group at the top */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelClasses}>{isAr ? 'التخطيط' : 'Layout'}</label>
          <select
            className={selectClasses}
            value={section.layout ?? 'data-lines'}
            onChange={(e) => update('layout', e.target.value as LpMirrorLayout)}
          >
            {LAYOUT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClasses}>anchor_id</label>
          <input
            type="text"
            className={inputClasses}
            value={section.anchor_id ?? ''}
            onChange={(e) => update('anchor_id', e.target.value || undefined)}
            dir="ltr"
            placeholder="e.g. mirror-section-1"
          />
        </div>
        <div>
          <label className={labelClasses}>{isAr ? 'الخلفية (الموضوع الافتراضي فقط)' : 'Background (default theme only)'}</label>
          <select
            className={selectClasses}
            value={section.background ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              update('background', v ? (v as MirrorBackground) : undefined);
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

      {/* Kicker + title — scalar bilingual */}
      <BilingualScalarField
        labelAr="الكيكر (AR)"
        labelEn="Kicker (EN)"
        valueAr={section.kicker_ar ?? ''}
        valueEn={section.kicker_en ?? ''}
        onChangeAr={(v) => update('kicker_ar', v || undefined)}
        onChangeEn={(v) => update('kicker_en', v || undefined)}
        helperText={isAr ? 'تسمية صغيرة فوق العنوان (اختياري).' : 'Small uppercase label above the title (optional).'}
      />
      <BilingualScalarField
        labelAr="العنوان (AR)"
        labelEn="Title (EN)"
        valueAr={section.title_ar ?? ''}
        valueEn={section.title_en ?? ''}
        onChangeAr={(v) => update('title_ar', v || undefined)}
        onChangeEn={(v) => update('title_en', v || undefined)}
      />

      {/* Body — bilingual RICH editor */}
      <div>
        <label className={labelClasses}>
          {isAr ? 'النص الأساسي (محرّر غني)' : 'Body (rich editor)'}
        </label>
        <p className="text-xs text-[var(--color-neutral-500)] mb-2">
          {isAr
            ? 'يحلّ هذا النص محلّ body_ar / body_en في العرض. الحقول النصية القديمة تبقى للتوافق العكسي.'
            : 'This rich body replaces body_ar / body_en in render. Legacy scalar fields stay populated for backward compat.'}
        </p>
        <BilingualRichEditor
          value={bodyValue}
          onChange={updateBodyBilingual}
          labelAr="AR"
          labelEn="EN"
          orientation="side-by-side"
        />
      </div>

      {/* Close — bilingual RICH editor (mirror-bridge / closing line) */}
      <div>
        <label className={labelClasses}>
          {isAr ? 'الإغلاق / الجسر (محرّر غني)' : 'Close / bridge (rich editor)'}
        </label>
        <p className="text-xs text-[var(--color-neutral-500)] mb-2">
          {isAr
            ? 'النص الذي يُختم به القسم — في تخطيط data-lines يُعرض كجسر تحت السطور.'
            : 'Closing text — on data-lines layout, renders as the bridge paragraph below the lines.'}
        </p>
        <BilingualRichEditor
          value={closeValue}
          onChange={updateCloseBilingual}
          labelAr="AR"
          labelEn="EN"
          orientation="side-by-side"
        />
      </div>

      {/* Items — list editor (used by data-lines + cards layouts) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelClasses + ' mb-0'}>
            {isAr ? 'العناصر (data-lines / cards)' : 'Items (data-lines / cards)'}
          </label>
          <button
            type="button"
            onClick={addItem}
            className="rounded-lg border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]"
          >
            + {isAr ? 'إضافة عنصر' : 'Add item'}
          </button>
        </div>
        <p className="text-xs text-[var(--color-neutral-500)] mb-3">
          {isAr
            ? 'data-lines يستخدم body_ar / body_en كسطر بيانات. cards يستخدم label + body كافتتاحية + متن.'
            : 'data-lines uses body_ar / body_en as the data line. cards uses label + body as opener + body.'}
        </p>
        <div className="space-y-3">
          {(section.items ?? []).map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  #{i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="rounded-lg border border-[var(--color-neutral-300)] px-2 py-1 text-xs text-[var(--color-neutral-700)] hover:border-red-300 hover:text-red-700"
                >
                  {isAr ? 'حذف' : 'Remove'}
                </button>
              </div>
              <BilingualScalarField
                labelAr="label (AR)"
                labelEn="label (EN)"
                valueAr={item.label_ar ?? ''}
                valueEn={item.label_en ?? ''}
                onChangeAr={(v) => updateItem(i, { ...item, label_ar: v || undefined })}
                onChangeEn={(v) => updateItem(i, { ...item, label_en: v || undefined })}
              />
              <BilingualScalarField
                labelAr="body (AR)"
                labelEn="body (EN)"
                valueAr={item.body_ar ?? ''}
                valueEn={item.body_en ?? ''}
                onChangeAr={(v) => updateItem(i, { ...item, body_ar: v || undefined })}
                onChangeEn={(v) => updateItem(i, { ...item, body_en: v || undefined })}
                variant="textarea"
              />
            </div>
          ))}
          {(!section.items || section.items.length === 0) && (
            <p className="text-sm text-[var(--color-neutral-500)] italic">
              {isAr ? 'لا عناصر — اضغط «إضافة عنصر».' : 'No items — click "Add item".'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
