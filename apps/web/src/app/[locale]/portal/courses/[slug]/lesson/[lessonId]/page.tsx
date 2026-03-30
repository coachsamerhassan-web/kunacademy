import { redirect } from 'next/navigation';

export default async function PortalLessonRedirect({
  params,
}: {
  params: Promise<{ locale: string; slug: string; lessonId: string }>;
}) {
  const { locale, slug, lessonId } = await params;
  redirect(`/${locale}/dashboard/courses/${slug}/lessons/${lessonId}`);
}
