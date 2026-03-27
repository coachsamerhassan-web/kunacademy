import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'حلول المؤسسات | أكاديمية كُن' : 'Corporate Solutions | Kun Academy',
    description: isAr
      ? 'برامج كوتشينج وتطوير قيادي مصمّمة للمؤسسات والفرق'
      : 'Coaching and leadership development programs designed for organizations and teams.',
  };
}

export default async function CorporatePathfinderRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/coaching/corporate`);
}
