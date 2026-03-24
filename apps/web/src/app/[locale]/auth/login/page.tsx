import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { LoginForm } from './login-form';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white" className="min-h-[70vh] flex items-center">
        <div className="mx-auto max-w-md w-full">
          <Heading level={1} className="text-center">
            {isAr ? 'تسجيل الدخول' : 'Sign In'}
          </Heading>
          <p className="mt-2 text-center text-[var(--color-neutral-600)]">
            {isAr
              ? 'أدخل بريدك الإلكتروني وسنرسل لك رابط دخول آمن'
              : 'Enter your email and we\'ll send you a secure login link'}
          </p>
          <LoginForm locale={locale} />
        </div>
      </Section>
    </main>
  );
}
