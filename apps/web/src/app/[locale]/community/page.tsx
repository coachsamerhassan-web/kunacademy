import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { cms, contentGetter } from '@kunacademy/cms';
import { CommunityMembers } from './community-members';

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  // CMS: fetch page content
  const sections = await cms.getPageContent('community');
  const t = contentGetter(sections, locale);

  return (
    <main>
      {/* Hero with community image */}
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
        </div>
      </section>

      <Section variant="white">
        <CommunityMembers locale={locale} />
      </Section>
    </main>
  );
}
