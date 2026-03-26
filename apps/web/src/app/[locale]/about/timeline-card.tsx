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

  // Close on Escape key
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

  return (
    <>
      <div className={`flex items-start gap-4 ${reverse ? 'md:flex-row-reverse' : ''}`}>
        {image && !image.endsWith('.svg') && (
          <button
            onClick={() => setExpanded(true)}
            className="shrink-0 cursor-pointer group"
            aria-label={`${isAr ? 'تكبير صورة' : 'Expand image'}: ${title}`}
          >
            <img
              src={image}
              alt={title}
              className="h-16 w-16 rounded-xl object-cover transition-transform duration-300 group-hover:scale-110 group-hover:shadow-lg"
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

      {/* Lightbox — rendered via portal to escape any parent overflow/transform clipping */}
      {expanded && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm cursor-pointer"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          style={{ animation: 'fade-in-item 0.2s ease-out' }}
        >
          <button
            className="absolute top-6 end-6 z-10 flex items-center justify-center w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 transition-colors text-white text-2xl"
            onClick={() => setExpanded(false)}
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            ✕
          </button>
          <img
            src={image}
            alt={title}
            className="max-w-[75vw] max-h-[75vh] rounded-2xl object-contain shadow-2xl"
            style={{ animation: 'fade-in-item 0.3s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </>
  );
}
