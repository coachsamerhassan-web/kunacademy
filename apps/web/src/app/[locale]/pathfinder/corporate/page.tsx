import { redirect } from 'next/navigation';

export default async function CorporatePathfinderRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/coaching/corporate`);
}
