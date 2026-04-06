import Image from 'next/image';

interface SamersPickProps {
  /** Optional one-line endorsement from Samer */
  quote?: string;
  /**
   * 'badge'    — compact chip for program cards (no quote)
   * 'featured' — larger display for detail pages (shows quote if provided)
   */
  variant?: 'badge' | 'featured';
  /** Current locale */
  locale?: string;
}

/**
 * SamersPick — 9.9 / Task 9.10
 *
 * A gold/amber badge indicating Samer's personal endorsement of a program.
 * Two variants:
 *   - badge:    Compact pill with avatar + label. For program cards.
 *   - featured: Wider card with avatar, label, and optional quote. For detail pages.
 *
 * RTL/LTR safe — uses logical CSS properties via Tailwind v4 and inline dir.
 * Uses samer-navy-headshot for the small circular avatar (clean headshot).
 */
export function SamersPick({
  quote,
  variant = 'badge',
  locale = 'ar',
}: SamersPickProps) {
  const isAr = locale === 'ar';
  const label = isAr ? 'اختيار سامر' : "Samer's Pick";
  const font = isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)';

  /* ── Badge variant (card context) ── */
  if (variant === 'badge') {
    return (
      <span
        dir={isAr ? 'rtl' : 'ltr'}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold select-none"
        style={{
          background: 'linear-gradient(135deg, #D4A853 0%, #F0C96E 50%, #D4A853 100%)',
          color: '#2D1906',
          boxShadow: '0 2px 8px rgba(212,168,83,0.35)',
          fontFamily: font,
          letterSpacing: isAr ? '0' : '0.01em',
        }}
        aria-label={label}
      >
        {/* Micro avatar */}
        <span
          className="relative inline-block rounded-full overflow-hidden shrink-0"
          style={{ width: '18px', height: '18px', border: '1.5px solid rgba(45,25,6,0.25)' }}
        >
          <Image
            src="/images/founder/samer-navy-headshot.jpg"
            alt="Samer Hassan"
            fill
            sizes="18px"
            className="object-cover object-top"
          />
        </span>
        {label}
        {/* Gold star accent */}
        <svg
          aria-hidden="true"
          className="shrink-0"
          style={{ width: '10px', height: '10px', fill: '#2D1906', opacity: 0.65 }}
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </span>
    );
  }

  /* ── Featured variant (detail page context) ── */
  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="inline-flex flex-col gap-3 rounded-2xl p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(212,168,83,0.12) 0%, rgba(240,201,110,0.06) 100%)',
        border: '1.5px solid rgba(212,168,83,0.35)',
        boxShadow: '0 4px 20px rgba(212,168,83,0.12)',
        maxWidth: '360px',
        fontFamily: font,
      }}
    >
      {/* Header row: avatar + name + badge */}
      <div className="flex items-center gap-3">
        <span
          className="relative inline-block rounded-full overflow-hidden shrink-0"
          style={{
            width: '44px',
            height: '44px',
            border: '2px solid rgba(212,168,83,0.5)',
            boxShadow: '0 0 12px rgba(212,168,83,0.3)',
          }}
        >
          <Image
            src="/images/founder/samer-navy-headshot.jpg"
            alt="Samer Hassan"
            fill
            sizes="44px"
            className="object-cover object-top"
          />
        </span>

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-bold leading-tight"
            style={{ color: '#D4A853' }}
          >
            {isAr ? 'سامر حسن' : 'Samer Hassan'}
          </p>
          <p
            className="text-xs leading-tight mt-0.5"
            style={{ color: 'rgba(212,168,83,0.7)' }}
          >
            {isAr ? 'مؤسس كُن كوتشينج' : 'Founder, Kun Coaching'}
          </p>
        </div>

        {/* Gold badge pill */}
        <span
          className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
          style={{
            background: 'linear-gradient(135deg, #D4A853 0%, #F0C96E 100%)',
            color: '#2D1906',
            boxShadow: '0 2px 8px rgba(212,168,83,0.4)',
          }}
        >
          <svg
            aria-hidden="true"
            style={{ width: '10px', height: '10px', fill: '#2D1906', flexShrink: 0 }}
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {label}
        </span>
      </div>

      {/* Quote — only shown in featured variant when provided */}
      {quote && (
        <blockquote
          className="text-sm leading-relaxed m-0"
          style={{
            color: 'var(--foreground)',
            borderInlineStart: '3px solid rgba(212,168,83,0.5)',
            paddingInlineStart: '12px',
            fontStyle: 'italic',
          }}
        >
          {`"${quote}"`}
        </blockquote>
      )}
    </div>
  );
}
