'use client';

import { useRef, useState, useCallback } from 'react';
import Link from 'next/link';

interface BookCover3DProps {
  slug: string;
  coverImage: string;
  title: string;
  author: string;
  locale: string;
  className?: string;
}

export function BookCover3D({ slug, coverImage, title, author, locale, className = '' }: BookCover3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('rotateY(-2deg) rotateX(1deg)');
  const [shadowIntensity, setShadowIntensity] = useState(0.3);
  const isAr = locale === 'ar';

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 20;
    const rotateX = (0.5 - y) * 10;
    setTransform(`rotateY(${rotateY}deg) rotateX(${rotateX}deg) scale(1.03)`);
    setShadowIntensity(0.5);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTransform('rotateY(-2deg) rotateX(1deg)');
    setShadowIntensity(0.3);
  }, []);

  const handleTouchStart = useCallback(() => {
    setTransform('rotateY(0deg) rotateX(0deg) scale(1.03)');
    setShadowIntensity(0.5);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setTransform('rotateY(-2deg) rotateX(1deg)');
    setShadowIntensity(0.3);
  }, []);

  return (
    <Link
      href={`/${locale}/reader/${slug}`}
      className={`block group ${className}`}
      aria-label={isAr ? `اقرأ ${title}` : `Read ${title}`}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-[280px] mx-auto"
        style={{ perspective: '1500px', aspectRatio: '1 / 1.45' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="absolute inset-0 rounded-sm overflow-hidden transition-transform duration-500"
          style={{
            transform,
            transformStyle: 'preserve-3d',
            boxShadow: `0 ${20 + shadowIntensity * 20}px ${40 + shadowIntensity * 40}px rgba(0, 0, 0, ${shadowIntensity}), inset 1px 1px 2px rgba(255,255,255,0.05)`,
            transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          {/* Cover image */}
          <img
            src={coverImage}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />

          {/* Spine crease — right side for Arabic, left for English */}
          <div
            className="absolute top-0 bottom-0 w-3 z-10"
            style={{
              [isAr ? 'right' : 'left']: 0,
              background: isAr
                ? 'linear-gradient(to left, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.2) 40%, transparent 100%)'
                : 'linear-gradient(to right, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.2) 40%, transparent 100%)',
            }}
          />

          {/* Subtle vignette overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.15) 100%)',
            }}
          />
        </div>

        {/* Book title below for accessibility */}
        <div className="mt-4 text-center">
          <p
            className="text-sm font-medium text-[var(--color-text)] truncate"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}
          >
            {title}
          </p>
          <p
            className="text-xs text-[var(--color-neutral-500)] mt-0.5"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}
          >
            {author}
          </p>
        </div>
      </div>
    </Link>
  );
}
