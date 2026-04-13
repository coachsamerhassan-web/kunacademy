'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BadgeModalProps {
  badge: {
    slug:            string;
    image_url:       string | null;
    name_ar:         string;
    name_en:         string;
    description_ar:  string | null;
    description_en:  string | null;
    program_url_ar:  string | null;
    program_url_en:  string | null;
  };
  graduation_date:  string | null;
  icf_credential:   string | null;
  cohort_name:      string | null;
  locale:           string;
  onClose:          () => void;
}

// ── ICF credential display map ────────────────────────────────────────────────

const ICF_LABELS: Record<string, { ar: string; en: string }> = {
  ACC: { ar: 'مدرّب معتمد مشارك (ACC)',       en: 'Associate Certified Coach (ACC)' },
  PCC: { ar: 'مدرّب محترف معتمد (PCC)',        en: 'Professional Certified Coach (PCC)' },
  MCC: { ar: 'مدرّب معتمد رئيسي (MCC)',        en: 'Master Certified Coach (MCC)' },
};

// ── Format date helper ────────────────────────────────────────────────────────

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-US', {
      year: 'numeric',
      month: 'long',
    });
  } catch {
    return dateStr;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BadgeModal({
  badge,
  graduation_date,
  icf_credential,
  cohort_name,
  locale,
  onClose,
}: BadgeModalProps) {
  const isAr       = locale === 'ar';
  const dialogRef  = useRef<HTMLDivElement>(null);
  const closeRef   = useRef<HTMLButtonElement>(null);

  const name        = isAr ? badge.name_ar        : badge.name_en;
  const description = isAr ? badge.description_ar  : badge.description_en;
  const programUrl  = isAr ? badge.program_url_ar  : badge.program_url_en;
  const icfMeta     = icf_credential ? ICF_LABELS[icf_credential] : null;

  // ── Keyboard: Escape closes, focus trap ──────────────────────────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    closeRef.current?.focus();

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // ── Click outside to close ───────────────────────────────────────────────────

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={name}
    >
      <div
        ref={dialogRef}
        className={`
          relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden
          animate-in fade-in-0 zoom-in-95 duration-200
          ${isAr ? 'text-right' : 'text-left'}
        `}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* ── Amber gradient top bar ──────────────────────────────────────── */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500" />

        {/* ── Close button ─────────────────────────────────────────────────── */}
        <button
          ref={closeRef}
          onClick={onClose}
          className={`
            absolute top-4 z-10 flex items-center justify-center w-8 h-8 rounded-full
            bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] hover:bg-[var(--color-neutral-200)]
            transition-colors duration-150
            ${isAr ? 'left-4' : 'right-4'}
          `}
          aria-label={isAr ? 'إغلاق' : 'Close'}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="p-6">
          {/* ── Badge image ──────────────────────────────────────────────── */}
          <div className="flex justify-center mb-5">
            {badge.image_url ? (
              <div className="relative h-28 w-28 rounded-full overflow-hidden ring-4 ring-amber-100 shadow-lg">
                <Image
                  src={badge.image_url}
                  alt={name}
                  fill
                  className="object-contain"
                  sizes="112px"
                />
              </div>
            ) : (
              <div className="h-28 w-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center ring-4 ring-amber-100 shadow-lg">
                <span className="text-white text-3xl font-bold">
                  {name.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* ── Badge name ───────────────────────────────────────────────── */}
          <h3 className="text-xl font-bold text-[var(--text-primary)] text-center">
            {name}
          </h3>

          {/* ── Metadata pills ───────────────────────────────────────────── */}
          <div className={`flex flex-wrap gap-2 mt-3 ${isAr ? 'justify-end' : 'justify-start'}`}>
            {graduation_date && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8"  y1="2" x2="8"  y2="6" />
                  <line x1="3"  y1="10" x2="21" y2="10" />
                </svg>
                {isAr ? 'تاريخ إتمام البرنامج: ' : 'Completed: '}{formatDate(graduation_date, locale)}
              </span>
            )}
            {cohort_name && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                {cohort_name}
              </span>
            )}
            {icfMeta && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                {isAr ? icfMeta.ar : icfMeta.en}
              </span>
            )}
          </div>

          {/* ── Description ──────────────────────────────────────────────── */}
          {description && (
            <p className="mt-4 text-sm text-[var(--color-neutral-600)] leading-relaxed">
              {description}
            </p>
          )}

          {/* ── Read more CTA ─────────────────────────────────────────────── */}
          {programUrl && (
            <div className={`mt-5 flex ${isAr ? 'justify-end' : 'justify-start'}`}>
              <a
                href={programUrl}
                className={`
                  inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5
                  text-sm font-semibold text-white hover:bg-amber-600 transition-colors duration-200
                  min-h-[40px]
                  ${isAr ? 'flex-row-reverse' : ''}
                `}
              >
                {isAr ? 'اعرف أكثر عن البرنامج' : 'Learn more about this program'}
                {isAr
                  ? <ArrowLeft  className="w-4 h-4 shrink-0" aria-hidden="true" />
                  : <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                }
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
