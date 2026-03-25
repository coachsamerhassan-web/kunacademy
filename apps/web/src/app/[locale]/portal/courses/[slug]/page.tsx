import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { CoursePlayer } from './course-player';

export default async function CoursePlayerPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <Section variant="white" className="py-0 sm:py-8">
        <CoursePlayer locale={locale} courseSlug={slug} />
      </Section>
    </main>
  );
}
