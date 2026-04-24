'use client';

/**
 * BilingualTextField — small reusable bilingual input for Wave F.3 admin forms.
 *
 * Renders an Arabic label + input and an English label + input. Two common
 * shapes: single-line (input) and multi-line (textarea). Values are plain
 * strings — this is NOT a rich-text editor (that's BilingualRichEditor in
 * packages/ui). Use for short copy: tier name, feature name, one-line
 * descriptions.
 *
 * Arabic rows render dir="rtl" locally regardless of parent locale so the
 * caret behaves correctly when admin edits Arabic copy from an English UI.
 */

import type { ChangeEvent } from 'react';

export interface BilingualTextFieldProps {
  labelAr: string;
  labelEn: string;
  valueAr: string;
  valueEn: string;
  onChangeAr: (v: string) => void;
  onChangeEn: (v: string) => void;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  placeholderAr?: string;
  placeholderEn?: string;
  helpAr?: string;
  helpEn?: string;
  disabled?: boolean;
  locale: string; // 'ar' | 'en' — used only to decide which label comes first visually
}

export function BilingualTextField(props: BilingualTextFieldProps) {
  const {
    labelAr, labelEn, valueAr, valueEn,
    onChangeAr, onChangeEn,
    multiline, required, maxLength,
    placeholderAr, placeholderEn,
    helpAr, helpEn,
    disabled,
    locale,
  } = props;

  const isAr = locale === 'ar';
  const Ar = (
    <div dir="rtl" className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-arabic-body)' }}>
        {labelAr}
        {required && <span className="text-red-600 ms-1">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={valueAr}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChangeAr(e.target.value)}
          required={required}
          maxLength={maxLength}
          placeholder={placeholderAr}
          disabled={disabled}
          rows={3}
          className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-neutral-50)]"
          style={{ fontFamily: 'var(--font-arabic-body)' }}
        />
      ) : (
        <input
          type="text"
          value={valueAr}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeAr(e.target.value)}
          required={required}
          maxLength={maxLength}
          placeholder={placeholderAr}
          disabled={disabled}
          className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-neutral-50)]"
          style={{ fontFamily: 'var(--font-arabic-body)' }}
        />
      )}
      {helpAr && <span className="text-xs text-[var(--color-neutral-500)]">{helpAr}</span>}
    </div>
  );

  const En = (
    <div dir="ltr" className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-[var(--text-primary)]">
        {labelEn}
        {required && <span className="text-red-600 ms-1">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={valueEn}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChangeEn(e.target.value)}
          required={required}
          maxLength={maxLength}
          placeholder={placeholderEn}
          disabled={disabled}
          rows={3}
          className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-neutral-50)]"
        />
      ) : (
        <input
          type="text"
          value={valueEn}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeEn(e.target.value)}
          required={required}
          maxLength={maxLength}
          placeholder={placeholderEn}
          disabled={disabled}
          className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-neutral-50)]"
        />
      )}
      {helpEn && <span className="text-xs text-[var(--color-neutral-500)]">{helpEn}</span>}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {isAr ? <>{Ar}{En}</> : <>{En}{Ar}</>}
    </div>
  );
}
