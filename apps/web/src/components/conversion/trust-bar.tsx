interface TrustItem {
  /** Inline SVG icon path data */
  iconPath: string;
  iconViewBox?: string;
  /** Main numeric/text value */
  value: string;
  valueAr: string;
  /** Descriptive label */
  label: string;
  labelAr: string;
}

interface TrustBarProps {
  /** Current locale */
  locale: string;
  /**
   * 'compact' — single tight row, embeds naturally inside page sections
   * 'full'    — larger standalone section with more breathing room
   */
  variant?: 'compact' | 'full';
  /** Override the default trust items */
  items?: TrustItem[];
  /** Optional section heading — only displayed in 'full' variant */
  heading?: string;
  headingAr?: string;
}

/* ── Default trust signal items ── */
const DEFAULT_ITEMS: TrustItem[] = [
  {
    // ICF shield / credential mark
    iconPath: 'M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5zm-1 14l-4-4 1.41-1.41L11 13.17l6.59-6.59L19 8l-8 8z',
    iconViewBox: '0 0 24 24',
    value: 'ICF',
    valueAr: 'ICF',
    label: 'Accredited Programs',
    labelAr: 'برامج معتمدة',
  },
  {
    // Graduation cap — coaches trained
    iconPath: 'M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 14.18L4.5 13.1v4.04c0 1.6 3.36 3.86 7.5 3.86s7.5-2.26 7.5-3.86V13.1L12 17.18z',
    iconViewBox: '0 0 24 24',
    value: '500+',
    valueAr: '٥٠٠+',
    label: 'Coaches Trained',
    labelAr: 'كوتش تدرّبوا',
  },
  {
    // Globe — continents
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
    iconViewBox: '0 0 24 24',
    value: '4',
    valueAr: '٤',
    label: 'Continents',
    labelAr: 'قارات',
  },
  {
    // Clock / calendar — years experience
    iconPath: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z',
    iconViewBox: '0 0 24 24',
    value: '20+',
    valueAr: '٢٠+',
    label: 'Years of Experience',
    labelAr: 'سنة خبرة',
  },
  {
    // Award ribbon — MCC credential
    iconPath: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z',
    iconViewBox: '0 0 24 24',
    value: 'MCC',
    valueAr: 'MCC',
    label: 'ICF Master Certified',
    labelAr: 'أعلى اعتماد ICF',
  },
];

/**
 * TrustBar — Task 9.11
 *
 * Horizontal credibility-signal bar. Shows icon + value + label for each
 * trust item. Two variants:
 *   compact — embeds inside other sections, single tight row
 *   full    — standalone section with larger type and optional heading
 *
 * Responsive:
 *   Mobile  — horizontal scroll (no wrap) so all items stay on one line
 *   Desktop — flex-wrap, items distribute naturally
 *
 * RTL/LTR safe via `dir` prop on root element.
 */
export function TrustBar({
  locale,
  variant = 'compact',
  items = DEFAULT_ITEMS,
  heading,
  headingAr,
}: TrustBarProps) {
  const isAr = locale === 'ar';
  const font = isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)';
  const isFull = variant === 'full';

  const headingText = isAr
    ? (headingAr ?? (isFull ? 'ثقة عالمية' : undefined))
    : (heading ?? (isFull ? 'Globally Trusted' : undefined));

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{ fontFamily: font }}
      className={isFull ? 'w-full' : 'w-full'}
    >
      {/* Wrapper */}
      <div
        className={[
          'relative w-full',
          isFull
            ? 'rounded-2xl py-10 px-6'
            : 'rounded-xl py-4 px-4',
        ].join(' ')}
        style={{
          background: isFull
            ? 'linear-gradient(135deg, var(--color-primary-50) 0%, rgba(255,245,233,0.6) 100%)'
            : 'rgba(71,64,153,0.04)',
          border: isFull
            ? '1px solid var(--color-outline-variant)'
            : '1px solid rgba(71,64,153,0.08)',
        }}
      >
        {/* Optional heading — full variant only */}
        {isFull && headingText && (
          <h2
            className="text-center font-bold mb-8"
            style={{
              fontSize: 'var(--text-section)',
              fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)',
              color: 'var(--color-primary)',
            }}
          >
            {headingText}
          </h2>
        )}

        {/* Items row:
            - Mobile: overflow-x-auto (scroll) + nowrap
            - Desktop: flex-wrap + justify-center */}
        <div
          className={[
            'flex gap-3',
            // Mobile horizontal scroll
            'overflow-x-auto',
            // Hide scrollbar visually but keep function
            '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
            // Desktop: wrap and center
            isFull
              ? 'md:flex-wrap md:justify-center md:overflow-visible md:gap-6'
              : 'md:flex-wrap md:justify-center md:overflow-visible',
          ].join(' ')}
        >
          {items.map((item, idx) => (
            <TrustItem
              key={idx}
              item={item}
              isAr={isAr}
              isFull={isFull}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Individual trust item ── */
function TrustItem({
  item,
  isAr,
  isFull,
}: {
  item: TrustItem;
  isAr: boolean;
  isFull: boolean;
}) {
  const value = isAr ? item.valueAr : item.value;
  const label = isAr ? item.labelAr : item.label;

  return (
    <div
      className={[
        'flex shrink-0 items-center rounded-xl transition-all duration-300',
        'hover:scale-[1.03]',
        isFull
          ? 'flex-col gap-3 px-6 py-4 min-w-[100px]'
          : 'flex-row gap-2.5 px-3 py-2.5 min-w-fit',
      ].join(' ')}
      style={{
        background: 'rgba(255,255,255,0.7)',
        border: '1px solid rgba(71,64,153,0.1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Icon */}
      <span
        className={[
          'flex items-center justify-center rounded-lg shrink-0',
          isFull ? 'w-12 h-12' : 'w-8 h-8',
        ].join(' ')}
        style={{ background: 'var(--color-primary-50)' }}
      >
        <svg
          aria-hidden="true"
          viewBox={item.iconViewBox ?? '0 0 24 24'}
          style={{
            width: isFull ? '24px' : '16px',
            height: isFull ? '24px' : '16px',
            fill: 'var(--color-primary)',
          }}
        >
          <path d={item.iconPath} />
        </svg>
      </span>

      {/* Text */}
      <div className={isFull ? 'text-center' : 'text-start'}>
        <p
          className="font-bold leading-none"
          style={{
            fontSize: isFull ? 'var(--text-card-title)' : '0.9375rem',
            color: 'var(--color-primary)',
          }}
        >
          {value}
        </p>
        <p
          className="leading-tight mt-0.5"
          style={{
            fontSize: isFull ? '0.875rem' : '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
