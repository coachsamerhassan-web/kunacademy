'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ──────────────────────────────────────────────
type ReadingTheme = 'light' | 'sepia' | 'dark';
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

// ─── Theme configs ──────────────────────────────────────
const THEMES: Record<ReadingTheme, { bg: string; pageBg: string; toolbarBg: string; text: string; pageFilter: string }> = {
  light: {
    bg: '#FFFFFF',
    pageBg: '#FFFFFF',
    toolbarBg: 'rgba(255, 255, 255, 0.92)',
    text: '#1F1B14',
    pageFilter: 'none',
  },
  sepia: {
    bg: '#F5E6D0',
    pageBg: '#FDF4E7',
    toolbarBg: 'rgba(245, 230, 208, 0.92)',
    text: '#3D2E1C',
    pageFilter: 'sepia(0.15)',
  },
  dark: {
    bg: '#1a1a2e',
    pageBg: '#24243e',
    toolbarBg: 'rgba(26, 26, 46, 0.92)',
    text: '#E0E0E0',
    pageFilter: 'brightness(0.85)',
  },
};

const AMBIENT_SOUNDS: { key: AmbientSound; label_ar: string; label_en: string; src: string }[] = [
  { key: 'birds', label_ar: 'عصافير', label_en: 'Birds', src: '/audio/ambience/birds.mp3' },
  { key: 'waves', label_ar: 'أمواج', label_en: 'Waves', src: '/audio/ambience/waves.mp3' },
  { key: 'rain', label_ar: 'مطر', label_en: 'Rain', src: '/audio/ambience/rain.mp3' },
];

const ZOOM_LEVELS = [1, 1.5, 2, 3] as const;

// ─── Component ──────────────────────────────────────────
export function BookReader({ slug, title, author, coverImage, locale, mode, hasSample }: BookReaderProps) {
  const router = useRouter();
  const isAr = locale === 'ar';

  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [nextPageImage, setNextPageImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Theme
  const [theme, setTheme] = useState<ReadingTheme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('kun-reader-theme') as ReadingTheme) || 'light';
    }
    return 'light';
  });

  // Zoom
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Audio
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [activeSound, setActiveSound] = useState<AmbientSound>(null);
  const [volume, setVolume] = useState(0.5);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Toolbar
  const [showToolbar, setShowToolbar] = useState(true);
  const toolbarTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Page flip animation
  const [flipping, setFlipping] = useState<'next' | 'prev' | null>(null);

  // Touch/swipe
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pinch zoom
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);

  const themeConfig = THEMES[theme];

  // ─── Load saved preferences ─────────────────────────
  useEffect(() => {
    const savedSound = localStorage.getItem('kun-reader-sound') as AmbientSound;
    const savedVolume = parseFloat(localStorage.getItem('kun-reader-volume') || '0.5');
    if (savedSound) setActiveSound(savedSound);
    if (!isNaN(savedVolume)) setVolume(savedVolume);
  }, []);

  // ─── Save theme preference ─────────────────────────
  useEffect(() => {
    localStorage.setItem('kun-reader-theme', theme);
  }, [theme]);

  // ─── Fetch a page image ─────────────────────────────
  const fetchPage = useCallback(async (page: number): Promise<{ url: string; total: number } | null> => {
    try {
      const res = await fetch(`/api/books/${slug}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, sample: mode === 'sample' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const total = parseInt(res.headers.get('X-Total-Pages') || '0', 10);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return { url, total };
    } catch (err: any) {
      console.error('[BookReader] fetchPage error:', err);
      return null;
    }
  }, [slug, mode]);

  // ─── Load current page ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const result = await fetchPage(currentPage);
      if (cancelled) return;

      if (!result) {
        setError(isAr ? 'تعذّر تحميل الصفحة' : 'Failed to load page');
        setLoading(false);
        return;
      }

      // Revoke previous URL
      if (pageImage) URL.revokeObjectURL(pageImage);

      setPageImage(result.url);
      if (result.total > 0) setTotalPages(result.total);
      setLoading(false);

      // Pre-fetch next page
      if (currentPage < (result.total || totalPages)) {
        const next = await fetchPage(currentPage + 1);
        if (!cancelled && next) {
          if (nextPageImage) URL.revokeObjectURL(nextPageImage);
          setNextPageImage(next.url);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, fetchPage, isAr]);

  // ─── Page navigation ────────────────────────────────
  const goToPage = useCallback((page: number) => {
    if (page < 1 || (totalPages > 0 && page > totalPages)) return;
    if (page === currentPage) return;
    setPanOffset({ x: 0, y: 0 });
    setZoom(1);
    setCurrentPage(page);
  }, [currentPage, totalPages]);

  const nextPage = useCallback(() => {
    if (totalPages > 0 && currentPage >= totalPages) return;
    setFlipping('next');
    setTimeout(() => {
      goToPage(currentPage + 1);
      setFlipping(null);
    }, 400);
  }, [currentPage, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage <= 1) return;
    setFlipping('prev');
    setTimeout(() => {
      goToPage(currentPage - 1);
      setFlipping(null);
    }, 400);
  }, [currentPage, goToPage]);

  // ─── Keyboard controls ──────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        isAr ? prevPage() : nextPage();
      } else if (e.key === 'ArrowLeft') {
        isAr ? nextPage() : prevPage();
      } else if (e.key === 'Escape') {
        router.back();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isAr, nextPage, prevPage, router]);

  // ─── Touch handlers (swipe + pinch) ─────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartZoom.current = zoom;
      return;
    }
    if (zoom > 1) {
      isPanning.current = true;
      panStart.current = { x: e.touches[0]!.clientX - panOffset.x, y: e.touches[0]!.clientY - panOffset.y };
      return;
    }
    touchStart.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
  }, [zoom, panOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      const dist = Math.hypot(dx, dy);
      const scale = (dist / pinchStartDist.current) * pinchStartZoom.current;
      const clamped = Math.max(1, Math.min(3, scale));
      setZoom(clamped);
      if (clamped === 1) setPanOffset({ x: 0, y: 0 });
      return;
    }
    if (isPanning.current && zoom > 1) {
      setPanOffset({
        x: e.touches[0]!.clientX - panStart.current.x,
        y: e.touches[0]!.clientY - panStart.current.y,
      });
    }
  }, [zoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }
    if (!touchStart.current) return;
    const touch = e.changedTouches[0]!;
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    touchStart.current = null;

    // Require minimum swipe distance
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) {
      // Tap — show/hide toolbar
      resetToolbarTimer();
      return;
    }

    if (isAr) {
      dx > 0 ? nextPage() : prevPage();
    } else {
      dx < 0 ? nextPage() : prevPage();
    }
  }, [isAr, nextPage, prevPage]);

  // ─── Click to navigate pages ────────────────────────
  const handlePageClick = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) return; // Don't navigate when zoomed
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const half = rect.width / 2;

    if (isAr) {
      x < half ? nextPage() : prevPage();
    } else {
      x > half ? nextPage() : prevPage();
    }

    resetToolbarTimer();
  }, [isAr, nextPage, prevPage, zoom]);

  // ─── Mouse drag for panning when zoomed ─────────────
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

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // ─── Zoom controls ─────────────────────────────────
  const handleZoomIn = useCallback(() => {
    setZoom(prev => {
      const idx = ZOOM_LEVELS.indexOf(prev as any);
      if (idx < ZOOM_LEVELS.length - 1) return ZOOM_LEVELS[idx + 1]!;
      return prev;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const idx = ZOOM_LEVELS.indexOf(prev as any);
      if (idx > 0) {
        const next = ZOOM_LEVELS[idx - 1]!;
        if (next === 1) setPanOffset({ x: 0, y: 0 });
        return next;
      }
      return prev;
    });
  }, []);

  const setZoomLevel = useCallback((level: number) => {
    setZoom(level);
    if (level === 1) setPanOffset({ x: 0, y: 0 });
  }, []);

  // ─── Toolbar auto-hide ──────────────────────────────
  const resetToolbarTimer = useCallback(() => {
    setShowToolbar(true);
    if (toolbarTimer.current) clearTimeout(toolbarTimer.current);
    toolbarTimer.current = setTimeout(() => setShowToolbar(false), 3000);
  }, []);

  useEffect(() => {
    resetToolbarTimer();
    return () => {
      if (toolbarTimer.current) clearTimeout(toolbarTimer.current);
    };
  }, [resetToolbarTimer]);

  // ─── Audio controls ─────────────────────────────────
  const playSound = useCallback((sound: AmbientSound) => {
    if (!sound) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setAudioPlaying(false);
      setActiveSound(null);
      localStorage.removeItem('kun-reader-sound');
      return;
    }

    const soundConfig = AMBIENT_SOUNDS.find(s => s.key === sound);
    if (!soundConfig) return;

    // Fade out current
    if (audioRef.current) {
      const old = audioRef.current;
      const fadeOut = setInterval(() => {
        if (old.volume > 0.05) {
          old.volume = Math.max(0, old.volume - 0.05);
        } else {
          clearInterval(fadeOut);
          old.pause();
        }
      }, 50);
    }

    // Create new audio
    const audio = new Audio(soundConfig.src);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;

    audio.play().then(() => {
      // Fade in
      const fadeIn = setInterval(() => {
        if (audio.volume < volume - 0.05) {
          audio.volume = Math.min(1, audio.volume + 0.05);
        } else {
          audio.volume = volume;
          clearInterval(fadeIn);
        }
      }, 50);
    }).catch(console.error);

    setAudioPlaying(true);
    setActiveSound(sound);
    localStorage.setItem('kun-reader-sound', sound);
  }, [volume]);

  const toggleAudio = useCallback(() => {
    if (audioPlaying) {
      playSound(null);
    } else {
      playSound(activeSound || 'birds');
    }
  }, [audioPlaying, activeSound, playSound]);

  // Update volume on existing audio
  useEffect(() => {
    if (audioRef.current && audioPlaying) {
      audioRef.current.volume = volume;
    }
    localStorage.setItem('kun-reader-volume', String(volume));
  }, [volume, audioPlaying]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ─── Progress percentage ────────────────────────────
  const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  // ─── Page flip animation class ──────────────────────
  const getFlipStyle = (): React.CSSProperties => {
    if (!flipping) return {};
    const isNext = flipping === 'next';
    const dir = isAr ? (isNext ? 1 : -1) : (isNext ? -1 : 1);
    return {
      animation: `pageFlip-${dir > 0 ? 'right' : 'left'} 0.4s ease-in-out`,
    };
  };

  return (
    <div
      className="fixed inset-0 flex flex-col select-none"
      style={{ backgroundColor: themeConfig.bg, color: themeConfig.text }}
      onMouseMove={resetToolbarTimer}
    >
      {/* Keyframes for page flip */}
      <style>{`
        @keyframes pageFlip-left {
          0% { transform: perspective(1200px) rotateY(0deg); }
          50% { transform: perspective(1200px) rotateY(-15deg); opacity: 0.7; }
          100% { transform: perspective(1200px) rotateY(0deg); }
        }
        @keyframes pageFlip-right {
          0% { transform: perspective(1200px) rotateY(0deg); }
          50% { transform: perspective(1200px) rotateY(15deg); opacity: 0.7; }
          100% { transform: perspective(1200px) rotateY(0deg); }
        }
      `}</style>

      {/* ─── Toolbar ─────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: themeConfig.toolbarBg,
          backdropFilter: 'blur(12px)',
          transform: showToolbar ? 'translateY(0)' : 'translateY(-100%)',
          opacity: showToolbar ? 1 : 0,
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto gap-3">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 min-w-[44px] min-h-[44px] justify-center rounded-lg hover:bg-black/5 transition-colors"
            aria-label={isAr ? 'رجوع' : 'Back'}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={isAr ? '' : 'rotate-180'}>
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0 text-center">
            <p
              className="text-sm font-medium truncate"
              style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}
            >
              {title}
            </p>
            <p className="text-xs opacity-60">{author}</p>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-1">
            {/* Theme toggle */}
            <div className="flex items-center gap-1 px-1">
              {(['light', 'sepia', 'dark'] as ReadingTheme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className="w-6 h-6 rounded-full border-2 transition-all min-w-[24px]"
                  style={{
                    backgroundColor: THEMES[t].bg,
                    borderColor: theme === t ? 'var(--color-primary)' : 'transparent',
                    boxShadow: theme === t ? '0 0 0 1px var(--color-primary)' : '0 0 0 1px rgba(0,0,0,0.15)',
                  }}
                  aria-label={t}
                />
              ))}
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-0.5 px-1 border-x border-current/10 mx-1">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-sm font-medium disabled:opacity-30 hover:bg-black/5 transition-colors"
                aria-label={isAr ? 'تصغير' : 'Zoom out'}
              >
                -
              </button>
              <span className="text-xs tabular-nums w-10 text-center">{zoom}x</span>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-sm font-medium disabled:opacity-30 hover:bg-black/5 transition-colors"
                aria-label={isAr ? 'تكبير' : 'Zoom in'}
              >
                +
              </button>
            </div>

            {/* Zoom level quick buttons (desktop only) */}
            <div className="hidden md:flex items-center gap-0.5 px-1">
              {ZOOM_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setZoomLevel(level)}
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-xs transition-colors"
                  style={{
                    backgroundColor: zoom === level ? 'var(--color-primary)' : 'transparent',
                    color: zoom === level ? '#fff' : 'inherit',
                  }}
                >
                  {level}x
                </button>
              ))}
            </div>

            {/* Audio toggle */}
            <div className="relative">
              <button
                onClick={() => setShowAudioPanel(!showAudioPanel)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
                aria-label={isAr ? 'صوت محيط' : 'Ambient sound'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
              </button>

              {/* Audio panel dropdown */}
              {showAudioPanel && (
                <div
                  className="absolute top-full mt-2 rounded-xl shadow-lg p-4 w-56 z-50"
                  style={{
                    backgroundColor: themeConfig.toolbarBg,
                    backdropFilter: 'blur(12px)',
                    [isAr ? 'left' : 'right']: 0,
                  }}
                >
                  <div className="space-y-3">
                    {AMBIENT_SOUNDS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => playSound(activeSound === s.key ? null : s.key)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors min-h-[44px]"
                        style={{
                          backgroundColor: activeSound === s.key ? 'var(--color-primary)' : 'transparent',
                          color: activeSound === s.key ? '#fff' : 'inherit',
                        }}
                      >
                        <span className="text-sm" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}>
                          {isAr ? s.label_ar : s.label_en}
                        </span>
                      </button>
                    ))}

                    {/* Volume slider */}
                    <div className="pt-2 border-t border-current/10">
                      <label className="flex items-center gap-3">
                        <span className="text-xs opacity-60">{isAr ? 'مستوى الصوت' : 'Volume'}</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: 'var(--color-primary)' }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page indicator */}
        <div className="text-center pb-2 text-xs opacity-60">
          {totalPages > 0 && (
            <span style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}>
              {isAr
                ? `صفحة ${toArabicNum(currentPage)} من ${toArabicNum(totalPages)}`
                : `Page ${currentPage} of ${totalPages}`}
            </span>
          )}
          {mode === 'sample' && (
            <span className="inline-block mx-2 px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}>
              {isAr ? 'عيّنة مجانية' : 'Free Sample'}
            </span>
          )}
        </div>
      </div>

      {/* ─── Page display area ─────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden"
        style={{ cursor: zoom > 1 ? 'grab' : 'pointer' }}
        onClick={zoom <= 1 ? handlePageClick : undefined}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading && !pageImage ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-current/20 border-t-current rounded-full animate-spin" />
            <p className="text-sm opacity-60" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}>
              {isAr ? 'جارٍ التحميل...' : 'Loading...'}
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <p className="text-sm opacity-60" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}>
              {error}
            </p>
            <button
              onClick={() => setCurrentPage(currentPage)}
              className="px-4 py-2 rounded-lg text-sm min-h-[44px]"
              style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
            >
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : pageImage ? (
          <div
            className="relative max-h-full transition-transform duration-200 ease-out"
            style={{
              transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
              transformOrigin: 'center center',
              ...getFlipStyle(),
            }}
          >
            {/* Page shadow */}
            <div
              className="absolute inset-0 pointer-events-none rounded"
              style={{
                boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 0 40px rgba(0,0,0,0.05)',
              }}
            />

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pageImage}
              alt={isAr ? `صفحة ${currentPage}` : `Page ${currentPage}`}
              className="max-h-[calc(100vh-120px)] w-auto mx-auto rounded"
              style={{
                filter: themeConfig.pageFilter,
                backgroundColor: themeConfig.pageBg,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                pointerEvents: 'none',
              }}
              draggable={false}
            />

            {/* Spine crease on page */}
            <div
              className="absolute top-0 bottom-0 w-2 pointer-events-none"
              style={{
                [isAr ? 'right' : 'left']: 0,
                background: isAr
                  ? 'linear-gradient(to left, rgba(0,0,0,0.08), transparent)'
                  : 'linear-gradient(to right, rgba(0,0,0,0.08), transparent)',
              }}
            />
          </div>
        ) : null}
      </div>

      {/* ─── Navigation arrows (desktop) ───────────── */}
      <button
        onClick={isAr ? nextPage : prevPage}
        disabled={currentPage <= 1 && !isAr}
        className="hidden md:flex fixed top-1/2 -translate-y-1/2 w-12 h-24 items-center justify-center rounded-lg hover:bg-black/5 transition-colors z-40 disabled:opacity-20"
        style={{ [isAr ? 'right' : 'left']: '1rem' }}
        aria-label={isAr ? 'الصفحة التالية' : 'Previous page'}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        onClick={isAr ? prevPage : nextPage}
        disabled={totalPages > 0 && currentPage >= totalPages && !isAr}
        className="hidden md:flex fixed top-1/2 -translate-y-1/2 w-12 h-24 items-center justify-center rounded-lg hover:bg-black/5 transition-colors z-40 disabled:opacity-20"
        style={{ [isAr ? 'left' : 'right']: '1rem' }}
        aria-label={isAr ? 'الصفحة السابقة' : 'Next page'}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ─── Sample mode CTA ───────────────────────── */}
      {mode === 'sample' && totalPages > 0 && currentPage >= totalPages && (
        <div
          className="fixed bottom-20 left-4 right-4 mx-auto max-w-md rounded-2xl p-6 text-center shadow-lg z-40"
          style={{
            backgroundColor: themeConfig.toolbarBg,
            backdropFilter: 'blur(12px)',
          }}
        >
          <p
            className="text-sm mb-4"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}
          >
            {isAr ? 'انتهت العيّنة المجانية — احصل على النسخة الكاملة' : 'End of free sample — get the full book'}
          </p>
          <button
            onClick={() => router.push(`/${locale}/shop`)}
            className="px-6 py-3 rounded-xl text-sm font-medium min-h-[44px] transition-transform hover:scale-105"
            style={{ backgroundColor: 'var(--color-primary)', color: '#fff', fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}
          >
            {isAr ? 'اشترِ الآن' : 'Buy Now'}
          </button>
        </div>
      )}

      {/* ─── Progress bar ──────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 h-1 z-50" style={{ backgroundColor: `${themeConfig.text}10` }}>
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            backgroundColor: 'var(--color-primary)',
            [isAr ? 'right' : 'left']: 0,
            position: 'absolute',
          }}
        />
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────
function toArabicNum(n: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n).replace(/\d/g, (d) => arabicDigits[parseInt(d)]!);
}
