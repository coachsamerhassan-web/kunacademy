import * as React from 'react';
import { cn } from './utils';

/**
 * Mashrabiya-inspired geometric patterns for Kun Academy.
 * Used as subtle background textures at low opacity.
 * RTL-aware: patterns originate from the right in Arabic mode.
 */

/** Eight-pointed star — Rub el Hizb, core Islamic geometric motif */
const eightPointedStarSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><path d='M40 0l11.18 28.82L80 40 51.18 51.18 40 80 28.82 51.18 0 40l28.82-11.18z' fill='%23474099' fill-opacity='0.08'/></svg>`;

/** Girih tile — interlocking geometric pattern */
const girihSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><path d='M50 0L100 50L50 100L0 50Z' fill='none' stroke='%23474099' stroke-width='0.5' opacity='0.12'/><path d='M25 25L75 25L75 75L25 75Z' fill='none' stroke='%23474099' stroke-width='0.5' opacity='0.08'/><circle cx='50' cy='50' r='20' fill='none' stroke='%23474099' stroke-width='0.5' opacity='0.06'/></svg>`;

/** Flower of Life — sacred geometry pattern */
const flowerOfLifeSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='104' viewBox='0 0 120 104'><circle cx='60' cy='52' r='20' fill='none' stroke='%23474099' stroke-width='0.4' opacity='0.07'/><circle cx='40' cy='52' r='20' fill='none' stroke='%23474099' stroke-width='0.4' opacity='0.07'/><circle cx='80' cy='52' r='20' fill='none' stroke='%23474099' stroke-width='0.4' opacity='0.07'/><circle cx='50' cy='34.7' r='20' fill='none' stroke='%23474099' stroke-width='0.4' opacity='0.07'/><circle cx='70' cy='34.7' r='20' fill='none' stroke='%23474099' stroke-width='0.4' opacity='0.07'/><circle cx='50' cy='69.3' r='20' fill='none' stroke='%23474099' stroke-width='0.4' opacity='0.07'/><circle cx='70' cy='69.3' r='20' fill='none' stroke='%23474099' stroke-width='0.4' opacity='0.07'/></svg>`;

const patternMap = {
  'eight-star': eightPointedStarSvg,
  girih: girihSvg,
  'flower-of-life': flowerOfLifeSvg,
} as const;

type PatternName = keyof typeof patternMap;

interface GeometricPatternProps {
  pattern?: PatternName;
  opacity?: number;
  className?: string;
  /** Pattern size in px */
  size?: number;
  /** Gradient fade direction */
  fade?: 'top' | 'bottom' | 'both' | 'none';
}

export function GeometricPattern({
  pattern = 'eight-star',
  opacity = 0.5,
  size,
  fade = 'both',
  className,
}: GeometricPatternProps) {
  const svg = patternMap[pattern];
  const bgSize = size ? `${size}px ${size}px` : undefined;

  const fadeGradient =
    fade === 'top'
      ? 'linear-gradient(to bottom, transparent, black 30%)'
      : fade === 'bottom'
        ? 'linear-gradient(to bottom, black 70%, transparent)'
        : fade === 'both'
          ? 'linear-gradient(to bottom, transparent 5%, black 20%, black 80%, transparent 95%)'
          : undefined;

  return (
    <div
      className={cn('absolute inset-0 pointer-events-none', className)}
      style={{
        opacity,
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/%23/g, '#'))}")`,
        ...(bgSize && { backgroundSize: bgSize }),
        ...(fadeGradient && {
          WebkitMaskImage: fadeGradient,
          maskImage: fadeGradient,
        }),
      }}
      aria-hidden="true"
    />
  );
}

export { type PatternName };
