'use client';

import Image from 'next/image';
import { useState } from 'react';
import { BadgeModal } from './badge-modal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Certificate {
  program_slug:    string;
  program_name_ar: string;
  program_name_en: string;
  badge_slug:      string;
  badge_image_url: string | null;
  badge_label_ar:  string;
  badge_label_en:  string;
  graduation_date: string | null;
  icf_credential:  string | null;
  certificate_type: string;
  cohort_name:     string | null;
  verified:        boolean;
}

interface Props {
  certificates: Certificate[];
  locale:       string;
}

// ── ICF credential labels ─────────────────────────────────────────────────────

const ICF_BADGE_COLORS: Record<string, string> = {
  ACC: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  PCC: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  MCC: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};

// ── Format date ───────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-US', {
      year: 'numeric',
      month: 'long',
    });
  } catch {
    return dateStr;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GraduateProfileClient({ certificates, locale }: Props) {
  const isAr = locale === 'ar';

  const [activeCert, setActiveCert] = useState<Certificate | null>(null);

  return (
    <>
      {/* Certificate cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {certificates.map((cert) => {
          const programName = isAr ? cert.program_name_ar : cert.program_name_en;
          const badgeLabel  = isAr ? cert.badge_label_ar  : cert.badge_label_en;

          return (
            <button
              key={`${cert.badge_slug}-${cert.graduation_date}`}
              onClick={() => setActiveCert(cert)}
              className={`
                group flex items-start gap-4 p-4 rounded-2xl border border-[var(--color-neutral-100)]
                bg-white hover:border-amber-300 hover:shadow-[0_4px_20px_rgba(146,104,48,0.1)]
                transition-all duration-200 text-left w-full
                ${isAr ? 'flex-row-reverse text-right' : ''}
              `}
              aria-label={`${isAr ? 'عرض تفاصيل' : 'View details for'} ${badgeLabel}`}
            >
              {/* Badge image */}
              <div className="shrink-0 relative h-14 w-14 rounded-full overflow-hidden ring-2 ring-amber-100 group-hover:ring-amber-200 transition-all duration-200">
                {cert.badge_image_url ? (
                  <Image
                    src={cert.badge_image_url}
                    alt={badgeLabel}
                    fill
                    className="object-contain"
                    sizes="56px"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
                    {(cert.badge_label_en || cert.badge_label_ar).charAt(0)}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-amber-700 transition-colors line-clamp-2">
                  {programName}
                </p>
                <p className="text-xs text-[var(--color-neutral-500)] mt-0.5 line-clamp-1">
                  {badgeLabel}
                </p>

                <div className={`flex flex-wrap gap-1.5 mt-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                  {cert.graduation_date && (
                    <span className="text-xs text-amber-700 font-medium">
                      {formatDate(cert.graduation_date, locale)}
                    </span>
                  )}
                  {cert.icf_credential && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ICF_BADGE_COLORS[cert.icf_credential] ?? 'bg-neutral-100 text-neutral-600'}`}
                    >
                      {cert.icf_credential}
                    </span>
                  )}
                  {cert.verified && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                      <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {isAr ? 'موثّق' : 'Verified'}
                    </span>
                  )}
                </div>
              </div>

              {/* Expand hint */}
              <div className={`shrink-0 mt-1 text-[var(--color-neutral-300)] group-hover:text-amber-400 transition-colors ${isAr ? 'mr-auto' : 'ml-auto'}`}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8"  x2="12" y2="16" />
                  <line x1="8"  y1="12" x2="16" y2="12" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>

      {/* Badge modal */}
      {activeCert && (
        <BadgeModal
          badge={{
            slug:            activeCert.badge_slug,
            image_url:       activeCert.badge_image_url,
            name_ar:         activeCert.badge_label_ar,
            name_en:         activeCert.badge_label_en,
            description_ar:  null,  // not returned by profile API (use badge_definitions for full desc)
            description_en:  null,
            program_url_ar:  `/${locale}/programs/${activeCert.program_slug}`,
            program_url_en:  `/${locale}/programs/${activeCert.program_slug}`,
          }}
          graduation_date={activeCert.graduation_date}
          icf_credential={activeCert.icf_credential}
          cohort_name={activeCert.cohort_name}
          locale={locale}
          onClose={() => setActiveCert(null)}
        />
      )}
    </>
  );
}
