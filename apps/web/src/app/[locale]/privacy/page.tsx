import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Privacy Policy | سياسة الخصوصية | Kun Academy',
  description: 'Privacy policy for Kun Coaching Academy.',
};

export default async function PrivacyRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/legal/privacy`);
}
