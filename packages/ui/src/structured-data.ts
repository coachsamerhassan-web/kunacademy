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

/** Person schema for coach/team member pages */
export function personJsonLd(opts: {
  locale: string;
  name: string;
  jobTitle: string;
  slug: string;
  image?: string;
  bio?: string;
  sameAs?: string[];
}) {
  const { locale, name, jobTitle, slug, image, bio, sameAs = [] } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE_URL}/${locale}/coaches/${slug}/#person`,
    name,
    jobTitle,
    url: `${SITE_URL}/${locale}/coaches/${slug}`,
    ...(image && { image }),
    ...(bio && { description: bio }),
    ...(sameAs.length > 0 && { sameAs }),
    affiliation: {
      '@type': 'EducationalOrganization',
      '@id': `${SITE_URL}/#organization`,
      name: locale === 'ar' ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy',
    },
  };
}

/** Article schema for blog post pages */
export function articleJsonLd(opts: {
  locale: string;
  title: string;
  description: string;
  slug: string;
  image?: string;
  author?: string;
  publishedAt?: string;
  modifiedAt?: string;
}) {
  const { locale, title, description, slug, image, author, publishedAt, modifiedAt } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url: `${SITE_URL}/${locale}/blog/${slug}`,
    ...(image && { image }),
    author: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: locale === 'ar' ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy',
    },
    publisher: {
      '@type': 'EducationalOrganization',
      '@id': `${SITE_URL}/#organization`,
      name: locale === 'ar' ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy',
      logo: `${SITE_URL}/images/logos/kun-logo-color.png`,
    },
    inLanguage: locale === 'ar' ? 'ar' : 'en',
    ...(publishedAt && { datePublished: publishedAt }),
    ...(modifiedAt && { dateModified: modifiedAt }),
  };
}

/** Event schema for event/retreat pages */
export function eventJsonLd(opts: {
  locale: string;
  name: string;
  description: string;
  slug: string;
  image?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  locationType?: 'in-person' | 'online' | 'hybrid';
  priceAed?: number;
  currency?: string;
}) {
  const { locale, name, description, slug, image, startDate, endDate, location, locationType, priceAed, currency = 'AED' } = opts;

  const eventLocation = locationType === 'online'
    ? { '@type': 'VirtualLocation', url: `${SITE_URL}/${locale}/events/${slug}` }
    : locationType === 'hybrid'
    ? [
        { '@type': 'VirtualLocation', url: `${SITE_URL}/${locale}/events/${slug}` },
        { '@type': 'Place', name: location || 'Dubai, UAE' },
      ]
    : { '@type': 'Place', name: location || 'Dubai, UAE' };

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${SITE_URL}/${locale}/events/${slug}/#event`,
    name,
    description,
    url: `${SITE_URL}/${locale}/events/${slug}`,
    ...(image && { image }),
    startDate,
    ...(endDate && { endDate }),
    location: eventLocation,
    organizer: {
      '@type': 'EducationalOrganization',
      '@id': `${SITE_URL}/#organization`,
      name: locale === 'ar' ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy',
    },
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
