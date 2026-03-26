import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://kunacademy.com';

  const staticPages = [
    '/',
    '/programs/',
    '/programs/certifications/stce/',
    '/programs/certifications/stce/level-1/',
    '/programs/certifications/stce/level-2/',
    '/programs/certifications/stce/level-3/',
    '/programs/certifications/stce/level-4/',
    '/programs/certifications/stce/packages/',
    '/programs/certifications/menhajak/',
    '/programs/certifications/mcc-mentoring/',
    '/programs/courses/',
    '/programs/retreats/',
    '/programs/corporate/',
    '/programs/corporate/gm-playbook/',
    '/programs/corporate/executive-coaching/',
    '/programs/corporate/culture-transformation/',
    '/programs/corporate/facilitation/',
    '/programs/family/',
    '/programs/family/seeds/',
    '/programs/family/seeds-adults/',
    '/programs/family/wisal/',
    '/programs/coaching/',
    '/programs/free/',
    '/programs/yaqatha/',
    '/methodology/',
    '/methodology/science/',
    '/methodology/coach-pathway/',
    '/about/',
    '/about/founder/',
    '/about/coaches/',
    '/about/accreditation/',
    '/about/community/',
    '/blog/',
    '/events/',
    '/shop/',
    '/book/',
    '/contact/',
    '/privacy/',
    '/terms/',
    '/refund/',
    '/faq/',
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const page of staticPages) {
    for (const locale of ['ar', 'en']) {
      entries.push({
        url: `${baseUrl}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === '/' ? 'weekly' : 'monthly',
        priority: page === '/' ? 1.0 : page.includes('certifications') ? 0.9 : 0.7,
        alternates: {
          languages: {
            ar: `${baseUrl}/ar${page}`,
            en: `${baseUrl}/en${page}`,
          },
        },
      });
    }
  }

  return entries;
}
