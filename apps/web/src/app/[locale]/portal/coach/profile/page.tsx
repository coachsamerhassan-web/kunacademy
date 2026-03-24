import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function CoachProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'تعديل ملف الكوتش' : 'Edit Coach Profile'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'يُرجى تسجيل الدخول بحساب الكوتش لتعديل ملفك الشخصي.'
            : 'Please log in with your coach account to edit your profile.'}
        </p>
      </Section>
    </main>
  );
}
