import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Terms of Service | شروط الاستخدام | Kun Academy',
  description: 'Terms of service for Kun Coaching Academy.',
};

export default async function TermsRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/legal/terms`);
}
