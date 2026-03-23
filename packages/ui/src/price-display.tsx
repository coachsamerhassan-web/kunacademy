import * as React from 'react';
import { cn } from './utils';

interface PriceDisplayProps {
  priceAed: number; // minor units: 25000 = 250 AED
  priceUsd?: number;
  priceEgp?: number;
  locale: string;
  className?: string;
}

export function PriceDisplay({ priceAed, priceUsd, priceEgp, locale, className }: PriceDisplayProps) {
  const aed = (priceAed / 100).toLocaleString();
  const usd = priceUsd ? (priceUsd / 100).toLocaleString() : null;

  if (locale === 'ar') {
    return (
      <span className={cn('font-bold', className)}>
        {aed} د.إ
        {usd && <span className="text-sm font-normal text-[var(--color-neutral-600)] ms-2">(${usd})</span>}
      </span>
    );
  }

  return (
    <span className={cn('font-bold', className)}>
      AED {aed}
      {usd && <span className="text-sm font-normal text-[var(--color-neutral-600)] ms-2">(${usd})</span>}
    </span>
  );
}
