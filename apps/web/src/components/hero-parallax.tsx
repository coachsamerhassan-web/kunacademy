'use client';

import { useRef, useEffect, type ReactNode } from 'react';

interface HeroParallaxProps {
  children: ReactNode;
}

/**
 * Thin client wrapper that adds parallax scroll to the hero background.
 * The children (background image + overlays) are server-rendered.
 * This component only adds a scroll listener for the translateY effect.
 */
export function HeroParallax({ children }: HeroParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const handleScroll = () => {
      if (!ref.current) return;
      const bg = ref.current.querySelector('[data-hero-bg]') as HTMLElement;
      if (bg) bg.style.transform = `translateY(${window.scrollY * 0.3}px)`;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return <div ref={ref}>{children}</div>;
}
