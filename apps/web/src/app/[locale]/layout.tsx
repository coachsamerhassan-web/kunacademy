import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import { Header } from '@kunacademy/ui/header';
import { Footer } from '@kunacademy/ui/footer';
import { ScrollObserver } from '@kunacademy/ui/scroll-observer';
import { fontVariables } from '@/lib/fonts';
import { NextImageProvider } from '@/components/image-provider';
import { ScrollRestore } from '@/components/scroll-restore';
import { Analytics } from '@/components/analytics';
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://kunacademy.com'),
  title: "Kun Coaching Academy | أكاديمية كُن للكوتشينج",
  description: "أول أكاديمية عربية للتفكير الحسّي® والكوتشينج المعتمد من ICF. أكثر من ٥٠٠ كوتش في ١٣ دولة.",
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: "Kun Coaching Academy | أكاديمية كُن للكوتشينج",
    description: "أول أكاديمية عربية للتفكير الحسّي® والكوتشينج المعتمد من ICF",
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={fontVariables}>
      <body className="flex flex-col min-h-screen">
        <NextIntlClientProvider messages={messages}>
          <NextImageProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-[var(--color-primary)] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
            >
              {locale === 'ar' ? 'تخطي إلى المحتوى الرئيسي' : 'Skip to main content'}
            </a>
            <Header locale={locale} />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer locale={locale} />
            <ScrollObserver />
            <ScrollRestore />
            <Analytics />
          </NextImageProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
