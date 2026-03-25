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
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export const metadata: Metadata = {
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
            <Header locale={locale} />
            <main className="flex-1">
              {children}
            </main>
            <Footer locale={locale} />
            <ScrollObserver />
            <ScrollRestore />
          </NextImageProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
