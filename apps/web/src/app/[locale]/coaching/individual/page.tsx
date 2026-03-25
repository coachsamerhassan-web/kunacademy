import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ComingSoon
      locale={locale}
      titleAr="كوتشينج فردي"
      titleEn="Individual Coaching"
      descAr="جلسات كوتشينج شخصية مع كوتشز معتمدين"
      descEn="Personal coaching sessions with certified coaches"
    />
  );
}
