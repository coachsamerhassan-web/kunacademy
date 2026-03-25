import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ComingSoon
      locale={locale}
      titleAr="فريقنا"
      titleEn="Our Team"
      descAr="تعرّف على فريق أكاديمية كُن"
      descEn="Meet the Kun Academy team"
    />
  );
}
