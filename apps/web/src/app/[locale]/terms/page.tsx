import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <div className="mx-auto max-w-3xl">
          <Heading level={1}>{isAr ? 'شروط الاستخدام' : 'Terms of Service'}</Heading>
          <p className="mt-4 text-[var(--color-neutral-700)]">
            {isAr
              ? 'باستخدامك لموقع أكاديمية كُن وخدماتها، فإنك توافق على الالتزام بالشروط والأحكام التالية.'
              : 'By using the Kun Academy website and services, you agree to be bound by the following terms and conditions.'}
          </p>
          <div className="mt-8 space-y-6 text-[var(--color-neutral-700)]">
            <p>{isAr ? 'المحتوى الكامل لشروط الاستخدام قيد الإعداد القانوني.' : 'Full terms of service content is under legal review.'}</p>
          </div>
        </div>
      </Section>
    </main>
  );
}
