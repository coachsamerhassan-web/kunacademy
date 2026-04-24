/**
 * Canonical coach-tier label register + Canon Phase 2 grandfather helpers.
 *
 * Canon Phase 2 (2026-04-24) renamed two tier labels in the English register:
 *   - DB `kun_level = 'expert'`  (old L3, AED 600/session) → new display label "Master"
 *   - DB `kun_level = 'master'`  (old L4, AED 800/session) → new display label "Expert"
 *
 * DB values themselves are UNCHANGED. Only the human-facing labels changed.
 * L1 (`basic` → "Associate") and L2 (`professional` → "Professional")
 * do not swap — they do not need grandfather treatment.
 *
 * Sources:
 *   - /Project Memory/KUN-Features/PROGRAM-CANON.md §775 (register mapping)
 *   - Sani micro-wave dispatch 2026-04-24 (30-day grandfather window spec)
 *   - feedback_arabic_english_bidi_mixing.md (Arabic banner stays fully Arabic)
 *   - feedback_arabic_calendar_rules.md (Gregorian-MSA dates)
 *
 * After GRANDFATHER_END_DATE, the `inGrandfatherWindow()` gate returns false
 * everywhere → only the new label renders. No code redeploy needed; the date
 * gate handles expiry cleanly.
 */

import { KUN_LEVELS, type KunLevel } from '@kunacademy/db/enums';

// ─── Grandfather window constants ────────────────────────────────────────────

/**
 * Canon Phase 2 label swap took effect 2026-04-24.
 * Grandfather window: 30 days ending 2026-05-24 (inclusive).
 * After this date, dual-label banner + "(previously: …)" suffix disappear.
 */
export const GRANDFATHER_START_DATE = '2026-04-24';
export const GRANDFATHER_END_DATE = '2026-05-24';

/**
 * `new Date()` is the default — callers in tests can inject a fixed Date.
 * SSR-safe: pure function, no browser APIs.
 */
export function inGrandfatherWindow(now: Date = new Date()): boolean {
  // Use ISO date strings (UTC-anchored) for comparison. A coach in UTC+12 seeing
  // 2026-05-25 00:30 local would still be 2026-05-24 12:30 UTC — banner still shows.
  // One UTC day (24h) after 2026-05-24 23:59:59.999Z the banner disappears globally.
  const end = new Date(`${GRANDFATHER_END_DATE}T23:59:59.999Z`);
  return now.getTime() <= end.getTime();
}

// ─── Tier label registers ────────────────────────────────────────────────────

/**
 * Current (Canon Phase 2) labels. These are what every downstream surface
 * renders by default. L3/L4 labels swapped vs pre-2026-04-24.
 */
export const TIER_LABELS_CURRENT: Record<KunLevel, { ar: string; en: string }> = {
  basic:        { ar: 'مساعد',   en: 'Associate'    },
  professional: { ar: 'محترف',    en: 'Professional' },
  // Canon Phase 2: DB `expert` (old L3, AED 600) now displays as "Master"
  expert:       { ar: 'ماستر',    en: 'Master'       },
  // Canon Phase 2: DB `master` (old L4, AED 800) now displays as "Expert"
  master:       { ar: 'خبير',     en: 'Expert'       },
};

/**
 * Pre-Canon-Phase-2 labels. ONLY used during the grandfather window on
 * coach-facing surfaces where the coach needs to recognise the old name.
 * After grandfather expires, this register is unused.
 */
export const TIER_LABELS_PREVIOUS: Record<KunLevel, { ar: string; en: string }> = {
  basic:        { ar: 'أساسي',    en: 'Basic'        },
  professional: { ar: 'محترف',    en: 'Professional' },
  expert:       { ar: 'خبير',     en: 'Expert'       },
  master:       { ar: 'ماستر',    en: 'Master'       },
};

/**
 * Longer-form labels with "Coach" suffix. Used in directory cards + coach
 * detail pages (`coaches-directory.tsx`, `coaches/[slug]/page.tsx`).
 * Grandfather swap rule applies identically to the plain labels above.
 */
export const TIER_LABELS_CURRENT_WITH_SUFFIX: Record<KunLevel, { ar: string; en: string }> = {
  basic:        { ar: 'كوتش مساعد',  en: 'Associate Coach'    },
  professional: { ar: 'كوتش محترف',  en: 'Professional Coach' },
  expert:       { ar: 'كوتش ماستر',  en: 'Master Coach'       },
  master:       { ar: 'كوتش خبير',   en: 'Expert Coach'       },
};

export const TIER_LABELS_PREVIOUS_WITH_SUFFIX: Record<KunLevel, { ar: string; en: string }> = {
  basic:        { ar: 'كوتش أساسي',  en: 'Basic Coach'        },
  professional: { ar: 'كوتش محترف',  en: 'Professional Coach' },
  expert:       { ar: 'كوتش خبير',   en: 'Expert Coach'       },
  master:       { ar: 'كوتش ماستر',  en: 'Master Coach'       },
};

// ─── Public helpers ──────────────────────────────────────────────────────────

/**
 * Valid KUN_LEVELS that were affected by the Canon Phase 2 swap.
 * Only these trigger the grandfather banner. L1+L2 do NOT show the banner.
 */
const SWAPPED_LEVELS: readonly KunLevel[] = ['expert', 'master'];

export function isSwappedLevel(level: string | null | undefined): level is KunLevel {
  return typeof level === 'string' && (SWAPPED_LEVELS as readonly string[]).includes(level);
}

export function isValidKunLevel(level: string | null | undefined): level is KunLevel {
  return typeof level === 'string' && (KUN_LEVELS as readonly string[]).includes(level);
}

/**
 * Resolve the current-canon label for a DB kun_level value.
 * Falls back to the raw string if the level is unrecognised.
 */
export function getTierLabel(
  level: string | null | undefined,
  isAr: boolean,
  options: { withSuffix?: boolean } = {},
): string {
  if (!isValidKunLevel(level)) return level ?? '';
  const register = options.withSuffix ? TIER_LABELS_CURRENT_WITH_SUFFIX : TIER_LABELS_CURRENT;
  return isAr ? register[level].ar : register[level].en;
}

/**
 * Resolve the pre-Canon-Phase-2 label. Only meaningful for `expert`/`master`
 * where the label swapped; L1+L2 return the same string as `getTierLabel`.
 */
export function getTierLabelPrevious(
  level: string | null | undefined,
  isAr: boolean,
  options: { withSuffix?: boolean } = {},
): string {
  if (!isValidKunLevel(level)) return level ?? '';
  const register = options.withSuffix ? TIER_LABELS_PREVIOUS_WITH_SUFFIX : TIER_LABELS_PREVIOUS;
  return isAr ? register[level].ar : register[level].en;
}

/**
 * Dual-label display for admin/coach surfaces during the grandfather window.
 *   - Returns `{ current, previous: string }` when grandfather active AND level
 *     is a swapped tier (L3/L4).
 *   - Returns `{ current, previous: null }` otherwise (single label path).
 */
export function getDualLabel(
  level: string | null | undefined,
  isAr: boolean,
  options: { withSuffix?: boolean; now?: Date } = {},
): { current: string; previous: string | null } {
  const current = getTierLabel(level, isAr, options);
  const inWindow = inGrandfatherWindow(options.now);
  if (!inWindow || !isSwappedLevel(level)) {
    return { current, previous: null };
  }
  const previous = getTierLabelPrevious(level, isAr, options);
  // Defensive: if for some reason the registers collided and produced the
  // same string, suppress the duplicate "(previously: X)" suffix.
  if (previous === current) return { current, previous: null };
  return { current, previous };
}

/**
 * Formatted date string for the grandfather-end deadline in the chosen locale.
 * Per feedback_arabic_calendar_rules.md: Gregorian-MSA dates (numeric form),
 * not Levantine month names, not Hijri. Both locales render 2026-05-24.
 */
export function formatGrandfatherEndDate(locale: 'ar' | 'en'): string {
  // Numeric ISO date is culturally neutral and matches the tiered-admin scope
  // which specifies 2026-05-24 directly in both banner strings.
  // Intl.DateTimeFormat with `ar-EG` would emit Arabic-Indic numerals which
  // mixes digit systems inside a pure-Arabic string — we keep Latin numerals
  // so BiDi rendering stays clean (per feedback_arabic_english_bidi_mixing.md
  // the concern is mixed sentences, not mixed digits in a fully Arabic phrase;
  // Latin numerals in Arabic are canonical for dates in modern MSA).
  return GRANDFATHER_END_DATE;
}
