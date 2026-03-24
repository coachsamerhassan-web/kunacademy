import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function LessonPlayerPage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string; lessonId: string }>;
}) {
  const { locale, courseId, lessonId } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'مشغّل الدرس' : 'Lesson Player'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'يُرجى تسجيل الدخول لمشاهدة هذا الدرس.'
            : 'Please log in to view this lesson.'}
        </p>
        <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
          {isAr ? `الدورة: ${courseId} — الدرس: ${lessonId}` : `Course: ${courseId} — Lesson: ${lessonId}`}
        </p>
      </Section>
    </main>
  );
}
