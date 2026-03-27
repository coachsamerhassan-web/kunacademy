import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'كوتشز أكاديمية كُن | أكاديمية كُن' : 'Kun Academy Coaches | Kun Academy',
    description: isAr ? 'تعرّف على كوتشز كُن المعتمدين — خريجو التفكير الحسّي® المعتمدون من ICF' : 'Meet Kun\'s certified coaches — Somatic Thinking® graduates accredited by ICF',
  };
}

export default async function AboutCoachesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/coaches`);
}
