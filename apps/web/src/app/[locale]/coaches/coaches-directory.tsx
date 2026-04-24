'use client';

import Image from 'next/image';
import { useState, useMemo } from 'react';
import type { TeamMember } from '@kunacademy/cms';
import { Card } from '@kunacademy/ui/card';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { KUN_LEVELS } from '@kunacademy/db/enums';

interface Props {
  coaches: TeamMember[];
  locale: string;
}

// ── Kun Level display map ─────────────────────────────────────────────────────

// Canon Phase 2 (2026-04-24): L3/L4 labels swapped in the display register.
// DB values unchanged. `expert` → "Master Coach", `master` → "Expert Coach".
// See apps/web/src/lib/coach-tier-labels.ts for the canonical helper.
const KUN_LEVEL_ENTRIES = [
  { value: 'basic',        ar: 'كوتش مساعد',        en: 'Associate Coach'     },
  { value: 'professional', ar: 'كوتش محترف',        en: 'Professional Coach'  },
  { value: 'expert',       ar: 'كوتش ماستر',        en: 'Master Coach'        },
  { value: 'master',       ar: 'كوتش خبير',         en: 'Expert Coach'        },
] as const;

// Color hierarchy follows NEW canon tier rank.
//   DB master (now displays "Expert", AED 800, highest tier) → amber
//   DB expert (now displays "Master", AED 600)               → purple
const KUN_LEVEL_COLORS: Record<string, string> = {
  basic:        'bg-green-100 text-green-800',
  professional: 'bg-blue-100 text-blue-800',
  expert:       'bg-purple-100 text-purple-800',
  master:       'bg-amber-100 text-amber-800',
};

function getLevelLabel(level: string, isAr: boolean): string {
  const entry = KUN_LEVEL_ENTRIES.find((l) => l.value === level);
  if (!entry) return level;
  return isAr ? entry.ar : entry.en;
}

// ── Fixed development types (spec-defined, not derived from data) ─────────────

const DEV_TYPES = [
  { value: 'تنمية ذاتية',    ar: 'تنمية ذاتية',    en: 'Self Development'     },
  { value: 'استكشاف طريقك',  ar: 'استكشاف طريقك',  en: 'Career Exploration'   },
  { value: 'تنمية علاقات',   ar: 'تنمية علاقات',   en: 'Relationship Growth'  },
  { value: 'تنمية عائلية',   ar: 'تنمية عائلية',   en: 'Family Development'   },
  { value: 'تنمية مهنية',    ar: 'تنمية مهنية',    en: 'Professional Growth'  },
] as const;

// ── Fixed coaching styles (spec-defined) ──────────────────────────────────────

const COACHING_STYLES = [
  { value: 'داعم',    ar: 'داعم',    en: 'Supportive'     },
  { value: 'حسّي',    ar: 'حسّي',    en: 'Somatic'        },
  { value: 'عميق',    ar: 'عميق',    en: 'Deep'           },
  { value: 'مواجه',   ar: 'مواجه',   en: 'Confrontational'},
  { value: 'عملي',    ar: 'عملي',    en: 'Practical'      },
  // Also match English variants stored in coaching_styles
  { value: 'Somatic Thinking', ar: 'حسّي', en: 'Somatic' },
] as const;

// Normalise a raw coaching_style value to a canonical spec key for display
function normaliseStyle(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('somatic') || lower.includes('حسّي') || lower.includes('حسي')) return 'حسّي';
  if (lower === 'داعم' || lower === 'supportive') return 'داعم';
  if (lower === 'عميق' || lower === 'deep') return 'عميق';
  if (lower === 'مواجه' || lower === 'confrontational') return 'مواجه';
  if (lower === 'عملي' || lower === 'practical') return 'عملي';
  return raw;
}

// ── Chip component ─────────────────────────────────────────────────────────────

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200
        min-h-[36px] whitespace-nowrap
        ${active
          ? 'bg-[var(--color-primary)] text-white shadow-sm'
          : 'bg-white border border-[var(--color-neutral-200)] text-[var(--text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
        }
      `}
    >
      {label}
    </button>
  );
}

// ── Filter section with collapsible behaviour on mobile ───────────────────────

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      {/* Mobile toggle */}
      <button
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-neutral-500)] mb-2 md:cursor-default"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {label}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 md:hidden ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        className={`flex flex-wrap gap-2 overflow-hidden transition-all duration-200 ${open ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0 md:max-h-[200px] md:opacity-100'}`}
      >
        {children}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CoachesDirectory({ coaches, locale }: Props) {
  const isAr = locale === 'ar';

  // Filter state
  const [level, setLevel]   = useState('');
  const [devType, setDevType] = useState('');
  const [style, setStyle]   = useState('');

  // Determine which Kun levels actually exist in the data
  const availableLevels = useMemo(() => {
    const set = new Set<string>();
    coaches.forEach((c) => { if (c.kun_level) set.add(c.kun_level); });
    return KUN_LEVEL_ENTRIES.filter((l) => set.has(l.value));
  }, [coaches]);

  // Determine which dev types have at least one coach
  const availableDevTypes = useMemo(() => {
    const coachSpecialties = new Set<string>();
    coaches.forEach((c) => c.specialties?.forEach((s) => coachSpecialties.add(s)));
    return DEV_TYPES.filter((dt) => coachSpecialties.has(dt.value));
  }, [coaches]);

  // Determine which coaching styles have at least one coach
  const availableStyles = useMemo(() => {
    const normalised = new Set<string>();
    coaches.forEach((c) =>
      c.coaching_styles?.forEach((s) => normalised.add(normaliseStyle(s)))
    );
    // Only show the 5 canonical spec styles that actually appear
    return COACHING_STYLES.filter(
      (cs, idx, arr) =>
        // deduplicate canonical values (Somatic Thinking merges into حسّي)
        arr.findIndex((x) => x.ar === cs.ar) === idx &&
        normalised.has(cs.value)
    );
  }, [coaches]);

  // Filter coaches with AND logic
  const filtered = useMemo(() => {
    return coaches.filter((c) => {
      if (level && c.kun_level !== level) return false;
      if (devType && !c.specialties?.includes(devType)) return false;
      if (style) {
        const normalisedStyles = c.coaching_styles?.map(normaliseStyle) ?? [];
        if (!normalisedStyles.includes(style)) return false;
      }
      return true;
    });
  }, [coaches, level, devType, style]);

  const hasFilters = !!(level || devType || style);

  const clearAll = () => { setLevel(''); setDevType(''); setStyle(''); };

  const showLevelFilter    = availableLevels.length > 0;
  const showDevTypeFilter  = availableDevTypes.length > 0;
  const showStyleFilter    = availableStyles.length > 0;
  const showFilters        = showLevelFilter || showDevTypeFilter || showStyleFilter;

  return (
    <div>
      {/* ── Filter panel ──────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="mb-8 rounded-2xl border border-[var(--color-neutral-100)] bg-[var(--color-surface-low)] p-5 space-y-5">

          {/* Kun Level */}
          {showLevelFilter && (
            <FilterRow label={isAr ? 'المستوى' : 'Level'}>
              <Chip
                label={isAr ? 'الكل' : 'All'}
                active={level === ''}
                onClick={() => setLevel('')}
              />
              {availableLevels.map((l) => (
                <Chip
                  key={l.value}
                  label={isAr ? l.ar : l.en}
                  active={level === l.value}
                  onClick={() => setLevel(level === l.value ? '' : l.value)}
                />
              ))}
            </FilterRow>
          )}

          {/* Development Type */}
          {showDevTypeFilter && (
            <FilterRow label={isAr ? 'نوع التطوّر' : 'Focus Area'}>
              <Chip
                label={isAr ? 'الكل' : 'All'}
                active={devType === ''}
                onClick={() => setDevType('')}
              />
              {availableDevTypes.map((dt) => (
                <Chip
                  key={dt.value}
                  label={isAr ? dt.ar : dt.en}
                  active={devType === dt.value}
                  onClick={() => setDevType(devType === dt.value ? '' : dt.value)}
                />
              ))}
            </FilterRow>
          )}

          {/* Coaching Style */}
          {showStyleFilter && (
            <FilterRow label={isAr ? 'أسلوب الكوتشينج' : 'Coaching Style'}>
              <Chip
                label={isAr ? 'الكل' : 'All'}
                active={style === ''}
                onClick={() => setStyle('')}
              />
              {availableStyles.map((cs) => (
                <Chip
                  key={cs.value}
                  label={isAr ? cs.ar : cs.en}
                  active={style === cs.value}
                  onClick={() => setStyle(style === cs.value ? '' : cs.value)}
                />
              ))}
            </FilterRow>
          )}

          {/* Clear filters */}
          {hasFilters && (
            <div className="pt-1 border-t border-[var(--color-neutral-100)]">
              <button
                onClick={clearAll}
                className="text-sm text-[var(--color-primary)] hover:underline min-h-[36px]"
              >
                {isAr ? 'مسح الفلاتر' : 'Clear all filters'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Results count ────────────────────────────────────────────────── */}
      {hasFilters && (
        <p className="text-sm text-[var(--color-neutral-500)] mb-4">
          {isAr
            ? `${filtered.length} كوتش`
            : `${filtered.length} coach${filtered.length !== 1 ? 'es' : ''}`}
        </p>
      )}

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((coach) => {
            const name  = isAr ? coach.name_ar : coach.name_en;
            const title = isAr ? coach.title_ar : coach.title_en;

            return (
              <a key={coach.slug} href={`/${locale}/coaches/${coach.slug}`} className="group">
                <Card accent className="p-6 h-full transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] group-hover:-translate-y-1">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="relative shrink-0 h-16 w-16 rounded-full overflow-hidden bg-[var(--color-neutral-100)]">
                      {coach.photo_url ? (
                        <Image
                          src={coach.photo_url}
                          alt={name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-[var(--color-neutral-400)]">
                          {name.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                        {name}
                      </h3>
                      {title && (
                        <p className="text-sm text-[var(--color-neutral-600)] mt-0.5 line-clamp-1">{title}</p>
                      )}
                      {coach.kun_level && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mt-2 ${KUN_LEVEL_COLORS[coach.kun_level] ?? 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'}`}
                        >
                          {getLevelLabel(coach.kun_level, isAr)}
                        </span>
                      )}
                      {/* ICF credential badge */}
                      {coach.icf_credential && coach.icf_credential !== 'none' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium ml-1">
                          {coach.icf_credential.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Specialties */}
                  {coach.specialties?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {coach.specialties.slice(0, 3).map((s) => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)] font-medium">
                          {s}
                        </span>
                      ))}
                      {coach.specialties.length > 3 && (
                        <span className="text-xs text-[var(--color-neutral-500)]">
                          +{coach.specialties.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Coaching styles (if any) */}
                  {coach.coaching_styles?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {coach.coaching_styles.slice(0, 2).map((cs) => (
                        <span key={cs} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-secondary-50)] text-[var(--color-secondary-600)] font-medium">
                          {cs}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Languages */}
                  {coach.languages?.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-[var(--color-neutral-500)]">
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                        <path d="M3.6 9h16.8M3.6 15h16.8" />
                      </svg>
                      {coach.languages.join(' · ')}
                    </div>
                  )}

                  {/* CTA */}
                  <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)]">
                    <span className="text-sm font-medium text-[var(--color-accent)] group-hover:text-[var(--color-accent-500)] transition-colors">
                      {isAr ? 'عرض الملف الشخصي' : 'View Profile'}{' '}
                      <ArrowRight className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" />
                    </span>
                  </div>
                </Card>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'لا يوجد كوتشز بهذه المعايير' : 'No coaches match these filters'}
          </p>
          <button
            onClick={clearAll}
            className="mt-3 text-sm text-[var(--color-primary)] hover:underline"
          >
            {isAr ? 'مسح الفلاتر' : 'Clear filters'}
          </button>
        </div>
      )}
    </div>
  );
}
