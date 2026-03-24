import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function CourseDetailPage({
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
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'دورة قصيرة' : 'Short Course'}
          </p>
          <Heading level={1}>
            {isAr ? `دورة: ${slug}` : `Course: ${slug}`}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)]">
            {isAr ? 'تفاصيل الدورة ستُعرض هنا' : 'Course details will be displayed here'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <Heading level={2}>
              {isAr ? 'محتوى الدورة' : 'Course Content'}
            </Heading>
            <p className="mt-4 text-[var(--color-neutral-600)]">
              {isAr ? 'سيتم عرض المنهج التفصيلي هنا' : 'Detailed curriculum will be displayed here'}
            </p>
          </div>
          <div className="rounded-[var(--card-radius)] bg-[var(--color-neutral-50)] p-6">
            <h3 className="font-bold text-lg mb-4">
              {isAr ? 'معلومات سريعة' : 'Quick Info'}
            </h3>
            <div className="space-y-3 text-sm text-[var(--color-neutral-600)]">
              <p>{isAr ? 'المدة: —' : 'Duration: —'}</p>
              <p>{isAr ? 'اللغة: —' : 'Language: —'}</p>
              <p>{isAr ? 'المستوى: —' : 'Level: —'}</p>
            </div>
            <Button variant="primary" className="mt-6 w-full">
              {isAr ? 'سجّل الآن' : 'Register Now'}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
