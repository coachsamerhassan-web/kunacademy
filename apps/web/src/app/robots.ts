import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/coach/',
          '/admin/',
          '/portal/',
          '/api/',
          '/auth/',
          '/checkout/',
          '/verify/',
        ],
      },
    ],
    sitemap: 'https://kunacademy.com/sitemap.xml',
  };
}
