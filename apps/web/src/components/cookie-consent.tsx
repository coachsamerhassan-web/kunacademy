'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

const STORAGE_KEY = 'kun-cookie-consent';
const CONSENT_EVENT = 'cookie-consent-changed';

// ─── Bilingual copy ───────────────────────────────────────────────────────────

const copy = {
  ar: {
    banner: 'نستخدم ملفات تعريف الارتباط لتحسين تجربتك',
    acceptAll: 'قبول الكل',
    managePrefs: 'إدارة التفضيلات',
    rejectAll: 'رفض الكل',
    savePrefs: 'حفظ التفضيلات',
    privacy: 'سياسة الخصوصية',
    essential: 'أساسية',
    essentialDesc: 'ضرورية لعمل الموقع ولا يمكن تعطيلها.',
    analytics: 'تحليلية',
    analyticsDesc: 'تساعدنا على فهم كيفية استخدامك للموقع.',
    marketing: 'تسويقية',
    marketingDesc: 'تُستخدم لعرض إعلانات مخصصة لك.',
    alwaysOn: 'دائمًا مفعّلة',
    prefsTitle: 'تفضيلات ملفات تعريف الارتباط',
    prefsSubtitle: 'اختر الفئات التي توافق عليها',
  },
  en: {
    banner: 'We use cookies to improve your experience',
    acceptAll: 'Accept All',
    managePrefs: 'Manage Preferences',
    rejectAll: 'Reject All',
    savePrefs: 'Save Preferences',
    privacy: 'Privacy Policy',
    essential: 'Essential',
    essentialDesc: 'Required for the site to function. Cannot be disabled.',
    analytics: 'Analytics',
    analyticsDesc: 'Helps us understand how you use our site.',
    marketing: 'Marketing',
    marketingDesc: 'Used to show you personalised advertisements.',
    alwaysOn: 'Always on',
    prefsTitle: 'Cookie Preferences',
    prefsSubtitle: 'Choose which categories you accept',
  },
} as const;

type Locale = keyof typeof copy;

// ─── Dispatch helper ──────────────────────────────────────────────────────────

function dispatchConsentEvent(state: ConsentState) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}

// ─── Persist helpers ──────────────────────────────────────────────────────────

function readStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    // Validate shape
    if (
      typeof parsed.analytics === 'boolean' &&
      typeof parsed.marketing === 'boolean' &&
      typeof parsed.timestamp === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredConsent(state: ConsentState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── useConsent hook ──────────────────────────────────────────────────────────

/**
 * Subscribe to consent state from anywhere in the tree.
 * Returns { analytics, marketing } — both false until user has saved.
 */
export function useConsent(): { analytics: boolean; marketing: boolean } {
  const [consent, setConsent] = useState<{ analytics: boolean; marketing: boolean }>(() => {
    const stored = readStoredConsent();
    return stored
      ? { analytics: stored.analytics, marketing: stored.marketing }
      : { analytics: false, marketing: false };
  });

  useEffect(() => {
    // Hydrate from storage after mount
    const stored = readStoredConsent();
    if (stored) {
      setConsent({ analytics: stored.analytics, marketing: stored.marketing });
    }

    function handleChange(e: Event) {
      const detail = (e as CustomEvent<ConsentState>).detail;
      setConsent({ analytics: detail.analytics, marketing: detail.marketing });
    }

    window.addEventListener(CONSENT_EVENT, handleChange);
    return () => window.removeEventListener(CONSENT_EVENT, handleChange);
  }, []);

  return consent;
}

// ─── Toggle switch sub-component ─────────────────────────────────────────────

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

function ToggleSwitch({ id, checked, disabled = false, onChange, label }: ToggleSwitchProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  }

  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={handleKeyDown}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'focus-visible:ring-[var(--color-primary)]',
        disabled
          ? 'cursor-not-allowed bg-[var(--color-primary)] opacity-60'
          : checked
            ? 'bg-[var(--color-primary)]'
            : 'bg-[var(--color-neutral-300)]',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm',
          'transform transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState<Locale>('ar');
  const [isRtl, setIsRtl] = useState(true);

  // Consent toggles — start both false until user decides
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  // Focus trap refs
  const bannerRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLButtonElement>(null);

  // Detect locale and direction from document root
  useEffect(() => {
    const lang = document.documentElement.lang;
    const dir = document.documentElement.dir;
    const detectedLocale: Locale = lang === 'ar' ? 'ar' : 'en';
    setLocale(detectedLocale);
    setIsRtl(dir === 'rtl' || detectedLocale === 'ar');
    setMounted(true);
  }, []);

  // Check for existing consent on mount
  useEffect(() => {
    if (!mounted) return;
    const stored = readStoredConsent();
    if (stored) {
      // Consent already given — don't show banner
      return;
    }
    // Small delay so the page settles before sliding up
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, [mounted]);

  // Focus trap when expanded
  useEffect(() => {
    if (!expanded || !bannerRef.current) return;

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusable = bannerRef.current!.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleTab);
    // Move focus into the panel
    firstFocusRef.current?.focus();
    return () => document.removeEventListener('keydown', handleTab);
  }, [expanded]);

  // ── Save helpers ────────────────────────────────────────────────────────────

  const saveConsent = useCallback(
    (analytics: boolean, marketing: boolean) => {
      const state: ConsentState = {
        analytics,
        marketing,
        timestamp: new Date().toISOString(),
      };
      writeStoredConsent(state);
      dispatchConsentEvent(state);
      setVisible(false);
      setExpanded(false);
    },
    []
  );

  const handleAcceptAll = useCallback(() => saveConsent(true, true), [saveConsent]);

  const handleRejectAll = useCallback(() => saveConsent(false, false), [saveConsent]);

  const handleSavePrefs = useCallback(
    () => saveConsent(analyticsEnabled, marketingEnabled),
    [saveConsent, analyticsEnabled, marketingEnabled]
  );

  const handleManagePrefs = useCallback(() => {
    setExpanded(true);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  // Don't render until client has mounted (avoids SSR hydration mismatch)
  if (!mounted) return null;

  const t = copy[locale];
  const privacyHref = `/${locale}/legal/privacy`;

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-modal="true"
      aria-label={t.prefsTitle}
      aria-live="polite"
      dir={isRtl ? 'rtl' : 'ltr'}
      className={[
        'fixed bottom-0 left-0 right-0 z-[9999]',
        'transition-all duration-500 ease-out',
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-full opacity-0 pointer-events-none',
      ].join(' ')}
    >
      {/* Backdrop blur at bottom — subtle depth cue */}
      <div className="absolute inset-0 -z-10 backdrop-blur-sm" aria-hidden="true" />

      <div
        className={[
          'relative mx-auto w-full max-w-4xl',
          'bg-[var(--color-background)]',
          'border-t border-[var(--color-outline-variant)]',
          'shadow-[0_-4px_32px_rgba(71,64,153,0.12)]',
          'rounded-t-[16px]',
          'px-4 py-5 sm:px-6 sm:py-6',
        ].join(' ')}
      >
        {/* ── Collapsed: simple banner ─────────────────────────────────────── */}
        {!expanded && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Message + privacy link */}
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-relaxed text-[var(--color-text)]">
                {t.banner}{' '}
                <a
                  href={privacyHref}
                  className={[
                    'text-[var(--color-primary)] underline underline-offset-2',
                    'hover:text-[var(--color-accent)] transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-sm',
                  ].join(' ')}
                >
                  {t.privacy}
                </a>
              </p>
            </div>

            {/* Action buttons */}
            <div
              className={[
                'flex items-center gap-2 flex-wrap',
                isRtl ? 'flex-row-reverse sm:flex-row' : '',
              ].join(' ')}
            >
              {/* Reject All */}
              <button
                onClick={handleRejectAll}
                className={[
                  'min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium',
                  'border border-[var(--color-outline-variant)]',
                  'text-[var(--color-text)] bg-transparent',
                  'hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'whitespace-nowrap',
                ].join(' ')}
              >
                {t.rejectAll}
              </button>

              {/* Manage Preferences */}
              <button
                ref={firstFocusRef}
                onClick={handleManagePrefs}
                className={[
                  'min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium',
                  'border border-[var(--color-primary)]',
                  'text-[var(--color-primary)] bg-transparent',
                  'hover:bg-[var(--color-primary-50)]',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'whitespace-nowrap',
                ].join(' ')}
              >
                {t.managePrefs}
              </button>

              {/* Accept All */}
              <button
                onClick={handleAcceptAll}
                className={[
                  'min-h-[44px] rounded-xl px-5 py-2 text-sm font-semibold',
                  'bg-[var(--color-accent)] text-white',
                  'hover:bg-[var(--color-accent-500)] active:bg-[var(--color-accent-600)]',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-accent)]',
                  'whitespace-nowrap shadow-sm',
                ].join(' ')}
              >
                {t.acceptAll}
              </button>
            </div>
          </div>
        )}

        {/* ── Expanded: preferences panel ──────────────────────────────────── */}
        {expanded && (
          <div className="flex flex-col gap-5">
            {/* Header */}
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                {t.prefsTitle}
              </h2>
              <p className="mt-0.5 text-sm text-[var(--color-neutral-600)]">
                {t.prefsSubtitle}
              </p>
            </div>

            {/* Category rows */}
            <div className="flex flex-col divide-y divide-[var(--color-outline-variant)]">
              {/* Essential — always on */}
              <CategoryRow
                id="toggle-essential"
                label={t.essential}
                description={t.essentialDesc}
                checked={true}
                disabled={true}
                alwaysOnLabel={t.alwaysOn}
                isRtl={isRtl}
                onChange={() => {}}
              />

              {/* Analytics */}
              <CategoryRow
                id="toggle-analytics"
                label={t.analytics}
                description={t.analyticsDesc}
                checked={analyticsEnabled}
                isRtl={isRtl}
                onChange={setAnalyticsEnabled}
              />

              {/* Marketing */}
              <CategoryRow
                id="toggle-marketing"
                label={t.marketing}
                description={t.marketingDesc}
                checked={marketingEnabled}
                isRtl={isRtl}
                onChange={setMarketingEnabled}
              />
            </div>

            {/* Expanded actions */}
            <div
              className={[
                'flex items-center gap-3 flex-wrap pt-1',
                isRtl ? 'flex-row-reverse' : '',
              ].join(' ')}
            >
              {/* Save Preferences */}
              <button
                ref={lastFocusRef}
                onClick={handleSavePrefs}
                className={[
                  'min-h-[44px] rounded-xl px-5 py-2 text-sm font-semibold',
                  'bg-[var(--color-accent)] text-white',
                  'hover:bg-[var(--color-accent-500)] active:bg-[var(--color-accent-600)]',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-accent)]',
                  'shadow-sm',
                ].join(' ')}
              >
                {t.savePrefs}
              </button>

              {/* Accept All */}
              <button
                onClick={handleAcceptAll}
                className={[
                  'min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium',
                  'border border-[var(--color-primary)]',
                  'text-[var(--color-primary)] bg-transparent',
                  'hover:bg-[var(--color-primary-50)]',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                ].join(' ')}
              >
                {t.acceptAll}
              </button>

              {/* Reject All */}
              <button
                onClick={handleRejectAll}
                className={[
                  'min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium',
                  'border border-[var(--color-outline-variant)]',
                  'text-[var(--color-text)] bg-transparent',
                  'hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                ].join(' ')}
              >
                {t.rejectAll}
              </button>

              {/* Privacy link */}
              <a
                href={privacyHref}
                className={[
                  'text-sm text-[var(--color-primary)] underline underline-offset-2',
                  'hover:text-[var(--color-accent)] transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-sm',
                  isRtl ? 'mr-auto' : 'ml-auto',
                ].join(' ')}
              >
                {t.privacy}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Category row sub-component ───────────────────────────────────────────────

interface CategoryRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  alwaysOnLabel?: string;
  isRtl: boolean;
  onChange: (value: boolean) => void;
}

function CategoryRow({
  id,
  label,
  description,
  checked,
  disabled = false,
  alwaysOnLabel,
  isRtl,
  onChange,
}: CategoryRowProps) {
  return (
    <div
      className={[
        'flex items-start gap-4 py-4',
        isRtl ? 'flex-row-reverse' : 'flex-row',
      ].join(' ')}
    >
      {/* Text */}
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[var(--color-text)] cursor-pointer"
        >
          {label}
        </label>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-neutral-600)]">
          {description}
        </p>
      </div>

      {/* Toggle or "always on" badge */}
      {disabled ? (
        <span
          className={[
            'shrink-0 self-center rounded-full px-2.5 py-1',
            'text-xs font-medium',
            'bg-[var(--color-primary-50)] text-[var(--color-primary)]',
          ].join(' ')}
        >
          {alwaysOnLabel}
        </span>
      ) : (
        <div className="shrink-0 self-center">
          <ToggleSwitch
            id={id}
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            label={label}
          />
        </div>
      )}
    </div>
  );
}
