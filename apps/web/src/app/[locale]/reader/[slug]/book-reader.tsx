'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Polyfill Map.prototype.getOrInsertComputed (Stage 3 proposal, required by pdfjs-dist 5.x)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof Map !== 'undefined' && !(Map.prototype as any).getOrInsertComputed) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Map.prototype as any).getOrInsertComputed = function(key: any, callbackFn: (key: any) => any) {
    if (this.has(key)) return this.get(key);
    const value = callbackFn(key);
    this.set(key, value);
    return value;
  };
}

// pdf.js loaded dynamically client-side only (avoids DOMMatrix SSR error)
type PDFDocumentProxy = import('pdfjs-dist').PDFDocumentProxy;
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

// ─── Types ──────────────────────────────────────────────
type ReadingTheme = 'sepia' | 'dark';
type AmbientSound = 'birds' | 'waves' | 'rain' | null;

interface BookReaderProps {
  slug: string;
  title: string;
  author: string;
  coverImage: string;
  locale: string;
  mode: 'full' | 'sample';
  hasSample: boolean;
}

// ─── Theme configs (2 themes: sand + dark blue) ─────────
const THEMES: Record<ReadingTheme, { bg: string; pageBg: string; toolbarBg: string; text: string; pageFilter: string; label_ar: string; label_en: string }> = {
  sepia: { bg: '#FFF5E9', pageBg: '#FDF4E7', toolbarBg: 'rgba(255,245,233,0.94)', text: '#3D2E1C', pageFilter: 'none', label_ar: 'رملي', label_en: 'Sand' },
  dark: { bg: '#1a2634', pageBg: '#243447', toolbarBg: 'rgba(26,38,52,0.94)', text: '#E0E6ED', pageFilter: 'none', label_ar: 'ليلي', label_en: 'Night' },
};

const AMBIENT_SOUNDS: { key: AmbientSound; label_ar: string; label_en: string; src: string }[] = [
  { key: 'birds', label_ar: 'عصافير', label_en: 'Birds', src: '/audio/ambience/birds.mp3' },
  { key: 'waves', label_ar: 'أمواج', label_en: 'Waves', src: '/audio/ambience/waves.mp3' },
  { key: 'rain', label_ar: 'مطر', label_en: 'Rain', src: '/audio/ambience/rain.mp3' },
];

const ZOOM_LEVELS = [1, 1.5, 2, 3] as const;

// ─── Component ──────────────────────────────────────────
export function BookReader({ slug, title, author, coverImage, locale, mode }: BookReaderProps) {
  const router = useRouter();
  const isAr = locale === 'ar';

  // PDF state
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Page images (pre-rendered data URLs)
  const pageImagesRef = useRef<string[]>([]);

  // PageFlip instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageFlipRef = useRef<any>(null);
  const bookContainerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [bookReady, setBookReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Closed book state — cover shows first, user opens by flipping from left
  const [bookOpen, setBookOpen] = useState(false);
  const [coverAnimating, setCoverAnimating] = useState(false);

  // Theme
  const [theme, setTheme] = useState<ReadingTheme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('kun-reader-theme') as ReadingTheme) || 'sepia';
    }
    return 'sepia';
  });

  // Zoom
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Pinch zoom
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);

  // Audio
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [activeSound, setActiveSound] = useState<AmbientSound>(null);
  const [volume, setVolume] = useState(0.5);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Toolbar
  const [showToolbar, setShowToolbar] = useState(true);
  const toolbarTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fullscreen
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Page dimensions from PDF
  const pageDimensionsRef = useRef<{ width: number; height: number }>({ width: 595, height: 842 });

  const themeConfig = THEMES[theme];

  // ─── Detect mobile ────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ─── Load PDF and pre-render all pages ────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        // Dynamic import — only runs in browser
        if (!pdfjsLib) {
          pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        }

        const sampleParam = mode === 'sample' ? '?sample=true' : '';
        const url = `/api/books/${slug}/pages${sampleParam}`;

        const loadingTask = pdfjsLib.getDocument({
          url,
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/standard_fonts/',
        });
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        pdfDocRef.current = pdf;
        const numPages = pdf.numPages;
        setTotalPages(numPages);
        setLoadingProgress({ current: 0, total: numPages });

        // Pre-render all pages to data URLs
        let images: string[] = [];
        const RENDER_SCALE = 2.0; // High-res

        for (let i = 1; i <= numPages; i++) {
          if (cancelled) return;

          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: RENDER_SCALE });

          // Save first page dimensions for PageFlip sizing
          if (i === 1) {
            pageDimensionsRef.current = {
              width: viewport.width / RENDER_SCALE,
              height: viewport.height / RENDER_SCALE,
            };
          }

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;

          await (page.render({
            canvasContext: ctx,
            viewport,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)).promise;

          images.push(canvas.toDataURL('image/jpeg', 0.92));

          setLoadingProgress({ current: i, total: numPages });
        }

        if (cancelled) return;

        // Prepend cover image as page 0 for PageFlip (needed for hard cover + proper flip).
        // The closed-book state shows this separately; when opened, we auto-flip past it.
        if (coverImage) {
          try {
            const coverDataUrl = await new Promise<string>((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const pDims = pageDimensionsRef.current;
                const RS = 2.0;
                canvas.width = pDims.width * RS;
                canvas.height = pDims.height * RS;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
                const w = img.naturalWidth * scale;
                const h = img.naturalHeight * scale;
                ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.92));
              };
              img.onerror = reject;
              img.src = coverImage;
            });
            images.unshift(coverDataUrl);
          } catch {
            console.warn('[BookReader] Cover image failed to load');
          }
        }

        // No page pair swapping needed — rtl: true in PageFlip handles Arabic spread layout.
        pageImagesRef.current = images;
        setTotalPages(images.length);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('[BookReader] PDF load error:', err);
        setError(isAr ? 'تعذّر تحميل الكتاب' : 'Failed to load book');
        setLoading(false);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [slug, mode, isAr, coverImage]);

  // ─── Initialize PageFlip once pages are rendered AND book is opened ──────
  useEffect(() => {
    if (loading || error || pageImagesRef.current.length === 0) return;
    if (!bookOpen) return; // Don't init PageFlip until book is opened
    if (!bookContainerRef.current) return;

    // Small delay to let DOM settle
    const timer = setTimeout(() => {
      initPageFlip();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (pageFlipRef.current) {
        try { pageFlipRef.current.destroy(); } catch { /* ignore */ }
        pageFlipRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, isMobile, bookOpen]);

  async function initPageFlip() {
    if (!bookContainerRef.current || pageImagesRef.current.length === 0) return;

    // Clean up previous instance
    if (pageFlipRef.current) {
      try { pageFlipRef.current.destroy(); } catch { /* ignore */ }
      pageFlipRef.current = null;
    }

    // Dynamic import of PageFlip (avoid SSR)
    const { PageFlip } = await import('page-flip');

    if (!bookContainerRef.current) return;

    const dims = pageDimensionsRef.current;
    // Page width/height — these are per-page dimensions (one side of the spread)
    const pageWidth = Math.round(dims.width);
    const pageHeight = Math.round(dims.height);

    const pf = new PageFlip(bookContainerRef.current, {
      width: pageWidth,
      height: pageHeight,
      size: 'stretch' as never,
      minWidth: 200,
      maxWidth: 800,
      minHeight: 280,
      maxHeight: 1200,
      showCover: true,        // Page 0 = hard cover, enables proper flip behavior
      maxShadowOpacity: 0.5,
      mobileScrollSupport: false,
      useMouseEvents: true,
      flippingTime: 800,      // Matches DFlip default
      drawShadow: true,
      autoSize: true,
      startPage: 0,
      startZIndex: 10,
      usePortrait: true,
      disableFlipByClick: false,
      showPageCorners: true,
      clickEventForward: true,
      swipeDistance: 30,
      rtl: isAr,  // Arabic: spine on right, pages flip left→right
    });

    // Load from image URLs
    pf.loadFromImages(pageImagesRef.current);

    // Track highest page reached to know when user flips BACK to cover
    let maxPageReached = 0;

    // Listen for page flips
    pf.on('flip', (e) => {
      const page = e.data as number;
      setCurrentPage(page);

      if (page > maxPageReached) maxPageReached = page;

      // Auto-close: user flipped back to cover AFTER having gone deeper
      if (page === 0 && maxPageReached > 0) {
        setTimeout(() => {
          if (pageFlipRef.current) {
            try { pageFlipRef.current.destroy(); } catch { /* ignore */ }
            pageFlipRef.current = null;
          }
          setBookReady(false);
          setBookOpen(false);
          setCurrentPage(0);
        }, 800); // Wait for flip animation to finish
      }
    });

    pageFlipRef.current = pf;
    setBookReady(true);
    setCurrentPage(0);
  }

  // ─── Open/close book (transition between cover and spread) ──
  const openBook = useCallback(() => {
    if (bookOpen || coverAnimating || loading) return;
    setCoverAnimating(true);
    setTimeout(() => {
      setBookOpen(true);
      setCoverAnimating(false);
    }, 600);
  }, [bookOpen, coverAnimating, loading]);

  const closeBook = useCallback(() => {
    if (!bookOpen) return;
    // Destroy PageFlip and return to cover
    if (pageFlipRef.current) {
      try { pageFlipRef.current.destroy(); } catch { /* ignore */ }
      pageFlipRef.current = null;
    }
    setBookReady(false);
    setBookOpen(false);
    setCurrentPage(0);
  }, [bookOpen]);

  // ─── Save theme preference ───────────────────────────
  useEffect(() => {
    localStorage.setItem('kun-reader-theme', theme);
  }, [theme]);

  // ─── Page navigation ─────────────────────────────────
  // page-flip rtl: true only changes visual flip direction, NOT flipNext/flipPrev semantics.
  // flipNext() always goes to higher page indices, flipPrev() to lower.
  const goForward = useCallback(() => {
    if (!pageFlipRef.current) return;
    pageFlipRef.current.flipNext();
  }, []);

  const goBackward = useCallback(() => {
    if (!pageFlipRef.current) return;
    pageFlipRef.current.flipPrev();
  }, []);

  // ─── Keyboard controls ───────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // ArrowLeft = forward in Arabic (deeper into book), backward in English
      // ArrowRight = backward in Arabic (toward cover), forward in English
      if (e.key === 'ArrowLeft') isAr ? goForward() : goBackward();
      else if (e.key === 'ArrowRight') isAr ? goBackward() : goForward();
      else if (e.key === 'Escape') router.back();
      else if (e.key === '+' || e.key === '=') handleZoomIn();
      else if (e.key === '-') handleZoomOut();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isAr, goForward, goBackward, router]);

  // ─── Touch handlers for zoom (pinch) ─────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartZoom.current = zoom;
      return;
    }
    if (zoom > 1) {
      isPanning.current = true;
      panStart.current = {
        x: e.touches[0]!.clientX - panOffset.x,
        y: e.touches[0]!.clientY - panOffset.y,
      };
    }
  }, [zoom, panOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      const dist = Math.hypot(dx, dy);
      const scale = (dist / pinchStartDist.current) * pinchStartZoom.current;
      setZoom(Math.max(1, Math.min(3, scale)));
      return;
    }
    if (isPanning.current && zoom > 1) {
      setPanOffset({
        x: e.touches[0]!.clientX - panStart.current.x,
        y: e.touches[0]!.clientY - panStart.current.y,
      });
    }
  }, [zoom]);

  const handleTouchEnd = useCallback(() => {
    if (isPanning.current) { isPanning.current = false; }
  }, []);

  // ─── Mouse drag for panning when zoomed ──────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    e.preventDefault();
  }, [zoom, panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current || zoom <= 1) return;
    setPanOffset({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y,
    });
  }, [zoom]);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  // ─── Zoom controls ──────────────────────────────────
  const handleZoomIn = useCallback(() => {
    setZoom(prev => {
      const idx = ZOOM_LEVELS.indexOf(prev as typeof ZOOM_LEVELS[number]);
      return idx < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[idx + 1]! : prev;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const idx = ZOOM_LEVELS.indexOf(prev as typeof ZOOM_LEVELS[number]);
      if (idx > 0) {
        const next = ZOOM_LEVELS[idx - 1]!;
        if (next === 1) setPanOffset({ x: 0, y: 0 });
        return next;
      }
      return prev;
    });
  }, []);

  // ─── Toolbar auto-hide ──────────────────────────────
  const resetToolbarTimer = useCallback(() => {
    setShowToolbar(true);
    if (toolbarTimer.current) clearTimeout(toolbarTimer.current);
    toolbarTimer.current = setTimeout(() => setShowToolbar(false), 3000);
  }, []);

  useEffect(() => {
    resetToolbarTimer();
    return () => { if (toolbarTimer.current) clearTimeout(toolbarTimer.current); };
  }, [resetToolbarTimer]);

  // ─── Audio controls ─────────────────────────────────
  const playSound = useCallback((sound: AmbientSound) => {
    if (!sound) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setAudioPlaying(false);
      setActiveSound(null);
      localStorage.removeItem('kun-reader-sound');
      return;
    }

    const soundConfig = AMBIENT_SOUNDS.find(s => s.key === sound);
    if (!soundConfig) return;

    if (audioRef.current) {
      const old = audioRef.current;
      const fadeOut = setInterval(() => {
        if (old.volume > 0.05) old.volume = Math.max(0, old.volume - 0.05);
        else { clearInterval(fadeOut); old.pause(); }
      }, 50);
    }

    const audio = new Audio(soundConfig.src);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;

    audio.play().then(() => {
      const fadeIn = setInterval(() => {
        if (audio.volume < volume - 0.05) audio.volume = Math.min(1, audio.volume + 0.05);
        else { audio.volume = volume; clearInterval(fadeIn); }
      }, 50);
    }).catch(console.error);

    setAudioPlaying(true);
    setActiveSound(sound);
    localStorage.setItem('kun-reader-sound', sound);
  }, [volume]);

  useEffect(() => {
    if (audioRef.current && audioPlaying) audioRef.current.volume = volume;
    localStorage.setItem('kun-reader-volume', String(volume));
  }, [volume, audioPlaying]);

  useEffect(() => {
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, []);

  // ─── Fullscreen ─────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!rootRef.current) return;
    if (!document.fullscreenElement) {
      rootRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ─── Resize handler for PageFlip ─────────────────────
  useEffect(() => {
    if (!pageFlipRef.current || !bookReady) return;
    const handler = () => {
      try { pageFlipRef.current?.update(); } catch { /* ignore */ }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [bookReady]);

  // ─── Progress ───────────────────────────────────────
  const progress = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0;

  // Current display page number (1-based, human readable)
  const displayPage = currentPage + 1;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 flex flex-col select-none"
      style={{ backgroundColor: themeConfig.bg, color: themeConfig.text, zIndex: 9999 }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseMove={resetToolbarTimer}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Reader custom styles */}
      <style>{`
        @keyframes reader-spread-in {
          from { opacity: 0; transform: scaleX(0.5); }
          to { opacity: 1; transform: scaleX(1); }
        }
        .reader-volume-slider {
          -webkit-appearance: none;
          appearance: none;
          background: ${themeConfig.text}25;
          border-radius: 999px;
          outline: none;
        }
        .reader-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--color-primary, #7C5CFC);
          cursor: pointer;
          border: 2px solid ${theme === 'dark' ? '#1e2d3d' : '#FFF5E9'};
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .reader-volume-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--color-primary, #7C5CFC);
          cursor: pointer;
          border: 2px solid ${theme === 'dark' ? '#1e2d3d' : '#FFF5E9'};
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .reader-volume-slider::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 999px;
          background: ${themeConfig.text}25;
        }
        .reader-volume-slider::-moz-range-track {
          height: 6px;
          border-radius: 999px;
          background: ${themeConfig.text}25;
        }
      `}</style>
      {/* ─── Page display area ─────────────────── */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {!bookOpen ? (
          /* ─── Desktop: Closed book (single cover page) ─── */
          <div
            className="relative cursor-pointer group"
            style={{
              perspective: '1500px',
              width: '40vw',
              maxWidth: '500px',
              height: '80vh',
              maxHeight: '750px',
            }}
            onClick={openBook}
          >
            {/* Cover page */}
            <div
              className="w-full h-full relative transition-transform duration-700 ease-in-out"
              style={{
                transformOrigin: isAr ? 'right center' : 'left center',
                transform: coverAnimating ? `rotateY(${isAr ? '' : '-'}90deg)` : 'rotateY(0deg)',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImage}
                alt={title}
                className="w-full h-full object-contain rounded-sm"
                style={{
                  boxShadow: `
                    ${isAr ? '-' : ''}6px 4px 20px rgba(71,64,153,0.15),
                    ${isAr ? '-' : ''}2px 0 8px rgba(71,64,153,0.08),
                    0 8px 32px rgba(0,0,0,0.12)
                  `,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  pointerEvents: 'none',
                }}
                draggable={false}
              />

              {/* Spine edge shadow */}
              <div
                className="absolute top-0 bottom-0 w-3 pointer-events-none"
                style={{
                  [isAr ? 'right' : 'left']: 0,
                  background: `linear-gradient(to ${isAr ? 'left' : 'right'},
                    rgba(71,64,153,0.15) 0%,
                    rgba(71,64,153,0.06) 40%,
                    transparent 100%
                  )`,
                }}
              />
            </div>

            {/* Loading overlay or "open book" hint */}
            <div
              className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2 transition-opacity duration-300"
              style={{ opacity: coverAnimating ? 0 : 0.8 }}
            >
              {loading ? (
                <>
                  <div className="w-6 h-6 border-2 border-current/20 border-t-current rounded-full animate-spin" style={{ color: themeConfig.text }} />
                  {loadingProgress.total > 0 && (
                    <div className="w-32 h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${themeConfig.text}20` }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%`, backgroundColor: 'var(--color-primary)' }} />
                    </div>
                  )}
                </>
              ) : (
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs"
                  style={{
                    backgroundColor: `${themeConfig.text}10`,
                    color: themeConfig.text,
                    fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {isAr ? 'اضغط لفتح الكتاب' : 'Tap to open'}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ─── Book is open: error, mobile scroll, or desktop PageFlip ─── */
          error ? (
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <p className="text-sm opacity-60">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg text-sm min-h-[44px]"
              style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
            >
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
          ) : isMobile ? (
          /* ─── Mobile: vertical single-page scroll ─── */
          <div
            className="w-full h-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory scroll-smooth px-2 pt-16 pb-4"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onScroll={(e) => {
              const el = e.currentTarget;
              const pageHeight = el.clientHeight;
              const idx = Math.round(el.scrollTop / pageHeight);
              if (idx !== currentPage) setCurrentPage(idx);
            }}
          >
            {pageImagesRef.current.map((src, i) => (
              <div
                key={i}
                className="snap-start flex items-center justify-center"
                style={{ minHeight: '100%', padding: '8px 0' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={isAr ? `صفحة ${i}` : `Page ${i}`}
                  className="max-h-[85vh] w-auto max-w-full rounded-2xl"
                  style={{
                    boxShadow: '0 4px 24px rgba(71,64,153,0.10)',
                    filter: themeConfig.pageFilter,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    pointerEvents: 'none',
                  }}
                  draggable={false}
                />
              </div>
            ))}
          </div>
        ) : (
          /* ─── Desktop: PageFlip double-spread ─── */
          <div
            className="relative transition-transform duration-200 ease-out"
            style={{
              transform: zoom > 1
                ? `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`
                : undefined,
              transformOrigin: 'center center',
              width: '85vw',
              maxWidth: '1200px',
              // Height matches the book's aspect ratio — no extra whitespace
              aspectRatio: `${pageDimensionsRef.current.width * 2} / ${pageDimensionsRef.current.height}`,
              maxHeight: '85vh',
              animation: 'reader-spread-in 0.4s ease-out',
            }}
          >
            {/* Book container — PageFlip mounts here */}
            <div
              ref={bookContainerRef}
              className="w-full h-full"
              style={{
                filter: themeConfig.pageFilter,
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            />

            {/* Binding crease shadow (desktop double-spread only) */}
            {bookReady && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '30px',
                  background: `linear-gradient(to right,
                    transparent 0%,
                    rgba(71,64,153,0.08) 35%,
                    rgba(71,64,153,0.18) 50%,
                    rgba(71,64,153,0.08) 65%,
                    transparent 100%
                  )`,
                  zIndex: 20,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ─── Nav arrows (desktop, only when book is open) ─────────────── */}
      {bookReady && bookOpen && (
        <>
          <button
            onClick={goBackward}
            disabled={currentPage <= 0}
            className="hidden md:flex fixed top-1/2 -translate-y-1/2 w-12 h-24 items-center justify-center rounded-lg transition-colors z-40 disabled:opacity-20"
            style={{
              [isAr ? 'right' : 'left']: '1rem',
              backgroundColor: `${themeConfig.text}08`,
            }}
            onMouseEnter={resetToolbarTimer}
            aria-label={isAr ? 'الصفحة السابقة' : 'Previous page'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            onClick={goForward}
            disabled={totalPages > 0 && currentPage >= totalPages - 1}
            className="hidden md:flex fixed top-1/2 -translate-y-1/2 w-12 h-24 items-center justify-center rounded-lg transition-colors z-40 disabled:opacity-20"
            style={{
              [isAr ? 'left' : 'right']: '1rem',
              backgroundColor: `${themeConfig.text}08`,
            }}
            onMouseEnter={resetToolbarTimer}
            aria-label={isAr ? 'الصفحة التالية' : 'Next page'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}

      {/* ─── Sample CTA ──────────────────────── */}
      {mode === 'sample' && totalPages > 0 && currentPage >= totalPages - 1 && (
        <div
          className="fixed bottom-24 left-4 right-4 mx-auto max-w-md rounded-2xl p-6 text-center shadow-lg z-40"
          style={{ backgroundColor: themeConfig.toolbarBg, backdropFilter: 'blur(12px)' }}
        >
          <p className="text-sm mb-4" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}>
            {isAr ? 'انتهت العيّنة — احصل على النسخة الكاملة' : 'End of sample — get the full book'}
          </p>
          <button
            onClick={() => router.push(`/${locale}/shop`)}
            className="px-6 py-3 rounded-xl text-sm font-medium min-h-[44px] transition-transform hover:scale-105"
            style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
          >
            {isAr ? 'اشترِ الآن' : 'Buy Now'}
          </button>
        </div>
      )}

      {/* ─── Top toolbar (DFlip style) ─────── */}
      <div
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: themeConfig.toolbarBg,
          backdropFilter: 'blur(12px)',
          transform: showToolbar ? 'translateY(0)' : 'translateY(-100%)',
          opacity: showToolbar ? 1 : 0,
        }}
        onMouseEnter={resetToolbarTimer}
      >
        {/* Progress bar at top of toolbar */}
        <div className="h-0.5 w-full" style={{ backgroundColor: `${themeConfig.text}10` }}>
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              backgroundColor: 'var(--color-primary)',
              float: isAr ? 'right' : 'left',
            }}
          />
        </div>

        <div className="flex items-center justify-between px-3 py-2 max-w-5xl mx-auto gap-2">
          {/* Left: Back + page counter */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors"
              style={{ color: themeConfig.text }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${themeConfig.text}12`}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label={isAr ? 'رجوع' : 'Back'}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={isAr ? '' : 'rotate-180'}>
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Close book button (return to cover) */}
            {bookOpen && (
              <button
                onClick={closeBook}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors"
                style={{ color: themeConfig.text }}
                aria-label={isAr ? 'إغلاق الكتاب' : 'Close book'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}

            {totalPages > 0 && (
              <span className="text-xs opacity-70 tabular-nums whitespace-nowrap" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}>
                {isAr
                  ? `صفحة ${toArabicNum(displayPage)} من ${toArabicNum(totalPages)}`
                  : `${displayPage} / ${totalPages}`}
              </span>
            )}

            {mode === 'sample' && (
              <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
                {isAr ? 'عيّنة' : 'Sample'}
              </span>
            )}
          </div>

          {/* Center: theme dots + zoom */}
          <div className="flex items-center gap-2">
            {/* Theme dots */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] opacity-50 mb-1">
                {isAr ? 'لون الخلفية' : 'Background'}
              </span>
              <div className="flex items-center gap-1">
                {(['sepia', 'dark'] as ReadingTheme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className="w-6 h-6 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: THEMES[t].bg,
                      borderColor: theme === t ? 'var(--color-primary)' : 'transparent',
                      boxShadow: theme === t ? '0 0 0 1px var(--color-primary)' : '0 0 0 1px rgba(0,0,0,0.15)',
                    }}
                    aria-label={t}
                  />
                ))}
              </div>
            </div>

            {/* Zoom */}
            <div className="flex flex-col items-center px-2 border-x border-current/10">
              <span className="text-[10px] opacity-50">
                {isAr ? 'تكبير' : 'Zoom'}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleZoomOut}
                  disabled={zoom <= 1}
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-sm disabled:opacity-30"
                    style={{ color: themeConfig.text }}
                >
                  −
                </button>
                <span className="text-xs tabular-nums w-8 text-center">{zoom}x</span>
                <button
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-sm disabled:opacity-30"
                    style={{ color: themeConfig.text }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Right: audio + fullscreen */}
          <div className="flex items-center gap-1">
            {/* Audio toggle */}
            <div className="relative">
              <button
                onClick={() => setShowAudioPanel(!showAudioPanel)}
                className="min-w-[44px] min-h-[44px] flex items-center gap-1.5 justify-center rounded-lg transition-colors px-2"
                style={{ color: themeConfig.text }}
                aria-label={isAr ? 'صوت محيط' : 'Ambient sound'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  {audioPlaying ? (
                    <>
                      <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M19.07 4.93a10 10 0 010 14.14" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  ) : (
                    <>
                      <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="23" y1="9" x2="17" y2="15" strokeLinecap="round" />
                      <line x1="17" y1="9" x2="23" y2="15" strokeLinecap="round" />
                    </>
                  )}
                </svg>
                {audioPlaying && activeSound ? (
                  <span className="text-[10px] opacity-50 hidden sm:inline">
                    {isAr
                      ? AMBIENT_SOUNDS.find(s => s.key === activeSound)?.label_ar
                      : AMBIENT_SOUNDS.find(s => s.key === activeSound)?.label_en}
                  </span>
                ) : (
                  <span className="text-[10px] opacity-50 hidden sm:inline">
                    {isAr ? 'صوت مريح أثناء القراءة؟' : 'Relaxing sound?'}
                  </span>
                )}
              </button>

              {showAudioPanel && (
                <div
                  className="absolute top-full mt-2 rounded-xl shadow-lg p-4 w-60 z-50 border"
                  style={{
                    backgroundColor: theme === 'dark' ? '#1e2d3d' : '#FFF5E9',
                    borderColor: `${themeConfig.text}15`,
                    boxShadow: '0 4px 24px rgba(71,64,153,0.08)',
                    color: themeConfig.text,
                    [isAr ? 'left' : 'right']: 0,
                  }}
                >
                  <div className="space-y-1.5">
                    {AMBIENT_SOUNDS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => playSound(activeSound === s.key ? null : s.key)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors min-h-[44px]"
                        style={{
                          backgroundColor: activeSound === s.key ? 'var(--color-primary)' : `${themeConfig.text}08`,
                          color: activeSound === s.key ? '#fff' : themeConfig.text,
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0, opacity: 0.7 }}>
                          {s.key === 'birds' ? (
                            <path d="M16 7c0 0-3 1-3 4s3 4 3 4M8 7c0 0 3 1 3 4s-3 4-3 4M12 3v1M12 20v1M4.22 10l.8.4M18.98 10l.8.4" strokeLinecap="round" strokeLinejoin="round" />
                          ) : s.key === 'waves' ? (
                            <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0" strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <path d="M16 13V5a2 2 0 00-4 0v8M12 15a4 4 0 01-4-4V7M8 15a4 4 0 004 4M12 19v2M8 19h8" strokeLinecap="round" strokeLinejoin="round" />
                          )}
                        </svg>
                        <span className="text-sm" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}>
                          {isAr ? s.label_ar : s.label_en}
                        </span>
                        {activeSound === s.key && (
                          <span className="text-xs opacity-60" style={{ marginInlineStart: 'auto' }}>&#9835;</span>
                        )}
                      </button>
                    ))}

                    {/* Fix 4: Stop button — visible when audio is playing */}
                    {audioPlaying && (
                      <button
                        onClick={() => playSound(null)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-colors min-h-[44px] mt-1"
                        style={{
                          backgroundColor: `${themeConfig.text}12`,
                          color: themeConfig.text,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                        <span className="text-sm" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}>
                          {isAr ? 'إيقاف الصوت' : 'Stop'}
                        </span>
                      </button>
                    )}

                    {/* Fix 5: Styled volume slider */}
                    <div className="pt-2 mt-1" style={{ borderTop: `1px solid ${themeConfig.text}15` }}>
                      <label className="flex items-center gap-3">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.6, flexShrink: 0 }}>
                          <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <input type="range" min="0" max="1" step="0.05" value={volume}
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="reader-volume-slider flex-1 h-2 rounded-full cursor-pointer"
                        />
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.6, flexShrink: 0 }}>
                          <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M19.07 4.93a10 10 0 010 14.14" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors"
              style={{ color: themeConfig.text }}
              aria-label={isAr ? 'ملء الشاشة' : 'Fullscreen'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                {isFullscreen ? (
                  <>
                    <path d="M8 3v3a2 2 0 01-2 2H3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 8h-3a2 2 0 01-2-2V3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 16h3a2 2 0 012 2v3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M16 21v-3a2 2 0 012-2h3" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                ) : (
                  <>
                    <path d="M8 3H5a2 2 0 00-2 2v3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 8V5a2 2 0 00-2-2h-3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 16v3a2 2 0 002 2h3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M16 21h3a2 2 0 002-2v-3" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function toArabicNum(n: number): string {
  const d = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n).replace(/\d/g, (c) => d[parseInt(c)]!);
}
