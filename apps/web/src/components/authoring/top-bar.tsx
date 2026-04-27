/**
 * Wave 15 Wave 3 — Editor top bar (56px).
 *
 * Per Hakawati §6.1: page title · status pill · AR ⇄ EN toggle · Preview ·
 * Save + autosave indicator · Undo (post-canary).
 */

'use client';

import Link from 'next/link';
import type { AutoSaveStatus } from './use-autosave';
import { formatRelative } from './use-autosave';

export type RowStatus = 'draft' | 'review' | 'published' | 'archived';

interface TopBarProps {
  title: string;
  status: RowStatus;
  canvasLocale: 'ar' | 'en';
  onLocaleToggle: () => void;
  previewHref: string | null;
  saveStatus: AutoSaveStatus;
  lastSavedAt: Date | null;
  onSaveNow: () => void;
  onSubmitForReview: () => void;
  onPublish: () => void;
  publishDisabled?: boolean;
  reviewDisabled?: boolean;
  locale: string;
}

const STATUS_BADGE: Record<RowStatus, { ar: string; en: string; bg: string; fg: string }> = {
  draft: { ar: 'مسودّة', en: 'Draft', bg: '#F3F4F6', fg: '#374151' },
  review: { ar: 'مراجعة', en: 'In review', bg: '#FEF3C7', fg: '#92400E' },
  published: { ar: 'منشور', en: 'Live', bg: '#D1FAE5', fg: '#065F46' },
  archived: { ar: 'مؤرشف', en: 'Archived', bg: '#E5E7EB', fg: '#6B7280' },
};

export function TopBar({
  title,
  status,
  canvasLocale,
  onLocaleToggle,
  previewHref,
  saveStatus,
  lastSavedAt,
  onSaveNow,
  onSubmitForReview,
  onPublish,
  publishDisabled,
  reviewDisabled,
  locale,
}: TopBarProps) {
  const isAr = locale === 'ar';
  const sb = STATUS_BADGE[status];

  const saveIndicator =
    saveStatus === 'saving'
      ? isAr ? 'جارٍ الحفظ…' : 'Saving…'
      : saveStatus === 'saved'
      ? formatRelative(lastSavedAt, isAr)
      : saveStatus === 'dirty'
      ? isAr ? 'تغييرات غير محفوظة' : 'Unsaved changes'
      : saveStatus === 'error'
      ? isAr ? '⚠ فشل الحفظ' : '⚠ Save failed'
      : isAr ? 'لا تغييرات' : 'No changes';

  return (
    <header
      className="flex items-center gap-3 px-3 md:px-4 border-b border-[var(--color-neutral-200)] bg-white shrink-0 flex-wrap"
      style={{ minHeight: 56 }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <h1 className="text-sm md:text-base font-semibold text-[var(--text-primary)] truncate" dir={isAr ? 'rtl' : 'ltr'}>
          {title}
        </h1>
        <span
          className="shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
          style={{ background: sb.bg, color: sb.fg }}
        >
          {isAr ? sb.ar : sb.en}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {/* AR ⇄ EN toggle */}
        <button
          type="button"
          onClick={onLocaleToggle}
          className="rounded-lg border border-[var(--color-neutral-300)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-neutral-700)] hover:border-[var(--color-primary)]"
          aria-label={isAr ? 'تبديل اللغة' : 'Toggle locale'}
        >
          {canvasLocale === 'ar' ? 'العربية' : 'English'}
          <span className="mx-1.5 text-[var(--color-neutral-400)]">⇄</span>
          {canvasLocale === 'ar' ? 'English' : 'العربية'}
        </button>

        {/* Preview link */}
        {previewHref && (
          <Link
            href={previewHref}
            target="_blank"
            rel="noopener"
            className="rounded-lg border border-[var(--color-neutral-300)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-neutral-700)] hover:border-[var(--color-primary)]"
          >
            {isAr ? 'معاينة ↗' : 'Preview ↗'}
          </Link>
        )}

        {/* Autosave indicator + manual save */}
        <span
          className={`text-[11px] ${
            saveStatus === 'error'
              ? 'text-red-700'
              : saveStatus === 'dirty'
              ? 'text-amber-700'
              : 'text-[var(--color-neutral-500)]'
          }`}
        >
          {saveIndicator}
        </span>
        <button
          type="button"
          onClick={onSaveNow}
          disabled={saveStatus === 'saving'}
          className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-600)] disabled:opacity-60"
        >
          {isAr ? 'حفظ' : 'Save'}
        </button>

        {/* Submit for review (or publish for already-in-review rows). */}
        {status === 'draft' && (
          <button
            type="button"
            onClick={onSubmitForReview}
            disabled={reviewDisabled}
            className="rounded-lg border border-[var(--color-warning-300,#fbbf24)] bg-[var(--color-warning-50,#fffbeb)] px-3 py-1.5 text-xs font-semibold text-[var(--color-warning-900,#78350f)] hover:bg-[var(--color-warning-100,#fef3c7)] disabled:opacity-60"
          >
            {isAr ? 'إرسال للمراجعة' : 'Submit for review'}
          </button>
        )}
        {status === 'review' && (
          <button
            type="button"
            onClick={onPublish}
            disabled={publishDisabled}
            className="rounded-lg bg-[var(--color-success,#10b981)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {isAr ? 'نشر' : 'Publish'}
          </button>
        )}
      </div>
    </header>
  );
}
