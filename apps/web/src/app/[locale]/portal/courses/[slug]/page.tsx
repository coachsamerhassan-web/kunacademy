import { redirect } from 'next/navigation';

export default async function PortalCourseRedirect({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  redirect(`/${locale}/dashboard/courses/${slug}`);
}
