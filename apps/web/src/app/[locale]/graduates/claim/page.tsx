import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { ClaimForm } from './claim-form';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr
      ? 'ربط ملفك الشخصي | أكاديمية كُن'
      : 'Claim Your Profile | Kun Academy',
    description: isAr
      ? 'خريج أكاديمية كُن؟ ابحث عن اسمك وربط ملفك الشخصي بحسابك'
      : 'A Kun Academy graduate? Search for your name and claim your profile',
  };
}

export default async function ClaimPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-14 md:py-20">
        <div className="absolute inset-0">
          <img
            src="/images/community/hands-circle-gulf.jpg"
            alt=""
            className="w-full h-full object-cover"
            style={{ filter: 'saturate(0.4) brightness(0.3)' }}
            loading="eager"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(146,104,48,0.85) 0%, rgba(29,26,61,0.92) 100%)',
            }}
          />
          <GeometricPattern pattern="girih" opacity={0.08} fade="both" />
        </div>

        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h1
            className="text-[2rem] md:text-[2.75rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{
              fontFamily: isAr
                ? 'var(--font-arabic-heading)'
                : 'var(--font-english-heading)',
            }}
          >
            {isAr ? 'ربط ملفك الشخصي' : 'Claim Your Profile'}
          </h1>

          <p className="mt-4 text-white/65 max-w-md mx-auto text-base md:text-lg">
            {isAr
              ? 'ابحث عن اسمك في دليل الخريجين واربط ملفك الشخصي بحسابك'
              : 'Search for your name in the graduate directory and link your profile to your account'}
          </p>
        </div>
      </section>

      {/* ── Claim Form ────────────────────────────────────────────────── */}
      <Section variant="white">
        <ClaimForm locale={locale} />
      </Section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <Section variant="surface-low">
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)] text-center mb-8"
            style={{
              fontFamily: isAr
                ? 'var(--font-arabic-heading)'
                : 'var(--font-english-heading)',
            }}
          >
            {isAr ? 'كيف يعمل؟' : 'How it works'}
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                step: '1',
                titleAr: 'ابحث عن اسمك',
                titleEn: 'Find your name',
                descAr: 'استخدم خانة البحث أعلاه للعثور على ملفك في دليل الخريجين',
                descEn: 'Use the search box above to find your profile in the graduate directory',
              },
              {
                step: '2',
                titleAr: 'أدخل بريدك',
                titleEn: 'Enter your email',
                descAr: 'أدخل بريدك الإلكتروني للتحقق من هويتك',
                descEn: 'Enter your email address to verify your identity',
              },
              {
                step: '3',
                titleAr: 'تم الربط',
                titleEn: 'Profile linked',
                descAr: 'إذا تطابق بريدك، يتم الربط فورا. إذا لم يتطابق، يراجع المسؤول طلبك.',
                descEn: 'If your email matches, the link is instant. Otherwise, an admin reviews your request.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm">
                  {item.step}
                </div>
                <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">
                  {isAr ? item.titleAr : item.titleEn}
                </h3>
                <p className="text-xs text-[var(--color-neutral-500)] leading-relaxed">
                  {isAr ? item.descAr : item.descEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </main>
  );
}
