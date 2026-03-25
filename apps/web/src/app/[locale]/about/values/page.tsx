import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ComingSoon
      locale={locale}
      titleAr="قيمنا"
      titleEn="Our Values"
      descAr="القيم التي تقود رحلتنا"
      descEn="The values that guide our journey"
    />
  );
}
