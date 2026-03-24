import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function FreeCourseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-[var(--color-secondary)] font-medium mb-2">
            {isAr ? 'مجاني' : 'Free'}
          </p>
          <Heading level={1}>
            {isAr ? `مورد: ${slug}` : `Resource: ${slug}`}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)]">
            {isAr ? 'تفاصيل المورد المجاني ستُعرض هنا' : 'Free resource details will be displayed here'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'المحتوى' : 'Content'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-600)]">
            {isAr ? 'محتوى الدورة المجانية سيُعرض هنا' : 'Free course content will be displayed here'}
          </p>
          <Button variant="primary" size="lg" className="mt-8">
            {isAr ? 'ابدأ التعلّم' : 'Start Learning'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
