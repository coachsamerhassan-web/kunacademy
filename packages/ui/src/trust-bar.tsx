import * as React from 'react';
import { cn } from './utils';

interface TrustBarProps {
  locale: string;
  className?: string;
}

const stats = {
  ar: [
    { label: '٥٠٠+ كوتش', icon: '🎓' },
    { label: '٤ قارات', icon: '🌍' },
    { label: 'أول عربي MCC', icon: '🏅' },
    { label: 'ICF L1 + L2', icon: '✓' },
  ],
  en: [
    { label: '500+ Coaches', icon: '🎓' },
    { label: '4 Continents', icon: '🌍' },
    { label: 'First Arab MCC', icon: '🏅' },
    { label: 'ICF L1 + L2', icon: '✓' },
  ],
};

export function TrustBar({ locale, className }: TrustBarProps) {
  const items = locale === 'ar' ? stats.ar : stats.en;

  return (
    <div
      className={cn(
        'bg-[var(--color-primary)] bg-opacity-95 py-4',
        className
      )}
    >
      <div className="mx-auto max-w-[var(--max-content-width)] px-4">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-white">
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm md:text-base font-medium whitespace-nowrap">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
