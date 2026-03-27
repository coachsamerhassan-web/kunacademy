// Server-safe JSON-LD structured data generators

const SITE_URL = 'https://kunacademy.com';

/** Organization schema — placed in root layout */
export function organizationJsonLd(locale: string) {
  const isAr = locale === 'ar';
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    '@id': `${SITE_URL}/#organization`,
    name: isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy',
    alternateName: isAr ? 'Kun Coaching Academy' : 'أكاديمية كُن للكوتشينج',
    url: SITE_URL,
    logo: `${SITE_URL}/images/logos/kun-logo-color.png`,
    description: isAr
      ? 'أول أكاديمية عربية للتفكير الحسّي® والكوتشينج المعتمد من ICF. أكثر من ٥٠٠ كوتش في ١٣ دولة.'
      : 'The first Arab academy for Somatic Thinking® and ICF-accredited coaching. 500+ coaches across 13 countries.',
    foundingDate: '2018',
    founder: {
      '@type': 'Person',
      '@id': `${SITE_URL}/#founder`,
      name: isAr ? 'سامر حسن' : 'Samer Hassan',
      jobTitle: isAr ? 'مؤسس أكاديمية كُن — MCC, ICF' : 'Founder of Kun Academy — MCC, ICF',
      url: `${SITE_URL}/${locale}/about`,
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dubai',
      addressRegion: 'Dubai',
      addressCountry: 'AE',
    },
    sameAs: [
      'https://www.instagram.com/kuncoaching/',
      'https://www.youtube.com/@kuncoaching',
      'https://www.linkedin.com/company/kuncoaching/',
      'https://www.facebook.com/kuncoaching',
    ],
    areaServed: [
      { '@type': 'Country', name: 'United Arab Emirates' },
      { '@type': 'Country', name: 'Saudi Arabia' },
      { '@type': 'Country', name: 'Egypt' },
      { '@type': 'Country', name: 'Qatar' },
      { '@type': 'Country', name: 'Kuwait' },
    ],
    numberOfEmployees: { '@type': 'QuantitativeValue', value: '500+', unitText: 'coaches graduated' },
  };
}

/** Course schema for individual program pages */
export function courseJsonLd(opts: {
  locale: string;
  name: string;
  description: string;
  slug: string;
  hours: number;
  priceAed?: number;
  currency?: string;
  provider?: string;
}) {
  const { locale, name, description, slug, hours, priceAed, currency = 'AED' } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name,
    description,
    url: `${SITE_URL}/${locale}/${slug}`,
    provider: {
      '@type': 'EducationalOrganization',
      '@id': `${SITE_URL}/#organization`,
      name: locale === 'ar' ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy',
    },
    timeRequired: `PT${hours}H`,
    inLanguage: locale === 'ar' ? 'ar' : 'en',
    ...(priceAed != null && {
      offers: {
        '@type': 'Offer',
        price: (priceAed / 100).toFixed(2),
        priceCurrency: currency,
        availability: 'https://schema.org/InStock',
      },
    }),
  };
}

/** BreadcrumbList schema for nested pages */
export function breadcrumbJsonLd(
  locale: string,
  items: Array<{ name: string; path: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}/${locale}${item.path}`,
    })),
  };
}

/** WebSite schema with SearchAction — placed in root layout */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'Kun Coaching Academy',
    url: SITE_URL,
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: ['ar', 'en'],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/en/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
