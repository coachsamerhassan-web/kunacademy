import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'الفعاليات | أكاديمية كُن' : 'Events | Kun Academy',
    description: isAr
      ? 'ورش عمل، ندوات، ولقاءات مباشرة من أكاديمية كُن'
      : 'Workshops, webinars, and live gatherings from Kun Academy',
  };
}

const locationTypeLabels: Record<string, { ar: string; en: string; className: string }> = {
  'in-person': { ar: 'حضوري', en: 'In-Person', className: 'bg-green-100 text-green-700' },
  'online': { ar: 'أونلاين', en: 'Online', className: 'bg-blue-100 text-blue-700' },
  'hybrid': { ar: 'حضوري + أونلاين', en: 'Hybrid', className: 'bg-purple-100 text-purple-700' },
};

export default async function EventsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const allEvents = await cms.getAllEvents();
  const today = new Date().toISOString().split('T')[0];
  const upcoming = allEvents.filter((e) => e.date_start >= today);
  const past = allEvents.filter((e) => e.date_start < today);

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="eight-star" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'الفعاليات' : 'Events'}
          </h1>
          <p className="mt-4 text-white/65 max-w-lg mx-auto text-lg md:text-xl">
            {isAr
              ? 'ورش عمل، ندوات، ولقاءات مباشرة من أكاديمية كُن'
              : 'Workshops, webinars, and live gatherings from Kun Academy'}
          </p>
        </div>
      </section>

      {/* Upcoming Events */}
      <Section variant="white">
        <h2
          className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-8"
          style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
        >
          {isAr ? 'الفعاليات القادمة' : 'Upcoming Events'}
        </h2>

        {upcoming.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {upcoming.map((event) => {
              const title = isAr ? event.title_ar : event.title_en;
              const description = isAr ? event.description_ar : event.description_en;
              const location = isAr ? event.location_ar : event.location_en;
              const dateObj = new Date(event.date_start + 'T00:00:00');
              const dateStr = dateObj.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              });
              const locType = locationTypeLabels[event.location_type];
              const isFree = !event.price_aed || event.price_aed === 0;

              return (
                <a key={event.slug} href={`/${locale}/events/${event.slug}`} className="group">
                  <Card accent className="overflow-hidden h-full">
                    {event.image_url && (
                      <div className="relative aspect-[16/9] overflow-hidden">
                        <Image src={event.image_url} alt={title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 50vw" />
                        {locType && (
                          <span className={`absolute top-3 ${isAr ? 'right-3' : 'left-3'} inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${locType.className}`}>
                            {isAr ? locType.ar : locType.en}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-2 text-sm text-[var(--color-accent)] font-medium mb-2">
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        {dateStr}
                      </div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
                        {title}
                      </h3>
                      {description && (
                        <p className="mt-2 text-sm text-[var(--color-neutral-600)] line-clamp-2">{description}</p>
                      )}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--color-neutral-100)]">
                        <div className="flex items-center gap-2">
                          {location && (
                            <span className="text-xs text-[var(--color-neutral-500)]">{location}</span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-[var(--color-primary)]">
                          {isFree ? (isAr ? 'مجاني' : 'Free') : `${event.price_aed} ${isAr ? 'د.إ' : 'AED'}`}
                        </span>
                      </div>
                    </div>
                  </Card>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-[var(--color-accent-50)] flex items-center justify-center">
              <svg className="w-7 h-7 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)]">
              {isAr ? 'لا توجد فعاليات قادمة حاليًا' : 'No Upcoming Events'}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)] max-w-md mx-auto">
              {isAr
                ? 'تابعنا على وسائل التواصل للبقاء على اطلاع بالفعاليات الجديدة'
                : 'Follow us on social media to stay updated on new events'}
            </p>
          </div>
        )}
      </Section>

      {/* Past Events */}
      {past.length > 0 && (
        <Section variant="surface">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-6"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'فعاليات سابقة' : 'Past Events'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {past.map((event) => {
              const title = isAr ? event.title_ar : event.title_en;
              const dateObj = new Date(event.date_start + 'T00:00:00');
              const dateStr = dateObj.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });

              return (
                <div key={event.slug} className="flex items-center gap-4 rounded-xl border border-[var(--color-neutral-200)] bg-white p-4">
                  <div className="shrink-0 text-center">
                    <div className="text-2xl font-bold text-[var(--color-primary)]">{dateObj.getDate()}</div>
                    <div className="text-xs text-[var(--color-neutral-500)] uppercase">
                      {dateObj.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short' })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[var(--text-primary)] line-clamp-1">{title}</h3>
                    <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">{dateStr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </main>
  );
}
