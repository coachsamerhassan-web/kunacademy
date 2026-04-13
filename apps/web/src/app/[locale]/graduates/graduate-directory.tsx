'use client';

import Image from 'next/image';
import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { Card } from '@kunacademy/ui/card';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GraduateBadge {
  badge_slug:      string;
  badge_label_ar:  string;
  badge_label_en:  string;
  image_url:       string | null;
  program_slug:    string;
  graduation_date: string | null;
  icf_credential:  string | null;
}

interface Graduate {
  id:              string;
  slug:            string;
  name_ar:         string;
  name_en:         string;
  photo_url:       string | null;
  country:         string | null;
  member_type:     string;
  coaching_status: string | null;
  badges:          GraduateBadge[];
}

interface DirectoryData {
  graduates:     Graduate[];
  total:         number;
  totalPages:    number;
  programCounts: Record<string, number>;
}

interface Props {
  locale:      string;
  initialData: DirectoryData;
}

// ── Country flag helper ────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  'UAE':          '🇦🇪',
  'Saudi Arabia': '🇸🇦',
  'Egypt':        '🇪🇬',
  'Jordan':       '🇯🇴',
  'Kuwait':       '🇰🇼',
  'Qatar':        '🇶🇦',
  'Bahrain':      '🇧🇭',
  'Oman':         '🇴🇲',
  'Lebanon':      '🇱🇧',
  'Morocco':      '🇲🇦',
  'Tunisia':      '🇹🇳',
  'Libya':        '🇱🇾',
  'Iraq':         '🇮🇶',
  'Syria':        '🇸🇾',
  'Palestine':    '🇵🇸',
  'UK':           '🇬🇧',
  'USA':          '🇺🇸',
  'Germany':      '🇩🇪',
  'France':       '🇫🇷',
  'Canada':       '🇨🇦',
  'Australia':    '🇦🇺',
  'KSA':          '🇸🇦',
  'Algeria':      '🇩🇿',
  'Colombia':     '🇨🇴',
  'Finland':      '🇫🇮',
  'Belgium':      '🇧🇪',
  'Sudan':        '🇸🇩',
  'China':        '🇨🇳',
  'Taiwan':       '🇹🇼',
};

function getFlag(country: string | null): string {
  if (!country) return '';
  const primary = country.split(',')[0].trim();
  return COUNTRY_FLAGS[primary] ?? '';
}

// ── Gradient palette for initials avatars ─────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-amber-400 to-orange-500',
  'from-yellow-400 to-amber-500',
  'from-orange-400 to-red-500',
  'from-amber-500 to-yellow-600',
  'from-yellow-500 to-orange-600',
];

function getGradient(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// ── Category + Program filters ────────────────────────────────────────────────

const CATEGORIES = [
  {
    slug: 'certified-coaches',
    ar: 'كوتشز معتمدون',
    en: 'Certified Coaches',
    programs: ['stce-stic', 'stce-staic', 'stce-stgc', 'stce-stoc', 'manhajak'],
  },
  {
    slug: 'program-graduates',
    ar: 'خريجو البرامج',
    en: 'Program Graduates',
    programs: ['impact-engineering', 'gps', 'ihya'],
  },
  {
    slug: 'workshop-alumni',
    ar: 'خريجو الورش',
    en: 'Workshop Alumni',
    programs: ['mini-course', 'retreat', 'open-day'],
  },
];

const PROGRAMS_BY_CATEGORY: Record<string, Array<{ slug: string; ar: string; en: string }>> = {
  'certified-coaches': [
    { slug: 'stce-stic',  ar: 'كوتش أفراد',       en: 'Individual Coach' },
    { slug: 'stce-staic', ar: 'كوتش أفراد متقدم', en: 'Advanced Individual Coach' },
    { slug: 'stce-stgc',  ar: 'كوتش مجموعات',     en: 'Group Coach' },
    { slug: 'stce-stoc',  ar: 'كوتش مؤسسات',      en: 'Organisational Coach' },
    { slug: 'manhajak',   ar: 'مبتكر منهجية',     en: 'Methodology Creator' },
  ],
  'program-graduates': [
    { slug: 'impact-engineering', ar: 'هندسة التأثير',  en: 'Impact Engineering' },
    { slug: 'gps',               ar: 'بوصلة الحياة',   en: 'GPS of Life' },
    { slug: 'ihya',              ar: 'إحياء',           en: 'Ihya' },
  ],
  'workshop-alumni': [
    { slug: 'mini-course', ar: 'دورة قصيرة',  en: 'Mini Course' },
    { slug: 'retreat',     ar: 'خلوة',         en: 'Retreat' },
    { slug: 'open-day',   ar: 'يوم مفتوح',    en: 'Open Day' },
  ],
};

// ── ICF credential helper ────────────────────────────────────────────────────

const ICF_RANK: Record<string, number> = { ACC: 1, PCC: 2, MCC: 3 };
const ICF_IMAGES: Record<string, string> = {
  ACC: '/images/badges/icf-acc.png',
  PCC: '/images/badges/icf-pcc.png',
  MCC: '/images/badges/icf-mcc.png',
};

function getHighestIcf(badges: GraduateBadge[]): { credential: string; image: string } | null {
  let best: string | null = null;
  for (const b of badges) {
    const cred = b.icf_credential?.toUpperCase();
    if (cred && ICF_RANK[cred]) {
      if (!best || ICF_RANK[cred] > ICF_RANK[best]) {
        best = cred;
      }
    }
  }
  if (!best) return null;
  return { credential: best, image: ICF_IMAGES[best] };
}

// ── Chip component ────────────────────────────────────────────────────────────

function Chip({
  label,
  active,
  onClick,
}: {
  label:   string;
  active:  boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200
        min-h-[36px] whitespace-nowrap
        ${active
          ? 'bg-amber-500 text-white shadow-sm'
          : 'bg-white border border-[var(--color-neutral-200)] text-[var(--text-primary)] hover:border-amber-400 hover:text-amber-700'
        }
      `}
    >
      {label}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

/** Map API response (certificates) to component shape (badges) */
function mapApiData(raw: any): DirectoryData {
  return {
    total: raw?.total ?? 0,
    totalPages: raw?.totalPages ?? 0,
    programCounts: raw?.programCounts ?? {},
    graduates: (raw?.graduates ?? []).map((g: any) => ({
      ...g,
      badges: (g.certificates ?? g.badges ?? []).map((c: any) => ({
        badge_slug: c.badge_slug,
        badge_label_ar: c.badge_label_ar,
        badge_label_en: c.badge_label_en,
        image_url: c.badge_image_url ?? c.image_url,
        program_slug: c.program_slug,
        graduation_date: c.graduation_date,
        icf_credential: c.icf_credential,
      })),
    })),
  };
}

export function GraduateDirectory({ locale, initialData }: Props) {
  const isAr = locale === 'ar';

  const [data,       setData]       = useState<DirectoryData>(mapApiData(initialData));
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('');
  const [program,    setProgram]    = useState('');
  const [page,       setPage]       = useState(1);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Badge enlarge overlay
  const [enlargedBadge, setEnlargedBadge] = useState<GraduateBadge | null>(null);

  // ── Fetch function ───────────────────────────────────────────────────────────

  const fetchGraduates = useCallback(
    async (searchVal: string, categoryVal: string, programVal: string, pageVal: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchVal)   params.set('search',   searchVal);
        if (programVal)  params.set('program',  programVal);
        else if (categoryVal) params.set('category', categoryVal);
        params.set('page', String(pageVal));

        const res = await fetch(`/api/graduates?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(mapApiData(json));
      } catch {
        // Keep previous data on error
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Debounced search ─────────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchGraduates(value, category, program, 1);
    }, 300);
  };

  const handleCategoryChange = (slug: string) => {
    if (category === slug) {
      // Deselect category — reset both
      setCategory('');
      setProgram('');
      setPage(1);
      fetchGraduates(search, '', '', 1);
    } else {
      setCategory(slug);
      setProgram(''); // Clear program when switching category
      setPage(1);
      fetchGraduates(search, slug, '', 1);
    }
  };

  const handleProgramChange = (slug: string) => {
    const next = program === slug ? '' : slug;
    setProgram(next);
    setPage(1);
    // If program deselected, fall back to category filter
    fetchGraduates(search, category, next, 1);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    fetchGraduates(search, category, program, nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setProgram('');
    setPage(1);
    fetchGraduates('', '', '', 1);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasFilters = !!(search || category || program);
  const { graduates, total, totalPages, programCounts } = data;

  return (
    <div>
      {/* ── Search + Filter panel ─────────────────────────────────────────── */}
      <div className="mb-8 rounded-2xl border border-[var(--color-neutral-100)] bg-[var(--color-surface-low)] p-5 space-y-5">

        {/* Search bar */}
        <div className="relative">
          <Search
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-neutral-400)] pointer-events-none
              ${isAr ? 'right-3.5' : 'left-3.5'}`}
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={isAr ? 'ابحث باسم الخريج...' : 'Search by name...'}
            className={`
              w-full rounded-xl border border-[var(--color-neutral-200)] bg-white
              py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--color-neutral-400)]
              focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400
              transition-all duration-200
              ${isAr ? 'pr-9 pl-4 text-right' : 'pl-9 pr-4'}
            `}
            dir={isAr ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Row 1: Category chips */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-neutral-500)] mb-2">
            {isAr ? 'التصنيف' : 'Category'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Chip
              label={isAr ? 'الكل' : 'All'}
              active={category === '' && program === ''}
              onClick={clearFilters}
            />
            {CATEGORIES.filter((cat) => {
              const catCount = cat.programs.reduce(
                (sum, slug) => sum + (programCounts[slug] ?? 0),
                0
              );
              return catCount > 0;
            }).map((cat) => {
              const catCount = cat.programs.reduce(
                (sum, slug) => sum + (programCounts[slug] ?? 0),
                0
              );
              return (
                <Chip
                  key={cat.slug}
                  label={`${isAr ? cat.ar : cat.en} (${catCount})`}
                  active={category === cat.slug}
                  onClick={() => handleCategoryChange(cat.slug)}
                />
              );
            })}
          </div>
        </div>

        {/* Row 2: Program chips (visible only when a category is selected) */}
        {category && PROGRAMS_BY_CATEGORY[category] && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-neutral-500)] mb-2">
              {isAr ? 'البرنامج' : 'Program'}
            </p>
            <div className="flex flex-wrap gap-2">
              {PROGRAMS_BY_CATEGORY[category]
                .filter((p) => (programCounts[p.slug] ?? 0) > 0)
                .map((p) => {
                  const count = programCounts[p.slug] ?? 0;
                  return (
                    <Chip
                      key={p.slug}
                      label={`${isAr ? p.ar : p.en} (${count})`}
                      active={program === p.slug}
                      onClick={() => handleProgramChange(p.slug)}
                    />
                  );
                })}
            </div>
          </div>
        )}

        {/* Clear filters */}
        {hasFilters && (
          <div className="pt-1 border-t border-[var(--color-neutral-100)]">
            <button
              onClick={clearFilters}
              className="text-sm text-amber-600 hover:underline min-h-[36px]"
            >
              {isAr ? 'مسح الفلاتر' : 'Clear all filters'}
            </button>
          </div>
        )}
      </div>

      {/* ── Results count ────────────────────────────────────────────────── */}
      <p className={`text-sm text-[var(--color-neutral-500)] mb-4 ${loading ? 'opacity-50' : ''}`}>
        {isAr
          ? `${total} خريج`
          : `${total} graduate${total !== 1 ? 's' : ''}`}
      </p>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {graduates.length > 0 ? (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}
        >
          {graduates.map((graduate) => {
            const name    = isAr ? graduate.name_ar : graduate.name_en;
            const initial = (graduate.name_en || graduate.name_ar).charAt(0).toUpperCase();
            const gradient = getGradient(graduate.slug);
            const flag     = getFlag(graduate.country);
            const isCoach  = graduate.member_type === 'coach' || graduate.member_type === 'both';

            // Filter out STCE level badges (duplicate module completions)
            const moduleBadges = graduate.badges.filter(
              (b: GraduateBadge) => !b.badge_slug?.startsWith('stce-level-')
            );
            const visibleBadges = moduleBadges.slice(0, 4);
            const overflowCount = Math.max(0, moduleBadges.length - 4);

            return (
              <a
                key={graduate.slug}
                href={`/${locale}/graduates/${graduate.slug}`}
                className="group"
              >
                <Card
                  accent
                  className="p-6 h-full transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(146,104,48,0.12)] group-hover:-translate-y-1"
                >
                  {/* Top row: avatar + name/country */}
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="relative shrink-0 h-14 w-14 rounded-full overflow-hidden">
                      {graduate.photo_url ? (
                        <Image
                          src={graduate.photo_url}
                          alt={name}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      ) : (
                        <div
                          className={`h-full w-full flex items-center justify-center bg-gradient-to-br ${gradient} text-white text-xl font-bold`}
                        >
                          {initial}
                        </div>
                      )}
                    </div>

                    {/* Name + country */}
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`font-bold text-base text-[var(--text-primary)] group-hover:text-amber-700 transition-colors line-clamp-2 ${isAr ? 'text-right' : ''}`}
                        dir={isAr ? 'rtl' : 'ltr'}
                      >
                        {name}
                      </h3>

                      {/* Country */}
                      {flag && (
                        <div className={`mt-1 ${isAr ? 'text-right' : ''}`}>
                          <span className="text-base leading-none cursor-default" title={graduate.country || ''}>
                            {flag}
                          </span>
                        </div>
                      )}

                      {/* Coach badge */}
                      {isCoach && graduate.coaching_status === 'active' && (
                        <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          {isAr ? 'كوتش نشط' : 'Active Coach'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges row */}
                  {graduate.badges.length > 0 && (() => {
                    const icf = getHighestIcf(graduate.badges);
                    return (
                      <div className={`flex items-center gap-2 mt-4 ${isAr ? 'flex-row-reverse' : ''}`}>
                        {visibleBadges.map((badge) =>
                          badge.image_url ? (
                            <button
                              key={badge.badge_slug}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEnlargedBadge(badge);
                              }}
                              className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden ring-2 ring-white shadow-sm cursor-pointer hover:ring-amber-300 transition-all duration-200"
                              title={isAr ? badge.badge_label_ar : badge.badge_label_en}
                            >
                              <Image
                                src={badge.image_url}
                                alt={isAr ? badge.badge_label_ar : badge.badge_label_en}
                                fill
                                className="object-contain"
                                sizes="36px"
                              />
                            </button>
                          ) : (
                            <button
                              key={badge.badge_slug}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEnlargedBadge(badge);
                              }}
                              className="h-9 w-9 shrink-0 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xs font-bold ring-2 ring-white shadow-sm cursor-pointer hover:ring-amber-300 transition-all duration-200"
                              title={isAr ? badge.badge_label_ar : badge.badge_label_en}
                            >
                              {(badge.badge_label_en || badge.badge_label_ar).charAt(0)}
                            </button>
                          )
                        )}
                        {overflowCount > 0 && (
                          <span className="text-xs text-[var(--color-neutral-500)] font-medium">
                            +{overflowCount}
                          </span>
                        )}
                        {/* ICF credential indicator — personal credential, separated from program badges */}
                        {icf && (
                          <>
                            <div className="self-stretch w-px bg-[var(--color-neutral-200)] shrink-0 mx-0.5" aria-hidden="true" />
                            <div className="flex flex-col items-center gap-0.5 shrink-0">
                              <div className="relative h-10 w-10" title={`ICF ${icf.credential}`}>
                                <Image
                                  src={icf.image}
                                  alt={`ICF ${icf.credential}`}
                                  fill
                                  className="object-contain"
                                  sizes="40px"
                                />
                              </div>
                              <span className="text-xs font-semibold text-blue-700 leading-none">{icf.credential}</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* CTA */}
                  <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)]">
                    <span className={`text-sm font-medium text-amber-600 group-hover:text-amber-700 transition-colors flex items-center gap-1 ${isAr ? 'flex-row-reverse' : ''}`}>
                      {isAr ? 'عرض الملف الشخصي' : 'View Profile'}
                      {isAr
                        ? <ArrowLeft  className="w-4 h-4" aria-hidden="true" />
                        : <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      }
                    </span>
                  </div>
                </Card>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'لا يوجد خريجون بهذه المعايير' : 'No graduates match these filters'}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-amber-600 hover:underline"
            >
              {isAr ? 'مسح الفلاتر' : 'Clear filters'}
            </button>
          )}
        </div>
      )}

      {/* ── Badge enlarge overlay ──────────────────────────────────────── */}
      {enlargedBadge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setEnlargedBadge(null)}
          role="dialog"
          aria-modal="true"
          aria-label={isAr ? enlargedBadge.badge_label_ar : enlargedBadge.badge_label_en}
        >
          <div
            className="flex flex-col items-center gap-3 animate-badge-enlarge"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Enlarged badge */}
            <div className="relative h-[120px] w-[120px] rounded-full overflow-hidden ring-4 ring-white shadow-2xl bg-white">
              {enlargedBadge.image_url ? (
                <Image
                  src={enlargedBadge.image_url}
                  alt={isAr ? enlargedBadge.badge_label_ar : enlargedBadge.badge_label_en}
                  fill
                  className="object-contain p-1"
                  sizes="120px"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-amber-100 text-amber-600 text-3xl font-bold">
                  {(enlargedBadge.badge_label_en || enlargedBadge.badge_label_ar).charAt(0)}
                </div>
              )}
            </div>
            {/* Badge label */}
            <p className="text-white text-base font-semibold text-center max-w-[200px] leading-snug drop-shadow-md">
              {isAr ? enlargedBadge.badge_label_ar : enlargedBadge.badge_label_en}
            </p>
            {/* Graduation date if available */}
            {enlargedBadge.graduation_date && (
              <p className="text-white/70 text-xs">
                {new Date(enlargedBadge.graduation_date).toLocaleDateString(isAr ? 'ar' : 'en', {
                  year: 'numeric',
                  month: 'long',
                })}
              </p>
            )}
            {/* ICF credential if present on this badge */}
            {enlargedBadge.icf_credential && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="relative h-5 w-5">
                  <Image
                    src={ICF_IMAGES[enlargedBadge.icf_credential.toUpperCase()] || ICF_IMAGES.ACC}
                    alt={`ICF ${enlargedBadge.icf_credential}`}
                    fill
                    className="object-contain"
                    sizes="20px"
                  />
                </div>
                <span className="text-white/80 text-xs font-medium">
                  ICF {enlargedBadge.icf_credential.toUpperCase()}
                </span>
              </div>
            )}
            {/* Dismiss hint */}
            <p className="text-white/50 text-xs mt-2">
              {isAr ? 'انقر في أي مكان للإغلاق' : 'Tap anywhere to close'}
            </p>
          </div>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className={`flex items-center justify-center gap-2 mt-10 ${isAr ? 'flex-row-reverse' : ''}`}>
          {/* Prev */}
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--color-neutral-200)] text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-amber-400 hover:text-amber-600 transition-all duration-200"
            aria-label={isAr ? 'الصفحة السابقة' : 'Previous page'}
          >
            {isAr
              ? <ArrowRight className="w-4 h-4" aria-hidden="true" />
              : <ArrowLeft  className="w-4 h-4" aria-hidden="true" />
            }
          </button>

          {/* Page numbers */}
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            // Show pages around current page
            let pageNum: number;
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (page <= 4) {
              pageNum = i + 1;
            } else if (page >= totalPages - 3) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = page - 3 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`
                  inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200
                  ${pageNum === page
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'border border-[var(--color-neutral-200)] text-[var(--text-primary)] hover:border-amber-400 hover:text-amber-600'
                  }
                `}
                aria-current={pageNum === page ? 'page' : undefined}
              >
                {pageNum}
              </button>
            );
          })}

          {/* Next */}
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--color-neutral-200)] text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-amber-400 hover:text-amber-600 transition-all duration-200"
            aria-label={isAr ? 'الصفحة التالية' : 'Next page'}
          >
            {isAr
              ? <ArrowLeft  className="w-4 h-4" aria-hidden="true" />
              : <ArrowRight className="w-4 h-4" aria-hidden="true" />
            }
          </button>
        </div>
      )}
    </div>
  );
}
