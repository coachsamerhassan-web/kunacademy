import { execSync } from 'child_process';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Build hash: baked into the binary at build time so the live server can
// expose it as an HTTP response header (X-Build-Hash). Used by kun-deploy.sh
// to verify "is the live bundle the one I built?" after every deploy.
// Falls back to 'unknown' in local dev (no git).
let BUILD_HASH = 'unknown';
try {
  BUILD_HASH = execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] })
    .toString()
    .trim();
} catch {
  // git not available (e.g., Docker layer without .git)
}

const nextConfig: NextConfig = {
  // output: 'standalone',
  // TypeScript strict checking enabled — 0 errors as of Wave 6.75d
  transpilePackages: ['@kunacademy/ui', '@kunacademy/brand', '@kunacademy/db', '@kunacademy/auth', '@kunacademy/payments', '@kunacademy/i18n', '@kunacademy/seo', '@kunacademy/email'],
  serverExternalPackages: ['pdfjs-dist', 'sharp', 'pg', 'bcryptjs', 'nodemailer', 'googleapis', 'google-auth-library'],

  compiler: {
    // Strip console.log and console.info at build time — keeps console.error and console.warn
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },

  async redirects() {
    return [
      // Legacy quiz → Pathfinder assess
      { source: '/:locale/quiz', destination: '/:locale/pathfinder/assess', permanent: true },
      { source: '/:locale/quiz/:path*', destination: '/:locale/pathfinder/assess', permanent: true },
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
      // NOTE: /:locale/programs/corporate/:path+ is intentionally NOT redirected here.
      // Subpaths (e.g. /programs/corporate/gm-playbook) have real page.tsx files and must
      // resolve normally. The old wildcard redirect was blocking them with a 308 to /coaching/corporate.
      // STCE packages subpage → canonical packages hub
      { source: '/:locale/academy/certifications/stce/packages', destination: '/:locale/academy/packages', permanent: true },
      // Methodology → About
      { source: '/:locale/methodology', destination: '/:locale/about/methodology', permanent: true },
      { source: '/:locale/methodology/:path*', destination: '/:locale/about/methodology', permanent: true },
      // About subpages
      { source: '/:locale/about/founder', destination: '/:locale/about/samer', permanent: true },
      { source: '/:locale/about/coaches', destination: '/:locale/coaches', permanent: true },
      // Programs/retreats now has a real page (Wave 10, 2026-04-05) — redirect removed
      // Legal consolidation
      { source: '/:locale/privacy', destination: '/:locale/legal/privacy', permanent: true },
      { source: '/:locale/terms', destination: '/:locale/legal/terms', permanent: true },
      { source: '/:locale/refund', destination: '/:locale/legal/refund', permanent: true },
      // Booking flow consolidation (Wave 15)
      { source: '/:locale/book', destination: '/:locale/coaching/book', permanent: true },
      { source: '/:locale/book/:path*', destination: '/:locale/coaching/book', permanent: true },
      // Retired program slugs — Canon Phase 2 W2 (migration 0040, 2026-04-21)
      // gps was a duplicate/placeholder row deleted in 0040; canonical is gps-of-life
      { source: '/:locale(ar|en)/programs/gps', destination: '/:locale/programs/gps-of-life', permanent: true },
      // gps-professional renamed to gps-couples in 0040; old slug must 301 to preserve SEO + bookmarks
      { source: '/:locale(ar|en)/programs/gps-professional', destination: '/:locale/programs/gps-couples', permanent: true },
      // WordPress legacy URL redirects
      { source: '/:locale/register', destination: '/:locale/auth/signup', permanent: true },
      { source: '/:locale/login', destination: '/:locale/auth/login', permanent: true },
      { source: '/:locale/my-account', destination: '/:locale/dashboard', permanent: true },
      { source: '/:locale/my-account/:path*', destination: '/:locale/dashboard', permanent: true },
      { source: '/:locale/about-us', destination: '/:locale/about', permanent: true },
      { source: '/:locale/our-team', destination: '/:locale/coaches', permanent: true },
      { source: '/:locale/privacy-policy', destination: '/:locale/legal/privacy', permanent: true },
      { source: '/:locale/terms-of-service', destination: '/:locale/legal/terms', permanent: true },
      { source: '/:locale/refund-policy', destination: '/:locale/legal/refund', permanent: true },
      // Wave 15 Wave 4 Route 1 (2026-04-29): /:locale/faq → /:locale/contact 308 removed.
      // /faq is now a real static_pages-backed page. The transitional Cache-Control
      // header in headers() below clears stale 308s in browser/CDN caches; remove it
      // ~30 days from deploy date (TTL: 2026-05-29).
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Bug B fix (Wave 15 W3 canary v2 respin):
          // Changed DENY → SAMEORIGIN globally.
          //
          // SAMEORIGIN is the correct setting here: it blocks any external
          // (cross-origin) site from iframing our pages while allowing the
          // admin preview panel (/ar/admin/preview/[entity]/[id]) — which lives
          // on the SAME origin (kuncoaching.me) — to iframe public LP and blog
          // pages.
          //
          // DENY was blocking the admin preview iframe. Next.js headers() does
          // not override duplicate keys across multiple matching rules; it appends
          // them, so the "override with SAMEORIGIN in a later rule" approach does
          // not work — both headers are emitted and browsers take the DENY.
          //
          // Security posture: SAMEORIGIN still prevents all cross-origin framing
          // attacks (clickjacking via a third-party site embedding our pages).
          // The only new capability granted is same-origin iframing, which is
          // only possible for authenticated sessions on our own domain.
          // Wave 15 W3 post-canary (Item 11): deploy chain verification header.
          // kun-deploy.sh curls this after every deploy to verify the live
          // bundle is the one we just built: `curl -sI ... | grep X-Build-Hash`
          { key: 'X-Build-Hash', value: BUILD_HASH },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https: http:; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.facebook.com https://connect.facebook.net; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://js.stripe.com https://checkout.tabby.ai; object-src 'none'; base-uri 'self'; form-action 'self'" },
        ],
      },
      {
        // Cache static assets aggressively
        source: '/images/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Wave 15 Wave 4 Route 1 (2026-04-29) — transitional cache-clearing for /faq.
        // The previous /:locale/faq → /:locale/contact 308 was permanent and may
        // remain cached in browsers + CDNs for an unbounded period. By emitting a
        // short-lived no-cache header on the new /faq response we force browsers
        // to revalidate against the live origin, which now returns 200 instead of
        // 308. Remove this rule on 2026-05-29 (~30 days post-deploy) once stale
        // caches are reasonably purged. Tracked on TTL list.
        source: '/:locale/faq',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
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
      // VPS storage
      { protocol: 'https', hostname: 'kuncoaching.me' },
      { protocol: 'https', hostname: 'kunacademy.com' },
      // WordPress legacy (migration period)
      { protocol: 'https', hostname: 'old.kunacademy.com' },
      // Unsplash (event images)
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default withNextIntl(nextConfig);
