import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ComingSoon
      locale={locale}
      titleAr="حلول المؤسسات"
      titleEn="Corporate Solutions"
      descAr="للقادة والفرق والمؤسسات"
      descEn="For leaders, teams, and organizations"
    />
  );
}
