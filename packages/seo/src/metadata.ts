import type { Metadata } from 'next';

export function kunMetadata(opts: {
  title: string;
  description: string;
  path: string;
  locale: string;
  image?: string;
}): Metadata {
  const baseUrl = 'https://kunacademy.com';
  const url = `${baseUrl}/${opts.locale}${opts.path}`;

  return {
    title: opts.title,
    description: opts.description,
    alternates: {
      canonical: url,
      languages: {
        ar: `${baseUrl}/ar${opts.path}`,
        en: `${baseUrl}/en${opts.path}`,
      },
    },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: opts.locale === 'ar' ? 'أكاديمية كُن' : 'Kun Academy',
      locale: opts.locale === 'ar' ? 'ar_AE' : 'en_US',
      type: 'website',
      images: opts.image ? [{ url: opts.image, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
      images: opts.image ? [opts.image] : [],
    },
  };
}
