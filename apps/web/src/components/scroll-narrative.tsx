'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface ScrollNarrativeProps {
  children: ReactNode;
  /** CSS class for the wrapper */
  className?: string;
  /** Whether to disable on prefers-reduced-motion */
  respectMotion?: boolean;
}

/**
 * ScrollNarrative — Wrapper component that registers GSAP ScrollTrigger
 * and handles cleanup. Children can use data-scroll-* attributes for animation.
 * 
 * Progressive enhancement: content is always visible, animations are additive.
 */
export function ScrollNarrative({
  children,
  className = '',
  respectMotion = true,
}: ScrollNarrativeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Respect prefers-reduced-motion
    if (respectMotion) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq.matches) return;
    }

    const ctx = gsap.context(() => {
      // Auto-animate elements with data-scroll-fade
      gsap.utils.toArray<HTMLElement>('[data-scroll-fade]').forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 30,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      // Auto-animate elements with data-scroll-scale
      gsap.utils.toArray<HTMLElement>('[data-scroll-scale]').forEach((el) => {
        gsap.from(el, {
          scale: 0.8,
          opacity: 0,
          duration: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, [respectMotion]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
