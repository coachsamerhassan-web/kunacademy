// @kunacademy/seo — JSON-LD, Open Graph, metadata helpers

// ─── JSON-LD Schema Generators ───────────────────────────────────────────────

export function organizationSchema(locale: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name:
      locale === 'ar'
        ? 'أكاديمية كُن للكوتشينج'
        : 'Kun Coaching Academy',
    url: 'https://kunacademy.com',
    logo: 'https://kunacademy.com/logo.png',
    description:
      locale === 'ar'
        ? 'أكاديمية كوتشينج معتمدة دوليًا من ICF، أسسها سامر حسن — أول عربي MCC'
        : 'ICF-Accredited International Coaching Academy founded by Samer Hassan, the first Arab MCC',
    founder: {
      '@type': 'Person',
      name: 'Samer Hassan',
      jobTitle: 'Master Certified Coach (MCC)',
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dubai',
      addressCountry: 'AE',
    },
    sameAs: [
      'https://www.linkedin.com/company/kunacademy',
      'https://www.instagram.com/kunacademy',
    ],
  };
}

export function courseSchema(opts: {
  name: string;
  description: string;
  provider?: string;
  duration?: string;
  price?: number;
  currency?: string;
  url: string;
  locale: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inLanguage: opts.locale === 'ar' ? 'ar' : 'en',
    provider: {
      '@type': 'EducationalOrganization',
      name: opts.provider ?? (opts.locale === 'ar' ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy'),
      url: 'https://kunacademy.com',
    },
    ...(opts.duration && {
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'Online',
        duration: opts.duration,
      },
    }),
    ...(opts.price != null && {
      offers: {
        '@type': 'Offer',
        price: opts.price,
        priceCurrency: opts.currency ?? 'USD',
        availability: 'https://schema.org/InStock',
      },
    }),
  };
}

export function personSchema(opts: {
  name: string;
  jobTitle: string;
  description?: string;
  url: string;
  image?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: opts.name,
    jobTitle: opts.jobTitle,
    url: opts.url,
    ...(opts.description && { description: opts.description }),
    ...(opts.image && { image: opts.image }),
  };
}

export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function eventSchema(opts: {
  name: string;
  startDate: string;
  location?: string;
  url: string;
  description?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: opts.name,
    startDate: opts.startDate,
    url: opts.url,
    ...(opts.description && { description: opts.description }),
    ...(opts.location
      ? {
          location: {
            '@type': 'Place',
            name: opts.location,
          },
        }
      : {
          eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
          location: {
            '@type': 'VirtualLocation',
            url: opts.url,
          },
        }),
    organizer: {
      '@type': 'EducationalOrganization',
      name: 'Kun Coaching Academy',
      url: 'https://kunacademy.com',
    },
  };
}

export function productSchema(opts: {
  name: string;
  description: string;
  price: number;
  currency: string;
  url: string;
  image?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    ...(opts.image && { image: opts.image }),
    offers: {
      '@type': 'Offer',
      price: opts.price,
      priceCurrency: opts.currency,
      availability: 'https://schema.org/InStock',
    },
  };
}

// ─── JSON-LD React Component ─────────────────────────────────────────────────

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─── Re-export metadata helper ───────────────────────────────────────────────

export { kunMetadata } from './metadata';
