import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { GraduateDirectory } from './graduate-directory';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr
      ? 'خريجونا | أكاديمية كُن'
      : 'Our Graduates | Kun Academy',
    description: isAr
      ? 'تعرّف على خريجي أكاديمية كُن — كل واحد منهم يحمل شهادة معتمدة من برامج التفكير الحسّي'
      : 'Meet Kun Academy graduates — each certified through Somatic Thinking programs',
  };
}

export default async function GraduatesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  // Server-side initial fetch for first page (no filters)
  let initialData: { graduates: any[]; total: number; totalPages: number; programCounts: Record<string, number> } = {
    graduates: [],
    total: 0,
    totalPages: 0,
    programCounts: {},
  };

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXTAUTH_URL || 'http://localhost:3001';

    const res = await fetch(`${baseUrl}/api/graduates?page=1&limit=24`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      initialData = await res.json();
    }
  } catch {
    // Fall through — client will fetch on mount
  }

  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-16 md:py-24">
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
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{
              fontFamily: isAr
                ? 'var(--font-arabic-heading)'
                : 'var(--font-english-heading)',
            }}
          >
            {isAr ? 'خريجونا' : 'Our Graduates'}
          </h1>

          <p className="mt-4 text-white/65 max-w-lg mx-auto text-lg md:text-xl">
            {isAr
              ? 'كل خريج يحمل شهادة معتمدة تعكس مسيرته في أكاديمية كُن'
              : 'Every graduate holds a certified credential reflecting their journey at Kun Academy'}
          </p>

          {/* Claim CTA */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-3 backdrop-blur-sm">
            <svg
              className="w-5 h-5 text-amber-300 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <p className="text-sm text-amber-200/90">
              {isAr ? (
                <>
                  خريج كُن؟{' '}
                  <a
                    href={`/${locale}/auth/login?callbackUrl=/${locale}/dashboard/certificates&claim=true`}
                    className="font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2 transition-colors"
                  >
                    أضف ملفك الشخصي
                  </a>
                </>
              ) : (
                <>
                  A Kun graduate?{' '}
                  <a
                    href={`/${locale}/auth/login?callbackUrl=/${locale}/dashboard/certificates&claim=true`}
                    className="font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2 transition-colors"
                  >
                    Claim your profile
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* ── Directory ─────────────────────────────────────────────────────── */}
      <Section variant="white">
        <GraduateDirectory
          locale={locale}
          initialData={initialData}
        />
      </Section>
    </main>
  );
}
