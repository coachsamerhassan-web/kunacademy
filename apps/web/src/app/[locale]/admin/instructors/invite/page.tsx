import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { InviteForm } from './invite-form';

export default async function InviteCoachPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white">
        <div className="mx-auto max-w-lg">
          <Heading level={1}>
            {isAr ? 'دعوة كوتش جديد' : 'Invite New Coach'}
          </Heading>
          <p className="mt-2 text-[var(--color-neutral-600)]">
            {isAr
              ? 'سيتلقى الكوتش رسالة بريدية مع رابط لإكمال ملفه الشخصي'
              : 'The coach will receive an email with a link to complete their profile'}
          </p>
          <InviteForm locale={locale} />
        </div>
      </Section>
    </main>
  );
}
