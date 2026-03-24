import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'مجتمع الخرّيجين' : 'Alumni & Community'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'أكثر من 500 كوتش تخرّجوا من أكاديمية كُن ويشكّلون اليوم مجتمعًا حيًا يمتد عبر 4 قارات — مجتمع مبني على الإحسان والممارسة الحسّية المستمرة.'
            : 'Over 500 coaches have graduated from Kun Academy, forming a living community spanning 4 continents — built on Ihsan and continuous somatic practice.'}
        </p>
      </Section>

      <Section>
        <Heading level={2}>{isAr ? 'مزايا العضوية' : 'Membership Benefits'}</Heading>
        <ul className="mt-4 space-y-3 text-[var(--color-neutral-700)]">
          <li>{isAr ? 'جلسات إشراف جماعي شهرية' : 'Monthly group supervision sessions'}</li>
          <li>{isAr ? 'مكتبة موارد حصرية للخرّيجين' : 'Exclusive alumni resource library'}</li>
          <li>{isAr ? 'فرص منتورنغ مع كوتشز MCC و PCC' : 'Mentoring opportunities with MCC and PCC coaches'}</li>
          <li>{isAr ? 'أولوية التسجيل في البرامج المتقدمة' : 'Priority enrollment in advanced programs'}</li>
          <li>{isAr ? 'شبكة إحالات مهنية' : 'Professional referral network'}</li>
        </ul>
      </Section>
    </main>
  );
}
