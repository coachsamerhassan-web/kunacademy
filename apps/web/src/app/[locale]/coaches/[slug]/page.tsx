import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { cms, type TeamMember } from '@kunacademy/cms';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const coach = await cms.getTeamMember(slug);
  if (!coach) return {};

  const name = locale === 'ar' ? coach.name_ar : coach.name_en;
  const title = locale === 'ar' ? coach.title_ar : coach.title_en;
  const bio = locale === 'ar' ? coach.bio_ar : coach.bio_en;

  return {
    title: `${name}${title ? ` — ${title}` : ''} | ${locale === 'ar' ? 'أكاديمية كُن' : 'Kun Academy'}`,
    description: bio?.slice(0, 160) || '',
    openGraph: {
      title: name,
      description: bio?.slice(0, 160) || '',
      ...(coach.photo_url ? { images: [{ url: coach.photo_url }] } : {}),
    },
  };
}

export default async function CoachProfilePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const coach = await cms.getTeamMember(slug);
  if (!coach) notFound();

  const name = isAr ? coach.name_ar : coach.name_en;
  const title = isAr ? coach.title_ar : coach.title_en;
  const bio = isAr ? coach.bio_ar : coach.bio_en;

  const credentialColors: Record<string, string> = {
    MCC: 'bg-amber-100 text-amber-800',
    PCC: 'bg-blue-100 text-blue-800',
    ACC: 'bg-green-100 text-green-800',
    instructor: 'bg-purple-100 text-purple-800',
    facilitator: 'bg-teal-100 text-teal-800',
  };

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }} />
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Photo */}
            <div className="shrink-0">
              <div className="h-40 w-40 md:h-52 md:w-52 rounded-full overflow-hidden ring-4 ring-white/20 shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
                {coach.photo_url ? (
                  <img
                    src={coach.photo_url}
                    alt={name}
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                ) : (
                  <div className="h-full w-full bg-[var(--color-primary-300)] flex items-center justify-center">
                    <span className="text-6xl font-bold text-white/80">{name.charAt(0)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Name & Title */}
            <div className="text-center md:text-start">
              <h1
                className="text-[2rem] md:text-[3rem] font-bold text-[#FFF5E9] leading-[1.1]"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {name}
              </h1>
              {title && (
                <p className="mt-2 text-lg md:text-xl text-white/70">{title}</p>
              )}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-4">
                {coach.coach_level && (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${credentialColors[coach.coach_level] || 'bg-white/20 text-white'}`}>
                    {coach.coach_level === 'instructor' ? (isAr ? 'مدرّب' : 'Instructor')
                      : coach.coach_level === 'facilitator' ? (isAr ? 'ميسّر' : 'Facilitator')
                      : `ICF ${coach.coach_level}`}
                  </span>
                )}
                {coach.credentials && (
                  <span className="text-sm text-white/60">{coach.credentials}</span>
                )}
              </div>
              {/* Languages */}
              {coach.languages.length > 0 && (
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3">
                  <svg className="w-4 h-4 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                    <path d="M3.6 9h16.8M3.6 15h16.8" />
                    <path d="M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9z" />
                  </svg>
                  {coach.languages.map((lang) => (
                    <span key={lang} className="text-sm text-white/70">{lang}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bio */}
      {bio && (
        <Section variant="white">
          <div className="max-w-3xl mx-auto">
            <h2
              className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-6"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'نبذة' : 'About'}
            </h2>
            <div
              className="text-[var(--color-neutral-700)] leading-relaxed text-base md:text-lg whitespace-pre-line"
              style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
            >
              {bio}
            </div>
          </div>
        </Section>
      )}

      {/* Specialties & Coaching Styles */}
      {(coach.specialties.length > 0 || coach.coaching_styles.length > 0) && (
        <Section variant="surface">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Specialties */}
              {coach.specialties.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
                    {isAr ? 'التخصصات' : 'Specialties'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {coach.specialties.map((spec) => (
                      <span
                        key={spec}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-[var(--color-primary-50)] text-[var(--color-primary)] font-medium"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Coaching Styles */}
              {coach.coaching_styles.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
                    {isAr ? 'أساليب الكوتشينج' : 'Coaching Styles'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {coach.coaching_styles.map((style) => (
                      <span
                        key={style}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-[var(--color-secondary-50)] text-[var(--color-secondary-600)] font-medium"
                      >
                        {style}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Book CTA */}
      {coach.is_bookable && (
        <Section variant="white">
          <div className="max-w-xl mx-auto text-center">
            <h2
              className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'احجز جلسة كوتشينج' : 'Book a Coaching Session'}
            </h2>
            <p className="text-[var(--color-neutral-600)] mb-6">
              {isAr
                ? `ابدأ رحلتك مع ${coach.name_ar} — جلسة فردية مصمّمة لاحتياجاتك`
                : `Start your journey with ${coach.name_en} — a session tailored to your needs`}
            </p>
            <a
              href={`/${locale}/coaching/book`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
            >
              {isAr ? 'احجز الآن' : 'Book Now'}
            </a>
            <a
              href={`/${locale}/coaches`}
              className="block mt-4 text-sm text-[var(--color-primary)] hover:underline"
            >
              {isAr ? 'تصفّح جميع الكوتشز' : 'Browse all coaches'}
            </a>
          </div>
        </Section>
      )}
    </main>
  );
}
