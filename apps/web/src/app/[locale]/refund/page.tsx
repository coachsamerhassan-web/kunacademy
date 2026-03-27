import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Refund Policy | سياسة الاسترداد | Kun Academy',
  description: 'Refund policy for Kun Coaching Academy.',
};

export default async function RefundRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/legal/refund`);
}
