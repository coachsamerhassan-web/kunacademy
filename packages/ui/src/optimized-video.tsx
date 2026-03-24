'use client';

import { useRef, useState, useCallback } from 'react';

interface OptimizedVideoProps {
  src: string;
  poster?: string;
  width?: number;
  height?: number;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /** WebM source for browsers that support it (smaller file size) */
  srcWebm?: string;
}

/**
 * Lazy-loaded video component. Only loads the video source when the element
 * enters the viewport. Shows the poster image until then.
 */
export function OptimizedVideo({
  src,
  poster,
  width,
  height,
  className,
  autoPlay = false,
  loop = false,
  muted = true,
  srcWebm,
}: OptimizedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);

  const observerRef = useCallback((node: HTMLVideoElement | null) => {
    if (!node) return;
    videoRef.current = node;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }, // start loading 200px before visible
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={observerRef}
      width={width}
      height={height}
      className={className}
      poster={poster}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline
      preload="none"
    >
      {isInView && (
        <>
          {srcWebm && <source src={srcWebm} type="video/webm" />}
          <source src={src} type="video/mp4" />
        </>
      )}
    </video>
  );
}
