import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ComingSoon
      locale={locale}
      titleAr="التفكير الحسّي"
      titleEn="Somatic Thinking"
      descAr="منهجية أصيلة تبدأ من الجسد"
      descEn="An original methodology that starts from the body"
    />
  );
}
