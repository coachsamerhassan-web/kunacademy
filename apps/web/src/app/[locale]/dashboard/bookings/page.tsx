import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white">
        <Heading level={1} className="mb-8">
          {isAr ? 'حجوزاتي' : 'My Bookings'}
        </Heading>
        <div className="bg-[var(--color-surface-container)] rounded-2xl p-8 min-h-[400px] flex items-center justify-center">
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'قريبًا — سيتم بناء هذه الصفحة في الموجات القادمة' : 'Coming soon — this page will be built in upcoming waves'}
          </p>
        </div>
      </Section>
    </main>
  );
}
