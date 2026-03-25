import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ComingSoon
      locale={locale}
      titleAr="المُرشد للمؤسسات"
      titleEn="Corporate Pathfinder"
      descAr="اعثر على البرنامج المناسب لمؤسستك"
      descEn="Find the right program for your organization"
    />
  );
}
