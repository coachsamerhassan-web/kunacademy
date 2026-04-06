'use client';

import type { TeamMember, Service, ServiceCategory } from '@kunacademy/cms';

// ── Level hierarchies ────────────────────────────────────────────────────────

/** Kun internal levels, ordered low → high */
const KUN_LEVELS: string[] = ['basic', 'professional', 'expert', 'master'];

/** ICF credential levels, ordered low → high */
const ICF_LEVELS: string[] = ['ACC', 'PCC', 'MCC'];

/**
 * Returns the numeric rank of a level string within its hierarchy.
 * Returns -1 if not found in either hierarchy.
 */
function levelRank(level: string): { rank: number; hierarchy: string[] } | null {
  const kunIdx = KUN_LEVELS.indexOf(level);
  if (kunIdx !== -1) return { rank: kunIdx, hierarchy: KUN_LEVELS };
  const icfIdx = ICF_LEVELS.indexOf(level);
  if (icfIdx !== -1) return { rank: icfIdx, hierarchy: ICF_LEVELS };
  return null;
}

/**
 * Resolve effective coach level string for a given TeamMember.
 * Prefers kun_level if present, falls back to coach_level.
 */
function coachEffectiveLevel(coach: TeamMember): string | null {
  return coach.kun_level ?? coach.coach_level ?? null;
}

/**
 * Determine whether a coach qualifies for a given service.
 */
function coachQualifies(coach: TeamMember, service: Service): boolean {
  const { coach_level_exact, coach_level_min } = service;

  // Neither constraint → any coach qualifies
  if (!coach_level_exact && !coach_level_min) return true;

  const effectiveLevel = coachEffectiveLevel(coach);
  if (!effectiveLevel) return false;

  // Exact match takes priority
  if (coach_level_exact) {
    return effectiveLevel === coach_level_exact;
  }

  // Minimum level check (coach must be at or above)
  if (coach_level_min) {
    const coachInfo = levelRank(effectiveLevel);
    const minInfo = levelRank(coach_level_min);

    // If both resolve to the same hierarchy, compare ranks
    if (coachInfo && minInfo && coachInfo.hierarchy === minInfo.hierarchy) {
      return coachInfo.rank >= minInfo.rank;
    }

    // Cross-hierarchy or unknown level — fall back to exact match check
    return effectiveLevel === coach_level_min;
  }

  return false;
}

// ── Category display config ──────────────────────────────────────────────────

const CATEGORIES: ServiceCategory[] = ['seeker', 'coaching', 'mentoring', 'package'];

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  seeker: 'Seeker',
  coaching: 'Coaching',
  mentoring: 'Mentoring',
  package: 'Package',
  student: 'Student',
  corporate: 'Corporate',
};

const CATEGORY_COLORS: Record<ServiceCategory, string> = {
  seeker: 'bg-blue-50 text-blue-700',
  coaching: 'bg-emerald-50 text-emerald-700',
  mentoring: 'bg-purple-50 text-purple-700',
  package: 'bg-amber-50 text-amber-700',
  student: 'bg-pink-50 text-pink-700',
  corporate: 'bg-slate-50 text-slate-700',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface ServicesMatrixProps {
  coaches: TeamMember[];
  services: Service[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function ServicesMatrix({ coaches, services }: ServicesMatrixProps) {
  // Sort coaches by display_order
  const sortedCoaches = [...coaches].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  // Group services by category, preserving display_order within each group
  const grouped = CATEGORIES.reduce<Record<ServiceCategory, Service[]>>(
    (acc, cat) => {
      acc[cat] = services
        .filter(s => s.category === cat)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      return acc;
    },
    {} as Record<ServiceCategory, Service[]>,
  );

  // Pre-compute eligibility matrix: eligibility[serviceSlug][coachSlug] = boolean
  const eligibility: Record<string, Record<string, boolean>> = {};
  for (const service of services) {
    eligibility[service.slug] = {};
    for (const coach of sortedCoaches) {
      eligibility[service.slug][coach.slug] = coachQualifies(coach, service);
    }
  }

  // Per-coach totals
  const coachTotals: Record<string, number> = {};
  for (const coach of sortedCoaches) {
    coachTotals[coach.slug] = services.filter(s => eligibility[s.slug][coach.slug]).length;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
      <table className="text-sm border-collapse">
        <thead>
          {/* Coach name headers — rotated for space efficiency */}
          <tr className="bg-[var(--color-neutral-50)]">
            {/* Sticky corner cell */}
            <th
              className="sticky left-0 z-20 bg-[var(--color-neutral-50)] border-b border-r border-[var(--color-neutral-200)] px-4 py-3 text-left font-medium text-[var(--color-neutral-500)] min-w-[220px] whitespace-nowrap"
            >
              Service
            </th>
            <th
              className="sticky left-0 z-20 bg-[var(--color-neutral-50)] border-b border-r border-[var(--color-neutral-200)] px-3 py-3 text-center font-medium text-[var(--color-neutral-500)] min-w-[80px] whitespace-nowrap"
              style={{ left: '220px' }}
            >
              Level req.
            </th>
            {sortedCoaches.map(coach => (
              <th
                key={coach.slug}
                className="border-b border-[var(--color-neutral-200)] px-2 py-3 text-center font-medium text-[var(--color-neutral-600)] min-w-[52px]"
              >
                {/* Rotated name */}
                <div
                  className="inline-block whitespace-nowrap"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: 120 }}
                  title={coach.name_en}
                >
                  <span>{coach.name_en.split(' ')[0]}</span>
                  {' '}
                  <span className="text-[var(--color-neutral-400)]">{coach.name_en.split(' ').slice(1).join(' ')}</span>
                </div>
                {/* ICF level badge */}
                <div className="mt-1 text-[10px] font-normal text-[var(--color-neutral-400)]">
                  {coachEffectiveLevel(coach) ?? '—'}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {CATEGORIES.map(category => {
            const categoryServices = grouped[category];
            if (!categoryServices || categoryServices.length === 0) return null;

            return (
              <>
                {/* Category separator row */}
                <tr key={`header-${category}`}>
                  <td
                    colSpan={2 + sortedCoaches.length}
                    className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wide border-y border-[var(--color-neutral-200)] ${CATEGORY_COLORS[category]}`}
                  >
                    {CATEGORY_LABELS[category]}
                  </td>
                </tr>

                {/* Service rows */}
                {categoryServices.map((service, rowIdx) => (
                  <tr
                    key={service.slug}
                    className={`border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)] ${rowIdx % 2 === 0 ? '' : 'bg-[var(--color-neutral-50)/50]'}`}
                  >
                    {/* Service name — sticky */}
                    <td className="sticky left-0 z-10 bg-white border-r border-[var(--color-neutral-200)] px-4 py-2.5 font-medium text-[var(--text-primary)] min-w-[220px] whitespace-nowrap">
                      <div>{service.name_en}</div>
                      {service.price_aed > 0 && (
                        <div className="text-[11px] text-[var(--color-neutral-400)] font-normal">
                          {service.price_aed} AED · {service.duration_minutes} min
                        </div>
                      )}
                      {service.is_free && (
                        <div className="text-[11px] text-emerald-600 font-normal">Free</div>
                      )}
                    </td>

                    {/* Level requirement — sticky (after service name) */}
                    <td
                      className="sticky z-10 bg-white border-r border-[var(--color-neutral-200)] px-3 py-2.5 text-center whitespace-nowrap"
                      style={{ left: '220px' }}
                    >
                      {service.coach_level_exact ? (
                        <span className="inline-block rounded-full bg-purple-100 text-purple-700 text-[11px] px-2 py-0.5 font-medium">
                          = {service.coach_level_exact}
                        </span>
                      ) : service.coach_level_min ? (
                        <span className="inline-block rounded-full bg-sky-100 text-sky-700 text-[11px] px-2 py-0.5 font-medium">
                          ≥ {service.coach_level_min}
                        </span>
                      ) : (
                        <span className="text-[var(--color-neutral-400)] text-[11px]">any</span>
                      )}
                    </td>

                    {/* Eligibility cells */}
                    {sortedCoaches.map(coach => {
                      const eligible = eligibility[service.slug][coach.slug];
                      return (
                        <td
                          key={coach.slug}
                          className="px-2 py-2.5 text-center"
                          title={`${coach.name_en} × ${service.name_en}: ${eligible ? 'eligible' : 'not eligible'}`}
                        >
                          {eligible ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                              ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50 text-red-400 text-sm">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            );
          })}

          {/* Summary row: eligible service count per coach */}
          <tr className="border-t-2 border-[var(--color-neutral-300)] bg-[var(--color-neutral-50)] font-semibold">
            <td className="sticky left-0 z-10 bg-[var(--color-neutral-50)] border-r border-[var(--color-neutral-200)] px-4 py-3 text-[var(--color-neutral-600)] min-w-[220px]">
              Total eligible services
            </td>
            <td
              className="sticky z-10 bg-[var(--color-neutral-50)] border-r border-[var(--color-neutral-200)] px-3 py-3"
              style={{ left: '220px' }}
            />
            {sortedCoaches.map(coach => (
              <td
                key={coach.slug}
                className="px-2 py-3 text-center text-[var(--color-primary)] font-bold"
              >
                {coachTotals[coach.slug]}
                <div className="text-[10px] font-normal text-[var(--color-neutral-400)]">/ {services.length}</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
