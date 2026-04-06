'use client';

import Image from 'next/image';
import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventItem {
  slug: string;
  title_ar: string;
  title_en: string;
  description_ar?: string;
  description_en?: string;
  date_start: string;
  date_end?: string;
  location_ar?: string;
  location_en?: string;
  location_type: 'in-person' | 'online' | 'hybrid';
  capacity?: number;
  price_aed: number;
  price_egp: number;
  price_usd: number;
  image_url?: string;
  program_slug?: string;
  program_logo?: string;
  status?: 'open' | 'sold_out' | 'completed';
  registration_url?: string;
}

interface Props {
  upcoming: EventItem[];
  past: EventItem[];
  locale: string;
  isAr: boolean;
  headingFont: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LOCATION_LABELS: Record<string, { ar: string; en: string; bg: string; text: string }> = {
  'in-person': { ar: 'حضوري', en: 'In-Person', bg: 'rgba(107, 170, 117, 0.15)', text: '#3a7a45' },
  'online':    { ar: 'أونلاين', en: 'Online', bg: 'rgba(91, 141, 184, 0.15)', text: '#2c6494' },
  'hybrid':    { ar: 'حضوري + أونلاين', en: 'Hybrid', bg: 'rgba(147, 107, 190, 0.15)', text: '#6a3fa0' },
};

const STATUS_CONFIG: Record<string, { ar: string; en: string; bg: string; text: string }> = {
  open:      { ar: 'مفتوح للتسجيل', en: 'Open for Registration', bg: 'rgba(71,64,153,0.1)', text: 'var(--color-primary)' },
  sold_out:  { ar: 'اكتمل التسجيل', en: 'Sold Out', bg: 'rgba(220,60,60,0.1)', text: '#c0392b' },
  completed: { ar: 'انتهت الفعالية', en: 'Completed', bg: 'rgba(100,100,100,0.1)', text: '#666' },
};

// Brand gradient fallbacks keyed by location_type
const GRADIENT_FALLBACKS: Record<string, string> = {
  'in-person': 'linear-gradient(135deg, #474099 0%, #2c6494 100%)',
  'online':    'linear-gradient(135deg, #F47E42 0%, #c0542a 100%)',
  'hybrid':    'linear-gradient(135deg, #474099 0%, #F47E42 100%)',
};

// ── Main Component ────────────────────────────────────────────────────────────

export function EventsGrid({ upcoming, past, locale, isAr, headingFont }: Props) {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const events = tab === 'upcoming' ? upcoming : past;

  const t = {
    upcoming: isAr ? 'القادمة' : 'Upcoming',
    past: isAr ? 'السابقة' : 'Past',
    noUpcoming: isAr ? 'لا توجد فعاليات قادمة حاليًا' : 'No Upcoming Events',
    noUpcomingDesc: isAr
      ? 'تابعنا على وسائل التواصل للبقاء على اطلاع بالفعاليات الجديدة'
      : 'Follow us on social media to stay updated on new events',
    contactUs: isAr ? 'تواصل معنا' : 'Contact Us',
    noPast: isAr ? 'لا توجد فعاليات سابقة' : 'No past events yet',
    free: isAr ? 'مجاني' : 'Free',
    aed: isAr ? 'د.إ' : 'AED',
    register: isAr ? 'سجّل الآن' : 'Register Now',
    viewDetails: isAr ? 'عرض التفاصيل' : 'View Details',
    soldOut: isAr ? 'اكتمل' : 'Sold Out',
    online: isAr ? 'أونلاين' : 'Online',
  };

  return (
    <div>
      {/* ── Tab Toggle ─────────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 mb-10 p-1 rounded-xl w-fit"
        style={{ background: 'var(--color-neutral-100)' }}
        role="tablist"
        aria-label={isAr ? 'تصفية الفعاليات' : 'Filter events'}
      >
        {(['upcoming', 'past'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="relative px-6 py-2 text-sm font-semibold rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            style={{
              background: tab === id ? '#fff' : 'transparent',
              color: tab === id ? 'var(--color-primary)' : 'var(--text-muted)',
              boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {id === 'upcoming' ? t.upcoming : t.past}
            {id === 'upcoming' && upcoming.length > 0 && (
              <span
                className="ms-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
                style={{
                  background: tab === 'upcoming' ? 'var(--color-primary)' : 'var(--color-neutral-300)',
                  color: tab === 'upcoming' ? '#fff' : 'var(--text-muted)',
                }}
              >
                {upcoming.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Events Grid ───────────────────────────────────────────────────── */}
      {events.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard
              key={event.slug}
              event={event}
              locale={locale}
              isAr={isAr}
              isPast={tab === 'past'}
              headingFont={headingFont}
              t={t}
            />
          ))}
        </div>
      ) : (
        <EmptyState tab={tab} isAr={isAr} locale={locale} headingFont={headingFont} t={t} />
      )}
    </div>
  );
}

// ── Event Card ────────────────────────────────────────────────────────────────

function EventCard({
  event,
  locale,
  isAr,
  isPast,
  headingFont,
  t,
}: {
  event: EventItem;
  locale: string;
  isAr: boolean;
  isPast: boolean;
  headingFont: string;
  t: Record<string, string>;
}) {
  const title = isAr ? event.title_ar : event.title_en;
  const description = isAr ? event.description_ar : event.description_en;
  const locationLabel = isAr ? event.location_ar : event.location_en;
  const locType = LOCATION_LABELS[event.location_type];

  const dateObj = new Date(event.date_start + 'T00:00:00');
  const dateStr = dateObj.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isFree = !event.price_aed || event.price_aed === 0;
  const priceLabel = isFree
    ? t.free
    : `${event.price_aed.toLocaleString()} ${t.aed}`;

  // Determine effective status
  const effectiveStatus = event.status ?? (isPast ? 'completed' : 'open');
  const statusCfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.open;

  const hasImage = Boolean(event.image_url);
  const fallbackGradient = GRADIENT_FALLBACKS[event.location_type] ?? GRADIENT_FALLBACKS['hybrid'];

  // CTA
  const ctaLabel = isPast || effectiveStatus === 'completed'
    ? t.viewDetails
    : effectiveStatus === 'sold_out'
    ? t.soldOut
    : t.register;

  const ctaHref =
    effectiveStatus === 'open' && event.registration_url
      ? event.registration_url
      : `/${locale}/events/${event.slug}`;

  const ctaIsExternal = Boolean(effectiveStatus === 'open' && event.registration_url);

  return (
    <a
      href={ctaHref}
      target={ctaIsExternal ? '_blank' : undefined}
      rel={ctaIsExternal ? 'noopener noreferrer' : undefined}
      className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      style={{
        background: '#fff',
        border: '1px solid var(--color-neutral-100)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}
      aria-label={title}
    >
      {/* ── Card Image / Fallback ─────────────────────────────────────────── */}
      <div className="relative aspect-[16/9] overflow-hidden shrink-0">
        {hasImage ? (
          <Image
            src={event.image_url!}
            alt=""
            aria-hidden="true"
            fill
            className="object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: fallbackGradient }}
            aria-hidden="true"
          >
            {/* Decorative Arabic/geometric text in the gradient */}
            <span
              className="absolute inset-0 flex items-center justify-center text-[4rem] font-bold select-none pointer-events-none"
              style={{ color: 'rgba(255,255,255,0.12)', fontFamily: 'var(--font-arabic-heading)' }}
              aria-hidden="true"
            >
              كُن
            </span>
          </div>
        )}

        {/* Location type pill — top-start */}
        {locType && (
          <span
            className={`absolute top-3 ${isAr ? 'right-3' : 'left-3'} inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm`}
            style={{ background: locType.bg, color: locType.text, border: `1px solid ${locType.text}22` }}
          >
            {isAr ? locType.ar : locType.en}
          </span>
        )}

        {/* Program logo — top-end corner */}
        {event.program_logo && (
          <div
            className={`absolute top-3 ${isAr ? 'left-3' : 'right-3'} w-10 h-10 rounded-lg overflow-hidden bg-white/90 backdrop-blur-sm p-1 shadow-md`}
          >
            <Image
              src={event.program_logo}
              alt=""
              aria-hidden="true"
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {/* Past event — dim overlay */}
        {isPast && (
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* ── Card Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-5">
        {/* Date row */}
        <div
          className="flex items-center gap-2 text-xs font-medium mb-3"
          style={{ color: 'var(--color-accent)' }}
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span>{dateStr}</span>
        </div>

        {/* Title */}
        <h3
          className="text-base font-bold leading-snug text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors duration-200 line-clamp-2 mb-2"
          style={{ fontFamily: headingFont }}
        >
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p
            className="text-sm leading-relaxed line-clamp-2 flex-1 mb-4"
            style={{ color: 'var(--text-muted)' }}
          >
            {description}
          </p>
        )}

        {/* ── Footer row ───────────────────────────────────────────────── */}
        <div className="mt-auto pt-4 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--color-neutral-100)' }}>
          {/* Location + price */}
          <div className="flex flex-col gap-0.5 min-w-0">
            {locationLabel && (
              <span
                className="text-xs truncate"
                style={{ color: 'var(--text-muted)' }}
              >
                {locationLabel}
              </span>
            )}
            <span
              className="text-sm font-bold"
              style={{ color: isFree ? '#3a7a45' : 'var(--color-primary)' }}
            >
              {priceLabel}
            </span>
          </div>

          {/* Status badge + CTA */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: statusCfg.bg, color: statusCfg.text }}
            >
              {isAr ? statusCfg.ar : statusCfg.en}
            </span>
            <span
              className="text-xs font-semibold px-3 py-1 rounded-lg transition-all duration-200 whitespace-nowrap"
              style={{
                background: effectiveStatus === 'open'
                  ? 'var(--color-primary)'
                  : effectiveStatus === 'sold_out'
                  ? 'rgba(192,57,43,0.1)'
                  : 'var(--color-neutral-100)',
                color: effectiveStatus === 'open'
                  ? '#fff'
                  : effectiveStatus === 'sold_out'
                  ? '#c0392b'
                  : 'var(--text-muted)',
              }}
            >
              {ctaLabel}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({
  tab,
  isAr,
  locale,
  headingFont,
  t,
}: {
  tab: 'upcoming' | 'past';
  isAr: boolean;
  locale: string;
  headingFont: string;
  t: Record<string, string>;
}) {
  const isUpcoming = tab === 'upcoming';

  return (
    <div className="text-center py-20">
      <div
        className="mx-auto mb-7 w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(71,64,153,0.07)' }}
      >
        <svg
          className="w-7 h-7"
          style={{ color: 'var(--color-primary)' }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </div>

      <h3
        className="text-lg font-bold text-[var(--text-primary)] mb-2"
        style={{ fontFamily: headingFont }}
      >
        {isUpcoming ? t.noUpcoming : t.noPast}
      </h3>

      {isUpcoming && (
        <>
          <p
            className="text-sm max-w-sm mx-auto leading-relaxed mb-7"
            style={{ color: 'var(--text-muted)' }}
          >
            {t.noUpcomingDesc}
          </p>
          <a
            href={`/${locale}/contact`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            {t.contactUs}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </>
      )}
    </div>
  );
}
