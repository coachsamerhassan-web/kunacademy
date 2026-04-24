'use client';

/**
 * TierGrandfatherBanner
 *
 * Coach-facing informational banner for the Canon Phase 2 label swap
 * (2026-04-24 → 2026-05-24). Renders ONLY when:
 *   - the authenticated coach's `kun_level` is one of the swapped tiers
 *     (`expert` → new "Master", `master` → new "Expert"), AND
 *   - the current date is on or before the grandfather-end deadline.
 *
 * After the grandfather window closes, the banner returns null and the
 * canonical label displays alone on every downstream surface. No redeploy
 * needed — the date-gate in `coach-tier-labels.ts` handles expiry cleanly.
 *
 * L1 (Associate) + L2 (Professional) coaches NEVER see this banner —
 * their labels did not swap.
 *
 * Self-fetches the logged-in coach's instructor row from `/api/coach/profile`
 * so it can be dropped into any coach-authenticated page without prop-drilling
 * the tier value. For authenticated non-coach users the endpoint returns
 * `{ instructor: null }` (200) and the banner renders nothing.
 *
 * Bilingual:
 *   - AR line is fully Arabic; no inline English label tokens
 *     (per feedback_arabic_english_bidi_mixing.md).
 *   - Date format 2026-05-24 Gregorian-MSA
 *     (per feedback_arabic_calendar_rules.md).
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@kunacademy/auth';
import {
  getDualLabel,
  inGrandfatherWindow,
  isSwappedLevel,
  formatGrandfatherEndDate,
} from '@/lib/coach-tier-labels';

interface Props {
  /** Locale inherited from the page — avoids a second hook to resolve it. */
  locale: string;
}

export function TierGrandfatherBanner({ locale }: Props) {
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [kunLevel, setKunLevel] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    // Only fetch if a user is logged in. The endpoint is coach-auth-gated
    // and returns { instructor: null } for non-coach authenticated users;
    // we still treat that as "no banner".
    if (!user) {
      setKunLevel(null);
      return;
    }
    let cancelled = false;
    fetch('/api/coach/profile')
      .then((r) => (r.ok ? r.json() : { instructor: null }))
      .then((data) => {
        if (cancelled) return;
        setKunLevel(data?.instructor?.kun_level ?? null);
      })
      .catch(() => {
        if (!cancelled) setKunLevel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Don't render ANYTHING while we're still loading — no placeholder flash.
  if (kunLevel === undefined) return null;

  // Post-grandfather: global no-op. L1/L2: per-coach no-op.
  if (!inGrandfatherWindow()) return null;
  if (!isSwappedLevel(kunLevel)) return null;

  const { current, previous } = getDualLabel(kunLevel, isAr);
  // Guard: getDualLabel returns previous: null when not in the swap set.
  // We already checked isSwappedLevel above, so this is belt-and-suspenders.
  if (!previous) return null;

  const deadline = formatGrandfatherEndDate(isAr ? 'ar' : 'en');

  const bannerText = isAr
    ? `مرتبتك: ${current} (سابقًا: ${previous} — تنتهي فترة الانتقال ${deadline})`
    : `Your tier: ${current} (previously: ${previous} — grandfather ends ${deadline})`;

  const a11yLabel = isAr ? 'إشعار تحديث تسمية المرتبة' : 'Tier label update notice';

  return (
    <div
      role="status"
      aria-label={a11yLabel}
      className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      data-testid="tier-grandfather-banner"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <p
          className="flex-1 leading-relaxed"
          style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}
        >
          {bannerText}
        </p>
      </div>
    </div>
  );
}

export default TierGrandfatherBanner;
