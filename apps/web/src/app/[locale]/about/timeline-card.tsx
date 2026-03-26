'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

interface TimelineCardContentProps {
  image: string;
  title: string;
  text: string;
  isAr: boolean;
  reverse: boolean;
}

export function TimelineCardContent({ image, title, text, isAr, reverse }: TimelineCardContentProps) {
  const [expanded, setExpanded] = React.useState(false);

  // Close on Escape key + lock body scroll
  React.useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [expanded]);

  const hasImage = image && !image.endsWith('.svg');

  return (
    <>
      <div className={`flex items-start gap-4 ${reverse ? 'md:flex-row-reverse' : ''}`}>
        {hasImage && (
          <button
            onClick={() => setExpanded(true)}
            className="shrink-0 cursor-pointer group"
            aria-label={`${isAr ? 'تكبير صورة' : 'Expand image'}: ${title}`}
          >
            <img
              src={image}
              alt={title}
              className="h-20 w-20 rounded-xl object-cover transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg"
              loading="lazy"
            />
          </button>
        )}
        <div>
          <h3 className="font-bold text-[var(--text-primary)]">{title}</h3>
          <p className="mt-2 text-sm text-[var(--color-neutral-600)] leading-relaxed" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
            {text}
          </p>
        </div>
      </div>

      {/* Lightbox — portal to body to escape parent overflow/transform */}
      {expanded && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer p-6"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          style={{ animation: 'fade-in-item 0.2s ease-out' }}
        >
          {/* Close button */}
          <button
            className="absolute top-5 end-5 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 transition-colors text-white text-xl"
            onClick={() => setExpanded(false)}
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            ✕
          </button>

          {/* Title above the image */}
          <h3
            className="text-white text-xl md:text-2xl font-bold mb-4 text-center max-w-[75vw]"
            style={{
              fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)',
              animation: 'fade-in-item 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {title}
          </h3>

          {/* Full-size image */}
          <img
            src={image}
            alt={title}
            className="max-w-[80vw] max-h-[70vh] rounded-2xl object-contain shadow-2xl"
            style={{ animation: 'fade-in-item 0.35s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </>
  );
}
