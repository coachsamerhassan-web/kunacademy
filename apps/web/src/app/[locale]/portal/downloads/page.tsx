import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { PageHero } from '@/components/page-hero';
import { DownloadsContent } from './downloads-content';

export default async function DownloadsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const isAr = locale === 'ar';

  return (
    <main>
      <PageHero
        locale={locale}
        titleAr="تحميلاتي"
        titleEn="My Downloads"
        subtitleAr="أدواتك ومواردك الرقمية المشتراة"
        subtitleEn="Your purchased digital resources and tools"
        eyebrowAr="المكتبة الشخصية"
        eyebrowEn="Personal Library"
        pattern="girih"
      />

      <Section>
        <DownloadsContent locale={locale} />
      </Section>
    </main>
  );
}
