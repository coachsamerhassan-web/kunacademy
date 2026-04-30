'use client';

/**
 * Phase 3 (2026-04-30) — DescriptionRichText
 *
 * TipTap-based wrapper replacing plain <textarea> fields across admin
 * editors. Inherits the packages/ui RichEditor config (Wave 14b S2) and
 * wires inline image upload through content_media (Wave 15 Wave 3).
 *
 * REPLACES: plain <textarea> for description fields across admin editors.
 * (Phase 4 will do the actual swap-in at each editor surface.)
 *
 * Props:
 *   - value       TipTap JSON document | null
 *   - onChange    called with fresh JSON on every keystroke
 *   - locale      'ar' | 'en' — drives dir + toolbar labels
 *   - label       optional visible label above the editor
 *   - helperText  optional helper text below the label
 *   - placeholder optional placeholder shown in empty editor
 *   - maxHeight   CSS value for scroll container (default 360px)
 *   - required    if true, renders a red asterisk on the label
 *   - error       error message string (from form validation)
 *   - disabled    renders editor in read-only mode
 *
 * Inline image upload:
 *   - Clicking the image button in the toolbar opens MediaPickerDialog.
 *   - On selection, the chosen image is inserted at the cursor.
 *   - The dialog is rendered portal-style inside this component.
 *
 * Usage:
 *   const RTE = dynamic(() => import('@/components/forms/DescriptionRichText'), { ssr: false });
 *   <RTE value={doc} onChange={setDoc} locale="ar" label="الوصف" />
 *
 * IMPORTANT: Always dynamic-import this component to keep the ~80KB TipTap
 * bundle off SSR + off public pages. See the RichEditor source for guidance.
 */

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import type { JSONContent } from '@tiptap/react';
import { MediaPickerDialog } from '@/components/authoring/media-picker-dialog';

// Dynamic import — prevents TipTap from landing in the SSR bundle.
const RichEditor = dynamic(
  () => import('@kunacademy/ui/rich-editor').then((m) => m.RichEditor),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          minHeight: 180,
          padding: 16,
          background: 'var(--color-neutral-50, #F7F7F8)',
          borderRadius: 12,
          border: '1px solid var(--color-neutral-200, #E4E5E7)',
          color: 'var(--color-neutral-500, #757578)',
          fontStyle: 'italic',
          fontSize: 14,
        }}
      >
        Loading editor…
      </div>
    ),
  },
);

export type DescriptionRichTextLocale = 'ar' | 'en';

export interface DescriptionRichTextProps {
  value: JSONContent | null;
  onChange: (value: JSONContent) => void;
  locale: DescriptionRichTextLocale;
  label?: string;
  helperText?: string;
  placeholder?: string;
  maxHeight?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

// Shared label/helper CSS — matches S2 form-helper patterns from _form-helpers.tsx.
const labelClasses =
  'block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5';
const helperClasses = 'text-xs text-[var(--color-neutral-500)] mb-2';

export function DescriptionRichText({
  value,
  onChange,
  locale,
  label,
  helperText,
  placeholder,
  maxHeight = '360px',
  required = false,
  error,
  disabled = false,
}: DescriptionRichTextProps) {
  const isAr = locale === 'ar';
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerResolve, setPickerResolve] = useState<
    ((pick: { url: string; alt?: string } | null) => void) | null
  >(null);

  // onImagePick — called by RichEditor toolbar image button.
  // Opens the MediaPickerDialog and waits for the user's selection.
  const handleImagePick = useCallback(
    (_editorLocale: DescriptionRichTextLocale) => {
      return new Promise<{ url: string; alt?: string } | null>((resolve) => {
        setPickerResolve(() => resolve);
        setPickerOpen(true);
      });
    },
    [],
  );

  const handlePickerSelect = useCallback(
    (selection: { src: string; alt_ar?: string | null; alt_en?: string | null }) => {
      if (pickerResolve) {
        const alt = locale === 'ar' ? selection.alt_ar : selection.alt_en;
        pickerResolve({
          url: selection.src,
          alt: alt ?? undefined,
        });
      }
      setPickerOpen(false);
      setPickerResolve(null);
    },
    [pickerResolve, locale],
  );

  const handlePickerClose = useCallback(() => {
    if (pickerResolve) pickerResolve(null);
    setPickerOpen(false);
    setPickerResolve(null);
  }, [pickerResolve]);

  return (
    <div
      className="description-rich-text"
      dir={isAr ? 'rtl' : 'ltr'}
      data-locale={locale}
    >
      {label && (
        <label className={labelClasses}>
          {label}
          {required && (
            <span
              className="text-red-600 ms-1"
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>
      )}

      {helperText && <p className={helperClasses}>{helperText}</p>}

      <div
        className={[
          'rounded-xl border',
          error
            ? 'border-red-400 ring-1 ring-red-300'
            : 'border-[var(--color-neutral-200)] focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary-50)]',
          disabled ? 'opacity-60 pointer-events-none' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ background: 'var(--color-surface, #FFFFFF)' }}
      >
        <RichEditor
          value={value}
          onChange={onChange}
          locale={locale}
          placeholder={placeholder}
          maxHeight={maxHeight}
          onImagePick={handleImagePick}
          readOnly={disabled}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-1.5 text-xs text-red-700"
        >
          {error}
        </p>
      )}

      {/* MediaPickerDialog — portal-style inside this component. */}
      <MediaPickerDialog
        open={pickerOpen}
        onClose={handlePickerClose}
        onSelect={handlePickerSelect}
        locale={locale}
        initialTab="library"
      />
    </div>
  );
}
