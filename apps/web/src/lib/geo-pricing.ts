import { cookies } from 'next/headers';

export type PricingRegion = 'EGP' | 'AED' | 'EUR';

export interface GeoPrice {
  amount: number;
  currency: string;
  symbol: string;
  earlyBird?: number;
}

/** Read the visitor's pricing region from the middleware-set cookie */
export async function getPricingRegion(): Promise<PricingRegion> {
  const cookieStore = await cookies();
  const region = cookieStore.get('pricing-region')?.value;
  if (region === 'EGP' || region === 'AED' || region === 'EUR') return region;
  return 'AED'; // fallback
}

/** Pick the right price for a program based on visitor's geo region */
export function getGeoPrice(
  region: PricingRegion,
  priceAed: number,
  priceEgp: number,
  priceEur: number,
  earlyBirdAed?: number,
): GeoPrice {
  switch (region) {
    case 'EGP':
      return { amount: priceEgp, currency: 'EGP', symbol: 'ج.م' };
    case 'EUR':
      return {
        amount: priceEur,
        currency: 'EUR',
        symbol: '€',
        earlyBird: earlyBirdAed ? Math.round(earlyBirdAed * 0.25) : undefined, // approximate EUR early bird
      };
    case 'AED':
    default:
      return {
        amount: priceAed,
        currency: 'AED',
        symbol: 'AED',
        earlyBird: earlyBirdAed || undefined,
      };
  }
}

/**
 * Board tier rule: programs priced above 4,000 AED hide their price
 * and show a CRM inquiry form instead.
 * Returns true when the price should be displayed (≤ 4,000 AED or free).
 */
export function shouldShowPrice(priceAed: number): boolean {
  return priceAed <= 4000;
}

/**
 * Format a geo price amount as a locale-appropriate string.
 * Always uses Western Arabic numerals (2,000 not ٢٬٠٠٠) per Kun convention.
 */
export function formatGeoPrice(geoPrice: GeoPrice, isAr: boolean): string {
  const formatted = geoPrice.amount.toLocaleString('en-US'); // Western numerals always
  if (geoPrice.currency === 'EUR') return `€${formatted}`;
  if (geoPrice.currency === 'EGP') return isAr ? `${formatted} ج.م` : `${formatted} EGP`;
  // AED
  return isAr ? `${formatted} د.إ` : `${formatted} AED`;
}
