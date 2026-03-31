'use client';

import { useEffect, useRef, useState } from 'react';

interface PromoVideoProps {
  url: string;
  title?: string;
  className?: string;
}

type VideoType = 'youtube' | 'drive' | 'direct';

function detectVideoType(url: string): { type: VideoType; id?: string } {
  // YouTube
  const ytFull = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytFull) return { type: 'youtube', id: ytFull[1] };

  // Google Drive
  const drive = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (drive) return { type: 'drive', id: drive[1] };

  return { type: 'direct' };
}

export function PromoVideo({ url, title, className = '' }: PromoVideoProps) {
  const { type, id } = detectVideoType(url);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const thumbnailSrc = type === 'youtube' && id
    ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
    : null;

  let embedSrc: string | null = null;
  if (type === 'youtube' && id) {
    embedSrc = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&autoplay=1`;
  } else if (type === 'drive' && id) {
    embedSrc = `https://drive.google.com/file/d/${id}/preview`;
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-2xl bg-black ${className}`}
      style={{ aspectRatio: '16 / 9' }}
    >
      {/* Direct video */}
      {type === 'direct' && isVisible && (
        <video
          src={url}
          controls
          className="absolute inset-0 w-full h-full object-cover"
          title={title}
        />
      )}

      {/* Iframe embed (YouTube / Drive) */}
      {(type === 'youtube' || type === 'drive') && (
        <>
          {/* Placeholder with thumbnail + play button */}
          {(!isPlaying) && (
            <button
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 w-full h-full flex items-center justify-center group cursor-pointer border-0 bg-transparent p-0"
              aria-label={title ? `تشغيل: ${title}` : 'تشغيل الفيديو'}
              style={{ zIndex: 2 }}
            >
              {thumbnailSrc && isVisible && (
                <img
                  src={thumbnailSrc}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              )}
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors duration-200" />
              <span
                className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-white/20 border-2 border-white/60 backdrop-blur-sm group-hover:scale-110 transition-transform duration-200"
                style={{ boxShadow: '0 0 32px rgba(0,0,0,0.4)' }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="white"
                  className="w-7 h-7 ml-1"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </button>
          )}

          {/* Iframe — only mounted after click */}
          {isPlaying && isVisible && embedSrc && (
            <iframe
              src={embedSrc}
              title={title || 'Promo video'}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}

          {/* Placeholder background before intersection */}
          {!isVisible && (
            <div className="absolute inset-0 bg-[var(--color-primary)] opacity-20" />
          )}
        </>
      )}
    </div>
  );
}
