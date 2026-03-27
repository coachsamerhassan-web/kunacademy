import type { Metadata } from 'next';

type OGType = 'default' | 'program' | 'blog' | 'coaching' | 'about';

interface PageMetadataOptions {
  title: string;
  titleAr?: string;
  description: string;
  descriptionAr?: string;
  path: string;
  type?: OGType;
  noIndex?: boolean;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kunacademy.com';

export function createPageMetadata({
  title,
  titleAr,
  description,
  descriptionAr,
  path,
  type = 'default',
  noIndex = false,
}: PageMetadataOptions): Metadata {
  const fullTitle = titleAr
    ? `${title} | ${titleAr}`
    : `${title} | Kun Coaching Academy`;

  const ogImageUrl = `${siteUrl}/api/og?${new URLSearchParams({
    title,
    subtitle: titleAr || 'أكاديمية كُن للكوتشينج',
    type,
  }).toString()}`;

  return {
    title: fullTitle,
    description: descriptionAr || description,
    ...(noIndex && { robots: { index: false, follow: false } }),
    openGraph: {
      title: fullTitle,
      description,
      url: `${siteUrl}${path}`,
      siteName: 'Kun Coaching Academy',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      type: 'website',
      locale: 'ar_SA',
      alternateLocale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: `${siteUrl}${path}`,
      languages: {
        ar: `${siteUrl}/ar${path}`,
        en: `${siteUrl}/en${path}`,
      },
    },
  };
}
