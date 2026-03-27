import { GeometricPattern } from '@kunacademy/ui/patterns';
import { HeroParallax } from './hero-parallax';

interface HeroSectionProps {
  locale: string;
}

export function HeroSection({ locale }: HeroSectionProps) {
  const isAr = locale === 'ar';

  const titleText = isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy';
  const titleWords = titleText.split(' ');

  return (
    <section className="hero-section relative min-h-[100svh] md:min-h-[85vh] flex items-center overflow-hidden">
      {/* Veil panels — CSS-only, auto-play with delay */}
      <div
        className="hero-veil-panel hero-veil-left absolute inset-y-0 z-50 pointer-events-none"
        style={{
          left: 0, width: '50%',
          background: 'linear-gradient(90deg, #1D1A3D 60%, #474099)',
        }}
      />
      <div
        className="hero-veil-panel hero-veil-right absolute inset-y-0 z-50 pointer-events-none"
        style={{
          left: '50%', width: '50%',
          background: 'linear-gradient(270deg, #1D1A3D 60%, #474099)',
        }}
      />
      {/* Light seam */}
      <div
        className="hero-light-seam absolute inset-y-0 z-50 pointer-events-none"
        style={{
          left: '50%', transform: 'translateX(-50%)', width: '2px',
          background: 'linear-gradient(180deg, transparent, rgba(251,195,163,0.6), transparent)',
        }}
      />

      {/* Background with Ken Burns — parallax handled by client component */}
      <HeroParallax>
        <div
          data-hero-bg
          className="hero-bg-cinematic absolute inset-0 w-full h-[120%] -top-[10%]"
        >
          <img
            src="/images/community/hands-circle-gulf.jpg"
            alt=""
            className="w-full h-full object-cover"
            style={{ filter: 'saturate(0.7) brightness(0.4)' }}
            loading="eager"
            fetchPriority="high"
          />
          <div
            className="absolute inset-0"
            style={{
              background: isAr
                ? 'linear-gradient(135deg, rgba(71,64,153,0.92) 0%, rgba(71,64,153,0.7) 40%, rgba(29,26,61,0.85) 100%)'
                : 'linear-gradient(225deg, rgba(71,64,153,0.92) 0%, rgba(71,64,153,0.7) 40%, rgba(29,26,61,0.85) 100%)',
            }}
          />
          <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        </div>
      </HeroParallax>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 w-full py-20">
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
          {/* Text side */}
          <div className="flex-1 text-center md:text-start">
            {/* Academy name — word by word clip reveal */}
            <h1
              className="text-[2.75rem] md:text-[4.5rem] font-bold leading-[1.1] text-[#FFF5E9]"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {titleWords.map((word, i) => (
                <span
                  key={i}
                  className="hero-word-mask inline-block overflow-hidden"
                  style={{ marginInlineEnd: i < titleWords.length - 1 ? '0.3em' : 0 }}
                >
                  <span
                    className="hero-word inline-block"
                    style={{
                      animationDelay: `${700 + i * 120}ms`,
                    }}
                  >
                    {word}
                  </span>
                </span>
              ))}
            </h1>

            {/* Accent line */}
            <div
              className="hero-accent-line h-[2px] mt-3 mb-4 max-w-[120px] md:max-w-[180px] mx-auto md:mx-0"
              style={{
                background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-200))',
                transformOrigin: isAr ? 'right' : 'left',
              }}
            />

            {/* Tagline */}
            <p
              className="hero-tagline text-xl md:text-2xl font-medium text-[var(--color-accent-200)]"
              style={{
                fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)',
              }}
            >
              {isAr ? 'وعيٌ يتخطّى الحدود' : 'Growing Beyond Limits'}
            </p>

            {/* Subtitle — blur deconvolution */}
            <p
              className="hero-subtitle mt-6 text-lg md:text-xl text-[#FFF5E9]/75 max-w-xl leading-relaxed"
            >
              {isAr
                ? 'رحلة تعلّم تبدأ من الجسد وتمتدّ إلى كل بُعد في حياتك المهنية. أكثر من ٥٠٠ كوتش تخرّجوا في ١٣ دولة. مليون حياة تأثّرت.'
                : 'A learning journey that begins in the body and extends into every dimension of your professional life. 500+ coaches across 13 countries. A million lives touched.'}
            </p>

            {/* CTAs — spring entrance */}
            <div className="mt-8 flex flex-wrap justify-center md:justify-start gap-4">
              <a
                href={`/${locale}/pathfinder/`}
                className="hero-cta hero-cta-1 inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)] hover:shadow-[0_8px_32px_rgba(228,96,30,0.5)] hover:scale-[1.02] active:scale-[0.98]"
              >
                {isAr ? 'ابدأ رحلتك' : 'Start Your Journey'}
              </a>
              <a
                href={`/${locale}/programs/`}
                className="hero-cta hero-cta-2 inline-flex items-center justify-center rounded-xl border-2 border-white/30 px-8 py-3.5 text-base font-medium text-white min-h-[52px] hover:bg-white/10 hover:border-white/50 transition-all duration-300 backdrop-blur-sm"
              >
                {isAr ? 'استكشف البرامج' : 'Explore Programs'}
              </a>
            </div>

            {/* Mobile founder photo */}
            <div className="hero-mobile-photo flex md:hidden justify-center mt-8">
              <div className="relative">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 shadow-lg">
                  <img src="/images/founder/samer-closeup-white-thobe-smile.jpg" alt={isAr ? 'سامر حسن' : 'Samer Hassan'} className="w-full h-full object-cover object-top" loading="eager" />
                </div>
                <div className="absolute -bottom-1 start-1/2 -translate-x-1/2 bg-white/95 rounded-full px-2.5 py-0.5 shadow-sm">
                  <span className="text-[10px] font-bold text-[var(--color-primary)]">MCC</span>
                </div>
              </div>
            </div>
          </div>

          {/* Founder photo — star backdrop + dark frame */}
          <div
            className={`hero-photo-frame hidden md:flex shrink-0 ${isAr ? 'hero-photo-rtl' : ''}`}
          >
            <div className="relative">
              {/* SVG stroke-draw star */}
              <div className="absolute -inset-8 animate-float" style={{ animationDuration: '8s' }}>
                <svg viewBox="0 0 400 400" className="w-full h-full">
                  <path className="hero-stroke-outer" d="M200 10l55.5 134.5L390 200l-134.5 55.5L200 390l-55.5-134.5L10 200l134.5-55.5z" fill="none" stroke="#FFF5E9" strokeWidth="1" strokeDasharray="2000" />
                  <path className="hero-stroke-inner" d="M200 60l38.7 101.3L340 200l-101.3 38.7L200 340l-38.7-101.3L60 200l101.3-38.7z" fill="none" stroke="#FFF5E9" strokeWidth="0.5" strokeDasharray="1400" />
                  <circle className="hero-stroke-circle" cx="200" cy="200" r="155" fill="none" stroke="#FFF5E9" strokeWidth="0.4" strokeDasharray="975" />
                </svg>
              </div>
              {/* Photo frame */}
              <div className="relative w-[280px] h-[320px] rounded-2xl overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-700)] p-1.5 shadow-[0_20px_60px_rgba(29,26,61,0.4)]">
                <div className="w-full h-full rounded-xl overflow-hidden">
                  <img src="/images/founder/samer-closeup-white-thobe-smile.jpg" alt={isAr ? 'سامر حسن' : 'Samer Hassan'} className="w-full h-full object-cover object-top" loading="eager" />
                </div>
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--color-primary-800)] to-transparent rounded-b-2xl" />
              </div>
              {/* Badge — bounce pop */}
              <div className="hero-badge absolute -bottom-4 start-1/2" style={{ transform: 'translateX(-50%)' }}>
                <div className="bg-white rounded-xl px-5 py-2 shadow-[0_4px_20px_rgba(71,64,153,0.2)]">
                  <span className="text-sm font-bold text-[var(--color-primary)]">{isAr ? 'أول عربي MCC' : 'First Arab MCC'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="hero-scroll-indicator absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center pt-2">
          <div className="w-1 h-2.5 rounded-full bg-white/60 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
