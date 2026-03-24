import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function VideosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'مكتبة الفيديو' : 'Video Library'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'محاضرات ولقاءات ومقاطع تعليمية في التفكير الحسّي والكوتشنغ.'
            : 'Lectures, interviews, and educational clips on Somatic Thinking® and coaching.'}
        </p>
      </Section>

      <Section>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Video cards will be populated from CMS/YouTube API */}
          <div className="aspect-video rounded-lg bg-[var(--color-neutral-100)] flex items-center justify-center">
            <p className="text-[var(--color-neutral-500)]">
              {isAr ? 'قريبًا' : 'Coming soon'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
