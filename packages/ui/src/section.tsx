import * as React from 'react';
import { cn } from './utils';
import { GeometricPattern, type PatternName } from './patterns';

/**
 * Section — Tonal surface system per Stitch "Modern Mashrabiya" design.
 *
 * Uses surface stacking instead of hard borders:
 * - surface (default): var(--color-background) — Cosmic Latte
 * - surface-low: surface_container_low — slightly lighter
 * - surface-high: surface_container_high — slightly darker
 * - white: pure white — highest contrast
 * - primary: deep primary gradient — hero/CTA areas
 * - dark: dark overlay — final CTA sections
 */

type SurfaceVariant =
  | 'surface'
  | 'surface-low'
  | 'surface-high'
  | 'white'
  | 'primary'
  | 'dark';

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Surface tone for tonal layering */
  variant?: SurfaceVariant | 'default';
  /** Show geometric pattern overlay */
  pattern?: boolean | PatternName;
  /** Constrain content width (default true) */
  contained?: boolean;
  /** Extra padding for hero sections */
  hero?: boolean;
}

const surfaceStyles: Record<string, string> = {
  default: 'bg-[var(--color-background)]',
  surface: 'bg-[var(--color-background)]',
  'surface-low': 'bg-[#fcf2e6]',
  'surface-high': 'bg-[#f0e7db]',
  white: 'bg-white',
  primary: 'text-white',
  dark: 'text-white',
};

export function Section({
  variant = 'surface',
  pattern = false,
  contained = true,
  hero = false,
  className,
  children,
  ...props
}: SectionProps) {
  const isPrimary = variant === 'primary';
  const isDark = variant === 'dark';
  const effectiveVariant = variant === 'default' ? 'surface' : variant;

  const patternName: PatternName | false =
    pattern === true ? 'eight-star' : pattern === false ? false : pattern;

  return (
    <section
      className={cn(
        'relative overflow-hidden',
        hero
          ? 'py-20 md:py-32'
          : 'py-[var(--section-padding-mobile)] md:py-[var(--section-padding)]',
        surfaceStyles[effectiveVariant],
        className
      )}
      {...(isPrimary && {
        style: {
          background:
            'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)',
        },
      })}
      {...(isDark && {
        style: {
          background:
            'linear-gradient(160deg, var(--color-primary-800) 0%, var(--color-primary-900) 100%)',
        },
      })}
      {...props}
    >
      {patternName && (
        <GeometricPattern
          pattern={patternName}
          opacity={isDark || isPrimary ? 0.15 : 0.4}
          fade="both"
        />
      )}
      {contained ? (
        <div className="relative mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          {children}
        </div>
      ) : (
        <div className="relative">{children}</div>
      )}
    </section>
  );
}
