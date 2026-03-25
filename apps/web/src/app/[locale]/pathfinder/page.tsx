import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ComingSoon
      locale={locale}
      titleAr="المُرشد"
      titleEn="Pathfinder"
      descAr="اكتشف المسار الأنسب لك"
      descEn="Discover your ideal path"
    />
  );
}
