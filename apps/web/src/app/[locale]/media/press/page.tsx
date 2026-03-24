import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function PressPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'الصحافة والإعلام' : 'Press & Media'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'تغطيات إعلامية ومقابلات وبيانات صحفية عن أكاديمية كُن وسامر حسن.'
            : 'Media coverage, interviews, and press releases about Kun Academy and Samer Hassan.'}
        </p>
      </Section>

      <Section>
        <div className="space-y-6">
          {/* Press items will be populated from CMS */}
          <div className="rounded-lg border border-[var(--color-neutral-200)] p-6">
            <p className="text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'التغطيات الإعلامية قيد الإعداد' : 'Press coverage coming soon'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
