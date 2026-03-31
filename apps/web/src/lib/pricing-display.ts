export interface PricingDisplay {
  type: 'show-price' | 'contact-us' | 'free' | 'deposit';
  /** Formatted price string (if type = show-price or deposit) */
  priceFormatted?: string;
  /** CTA label in both languages */
  ctaAr: string;
  ctaEn: string;
  /** Deposit amount if applicable */
  depositAed?: number;
}

export function getPricingDisplay(opts: {
  priceAed: number;
  priceEgp: number;
  priceEur: number;
  isEvent?: boolean;
  region: 'gulf' | 'egypt' | 'global';
  locale: string;
}): PricingDisplay {
  const { priceAed, priceEgp, priceEur, isEvent = false, region } = opts;

  function formatRegionalPrice(): string {
    switch (region) {
      case 'egypt':
        return opts.locale === 'ar' ? `${priceEgp} ج.م` : `EGP ${priceEgp}`;
      case 'global':
        return `€${priceEur}`;
      case 'gulf':
      default:
        return opts.locale === 'ar' ? `${priceAed} د.إ` : `AED ${priceAed}`;
    }
  }

  // Case 1: Free
  if (priceAed === 0) {
    return {
      type: 'free',
      ctaAr: 'سجّل مجانًا',
      ctaEn: 'Register Free',
    };
  }

  // Case 2: Non-event, price > 4,000 AED → hide price, show contact CTA
  if (!isEvent && priceAed > 4000) {
    return {
      type: 'contact-us',
      ctaAr: 'تواصل معنا',
      ctaEn: 'Contact Us',
    };
  }

  // Case 3: Event, price > 1,000 AED → show price + deposit option
  if (isEvent && priceAed > 1000) {
    return {
      type: 'deposit',
      priceFormatted: formatRegionalPrice(),
      ctaAr: 'سجّل بعربون',
      ctaEn: 'Register with Deposit',
      depositAed: Math.round(priceAed * 0.3),
    };
  }

  // Case 4: Show price normally
  return {
    type: 'show-price',
    priceFormatted: formatRegionalPrice(),
    ctaAr: 'سجّل الآن',
    ctaEn: 'Enroll Now',
  };
}
