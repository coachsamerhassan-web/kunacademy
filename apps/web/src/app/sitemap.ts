import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://kunacademy.com';
  const now = new Date();

  // All public pages — organized by section
  const pages: Array<{ path: string; priority: number; freq: MetadataRoute.Sitemap[0]['changeFrequency'] }> = [
    // Homepage
    { path: '/', priority: 1.0, freq: 'weekly' },

    // Academy — certifications
    { path: '/academy/', priority: 0.9, freq: 'monthly' },
    { path: '/academy/certifications/', priority: 0.9, freq: 'monthly' },
    { path: '/academy/certifications/stce/', priority: 0.9, freq: 'monthly' },
    { path: '/academy/certifications/stce/level-1/', priority: 0.8, freq: 'monthly' },
    { path: '/academy/certifications/stce/level-2/', priority: 0.8, freq: 'monthly' },
    { path: '/academy/certifications/stce/level-3/', priority: 0.8, freq: 'monthly' },
    { path: '/academy/certifications/stce/level-4/', priority: 0.8, freq: 'monthly' },
    { path: '/academy/certifications/stce/level-5/', priority: 0.8, freq: 'monthly' },
    { path: '/academy/certifications/stce/packages/', priority: 0.7, freq: 'monthly' },
    { path: '/academy/certifications/menhajak/', priority: 0.8, freq: 'monthly' },
    { path: '/academy/certifications/mcc-mentoring/', priority: 0.8, freq: 'monthly' },
    { path: '/academy/certifications/doctors/', priority: 0.7, freq: 'monthly' },
    { path: '/academy/certifications/managers/', priority: 0.7, freq: 'monthly' },

    // Academy — courses
    { path: '/academy/intro/', priority: 0.9, freq: 'monthly' },
    { path: '/academy/courses/', priority: 0.8, freq: 'weekly' },
    { path: '/academy/courses/your-identity/', priority: 0.8, freq: 'monthly' },
    { path: '/academy/recorded/', priority: 0.7, freq: 'monthly' },
    { path: '/academy/free/', priority: 0.7, freq: 'monthly' },

    // Corporate
    { path: '/programs/corporate/', priority: 0.8, freq: 'monthly' },
    { path: '/programs/corporate/gm-playbook/', priority: 0.7, freq: 'monthly' },
    { path: '/programs/corporate/executive-coaching/', priority: 0.7, freq: 'monthly' },
    { path: '/programs/corporate/culture-transformation/', priority: 0.7, freq: 'monthly' },
    { path: '/programs/corporate/facilitation/', priority: 0.7, freq: 'monthly' },
    { path: '/corporate/roi/', priority: 0.7, freq: 'monthly' },

    // Family
    { path: '/programs/family/', priority: 0.7, freq: 'monthly' },
    { path: '/programs/family/seeds/', priority: 0.7, freq: 'monthly' },
    { path: '/programs/family/seeds-adults/', priority: 0.7, freq: 'monthly' },
    { path: '/programs/family/wisal/', priority: 0.7, freq: 'monthly' },

    // Coaching
    { path: '/coaching/', priority: 0.8, freq: 'monthly' },
    { path: '/coaching/individual/', priority: 0.7, freq: 'monthly' },
    { path: '/coaching/group/', priority: 0.7, freq: 'monthly' },
    { path: '/coaching/corporate/', priority: 0.7, freq: 'monthly' },
    { path: '/coaching/book/', priority: 0.8, freq: 'weekly' },

    // Methodology
    { path: '/methodology/', priority: 0.8, freq: 'monthly' },
    { path: '/methodology/science/', priority: 0.7, freq: 'monthly' },
    { path: '/methodology/coach-pathway/', priority: 0.7, freq: 'monthly' },

    // About
    { path: '/about/', priority: 0.7, freq: 'monthly' },
    { path: '/about/founder/', priority: 0.7, freq: 'monthly' },
    { path: '/about/samer/', priority: 0.7, freq: 'monthly' },
    { path: '/about/team/', priority: 0.7, freq: 'monthly' },
    { path: '/about/accreditation/', priority: 0.6, freq: 'monthly' },
    { path: '/about/values/', priority: 0.6, freq: 'monthly' },

    // Content
    { path: '/blog/', priority: 0.8, freq: 'weekly' },
    { path: '/events/', priority: 0.8, freq: 'weekly' },
    { path: '/testimonials/', priority: 0.6, freq: 'monthly' },
    { path: '/media/videos/', priority: 0.6, freq: 'monthly' },
    { path: '/media/press/', priority: 0.5, freq: 'monthly' },
    { path: '/media/podcast/', priority: 0.5, freq: 'monthly' },

    // Tools
    { path: '/pathfinder/', priority: 0.7, freq: 'monthly' },
    { path: '/shop/', priority: 0.7, freq: 'weekly' },
    { path: '/contact/', priority: 0.6, freq: 'monthly' },
    { path: '/verify/', priority: 0.4, freq: 'monthly' },

    // Legal
    { path: '/privacy/', priority: 0.3, freq: 'yearly' },
    { path: '/terms/', priority: 0.3, freq: 'yearly' },
    { path: '/refund/', priority: 0.3, freq: 'yearly' },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    for (const locale of ['ar', 'en']) {
      entries.push({
        url: `${baseUrl}/${locale}${page.path}`,
        lastModified: now,
        changeFrequency: page.freq,
        priority: page.priority,
        alternates: {
          languages: {
            ar: `${baseUrl}/ar${page.path}`,
            en: `${baseUrl}/en${page.path}`,
          },
        },
      });
    }
  }

  return entries;
}
