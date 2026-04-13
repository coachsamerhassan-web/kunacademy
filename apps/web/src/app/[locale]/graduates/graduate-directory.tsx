'use client';

import Image from 'next/image';
import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Search, ChevronDown } from 'lucide-react';
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

// ── Program filters ───────────────────────────────────────────────────────────

const PROGRAMS = [
  { slug: 'stce-stic',  ar: 'مدرب فردي',           en: 'Individual Coach'          },
  { slug: 'stce-staic', ar: 'مدرب فردي متقدم',     en: 'Advanced Individual Coach'  },
  { slug: 'stce-stgc',  ar: 'مدرب جماعي',          en: 'Group Coach'                },
  { slug: 'stce-stoc',  ar: 'مدرب مؤسسي',          en: 'Organisational Coach'       },
  { slug: 'manhajak',   ar: 'مبتكر منهجية',         en: 'Methodology Creator'        },
];

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
  const [program,    setProgram]    = useState('');
  const [page,       setPage]       = useState(1);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch function ───────────────────────────────────────────────────────────

  const fetchGraduates = useCallback(
    async (searchVal: string, programVal: string, pageVal: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchVal)  params.set('search',  searchVal);
        if (programVal) params.set('program', programVal);
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
      fetchGraduates(value, program, 1);
    }, 300);
  };

  const handleProgramChange = (slug: string) => {
    const next = program === slug ? '' : slug;
    setProgram(next);
    setPage(1);
    fetchGraduates(search, next, 1);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    fetchGraduates(search, program, nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setSearch('');
    setProgram('');
    setPage(1);
    fetchGraduates('', '', 1);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasFilters = !!(search || program);
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

        {/* Program filter chips */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-neutral-500)] mb-2">
            {isAr ? 'البرنامج' : 'Program'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Chip
              label={isAr ? 'الكل' : 'All'}
              active={program === ''}
              onClick={() => program !== '' && handleProgramChange('')}
            />
            {PROGRAMS.filter((p) => (programCounts[p.slug] ?? 0) > 0).map((p) => {
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
                  {graduate.badges.length > 0 && (
                    <div className={`flex items-center gap-2 mt-4 ${isAr ? 'flex-row-reverse' : ''}`}>
                      {visibleBadges.map((badge) =>
                        badge.image_url ? (
                          <div
                            key={badge.badge_slug}
                            className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden ring-2 ring-white shadow-sm"
                            title={isAr ? badge.badge_label_ar : badge.badge_label_en}
                          >
                            <Image
                              src={badge.image_url}
                              alt={isAr ? badge.badge_label_ar : badge.badge_label_en}
                              fill
                              className="object-contain"
                              sizes="36px"
                            />
                          </div>
                        ) : (
                          <div
                            key={badge.badge_slug}
                            className="h-9 w-9 shrink-0 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xs font-bold ring-2 ring-white shadow-sm"
                            title={isAr ? badge.badge_label_ar : badge.badge_label_en}
                          >
                            {(badge.badge_label_en || badge.badge_label_ar).charAt(0)}
                          </div>
                        )
                      )}
                      {overflowCount > 0 && (
                        <span className="text-xs text-[var(--color-neutral-500)] font-medium">
                          +{overflowCount}
                        </span>
                      )}
                    </div>
                  )}

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
