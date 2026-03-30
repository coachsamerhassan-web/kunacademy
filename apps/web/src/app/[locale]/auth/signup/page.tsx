import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { LoginForm } from '../login/login-form';

export const metadata: Metadata = {
  title: 'Sign Up | Kun Academy',
  robots: { index: false, follow: false },
};

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white" className="min-h-[70vh] flex items-center">
        <div className="mx-auto max-w-md w-full">
          <Heading level={1} className="text-center">
            {isAr ? 'إنشاء حساب' : 'Create Account'}
          </Heading>
          <p className="mt-2 text-center text-[var(--color-neutral-600)]">
            {isAr
              ? 'انضم إلى مجتمع كُن وابدأ رحلتك'
              : 'Join the Kun community and start your journey'}
          </p>
          <LoginForm locale={locale} mode="signup" />
        </div>
      </Section>
    </main>
  );
}
