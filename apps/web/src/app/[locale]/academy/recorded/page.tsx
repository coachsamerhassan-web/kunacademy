import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ComingSoon
      locale={locale}
      titleAr="دورات مسجّلة"
      titleEn="Recorded Courses"
      descAr="تعلّم في أي وقت ومكان"
      descEn="Learn anytime, anywhere"
    />
  );
}
