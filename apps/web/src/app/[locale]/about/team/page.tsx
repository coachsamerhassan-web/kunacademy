import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import { breadcrumbJsonLd } from '@kunacademy/ui/structured-data';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'فريقنا | أكاديمية كُن' : 'Our Team | Kun Academy',
    description: isAr
      ? 'تعرّف على فريق أكاديمية كُن — كوتشز ومدرّبون حملوا منهجية التفكير الحسّي إلى ٤ قارات'
      : 'Meet the Kun Academy team — coaches and trainers who carry the Somatic Thinking methodology across 4 continents',
  };
}

const credentialColors: Record<string, string> = {
  MCC: 'bg-amber-100 text-amber-800',
  PCC: 'bg-blue-100 text-blue-800',
  ACC: 'bg-green-100 text-green-800',
  instructor: 'bg-purple-100 text-purple-800',
  facilitator: 'bg-teal-100 text-teal-800',
};

export default async function TeamPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const team = await cms.getAllTeamMembers();

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(locale, [
          { name: isAr ? 'الرئيسية' : 'Home', path: '' },
          { name: isAr ? 'عنّا' : 'About', path: '/about' },
          { name: isAr ? 'الفريق' : 'Team', path: '/about/team' },
        ])) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }} />
        <GeometricPattern pattern="girih" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'فريقنا' : 'Our Team'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr
              ? 'كوتشز ومدرّبون حملوا منهجية التفكير الحسّي® إلى ٤ قارات'
              : 'Coaches and trainers who carry the Somatic Thinking® methodology across 4 continents'}
          </p>
        </div>
      </section>

      {/* Team Grid */}
      <Section variant="white">
        {team.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {team.map((member) => {
              const name = isAr ? member.name_ar : member.name_en;
              const title = isAr ? member.title_ar : member.title_en;
              const bio = isAr ? member.bio_ar : member.bio_en;

              return (
                <a
                  key={member.slug}
                  href={member.is_bookable ? `/${locale}/coaches/${member.slug}` : undefined}
                  className={member.is_bookable ? 'group' : ''}
                >
                  <Card accent className="p-6 h-full text-center">
                    {/* Avatar */}
                    <div className="mx-auto h-28 w-28 rounded-full overflow-hidden bg-[var(--color-neutral-100)] mb-4">
                      {member.photo_url ? (
                        <img
                          src={member.photo_url}
                          alt={name}
                          className="h-full w-full object-cover"
                          style={{ objectPosition: 'center 15%' }}
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-4xl font-bold text-[var(--color-neutral-400)]">
                          {name.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Name & Title */}
                    <h3 className={`text-lg font-bold text-[var(--text-primary)] ${member.is_bookable ? 'group-hover:text-[var(--color-primary)] transition-colors' : ''}`}>
                      {name}
                    </h3>
                    {title && (
                      <p className="text-sm text-[var(--color-neutral-600)] mt-1 line-clamp-2">{title}</p>
                    )}

                    {/* Credential badge */}
                    {member.coach_level && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mt-3 ${credentialColors[member.coach_level] || 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'}`}>
                        {member.coach_level === 'instructor' ? (isAr ? 'مدرّب' : 'Instructor')
                          : member.coach_level === 'facilitator' ? (isAr ? 'ميسّر' : 'Facilitator')
                          : `ICF ${member.coach_level}`}
                      </span>
                    )}

                    {/* Bio excerpt */}
                    {bio && (
                      <p className="text-sm text-[var(--color-neutral-600)] mt-4 line-clamp-3 leading-relaxed">
                        {bio}
                      </p>
                    )}

                    {/* Languages */}
                    {(() => {
                      const langs = Array.isArray(member.languages) ? member.languages : typeof member.languages === 'string' ? (member.languages as string).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                      return langs.length > 0 ? (
                        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[var(--color-neutral-500)]">
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                            <path d="M3.6 9h16.8M3.6 15h16.8" />
                          </svg>
                          {langs.join(' · ')}
                        </div>
                      ) : null;
                    })()}
                  </Card>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-[var(--color-neutral-500)]">
              {isAr ? 'فريقنا قيد الإعداد' : 'Team profiles are being set up'}
            </p>
          </div>
        )}
      </Section>

      {/* CTA */}
      <Section variant="surface">
        <div className="text-center py-4">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'هل تريد الانضمام لفريقنا؟' : 'Want to Join Our Team?'}
          </h2>
          <p className="text-[var(--color-neutral-600)] mb-6 max-w-xl mx-auto">
            {isAr
              ? 'إذا كنت كوتشًا معتمدًا وتحمل شهادة STCE، يمكنك التقدّم للانضمام إلى منصة كُن'
              : 'If you\'re a certified coach with an STCE credential, you can apply to join the Kun platform'}
          </p>
          <a
            href={`/${locale}/coaching/book`}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
          >
            {isAr ? 'تواصل معنا' : 'Contact Us'}
          </a>
        </div>
      </Section>
    </main>
  );
}
