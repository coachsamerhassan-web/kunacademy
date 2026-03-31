'use client';

import { useState } from 'react';

interface Level {
  codeAr: string;
  codeEn: string;
  nameAr: string;
  nameEn: string;
  hoursAr: string;
  hoursEn: string;
  formatAr: string;
  formatEn: string;
  priceDisplay: string | null;
  ctaAr: string;
  ctaEn: string;
  ctaHref: string;
}

interface PackageCard {
  slug: string;
  nameAr: string;
  nameEn: string;
  hoursAr: string;
  hoursEn: string;
  targetAr: string;
  targetEn: string;
  pathwayAr: string[];
  pathwayEn: string[];
  color: string;
  ctaHref: string;
}

interface PackagesToggleProps {
  locale: string;
  packages: PackageCard[];
  levels: Level[];
}

export function PackagesToggle({ locale, packages, levels }: PackagesToggleProps) {
  const [view, setView] = useState<'packages' | 'individual'>('packages');
  const isAr = locale === 'ar';

  return (
    <div>
      {/* Toggle */}
      <div
        className="flex justify-center mb-10"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="inline-flex rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-1">
          <button
            onClick={() => setView('packages')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 min-h-[44px] ${
              view === 'packages'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-[var(--color-neutral-600)] hover:text-[var(--color-primary)]'
            }`}
          >
            {isAr ? 'الباقات' : 'Packages'}
          </button>
          <button
            onClick={() => setView('individual')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 min-h-[44px] ${
              view === 'individual'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-[var(--color-neutral-600)] hover:text-[var(--color-primary)]'
            }`}
          >
            {isAr ? 'المستويات المنفردة' : 'Individual Levels'}
          </button>
        </div>
      </div>

      {/* Packages View */}
      {view === 'packages' && (
        <div
          className="grid md:grid-cols-3 gap-6"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {packages.map((pkg) => (
            <div
              key={pkg.slug}
              className="rounded-2xl bg-white shadow-[0_4px_24px_rgba(71,64,153,0.06)] overflow-hidden flex flex-col"
            >
              <div
                className="px-6 py-5 text-white text-center"
                style={{ backgroundColor: pkg.color }}
              >
                <h2 className="text-xl md:text-2xl font-bold leading-snug">
                  {isAr ? pkg.nameAr : pkg.nameEn}
                </h2>
                <p className="text-white/70 text-sm mt-1">
                  {isAr ? pkg.hoursAr : pkg.hoursEn}
                </p>
              </div>

              <div className="px-6 pt-5 pb-3">
                <p className="text-[var(--color-neutral-700)] text-sm leading-relaxed">
                  {isAr ? pkg.targetAr : pkg.targetEn}
                </p>
              </div>

              <div className="px-6 pb-4 flex-1">
                <h3 className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
                  {isAr ? 'المسار' : 'Pathway'}
                </h3>
                <ul className="space-y-2">
                  {(isAr ? pkg.pathwayAr : pkg.pathwayEn).map((step, j, arr) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <span className="text-[var(--color-primary)] mt-0.5 shrink-0">
                        {j < arr.length - 1 ? `${j + 1}.` : '★'}
                      </span>
                      <span className="text-[var(--color-neutral-600)]">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-6 py-5 border-t border-[var(--color-neutral-100)] text-center">
                <a
                  href={pkg.ctaHref}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_16px_rgba(228,96,30,0.25)] w-full"
                >
                  {isAr ? 'تحدّث مع مرشد كُن' : 'Talk to a Kun Guide'}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Individual Levels View */}
      {view === 'individual' && (
        <div dir={isAr ? 'rtl' : 'ltr'}>
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-neutral-200)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-primary-50)]">
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-primary)]">
                    {isAr ? 'المستوى' : 'Level'}
                  </th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-primary)]">
                    {isAr ? 'الساعات' : 'Hours'}
                  </th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-primary)]">
                    {isAr ? 'الأسلوب' : 'Format'}
                  </th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-primary)]">
                    {isAr ? 'السعر' : 'Price'}
                  </th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-primary)]"></th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level, i) => (
                  <tr
                    key={level.codeEn}
                    className={`border-t border-[var(--color-neutral-100)] ${i % 2 === 0 ? 'bg-white' : 'bg-[var(--color-neutral-50)/50]'}`}
                  >
                    <td className="px-4 py-4">
                      <span className="font-semibold text-[var(--text-accent)] block">
                        {isAr ? level.codeAr : level.codeEn}
                      </span>
                      <span className="text-[var(--color-neutral-600)]">
                        {isAr ? level.nameAr : level.nameEn}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[var(--color-neutral-700)]">
                      {isAr ? level.hoursAr : level.hoursEn}
                    </td>
                    <td className="px-4 py-4 text-[var(--color-neutral-700)]">
                      {isAr ? level.formatAr : level.formatEn}
                    </td>
                    <td className="px-4 py-4">
                      {level.priceDisplay ? (
                        <span className="font-semibold text-[var(--text-accent)]">{level.priceDisplay}</span>
                      ) : (
                        <span className="text-[var(--color-neutral-500)] text-xs">
                          {isAr ? 'تواصل معنا' : 'Contact us'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={level.ctaHref}
                        className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white min-h-[36px] hover:bg-[var(--color-primary-700)] transition-colors whitespace-nowrap"
                      >
                        {isAr ? level.ctaAr : level.ctaEn}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-xs text-[var(--color-neutral-500)]">
            {isAr
              ? '* الأسعار المعروضة لمستويات تقل عن 4,000 درهم'
              : '* Prices shown for levels under AED 4,000'}
          </p>
        </div>
      )}
    </div>
  );
}
