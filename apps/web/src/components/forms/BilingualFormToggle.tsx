'use client';

/**
 * Phase 3 (2026-04-30) — BilingualFormToggle
 *
 * Single AR/EN pill toggle at the top of a form that switches the WHOLE
 * form view between Arabic and English. Implements the render-prop pattern
 * so the host form retains control of all its field state.
 *
 * REPLACES: ad-hoc side-by-side AR/EN field layouts and per-field locale
 * switches across admin editors. (Phase 4 wires the actual swap-in.)
 *
 * Locked decision Q1=all:
 *   The toggle wraps the WHOLE form — one locale is visible at a time.
 *   This was Samer's explicit choice over per-field bilateral editing.
 *
 * Render-prop API:
 *   <BilingualFormToggle locale="ar" onLocaleChange={setLocale}>
 *     {(locale) => <FormFields locale={locale} />}
 *   </BilingualFormToggle>
 *
 * OR with internal state (controlled by BilingualFormToggle):
 *   <BilingualFormToggle>
 *     {(locale) => <FormFields locale={locale} />}
 *   </BilingualFormToggle>
 *
 * Props:
 *   - children      (locale: 'ar' | 'en') => ReactNode — the form fields
 *   - locale        controlled locale value (optional — defaults to 'ar')
 *   - onLocaleChange called when user toggles (optional — use for controlled mode)
 *   - label         optional label shown next to the pill (e.g. "Language")
 *   - defaultLocale initial locale if uncontrolled (default 'ar')
 *
 * Accessibility:
 *   - role="group" on wrapper, aria-label on toggle cluster
 *   - Each pill button has aria-pressed + lang attributes
 *   - The form content area has dir + lang matching the active locale
 */

import { useState, useCallback, type ReactNode } from 'react';

export type BilingualLocale = 'ar' | 'en';

export interface BilingualFormToggleProps {
  /** Render prop: receives current locale, returns form fields. */
  children: (locale: BilingualLocale) => ReactNode;
  /** Controlled locale value. Omit to use internal state. */
  locale?: BilingualLocale;
  /** Called when the user toggles locale. */
  onLocaleChange?: (locale: BilingualLocale) => void;
  /** Label displayed next to the toggle pill (optional). */
  label?: string;
  /** Initial locale for uncontrolled mode (default: 'ar'). */
  defaultLocale?: BilingualLocale;
  /** Additional className for the wrapper div. */
  className?: string;
}

export function BilingualFormToggle({
  children,
  locale: controlledLocale,
  onLocaleChange,
  label,
  defaultLocale = 'ar',
  className,
}: BilingualFormToggleProps) {
  const [internalLocale, setInternalLocale] =
    useState<BilingualLocale>(defaultLocale);

  const isControlled = controlledLocale !== undefined;
  const activeLocale = isControlled ? controlledLocale : internalLocale;

  const handleLocaleChange = useCallback(
    (next: BilingualLocale) => {
      if (!isControlled) {
        setInternalLocale(next);
      }
      onLocaleChange?.(next);
    },
    [isControlled, onLocaleChange],
  );

  const isAr = activeLocale === 'ar';

  return (
    <div
      className={['bilingual-form-toggle', className].filter(Boolean).join(' ')}
      role="group"
    >
      {/* Toggle strip */}
      <div
        className="flex items-center gap-3 mb-4"
        dir="ltr" // toggle strip is always LTR regardless of active locale
      >
        {label && (
          <span className="text-sm font-semibold text-[var(--color-neutral-700)]">
            {label}
          </span>
        )}

        <div
          role="group"
          aria-label="Language selector"
          className="inline-flex items-center rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-0.5 gap-0.5"
        >
          <LocalePillButton
            locale="ar"
            active={activeLocale === 'ar'}
            onClick={() => handleLocaleChange('ar')}
          />
          <LocalePillButton
            locale="en"
            active={activeLocale === 'en'}
            onClick={() => handleLocaleChange('en')}
          />
        </div>

        {/* Active locale indicator badge */}
        <span
          className="text-xs text-[var(--color-neutral-500)] select-none"
          aria-live="polite"
          aria-atomic="true"
        >
          {isAr ? 'تعديل الحقول بالعربية' : 'Editing in English'}
        </span>
      </div>

      {/* Form content — dir + lang switch on locale change */}
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        lang={activeLocale}
        className="bilingual-form-toggle__content"
      >
        {children(activeLocale)}
      </div>
    </div>
  );
}

// ── LocalePillButton ──────────────────────────────────────────────────────────

interface LocalePillButtonProps {
  locale: BilingualLocale;
  active: boolean;
  onClick: () => void;
}

function LocalePillButton({ locale, active, onClick }: LocalePillButtonProps) {
  const label = locale === 'ar' ? 'العربية' : 'English';
  const shortLabel = locale === 'ar' ? 'AR' : 'EN';

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-pressed={active}
      lang={locale}
      onClick={onClick}
      className={[
        'rounded-md px-3 py-1.5 text-sm font-semibold transition-all min-h-[32px] min-w-[44px]',
        active
          ? 'bg-[var(--color-primary,#1D1A3D)] text-white shadow-sm'
          : 'text-[var(--color-neutral-600)] hover:text-[var(--color-neutral-900)] hover:bg-[var(--color-neutral-100)]',
      ].join(' ')}
      title={label}
    >
      {shortLabel}
    </button>
  );
}
