'use client';

import { useState, useMemo } from 'react';
import type { TeamMember } from '@kunacademy/cms';
import { Card } from '@kunacademy/ui/card';
import { ArrowRight } from 'lucide-react';

interface Props {
  coaches: TeamMember[];
  locale: string;
}

const credentialColors: Record<string, string> = {
  MCC: 'bg-amber-100 text-amber-800',
  PCC: 'bg-blue-100 text-blue-800',
  ACC: 'bg-green-100 text-green-800',
  instructor: 'bg-purple-100 text-purple-800',
  facilitator: 'bg-teal-100 text-teal-800',
};

export function CoachesDirectory({ coaches, locale }: Props) {
  const isAr = locale === 'ar';
  const [specialty, setSpecialty] = useState('');
  const [language, setLanguage] = useState('');
  const [level, setLevel] = useState('');

  // Extract unique filter values
  const allSpecialties = useMemo(() => {
    const set = new Set<string>();
    coaches.forEach((c) => c.specialties?.forEach((s) => set.add(s)));
    return [...set].sort();
  }, [coaches]);

  const allLanguages = useMemo(() => {
    const set = new Set<string>();
    coaches.forEach((c) => c.languages?.forEach((l) => set.add(l)));
    return [...set].sort();
  }, [coaches]);

  const allLevels = useMemo(() => {
    const set = new Set<string>();
    coaches.forEach((c) => { if (c.coach_level) set.add(c.coach_level); });
    return [...set];
  }, [coaches]);

  // Filter coaches
  const filtered = useMemo(() => {
    return coaches.filter((c) => {
      if (specialty && !c.specialties?.includes(specialty)) return false;
      if (language && !c.languages?.includes(language)) return false;
      if (level && c.coach_level !== level) return false;
      return true;
    });
  }, [coaches, specialty, language, level]);

  const hasFilters = specialty || language || level;

  return (
    <div>
      {/* Filters */}
      {(allSpecialties.length > 0 || allLanguages.length > 0 || allLevels.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 mb-8">
          {allSpecialties.length > 0 && (
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-2.5 text-sm text-[var(--text-primary)] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
            >
              <option value="">{isAr ? 'كل التخصصات' : 'All Specialties'}</option>
              {allSpecialties.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          {allLanguages.length > 0 && (
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-2.5 text-sm text-[var(--text-primary)] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
            >
              <option value="">{isAr ? 'كل اللغات' : 'All Languages'}</option>
              {allLanguages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}
          {allLevels.length > 0 && (
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-2.5 text-sm text-[var(--text-primary)] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
            >
              <option value="">{isAr ? 'كل المستويات' : 'All Levels'}</option>
              {allLevels.map((l) => (
                <option key={l} value={l}>
                  {l === 'instructor' ? (isAr ? 'مدرّب' : 'Instructor')
                    : l === 'facilitator' ? (isAr ? 'ميسّر' : 'Facilitator')
                    : `ICF ${l}`}
                </option>
              ))}
            </select>
          )}
          {hasFilters && (
            <button
              onClick={() => { setSpecialty(''); setLanguage(''); setLevel(''); }}
              className="text-sm text-[var(--color-primary)] hover:underline min-h-[44px]"
            >
              {isAr ? 'مسح الفلاتر' : 'Clear filters'}
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      {hasFilters && (
        <p className="text-sm text-[var(--color-neutral-500)] mb-4">
          {isAr ? `${filtered.length} كوتش` : `${filtered.length} coach${filtered.length !== 1 ? 'es' : ''}`}
        </p>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((coach) => {
            const name = isAr ? coach.name_ar : coach.name_en;
            const title = isAr ? coach.title_ar : coach.title_en;

            return (
              <a key={coach.slug} href={`/${locale}/coaches/${coach.slug}`} className="group">
                <Card accent className="p-6 h-full transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] group-hover:-translate-y-1">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="shrink-0 h-16 w-16 rounded-full overflow-hidden bg-[var(--color-neutral-100)]">
                      {coach.photo_url ? (
                        <img src={coach.photo_url} alt={name} className="h-full w-full object-cover" loading="lazy" />
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
                      {coach.coach_level && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mt-2 ${credentialColors[coach.coach_level] || 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'}`}>
                          {coach.coach_level === 'instructor' ? (isAr ? 'مدرّب' : 'Instructor')
                            : coach.coach_level === 'facilitator' ? (isAr ? 'ميسّر' : 'Facilitator')
                            : `ICF ${coach.coach_level}`}
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

                  {/* Languages */}
                  {coach.languages?.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-[var(--color-neutral-500)]">
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                        <path d="M3.6 9h16.8M3.6 15h16.8" />
                      </svg>
                      {coach.languages.join(' · ')}
                    </div>
                  )}

                  {/* CTA */}
                  <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)]">
                    <span className="text-sm font-medium text-[var(--color-accent)] group-hover:text-[var(--color-accent-500)] transition-colors">
                      {isAr ? 'عرض الملف الشخصي' : 'View Profile'} <ArrowRight className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" />
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
            onClick={() => { setSpecialty(''); setLanguage(''); setLevel(''); }}
            className="mt-3 text-sm text-[var(--color-primary)] hover:underline"
          >
            {isAr ? 'مسح الفلاتر' : 'Clear filters'}
          </button>
        </div>
      )}
    </div>
  );
}
