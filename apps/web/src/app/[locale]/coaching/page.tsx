import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ComingSoon
      locale={locale}
      titleAr="الكوتشينج"
      titleEn="Coaching"
      descAr="جلسات كوتشينج فردية وجماعية"
      descEn="Individual and group coaching sessions"
    />
  );
}
