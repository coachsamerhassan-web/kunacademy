'use client';

import { useEffect, useRef, useState } from 'react';

interface StickyMobileCTAProps {
  /** Program name — will be truncated if too long */
  programName: string;
  /** Pre-formatted price string e.g. "4,500 AED" or "اشترك مجاناً" */
  price: string;
  /** Target URL for the CTA button */
  ctaHref: string;
  /** Current locale — 'ar' or 'en' */
  locale: string;
  /**
   * Ref to the hero section element.
   * The bar appears only after the hero scrolls out of view.
   * If omitted, the bar appears after the user scrolls 200 px.
   */
  heroRef?: React.RefObject<HTMLElement | null>;
}

/**
 * StickyMobileCTA — 9.9
 *
 * Fixed bottom bar shown ONLY on mobile (<md) after the hero scrolls out of
 * view. Includes program name (truncated), price, and a primary CTA button.
 * RTL/LTR safe. Accounts for iOS home-indicator via env(safe-area-inset-bottom).
 * z-index 40 — above page content, below modal overlays (typically z-50+).
 */
export function StickyMobileCTA({
  programName,
  price,
  ctaHref,
  locale,
  heroRef,
}: StickyMobileCTAProps) {
  const isAr = locale === 'ar';
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // If a heroRef is provided, observe it via IntersectionObserver.
    // Bar appears once the hero is no longer intersecting.
    if (heroRef?.current) {
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          setVisible(!entry.isIntersecting);
        },
        { threshold: 0, rootMargin: '0px 0px 0px 0px' }
      );
      observerRef.current.observe(heroRef.current);
      return () => observerRef.current?.disconnect();
    }

    // Fallback: simple scroll threshold at 200 px
    const onScroll = () => setVisible(window.scrollY > 200);
    window.addEventListener('scroll', onScroll, { passive: true });
    // Run once immediately in case page is already scrolled
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [heroRef]);

  return (
    /* Outer wrapper — hidden on md+ via Tailwind, regardless of visible state */
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      role="region"
      aria-label={isAr ? 'تسجيل سريع' : 'Quick registration'}
      className={[
        // Only render on mobile
        'md:hidden',
        // Fixed positioning
        'fixed bottom-0 inset-x-0 z-40',
        // Visibility transition
        'transition-transform duration-300 ease-out',
        visible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
      style={{
        // Respect iOS notch / home-indicator
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Background: semi-transparent with backdrop blur */}
      <div
        className="relative flex items-center gap-3 px-4 py-3"
        style={{
          background: 'rgba(29, 26, 61, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
        }}
      >
        {/* Program info — grows to fill available space */}
        <div className="flex-1 min-w-0">
          <p
            className="truncate text-sm font-medium leading-tight"
            style={{
              color: 'rgba(255,245,233,0.85)',
              fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)',
            }}
          >
            {programName}
          </p>
          <p
            className="text-base font-bold leading-tight mt-0.5"
            style={{
              color: '#FFF5E9',
              fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)',
            }}
          >
            {price}
          </p>
        </div>

        {/* CTA button */}
        <a
          href={ctaHref}
          className="shrink-0 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 active:scale-95"
          style={{
            background: 'var(--color-accent)',
            boxShadow: '0 4px 16px rgba(228,96,30,0.4)',
            minHeight: '44px',
            fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)',
          }}
        >
          {isAr ? 'سجّل الآن' : 'Register Now'}
        </a>
      </div>
    </div>
  );
}
