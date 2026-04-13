import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { cms } from '@kunacademy/cms/server';
import { contentGetter } from '@kunacademy/cms';
import { CommunityTabs } from './community-tabs';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'مجتمع كُن | أكاديمية كُن' : 'Kun Community | Kun Academy',
    description: isAr
      ? 'تواصل مع الكوتشز والمتدربين من حول العالم — مجتمع أكاديمية كُن للتفكير الحسّي®'
      : 'Connect with coaches and learners worldwide — the Kun Academy Somatic Thinking® community.',
  };
}

export default async function CommunityPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { tab } = await searchParams;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  // CMS: fetch page content
  const sections = await cms.getPageContent('community');
  const t = contentGetter(sections, locale);

  // Determine initial tab from URL
  const initialTab = tab === 'members' ? 'members' as const : 'graduates' as const;

  // SSR-fetch initial graduate data for the default tab
  let initialGraduateData = {
    graduates: [] as any[],
    total: 0,
    totalPages: 0,
    programCounts: {} as Record<string, number>,
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
      initialGraduateData = await res.json();
    }
  } catch {
    // Fall through — client will fetch on mount
  }

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0">
          <img
            src="/images/community/diverse-hands-up.jpg"
            alt=""
            className="w-full h-full object-cover"
            style={{ filter: 'saturate(0.6) brightness(0.4)' }}
            loading="eager"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(71,64,153,0.88) 0%, rgba(29,26,61,0.92) 100%)' }} />
          <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        </div>
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {t('hero', 'title', isAr ? 'مجتمع كُن' : 'Kun Community')}
          </h1>
          <p className="mt-4 text-white/65 max-w-lg mx-auto text-lg md:text-xl">
            {t('hero', 'subtitle', isAr
              ? 'تواصل مع الكوتشز والمتدربين وعشاق التطوير من حول العالم'
              : 'Connect with coaches, students, and growth enthusiasts from around the world')}
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

      {/* Tabbed content */}
      <Section variant="white">
        <CommunityTabs
          locale={locale}
          initialTab={initialTab}
          initialGraduateData={initialGraduateData}
        />
      </Section>
    </main>
  );
}
