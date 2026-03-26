'use client';

import * as React from 'react';
import { cn } from './utils';
import { useImageComponent } from './image-slot';

// Re-export for convenience
export { ImageProvider, useImageComponent } from './image-slot';

/**
 * Card — Stitch "Tonal Layering" design.
 * Uses primary-tinted ambient shadows instead of black drop shadows.
 * No 1px borders per "No-Line Rule".
 * Optional Mashrabiya corner watermark at 10% opacity.
 */

/* ── Base Card ── */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Add a subtle geometric corner accent */
  accent?: boolean;
}

export function Card({ accent = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-2xl bg-white',
        'shadow-[0_4px_24px_rgba(71,64,153,0.06)]',
        'transition-all duration-500 ease-out',
        'hover:shadow-[0_8px_32px_rgba(71,64,153,0.1)]',
        'hover:-translate-y-0.5',
        className
      )}
      {...props}
    >
      {accent && (
        <div
          className="absolute top-0 end-0 w-20 h-20 pointer-events-none opacity-[0.06]"
          aria-hidden="true"
          style={{
            backgroundImage: `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><path d='M40 0l11.18 28.82L80 40 51.18 51.18 40 80 28.82 51.18 0 40l28.82-11.18z' fill='#474099'/></svg>")}")`,
            backgroundSize: '80px 80px',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'top right',
          }}
        />
      )}
      {children}
    </div>
  );
}

/* ── Program Card ── */
interface ProgramCardProps {
  titleAr: string;
  titleEn: string;
  locale: string;
  thumbnailUrl?: string;
  duration?: string;
  priceAed?: number;
  instructorName?: string;
  slug: string;
  className?: string;
}

export function ProgramCard({
  titleAr, titleEn, locale, thumbnailUrl, duration,
  priceAed, instructorName, slug, className,
}: ProgramCardProps) {
  const Img = useImageComponent();
  const title = locale === 'ar' ? titleAr : titleEn;
  const price = priceAed ? (priceAed / 100).toLocaleString() : null;
  const currencyLabel = locale === 'ar' ? 'د.إ' : 'AED';
  const ctaLabel = locale === 'ar' ? 'عرض' : 'View';

  return (
    <Card accent className={cn('overflow-hidden', className)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-b-[40%_20%]">
        {thumbnailUrl ? (
          <Img src={thumbnailUrl} alt={title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
        ) : (
          <div className="h-full w-full bg-[var(--color-primary-100)]" />
        )}
        {duration && (
          <span className="absolute top-3 inline-start-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium">
            {duration}
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col gap-2">
        <h3 className="text-lg font-bold line-clamp-2">{title}</h3>
        {instructorName && (
          <p className="text-sm text-[var(--color-neutral-600)]">{instructorName}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          {price && (
            <span className="font-bold text-[var(--color-primary)]">
              {price} {currencyLabel}
            </span>
          )}
          <a
            href={`/${locale}/programs/courses/${slug}`}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-all duration-300 hover:scale-[1.02]"
          >
            {ctaLabel}
          </a>
        </div>
      </div>
    </Card>
  );
}

/* ── Testimonial Card ── */
interface TestimonialCardProps {
  authorName: string;
  content: string;
  program?: string;
  role?: string;
  rating?: number;
  photoUrl?: string;
  videoUrl?: string;
  countryCode?: string;
  locale?: string;
  className?: string;
}

/** Country flag emoji from ISO code */
function countryFlag(code: string): string {
  const upper = code.toUpperCase();
  return String.fromCodePoint(...[...upper].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

const countryNamesMap: Record<string, { ar: string; en: string }> = {
  AE: { ar: 'الإمارات', en: 'UAE' }, SA: { ar: 'السعودية', en: 'Saudi Arabia' },
  QA: { ar: 'قطر', en: 'Qatar' }, EG: { ar: 'مصر', en: 'Egypt' },
  MA: { ar: 'المغرب', en: 'Morocco' }, DZ: { ar: 'الجزائر', en: 'Algeria' },
  US: { ar: 'أمريكا', en: 'USA' }, CA: { ar: 'كندا', en: 'Canada' },
  DE: { ar: 'ألمانيا', en: 'Germany' }, JP: { ar: 'اليابان', en: 'Japan' },
  TW: { ar: 'تايوان', en: 'Taiwan' }, BE: { ar: 'بلجيكا', en: 'Belgium' },
  ZA: { ar: 'جنوب أفريقيا', en: 'South Africa' },
};

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function TestimonialCard({
  authorName, content, program, role, rating, photoUrl, videoUrl, countryCode, locale, className,
}: TestimonialCardProps) {
  const isAr = locale === 'ar';
  const videoId = videoUrl ? extractYouTubeId(videoUrl) : null;
  const [isPlaying, setIsPlaying] = React.useState(false);

  return (
    <Card accent className={cn('p-0 overflow-hidden', className)}>
      {/* Video thumbnail / play area */}
      {videoId && (
        <div className="relative w-full aspect-video bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-700)]">
          {isPlaying ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`${authorName} testimonial`}
            />
          ) : (
            <button
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer group"
              aria-label={isAr ? 'شاهد التجربة' : 'Watch Story'}
            >
              {/* YouTube thumbnail */}
              <img
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-60"
                loading="lazy"
              />
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[var(--color-accent)] animate-ping opacity-20" />
                <div className="relative h-12 w-12 rounded-full bg-[var(--color-accent)] flex items-center justify-center shadow-[0_4px_20px_rgba(244,126,66,0.4)] group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-white ms-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.5 4.5v11l9-5.5-9-5.5z" />
                  </svg>
                </div>
              </div>
              <span className="relative text-xs font-medium text-white/90">
                {isAr ? 'شاهد التجربة' : 'Watch Story'}
              </span>
            </button>
          )}
        </div>
      )}

      <div className="p-5">
        {/* Quote */}
        <p
          className="text-[var(--color-neutral-700)] leading-relaxed line-clamp-4 text-sm"
          style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
        >
          &ldquo;{content}&rdquo;
        </p>

        {/* Author info */}
        <div className="mt-4 flex items-start gap-3">
          {/* Avatar */}
          <div className="shrink-0 h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-600)] flex items-center justify-center">
            {photoUrl ? (
              <img src={photoUrl} alt={authorName} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="text-lg font-bold text-white/90">{authorName.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-[var(--color-primary)]">{authorName}</p>
            {role && <p className="text-xs text-[var(--color-neutral-600)] mt-0.5">{role}</p>}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {program && (
                <span className="inline-block text-xs bg-[var(--color-primary-50)] text-[var(--color-primary)] px-2 py-0.5 rounded-full font-medium">
                  {program}
                </span>
              )}
              {countryCode && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-neutral-500)]">
                  <span className="text-sm leading-none">{countryFlag(countryCode)}</span>
                  {countryNamesMap[countryCode.toUpperCase()]
                    ? (isAr ? countryNamesMap[countryCode.toUpperCase()].ar : countryNamesMap[countryCode.toUpperCase()].en)
                    : countryCode}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── Coach Card ── */
interface CoachCardProps {
  nameAr: string;
  nameEn: string;
  locale: string;
  photoUrl?: string;
  credentials?: string[];
  specialties?: string[];
  slug: string;
  className?: string;
}

export function CoachCard({
  nameAr, nameEn, locale, photoUrl, credentials, specialties, slug, className,
}: CoachCardProps) {
  const Img = useImageComponent();
  const name = locale === 'ar' ? nameAr : nameEn;
  const ctaLabel = locale === 'ar' ? 'احجز' : 'Book';

  return (
    <Card accent className={cn('p-6 text-center', className)}>
      <div className="mx-auto h-20 w-20 rounded-full overflow-hidden bg-[var(--color-neutral-100)]">
        {photoUrl ? (
          <Img src={photoUrl} alt={name} width={80} height={80} className="object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-3xl text-[var(--color-neutral-500)]">
            {name.charAt(0)}
          </div>
        )}
      </div>
      <h3 className="mt-3 font-bold text-lg">{name}</h3>
      {credentials && credentials.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 mt-2">
          {credentials.map((c) => (
            <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-secondary-50)] text-[var(--color-secondary-600)] font-medium">
              {c}
            </span>
          ))}
        </div>
      )}
      {specialties && specialties.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 mt-2">
          {specialties.slice(0, 3).map((s) => (
            <span key={s} className="text-xs text-[var(--color-neutral-600)]">
              {s}
            </span>
          ))}
        </div>
      )}
      <a
        href={`/${locale}/coaches/${slug}`}
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-2 text-sm font-medium text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-all duration-300 hover:scale-[1.02]"
      >
        {ctaLabel}
      </a>
    </Card>
  );
}

/* ── Event Card ── */
interface EventCardProps {
  name: string;
  date: Date;
  location?: string;
  locale: string;
  slug: string;
  className?: string;
}

export function EventCard({ name, date, location, locale, slug, className }: EventCardProps) {
  const day = date.getDate();
  const month = date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'short' });
  const ctaLabel = locale === 'ar' ? 'سجّل' : 'Register';

  return (
    <Card className={cn('flex overflow-hidden', className)}>
      <div className="flex flex-col items-center justify-center bg-gradient-to-b from-[var(--color-accent)] to-[var(--color-accent-500)] text-white px-5 py-4 min-w-[80px]">
        <span className="text-2xl font-bold">{day}</span>
        <span className="text-xs uppercase">{month}</span>
      </div>
      <div className="flex-1 p-4 flex flex-col justify-between">
        <div>
          <h3 className="font-bold line-clamp-2">{name}</h3>
          {location && (
            <p className="text-sm text-[var(--color-neutral-600)] mt-1">{location}</p>
          )}
        </div>
        <a
          href={`/${locale}/events/${slug}`}
          className="mt-2 text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          {ctaLabel} →
        </a>
      </div>
    </Card>
  );
}
