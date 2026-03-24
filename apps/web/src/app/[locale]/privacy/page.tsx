import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <div className="mx-auto max-w-3xl">
          <Heading level={1}>{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</Heading>
          <p className="mt-4 text-[var(--color-neutral-700)]">
            {isAr
              ? 'تلتزم أكاديمية كُن بحماية خصوصية بياناتك الشخصية. توضّح هذه السياسة كيفية جمع واستخدام وحماية معلوماتك.'
              : 'Kun Academy is committed to protecting the privacy of your personal data. This policy explains how we collect, use, and protect your information.'}
          </p>
          <div className="mt-8 space-y-6 text-[var(--color-neutral-700)]">
            <p>{isAr ? 'المحتوى الكامل لسياسة الخصوصية قيد الإعداد القانوني.' : 'Full privacy policy content is under legal review.'}</p>
          </div>
        </div>
      </Section>
    </main>
  );
}
