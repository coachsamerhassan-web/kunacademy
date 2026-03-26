import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'ورش جماعية | أكاديمية كُن' : 'Group Workshops | Kun Academy',
    description: isAr
      ? 'ورش كوتشينج جماعية تفاعلية — تجارب تعلّم حيّة بمنهجية التفكير الحسّي®'
      : 'Interactive group coaching workshops — live learning experiences through the Somatic Thinking® methodology',
  };
}

const workshops = [
  {
    titleAr: 'ورشة الحضور الحسّي',
    titleEn: 'Somatic Presence Workshop',
    descAr: 'ورشة مكثّفة ليوم واحد تُعرّفك على لغة الجسد وإشاراته الحسّية من خلال تمارين عملية في مجموعة صغيرة.',
    descEn: 'A one-day intensive workshop introducing you to body language and somatic signals through hands-on exercises in a small group.',
    durationAr: 'يوم واحد (٦ ساعات)',
    durationEn: '1 day (6 hours)',
    sizeAr: '٦-١٢ مشترك',
    sizeEn: '6-12 participants',
  },
  {
    titleAr: 'ورشة القيادة من الداخل',
    titleEn: 'Leading from Within Workshop',
    descAr: 'للقادة والمديرين — كيف تقود فريقك بحضورك لا بمنصبك. تمارين حسّية تطبيقية على مواقف قيادية حقيقية.',
    descEn: 'For leaders and managers — how to lead your team with presence, not position. Applied somatic exercises on real leadership situations.',
    durationAr: 'يومان (١٢ ساعة)',
    durationEn: '2 days (12 hours)',
    sizeAr: '٨-١٥ مشترك',
    sizeEn: '8-15 participants',
  },
  {
    titleAr: 'ورشة اكتشاف الذات',
    titleEn: 'Self-Discovery Workshop',
    descAr: 'رحلة جماعية لاستكشاف أنماط التفكير والسلوك من خلال الجسد — مناسبة لمن يبحث عن بداية جديدة.',
    descEn: 'A group journey to explore thinking and behavior patterns through the body — perfect for anyone seeking a fresh start.',
    durationAr: 'يوم واحد (٤ ساعات)',
    durationEn: '1 day (4 hours)',
    sizeAr: '٤-١٠ مشتركين',
    sizeEn: '4-10 participants',
  },
];

export default async function GroupWorkshopsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }} />
        <GeometricPattern pattern="girih" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <div className="max-w-2xl animate-fade-up">
            <a href={`/${locale}/coaching`} className="text-[var(--color-accent)] text-sm font-medium hover:underline mb-4 inline-block">
              ← {isAr ? 'الكوتشينج' : 'Coaching'}
            </a>
            <h1
              className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.05]"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'ورش جماعية' : 'Group Workshops'}
            </h1>
            <p className="mt-4 text-white/70 text-lg md:text-xl leading-relaxed">
              {isAr
                ? 'تجارب تعلّم حيّة في مجموعات صغيرة — الجسد يتحرّك، والأفكار تتبلور، والتغيير يبدأ'
                : 'Live learning experiences in small groups — the body moves, ideas crystallize, and change begins'}
            </p>
          </div>
        </div>
      </section>

      {/* Workshops */}
      <Section variant="white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {workshops.map((ws, i) => (
            <Card key={i} accent className="p-6 h-full">
              <h3
                className="text-lg font-bold text-[var(--text-primary)] mb-3"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? ws.titleAr : ws.titleEn}
              </h3>
              <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed mb-4">
                {isAr ? ws.descAr : ws.descEn}
              </p>
              <div className="space-y-2 text-xs text-[var(--color-neutral-500)]">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  {isAr ? ws.durationAr : ws.durationEn}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                  {isAr ? ws.sizeAr : ws.sizeEn}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section variant="surface">
        <div className="text-center py-4">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'مهتم بورشة جماعية؟' : 'Interested in a Group Workshop?'}
          </h2>
          <p className="text-[var(--color-neutral-600)] mb-6 max-w-xl mx-auto">
            {isAr
              ? 'تابعنا على وسائل التواصل الاجتماعي لمعرفة مواعيد الورش القادمة، أو تواصل معنا لطلب ورشة خاصة لمجموعتك'
              : 'Follow us on social media for upcoming workshop dates, or contact us to request a private workshop for your group'}
          </p>
          <a
            href="mailto:info@kuncoaching.com"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-primary-600)] transition-all duration-300"
          >
            {isAr ? 'تواصل معنا' : 'Contact Us'}
          </a>
        </div>
      </Section>
    </main>
  );
}
