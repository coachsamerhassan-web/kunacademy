'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * TreeNarrative — "The Living Tree" (Direction 2)
 *
 * A parallax tree image alongside content sections.
 * Image scrolls slower than content, creating depth.
 * Content cards alternate left/right with the tree visible on the opposite side.
 *
 * Without image: shows a brand-colored gradient + arabesque pattern.
 * prefers-reduced-motion: static layout, no parallax.
 */

interface TreeNarrativeProps {
  imageSrc?: string;
  children: ReactNode;
}

export function TreeNarrative({
  imageSrc = '/images/tree/olive-tree.jpg',
  children,
}: TreeNarrativeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageColRef = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !imageColRef.current) return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const ctx = gsap.context(() => {
      // Parallax: image column moves slower than scroll
      gsap.to(imageColRef.current, {
        yPercent: -15,
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.3,
        },
      });

      // Animate each section on scroll — start visible, enhance on scroll
      gsap.utils.toArray<HTMLElement>('[data-tree-phase]').forEach((el, i) => {
        // Set initial state with CSS (visible), then animate TO enhanced state
        gsap.fromTo(el.querySelector('.tree-card') || el.firstElementChild, {
          opacity: 0.4,
          y: 20,
        }, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            end: 'top 40%',
            scrub: 0.5,
          },
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Background: tree image or gradient */}
      <div
        ref={imageColRef}
        className="absolute inset-0 w-full h-[115%]"
        aria-hidden="true"
      >
        {!imgError ? (
          <img
            src={imageSrc}
            alt=""
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            style={{
              filter: 'saturate(0.6) contrast(1.05) brightness(1.1)',
              opacity: 0.35,
            }}
            loading="lazy"
          />
        ) : null}

        {/* Duotone overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(255,245,233,0.4) 0%, rgba(71,64,153,0.10) 50%, rgba(255,245,233,0.6) 100%)',
          }}
        />

        {/* Subtle arabesque pattern */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.04]"
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 200 600"
        >
          {[100, 200, 300, 400, 500].map((y, i) => (
            <path
              key={i}
              d={`M100 ${y-25}l15 25-15 25-15-25z`}
              fill="none"
              stroke="#474099"
              strokeWidth="0.5"
            />
          ))}
          <path
            d="M100 0 Q95 150 100 300 Q105 450 100 600"
            fill="none"
            stroke="#474099"
            strokeWidth="0.3"
            strokeDasharray="6 10"
          />
        </svg>
      </div>

      {/* Content sections */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// TreePhase moved to ./tree-phase.tsx (server component, no GSAP dependency)
export { TreePhase } from './tree-phase';
