import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function BookingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'احجز جلسة' : 'Book a Session'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'اختر نوع الجلسة والموعد المناسب لك.'
            : 'Select a session type and choose a time that works for you.'}
        </p>
      </Section>

      <Section>
        <div className="mx-auto max-w-xl rounded-lg border border-[var(--color-neutral-200)] p-8 text-center">
          <p className="text-[var(--color-neutral-600)]">
            {isAr
              ? 'نظام الحجز قيد الإعداد. يُرجى التواصل معنا عبر صفحة الاتصال.'
              : 'Booking system is under development. Please reach out via the contact page.'}
          </p>
        </div>
      </Section>
    </main>
  );
}
