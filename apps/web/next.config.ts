import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@kunacademy/ui', '@kunacademy/brand', '@kunacademy/db', '@kunacademy/auth', '@kunacademy/payments', '@kunacademy/i18n', '@kunacademy/seo', '@kunacademy/email'],
  serverExternalPackages: ['pdfjs-dist', 'sharp'],

  async redirects() {
    return [
      // Portal → Dashboard/Coach (v2 restructure)
      { source: '/:locale/portal', destination: '/:locale/dashboard', permanent: true },
      { source: '/:locale/portal/courses', destination: '/:locale/dashboard/courses', permanent: true },
      { source: '/:locale/portal/bookings', destination: '/:locale/dashboard/bookings', permanent: true },
      { source: '/:locale/portal/certificates', destination: '/:locale/dashboard/certificates', permanent: true },
      { source: '/:locale/portal/profile', destination: '/:locale/dashboard/profile', permanent: true },
      { source: '/:locale/portal/coach', destination: '/:locale/coach', permanent: true },
      { source: '/:locale/portal/coach/:path*', destination: '/:locale/coach/:path*', permanent: true },
      // Programs → Coaching/Academy split
      { source: '/:locale/programs/coaching', destination: '/:locale/coaching', permanent: true },
      { source: '/:locale/programs/coaching/:path*', destination: '/:locale/coaching/:path*', permanent: true },
      { source: '/:locale/programs/certifications', destination: '/:locale/academy/certifications', permanent: true },
      { source: '/:locale/programs/certifications/:path*', destination: '/:locale/academy/certifications/:path*', permanent: true },
      { source: '/:locale/programs/courses', destination: '/:locale/academy/courses', permanent: true },
      { source: '/:locale/programs/courses/:path*', destination: '/:locale/academy/courses/:path*', permanent: true },
      { source: '/:locale/programs/free', destination: '/:locale/academy/free', permanent: true },
      { source: '/:locale/programs/free/:path*', destination: '/:locale/academy/free/:path*', permanent: true },
      { source: '/:locale/programs/corporate', destination: '/:locale/coaching/corporate', permanent: true },
      { source: '/:locale/programs/corporate/:path*', destination: '/:locale/coaching/corporate', permanent: true },
      // Methodology → About
      { source: '/:locale/methodology', destination: '/:locale/about/methodology', permanent: true },
      { source: '/:locale/methodology/:path*', destination: '/:locale/about/methodology', permanent: true },
      // About subpages
      { source: '/:locale/about/founder', destination: '/:locale/about/samer', permanent: true },
      { source: '/:locale/about/coaches', destination: '/:locale/coaches', permanent: true },
      // Programs without dedicated pages → academy hub
      { source: '/:locale/programs/retreats', destination: '/:locale/academy/certifications', permanent: false },
      { source: '/:locale/programs/retreats/:path*', destination: '/:locale/academy/certifications', permanent: false },
      // Legal consolidation
      { source: '/:locale/privacy', destination: '/:locale/legal/privacy', permanent: true },
      { source: '/:locale/terms', destination: '/:locale/legal/terms', permanent: true },
      { source: '/:locale/refund', destination: '/:locale/legal/refund', permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Cache static assets aggressively
        source: '/images/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      // Google Drive (CMS content images)
      { protocol: 'https', hostname: 'drive.google.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Google Sheets image cells
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      // Supabase Storage
      { protocol: 'https', hostname: '*.supabase.co' },
      // WordPress legacy (migration period)
      { protocol: 'https', hostname: 'kunacademy.com' },
      { protocol: 'https', hostname: 'old.kunacademy.com' },
    ],
  },
};

export default withNextIntl(nextConfig);
