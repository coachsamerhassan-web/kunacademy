import localFont from 'next/font/local';
import { Tajawal, Cairo, Noto_Naskh_Arabic, Inter, STIX_Two_Text } from 'next/font/google';

// ─── Arabic Fonts ───────────────────────────────────────

/** Noor (AGC) — Arabic display/heading font. Self-hosted, not on Google Fonts. */
export const noor = localFont({
  src: [
    { path: '../../public/fonts/noor/alfont_com_AlFont_com_AGCRegular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/noor/AGCBold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-noor',
  display: 'swap',
  preload: true,
});

export const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-tajawal',
  display: 'swap',
  preload: true,
});

export const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cairo',
  display: 'swap',
  preload: false, // fallback only — don't preload
});

export const notoNaskhArabic = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-noto-naskh',
  display: 'swap',
  preload: false, // fallback only
});

// ─── English Fonts ──────────────────────────────────────

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

export const stixTwoText = STIX_Two_Text({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-stix',
  display: 'swap',
  preload: false, // heading only — loaded on demand
});

// Combined className for <body>
export const fontVariables = [
  noor.variable,
  tajawal.variable,
  cairo.variable,
  notoNaskhArabic.variable,
  inter.variable,
  stixTwoText.variable,
].join(' ');
