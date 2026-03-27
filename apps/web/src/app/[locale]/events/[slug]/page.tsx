import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const event = await cms.getEvent(slug);
  if (!event) return {};

  const title = locale === 'ar' ? event.title_ar : event.title_en;
  const description = locale === 'ar' ? event.description_ar : event.description_en;

  return {
    title: `${title} | ${locale === 'ar' ? 'أكاديمية كُن' : 'Kun Academy'}`,
    description: description?.slice(0, 160) || '',
    openGraph: {
      title,
      description: description?.slice(0, 160) || '',
      ...(event.image_url ? { images: [{ url: event.image_url }] } : {}),
    },
  };
}

const locationTypeLabels: Record<string, { ar: string; en: string }> = {
  'in-person': { ar: 'حضوري', en: 'In-Person' },
  'online': { ar: 'أونلاين', en: 'Online' },
  'hybrid': { ar: 'حضوري + أونلاين', en: 'Hybrid' },
};

export default async function EventDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const event = await cms.getEvent(slug);
  if (!event) notFound();

  const title = isAr ? event.title_ar : event.title_en;
  const description = isAr ? event.description_ar : event.description_en;
  const location = isAr ? event.location_ar : event.location_en;
  const locType = locationTypeLabels[event.location_type];

  const dateObj = new Date(event.date_start + 'T00:00:00');
  const dateStr = dateObj.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const isFree = !event.price_aed || event.price_aed === 0;
  const today = new Date().toISOString().split('T')[0];
  const isPast = event.date_start < today;
  const isDeadlinePassed = event.registration_deadline && event.registration_deadline < today;

  // Fetch speakers if any
  let speakers: Awaited<ReturnType<typeof cms.getTeamMember>>[] = [];
  if (event.speaker_slugs?.length > 0) {
    speakers = await Promise.all(
      event.speaker_slugs.map((s) => cms.getTeamMember(s))
    );
  }

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        {event.image_url ? (
          <>
            <div className="absolute inset-0">
              <img src={event.image_url} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.3)' }} loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(29,26,61,0.9)]" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }} />
        )}
        <GeometricPattern pattern="eight-star" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <div className="max-w-3xl">
            {locType && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white mb-4">
                {isAr ? locType.ar : locType.en}
              </span>
            )}
            <h1
              className="text-[2rem] md:text-[3rem] font-bold text-[#FFF5E9] leading-[1.1]"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-4 text-white/70">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {dateStr}
              </div>
              {location && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {location}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Description */}
            <div className="md:col-span-2">
              {description && (
                <div
                  className="text-[var(--color-neutral-700)] leading-relaxed text-base md:text-lg whitespace-pre-line"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                >
                  {description}
                </div>
              )}

              {/* Speakers */}
              {speakers.filter(Boolean).length > 0 && (
                <div className="mt-8">
                  <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">
                    {isAr ? 'المتحدثون' : 'Speakers'}
                  </h2>
                  <div className="space-y-4">
                    {speakers.filter(Boolean).map((speaker) => {
                      if (!speaker) return null;
                      const name = isAr ? speaker.name_ar : speaker.name_en;
                      const speakerTitle = isAr ? speaker.title_ar : speaker.title_en;
                      return (
                        <a
                          key={speaker.slug}
                          href={`/${locale}/coaches/${speaker.slug}`}
                          className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-neutral-200)] hover:border-[var(--color-primary)]/30 transition-colors"
                        >
                          <div className="h-12 w-12 rounded-full overflow-hidden bg-[var(--color-neutral-100)] shrink-0">
                            {speaker.photo_url ? (
                              <img src={speaker.photo_url} alt={name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-lg font-bold text-[var(--color-neutral-400)]">
                                {name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-[var(--text-primary)]">{name}</div>
                            {speakerTitle && <div className="text-sm text-[var(--color-neutral-600)]">{speakerTitle}</div>}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar — Registration Card */}
            <div>
              <div className="sticky top-24 rounded-2xl border border-[var(--color-neutral-200)] p-6">
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-[var(--color-primary)]">
                    {isFree ? (isAr ? 'مجاني' : 'Free') : `${event.price_aed} ${isAr ? 'د.إ' : 'AED'}`}
                  </div>
                </div>

                {isPast ? (
                  <div className="text-center py-3 rounded-xl bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] text-sm font-medium">
                    {isAr ? 'انتهت هذه الفعالية' : 'This event has ended'}
                  </div>
                ) : isDeadlinePassed ? (
                  <div className="text-center py-3 rounded-xl bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] text-sm font-medium">
                    {isAr ? 'انتهى التسجيل' : 'Registration closed'}
                  </div>
                ) : (
                  <a
                    href={`/${locale}/coaching/book`}
                    className="block w-full text-center rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-all duration-300"
                  >
                    {isAr ? 'سجّل الآن' : 'Register Now'}
                  </a>
                )}

                {event.registration_deadline && !isPast && !isDeadlinePassed && (
                  <p className="text-xs text-center text-[var(--color-neutral-500)] mt-3">
                    {isAr ? 'آخر موعد للتسجيل: ' : 'Registration deadline: '}
                    {new Date(event.registration_deadline + 'T00:00:00').toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                      month: 'long', day: 'numeric',
                    })}
                  </p>
                )}

                {event.capacity && (
                  <p className="text-xs text-center text-[var(--color-neutral-500)] mt-2">
                    {isAr ? `${event.capacity} مقعد` : `${event.capacity} seats`}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Back link */}
      <Section variant="surface">
        <div className="text-center">
          <a href={`/${locale}/events`} className="text-sm text-[var(--color-primary)] hover:underline">
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'جميع الفعاليات' : 'All Events'}
          </a>
        </div>
      </Section>
    </main>
  );
}
