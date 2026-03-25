'use client';

import { useEffect } from 'react';

/**
 * ScrollObserver — Progressive enhancement scroll animations.
 * 
 * 1. Adds .scroll-animated to <html> — this enables hidden states in CSS
 * 2. Observes elements and adds .is-visible when they enter viewport
 * 
 * Without JS: everything is visible (no .scroll-animated = no hiding)
 * With JS: elements animate in on scroll
 */
export function ScrollObserver() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return; // no animations for reduced-motion

    // Enable animation hiding (content was visible before this)
    document.documentElement.classList.add('scroll-animated');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = el.dataset.animateDelay;
            if (delay) {
              setTimeout(() => el.classList.add('is-visible'), parseInt(delay, 10));
            } else {
              el.classList.add('is-visible');
            }
            observer.unobserve(el);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const selector = '.animate-fade-up, .animate-slide-start, .animate-slide-end, .animate-scale, .stagger-children, [data-animate]';

    const observeAll = () => {
      document.querySelectorAll(selector).forEach((el) => {
        if (!el.classList.contains('is-visible')) {
          observer.observe(el);
        }
      });
    };

    // Run after a tick to let React finish rendering
    requestAnimationFrame(() => {
      observeAll();
      // Re-check after hydration completes
      setTimeout(observeAll, 500);
    });

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('scroll-animated');
    };
  }, []);

  return null;
}
