import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { PromoVideo } from '@/components/promo-video';
import { EventCountdown } from '@/components/event-countdown';
import { EventRegistrationForm } from './event-registration-form';
import { eventJsonLd } from '@kunacademy/ui/structured-data';
import { JsonLd } from '@/components/seo/JsonLd';

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

  // Fetch featured testimonials (only used when speakers are present)
  const testimonials = await cms.getFeaturedTestimonials();

  return (
    <main>
      <JsonLd
        data={eventJsonLd({
          locale,
          name: title,
          description: description || '',
          slug,
          image: event.image_url || undefined,
          startDate: event.date_start,
          endDate: event.date_end || undefined,
          location: location || 'TBD',
          locationType: event.location_type as 'in-person' | 'online' | 'hybrid' || 'in-person',
          priceAed: isFree ? undefined : event.price_aed || undefined,
        })}
      />
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        {event.image_url ? (
          <>
            <div className="absolute inset-0">
              <Image src={event.image_url} alt="" fill className="object-cover" style={{ filter: 'brightness(0.3)' }} priority />
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
            {event.promo_video_url && (
              <PromoVideo url={event.promo_video_url} title={title} className="max-w-2xl mt-6" />
            )}
          </div>
        </div>
      </section>

      {/* Countdown */}
      {!isPast && !isDeadlinePassed && (
        <div className="mx-auto max-w-lg my-8 px-4">
          <EventCountdown targetDate={event.date_start} locale={locale} />
        </div>
      )}

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

              {/* Speakers — rich profile cards */}
              {speakers.filter(Boolean).length > 0 && (
                <div className="mt-8">
                  <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">
                    {isAr ? 'المتحدثون' : 'Speakers'}
                  </h2>
                  <div className="space-y-4">
                    {speakers.filter(Boolean).map((speaker) => {
                      if (!speaker) return null;
                      const name = speaker.name_ar || speaker.name_en;
                      const speakerTitle = isAr ? speaker.title_ar : speaker.title_en;
                      const bio = isAr ? speaker.bio_ar : speaker.bio_en;
                      const specialties: string[] = speaker.specialties ?? [];
                      return (
                        <div
                          key={speaker.slug}
                          className="rounded-2xl border border-[var(--color-neutral-200)] p-5"
                        >
                          {/* Top row: photo + meta */}
                          <div className="flex gap-4">
                            {/* Photo */}
                            <div className="relative h-[120px] w-[120px] rounded-2xl overflow-hidden bg-[var(--color-neutral-100)] shrink-0">
                              {speaker.photo_url ? (
                                <Image
                                  src={speaker.photo_url}
                                  alt={name}
                                  fill
                                  className="object-cover"
                                  style={{ objectPosition: 'center 15%' }}
                                  sizes="120px"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-3xl font-bold text-[var(--color-neutral-400)]">
                                  {name.charAt(0)}
                                </div>
                              )}
                            </div>

                            {/* Name / title / badges */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span
                                  className="text-xl font-bold text-[var(--text-primary)]"
                                  style={{ fontFamily: 'var(--font-arabic-body)' }}
                                >
                                  {name}
                                </span>
                                {speaker.icf_credential && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-primary)] text-white">
                                    {speaker.icf_credential}
                                  </span>
                                )}
                              </div>

                              {speakerTitle && (
                                <div
                                  className="text-sm text-[var(--color-neutral-600)] mb-2"
                                  style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                                >
                                  {speakerTitle}
                                </div>
                              )}

                              {specialties.length > 0 && (
                                <div
                                  className="text-xs text-[var(--color-neutral-500)]"
                                  style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                                >
                                  {specialties.join('  ·  ')}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Bio excerpt */}
                          {bio && (
                            <p
                              className="mt-4 text-sm text-[var(--color-neutral-700)] leading-relaxed line-clamp-3"
                              style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                            >
                              {bio}
                            </p>
                          )}

                          {/* View full profile link */}
                          <div className="mt-3">
                            <a
                              href={`/${locale}/coaches/${speaker.slug}`}
                              className="text-sm font-medium text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                            >
                              {isAr ? 'عرض الملف الكامل ←' : 'View Full Profile →'}
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar — Registration Card */}
            <div>
              {isPast ? (
                <div className="sticky top-24 rounded-2xl border border-[var(--color-neutral-200)] p-6">
                  <div className="text-center mb-4">
                    <div className="text-2xl font-bold text-[var(--color-primary)]">
                      {isFree ? (isAr ? 'مجاني' : 'Free') : `${event.price_aed} ${isAr ? 'د.إ' : 'AED'}`}
                    </div>
                  </div>
                  <div className="text-center py-3 rounded-xl bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] text-sm font-medium">
                    {isAr ? 'انتهت هذه الفعالية' : 'This event has ended'}
                  </div>
                </div>
              ) : isDeadlinePassed ? (
                <div className="sticky top-24 rounded-2xl border border-[var(--color-neutral-200)] p-6">
                  <div className="text-center mb-4">
                    <div className="text-2xl font-bold text-[var(--color-primary)]">
                      {isFree ? (isAr ? 'مجاني' : 'Free') : `${event.price_aed} ${isAr ? 'د.إ' : 'AED'}`}
                    </div>
                  </div>
                  <div className="text-center py-3 rounded-xl bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] text-sm font-medium">
                    {isAr ? 'انتهى التسجيل' : 'Registration closed'}
                  </div>
                </div>
              ) : (
                <EventRegistrationForm
                  eventSlug={event.slug}
                  eventName={title}
                  isFree={isFree}
                  priceAed={event.price_aed}
                  priceEgp={event.price_egp}
                  priceUsd={event.price_usd}
                  capacity={event.capacity}
                  locale={locale}
                  registrationDeadline={event.registration_deadline}
                  eventDate={event.date_start ?? null}
                />
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Testimonials — only when there are speakers and featured testimonials */}
      {speakers.filter(Boolean).length > 0 && testimonials.length > 0 && (
        <Section variant="surface">
          <div className="max-w-[var(--max-content-width)] mx-auto px-4 md:px-6">
            <h2
              className="text-xl font-bold text-[var(--text-primary)] mb-6 text-center"
              style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
            >
              {isAr ? 'ماذا يقول طلاب مدربينا' : "What Our Coaches' Students Say"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {testimonials.slice(0, 3).map((t, idx) => {
                const flagMap: Record<string, string> = {
                  AE: '🇦🇪', SA: '🇸🇦', EG: '🇪🇬', DZ: '🇩🇿',
                  KW: '🇰🇼', QA: '🇶🇦', BH: '🇧🇭', OM: '🇴🇲',
                  JO: '🇯🇴', LB: '🇱🇧', MA: '🇲🇦', TN: '🇹🇳',
                };
                const flag = t.country_code ? flagMap[t.country_code] ?? '' : '';
                const content = t.content_ar || t.content_en || '';
                const tName = t.name_ar || t.name_en || '';
                const role = isAr ? t.role_ar : t.role_en;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-[var(--color-neutral-200)] bg-white p-5 flex flex-col gap-3"
                  >
                    {/* Quote */}
                    <p
                      className="text-sm italic text-[var(--color-neutral-700)] leading-relaxed line-clamp-3 flex-1"
                      style={{ fontFamily: 'var(--font-arabic-body)' }}
                      dir="rtl"
                    >
                      &ldquo;{content}&rdquo;
                    </p>

                    {/* Attribution */}
                    <div>
                      <div
                        className="font-medium text-[var(--text-primary)] text-sm"
                        style={{ fontFamily: 'var(--font-arabic-body)' }}
                        dir="rtl"
                      >
                        — {tName} {flag}
                      </div>
                      {(role || t.program) && (
                        <div
                          className="text-xs text-[var(--color-neutral-500)] mt-0.5"
                          style={{ fontFamily: 'var(--font-arabic-body)' }}
                          dir="rtl"
                        >
                          {[role, t.program].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>

                    {/* Video link */}
                    {t.video_url && (
                      <a
                        href={t.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                      >
                        🎥 {isAr ? 'شاهد الفيديو' : 'Watch'}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

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
