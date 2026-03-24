import * as React from 'react';
import { cn } from './utils';

/**
 * TrustBar — Stitch-aligned social proof strip.
 * No emojis per brand guardian. Uses SVG icons or simple text markers.
 * Gradient background from primary to primary-600.
 */

interface TrustBarProps {
  locale: string;
  className?: string;
}

const stats = {
  ar: [
    { value: '٥٠٠+', label: 'كوتش تخرّجوا' },
    { value: '٤', label: 'قارات' },
    { value: 'MCC', label: 'أول عربي' },
    { value: 'ICF', label: 'اعتماد دولي' },
  ],
  en: [
    { value: '500+', label: 'Coaches Graduated' },
    { value: '4', label: 'Continents' },
    { value: 'MCC', label: 'First Arab' },
    { value: 'ICF', label: 'Accredited' },
  ],
};

export function TrustBar({ locale, className }: TrustBarProps) {
  const items = locale === 'ar' ? stats.ar : stats.en;

  return (
    <div
      className={cn(
        'py-5 md:py-6',
        className
      )}
      style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)',
      }}
    >
      <div className="mx-auto max-w-[var(--max-content-width)] px-4">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col items-center text-white">
              <span className="text-2xl md:text-3xl font-bold tracking-tight">
                {item.value}
              </span>
              <span className="text-xs md:text-sm font-medium text-white/75 mt-0.5">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
