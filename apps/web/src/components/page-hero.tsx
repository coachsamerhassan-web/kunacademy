import Image from 'next/image';
import { GeometricPattern, type PatternName } from '@kunacademy/ui/patterns';

interface PageHeroProps {
  locale: string;
  titleAr: string;
  titleEn: string;
  subtitleAr?: string;
  subtitleEn?: string;
  eyebrowAr?: string;
  eyebrowEn?: string;
  pattern?: PatternName;
  /** Use image background instead of gradient */
  imageUrl?: string;
}

export function PageHero({
  locale, titleAr, titleEn, subtitleAr, subtitleEn,
  eyebrowAr, eyebrowEn, pattern = 'flower-of-life', imageUrl,
}: PageHeroProps) {
  const isAr = locale === 'ar';

  return (
    <section
      className="relative overflow-hidden py-16 md:py-24"
      style={imageUrl ? undefined : {
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)',
      }}
    >
      {imageUrl && (
        <div className="absolute inset-0">
          <Image src={imageUrl} alt="" fill className="object-cover" style={{ filter: 'saturate(0.5) brightness(0.35)' }} priority />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(71,64,153,0.88) 0%, rgba(29,26,61,0.92) 100%)' }} />
        </div>
      )}
      <GeometricPattern pattern={pattern} opacity={0.08} fade="both" />
      <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
        {(eyebrowAr || eyebrowEn) && (
          <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent-200)] mb-4">
            {isAr ? eyebrowAr : eyebrowEn}
          </p>
        )}
        <h1
          className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
          style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
        >
          {isAr ? titleAr : titleEn}
        </h1>
        {(subtitleAr || subtitleEn) && (
          <p className="mt-5 text-white/65 max-w-2xl mx-auto text-lg md:text-2xl">
            {isAr ? subtitleAr : subtitleEn}
          </p>
        )}
      </div>
    </section>
  );
}
