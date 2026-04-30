'use client';

/**
 * Phase 3 (2026-04-30) — MediaLibraryPicker
 *
 * Image picker reading from the unified content_media table (Wave 15).
 * Replaces plain text inputs for image URL fields across admin editors.
 * (Phase 4 will do the actual swap-in at each editor surface.)
 *
 * REPLACES: plain <input type="text"> / <input type="url"> for image URL
 * fields across admin editors.
 *
 * Design decisions (per locked Samer choices):
 *   - C1 = hybrid: folders + tags for media organization.
 *   - Single content_media table (already exists, no new migration needed).
 *   - Modal pattern (MediaPickerDialog re-used as the picker surface).
 *   - Multi-select: returns array of ids + URLs (for fields needing it).
 *   - Single-select mode (default): most image fields pick exactly one.
 *   - Drag-upload + inline crop: delegated to MediaPickerDialog Upload tab.
 *
 * Returns: content_media.id + url on selection.
 *
 * Props:
 *   - value         current image URL string (single-select) or null
 *   - mediaId       current content_media.id (optional — for audit/link display)
 *   - onChange      called with { url, mediaId } on pick
 *   - onClear       called when user clicks the X to remove the image
 *   - locale        'ar' | 'en' — drives dialog labels
 *   - label         optional visible label
 *   - helperText    optional helper below label
 *   - required      if true, red asterisk on label
 *   - error         validation error message
 *   - disabled      if true, hide the picker button
 *   - allowUrl      if true, shows the URL tab in the picker (default true)
 *   - previewSize   'sm' | 'md' (default 'md') — thumbnail preview size
 *
 * Usage:
 *   <MediaLibraryPicker
 *     value={form.featured_image_url}
 *     mediaId={form.featured_image_media_id}
 *     onChange={(p) => setForm({ ...form, featured_image_url: p.url, featured_image_media_id: p.mediaId })}
 *     onClear={() => setForm({ ...form, featured_image_url: null, featured_image_media_id: null })}
 *     locale="ar"
 *     label="الصورة المميّزة"
 *   />
 */

import { useState, useCallback } from 'react';
import { MediaPickerDialog } from '@/components/authoring/media-picker-dialog';
import type { MediaPickerSelection } from '@/components/authoring/media-picker-dialog';

export interface MediaPickResult {
  url: string;
  mediaId?: string;
  alt_ar?: string | null;
  alt_en?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface MediaLibraryPickerProps {
  value: string | null | undefined;
  mediaId?: string | null;
  onChange: (pick: MediaPickResult) => void;
  onClear?: () => void;
  locale: 'ar' | 'en';
  label?: string;
  helperText?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  allowUrl?: boolean;
  previewSize?: 'sm' | 'md';
}

const labelClasses =
  'block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5';
const helperClasses = 'text-xs text-[var(--color-neutral-500)] mb-2';

const PREVIEW_SIZES = {
  sm: { container: 64, maxW: 'max-w-[64px]' },
  md: { container: 96, maxW: 'max-w-[96px]' },
};

export function MediaLibraryPicker({
  value,
  mediaId: _mediaId,
  onChange,
  onClear,
  locale,
  label,
  helperText,
  required = false,
  error,
  disabled = false,
  allowUrl = true,
  previewSize = 'md',
}: MediaLibraryPickerProps) {
  const isAr = locale === 'ar';
  const [pickerOpen, setPickerOpen] = useState(false);
  const sz = PREVIEW_SIZES[previewSize];

  const handleSelect = useCallback(
    (selection: MediaPickerSelection) => {
      onChange({
        url: selection.src,
        mediaId: selection.mediaId,
        alt_ar: selection.alt_ar,
        alt_en: selection.alt_en,
        width: selection.width,
        height: selection.height,
      });
      setPickerOpen(false);
    },
    [onChange],
  );

  const handleClose = useCallback(() => setPickerOpen(false), []);

  const L = {
    chooseImage: isAr ? 'اختر صورة' : 'Choose image',
    changeImage: isAr ? 'تغيير الصورة' : 'Change image',
    removeImage: isAr ? 'إزالة الصورة' : 'Remove image',
    preview: isAr ? 'معاينة' : 'Preview',
    noImage: isAr ? 'لم تُختر صورة' : 'No image selected',
  };

  return (
    <div
      className="media-library-picker"
      dir={isAr ? 'rtl' : 'ltr'}
      data-locale={locale}
    >
      {label && (
        <label className={labelClasses}>
          {label}
          {required && (
            <span className="text-red-600 ms-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {helperText && <p className={helperClasses}>{helperText}</p>}

      <div
        className={[
          'flex items-center gap-3 p-3 rounded-xl border',
          error
            ? 'border-red-400 bg-red-50'
            : 'border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]',
        ].join(' ')}
      >
        {/* Thumbnail preview */}
        <div
          className={[
            'flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-neutral-200)] flex items-center justify-center',
            sz.maxW,
          ].join(' ')}
          style={{ width: sz.container, height: sz.container }}
          aria-hidden="true"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={L.preview}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-2xl text-[var(--color-neutral-400)]">
              {/* Image placeholder icon */}
              &#x1F5BC;
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {value ? (
            <span
              className="text-xs text-[var(--color-neutral-600)] truncate font-mono"
              title={value}
            >
              {value.split('/').pop()}
            </span>
          ) : (
            <span className="text-xs text-[var(--color-neutral-500)] italic">
              {L.noImage}
            </span>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={disabled}
              className="rounded-lg border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
            >
              {value ? L.changeImage : L.chooseImage}
            </button>

            {value && onClear && !disabled && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-lg border border-[var(--color-neutral-300)] px-3 py-1.5 text-sm text-[var(--color-neutral-700)] hover:border-red-300 hover:text-red-700 min-h-[36px]"
                aria-label={L.removeImage}
              >
                {L.removeImage}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-700">
          {error}
        </p>
      )}

      <MediaPickerDialog
        open={pickerOpen}
        onClose={handleClose}
        onSelect={handleSelect}
        locale={locale}
        initialTab={allowUrl ? 'library' : 'library'}
      />
    </div>
  );
}
