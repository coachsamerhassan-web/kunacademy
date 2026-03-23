import * as React from 'react';
import { cn } from './utils';

/* ── Base Card ── */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--card-radius)] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)]',
        className
      )}
      {...props}
    >
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
  const title = locale === 'ar' ? titleAr : titleEn;
  const price = priceAed ? (priceAed / 100).toLocaleString() : null;
  const currencyLabel = locale === 'ar' ? 'د.إ' : 'AED';
  const ctaLabel = locale === 'ar' ? 'عرض' : 'View';

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Arch-shaped image */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-b-[40%_20%]">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[var(--color-primary-100)]" />
        )}
        {duration && (
          <span className="absolute top-3 inline-start-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium">
            {duration}
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2">
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
            className="inline-flex items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-colors"
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
  rating?: number;
  photoUrl?: string;
  videoUrl?: string;
  className?: string;
}

export function TestimonialCard({
  authorName, content, program, rating, photoUrl, videoUrl, className,
}: TestimonialCardProps) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="h-16 w-16 rounded-full overflow-hidden bg-[var(--color-neutral-100)]">
            {photoUrl ? (
              <img src={photoUrl} alt={authorName} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-2xl text-[var(--color-neutral-500)]">
                {authorName.charAt(0)}
              </div>
            )}
          </div>
          {videoUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
                <span className="text-white text-xs ms-0.5">▶</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold">{authorName}</p>
          {program && (
            <span className="inline-block text-xs bg-[var(--color-primary-50)] text-[var(--color-primary)] px-2 py-0.5 rounded-full mt-1">
              {program}
            </span>
          )}
          {rating && (
            <div className="flex gap-0.5 mt-1">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={i < rating ? 'text-[var(--color-accent)]' : 'text-[var(--color-neutral-300)]'}>
                  ★
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed line-clamp-4">
        &ldquo;{content}&rdquo;
      </p>
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
  const name = locale === 'ar' ? nameAr : nameEn;
  const ctaLabel = locale === 'ar' ? 'احجز' : 'Book';

  return (
    <Card className={cn('p-6 text-center', className)}>
      <div className="mx-auto h-20 w-20 rounded-full overflow-hidden bg-[var(--color-neutral-100)]">
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
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
        href={`/${locale}/programs/coaching/${slug}`}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-[var(--color-accent)] px-6 py-2 text-sm font-medium text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-colors"
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
      <div className="flex flex-col items-center justify-center bg-[var(--color-accent)] text-white px-5 py-4 min-w-[80px]">
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
