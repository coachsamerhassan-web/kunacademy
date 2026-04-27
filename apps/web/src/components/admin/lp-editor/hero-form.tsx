/**
 * Wave 14b LP-ADMIN-UX Session 2 — Hero editor (featured image + scalar
 * hero fields).
 *
 * Surface for `composition_json.hero` — the top-of-page block that's not
 * inside `sections[]`. Spec §6 Session 2: featured image + alt-text
 * (bilingual, a11y-required).
 *
 * Architecture: shipped as an additive top tab alongside Sections + JSON.
 * Reads/writes the SAME composition_json string via the shared
 * `composition` parsed object. Tab toggles non-destructive.
 *
 * Storage (Q2 lock): JSONB key on `LpHero` — no migration. Featured image
 * has its OWN url + alt fields (`featured_image_url`, `featured_image_alt_ar`,
 * `featured_image_alt_en`) distinct from `background_image_url`. Background
 * is the visual fill behind the hero text; featured is the canonical
 * representation of the LP for SEO/OG/social-card surfaces.
 */

'use client';

import { useState } from 'react';
import type { LpComposition, LpHero } from '@/lib/lp/composition-types';
import { useImageUpload } from './use-image-upload';

const inputClasses =
  'block w-full rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-2.5 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none';
const labelClasses =
  'block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5';

interface HeroFormProps {
  /** The FULL composition_json object (may be empty/null). */
  value: LpComposition | null;
  onChange: (next: LpComposition) => void;
  locale: string;
}

export function HeroForm({ value, onChange, locale }: HeroFormProps) {
  const isAr = locale === 'ar';
  const composition = value ?? {};
  const hero: LpHero = composition.hero ?? {};
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { uploadFile } = useImageUpload();

  function setHero(next: LpHero) {
    onChange({ ...composition, hero: next });
  }

  function setHeroField<K extends keyof LpHero>(key: K, val: LpHero[K]) {
    setHero({ ...hero, [key]: val });
  }

  // Validate alt-text BEFORE opening the file picker — better UX than
  // rejecting after the user has already selected a file (DeepSeek LOW
  // 2026-04-27). The button is also `disabled` when alt is empty so
  // users see the gate before clicking.
  const altAr = (hero.featured_image_alt_ar ?? '').trim();
  const altEn = (hero.featured_image_alt_en ?? '').trim();
  const altMissing = !altAr && !altEn;

  async function handleFeaturedImageSelect() {
    setUploadError(null);
    if (altMissing) {
      setUploadError(
        isAr
          ? 'يجب تعبئة نص بديل (AR أو EN) قبل الرفع — مطلوب لإمكانية الوصول.'
          : 'Provide alt text (AR or EN) before uploading — required for accessibility.',
      );
      return;
    }
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const media = await uploadFile(file, altAr, altEn);
        setHero({
          ...hero,
          featured_image_url: media.url,
          // Persist whatever alt the server stored back (one or both)
          featured_image_alt_ar: media.alt_ar ?? altAr ?? undefined,
          featured_image_alt_en: media.alt_en ?? altEn ?? undefined,
        });
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  function handleClearFeaturedImage() {
    setHero({
      ...hero,
      featured_image_url: undefined,
      // Keep alts on hero in case author re-uploads
    });
    setUploadError(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-[var(--text-primary)]">
          {isAr ? 'صورة مميَّزة' : 'Featured image'}
        </h3>
        <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
          {isAr
            ? 'الصورة الكنسية للصفحة — تستخدم في بطاقات OG وروابط المشاركة. مختلفة عن صورة الخلفية.'
            : 'Canonical image for the LP — used in OG cards and share links. Distinct from the background image.'}
        </p>
      </div>

      {/* Alt text — required for a11y; entered before file picker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClasses}>
            {isAr ? 'النص البديل (AR) — مطلوب' : 'Alt text (AR) — required'}
          </label>
          <input
            type="text"
            className={inputClasses}
            value={hero.featured_image_alt_ar ?? ''}
            onChange={(e) => setHeroField('featured_image_alt_ar', e.target.value || undefined)}
            dir="rtl"
            placeholder={isAr ? 'وصف مختصر للصورة بالعربية' : 'Short Arabic description of the image'}
          />
        </div>
        <div>
          <label className={labelClasses}>
            {isAr ? 'النص البديل (EN) — مطلوب' : 'Alt text (EN) — required'}
          </label>
          <input
            type="text"
            className={inputClasses}
            value={hero.featured_image_alt_en ?? ''}
            onChange={(e) => setHeroField('featured_image_alt_en', e.target.value || undefined)}
            dir="ltr"
            placeholder="Short English description of the image"
          />
        </div>
        <p className="md:col-span-2 text-xs text-[var(--color-neutral-500)]">
          {isAr
            ? 'يتطلّب الخادم نصًّا بديلًا واحدًا على الأقل (AR أو EN) قبل رفع الصورة.'
            : 'The server requires at least one alt text (AR or EN) before upload.'}
        </p>
      </div>

      {/* Current image preview + actions */}
      {hero.featured_image_url ? (
        <div className="rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4 space-y-3">
          <div className="aspect-[16/9] w-full max-w-md overflow-hidden rounded-lg border border-[var(--color-neutral-200)] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero.featured_image_url}
              alt={(isAr ? hero.featured_image_alt_ar : hero.featured_image_alt_en) ?? ''}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-xs text-[var(--color-neutral-700)] break-all font-mono">
            {hero.featured_image_url}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleFeaturedImageSelect}
              disabled={uploading || altMissing}
              title={altMissing ? (isAr ? 'أدخل نص بديل أوّلًا' : 'Enter alt text first') : undefined}
              className="rounded-lg border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-4 py-2 text-sm font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {uploading ? (isAr ? 'جارٍ الرفع…' : 'Uploading…') : isAr ? 'استبدال الصورة' : 'Replace image'}
            </button>
            <button
              type="button"
              onClick={handleClearFeaturedImage}
              className="rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm text-[var(--color-neutral-700)] hover:border-red-300 hover:text-red-700"
            >
              {isAr ? 'إزالة' : 'Remove'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--color-neutral-300)] bg-[var(--color-neutral-50)] p-6 text-center">
          <p className="text-sm text-[var(--color-neutral-600)] mb-3">
            {isAr ? 'لا صورة مميَّزة بعد.' : 'No featured image yet.'}
          </p>
          <button
            type="button"
            onClick={handleFeaturedImageSelect}
            disabled={uploading || altMissing}
            title={altMissing ? (isAr ? 'أدخل نص بديل أوّلًا' : 'Enter alt text first') : undefined}
            className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--color-accent-500)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? (isAr ? 'جارٍ الرفع…' : 'Uploading…') : isAr ? 'رفع صورة' : 'Upload image'}
          </button>
        </div>
      )}

      {uploadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {uploadError}
        </div>
      )}

      {/* Quick scalar hero fields — most authoring still happens via JSON tab,
          but these are the most common and surfacing them inline reduces tab
          ping-ponging. */}
      <div className="border-t border-[var(--color-neutral-100)] pt-5">
        <h4 className="font-semibold text-[var(--text-primary)] mb-3">
          {isAr ? 'الحقول الأساسية للهيرو' : 'Core hero fields'}
        </h4>
        <p className="text-xs text-[var(--color-neutral-500)] mb-4">
          {isAr
            ? 'لتحرير الحقول المتقدّمة (eyebrow / hook / footer / brand_mark / إلخ) استخدم تبويب JSON.'
            : 'For advanced fields (eyebrow / hook / footer / brand_mark / etc.) use the JSON tab.'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>{isAr ? 'العنوان (AR)' : 'Headline (AR)'}</label>
            <input
              type="text"
              className={inputClasses}
              value={hero.headline_ar ?? ''}
              onChange={(e) => setHeroField('headline_ar', e.target.value || undefined)}
              dir="rtl"
            />
          </div>
          <div>
            <label className={labelClasses}>{isAr ? 'العنوان (EN)' : 'Headline (EN)'}</label>
            <input
              type="text"
              className={inputClasses}
              value={hero.headline_en ?? ''}
              onChange={(e) => setHeroField('headline_en', e.target.value || undefined)}
              dir="ltr"
            />
          </div>
          <div>
            <label className={labelClasses}>{isAr ? 'العنوان الفرعي (AR)' : 'Subheadline (AR)'}</label>
            <input
              type="text"
              className={inputClasses}
              value={hero.subheadline_ar ?? ''}
              onChange={(e) => setHeroField('subheadline_ar', e.target.value || undefined)}
              dir="rtl"
            />
          </div>
          <div>
            <label className={labelClasses}>{isAr ? 'العنوان الفرعي (EN)' : 'Subheadline (EN)'}</label>
            <input
              type="text"
              className={inputClasses}
              value={hero.subheadline_en ?? ''}
              onChange={(e) => setHeroField('subheadline_en', e.target.value || undefined)}
              dir="ltr"
            />
          </div>
          <div>
            <label className={labelClasses}>{isAr ? 'نص الزر (AR)' : 'CTA label (AR)'}</label>
            <input
              type="text"
              className={inputClasses}
              value={hero.cta_label_ar ?? ''}
              onChange={(e) => setHeroField('cta_label_ar', e.target.value || undefined)}
              dir="rtl"
            />
          </div>
          <div>
            <label className={labelClasses}>{isAr ? 'نص الزر (EN)' : 'CTA label (EN)'}</label>
            <input
              type="text"
              className={inputClasses}
              value={hero.cta_label_en ?? ''}
              onChange={(e) => setHeroField('cta_label_en', e.target.value || undefined)}
              dir="ltr"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClasses}>cta_anchor</label>
            <input
              type="text"
              className={inputClasses}
              value={hero.cta_anchor ?? ''}
              onChange={(e) => setHeroField('cta_anchor', e.target.value || undefined)}
              dir="ltr"
              placeholder="#lead-form | #payment | https://…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
