'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { GeometricPattern } from '@kunacademy/ui/patterns';

/* ── Types ── */
interface TestimonialData {
  id: string;
  authorName: string;
  content: string;
  program: string;
  role?: string;
  location?: string;
  photoUrl?: string;
  videoUrl?: string;
  countryCode?: string;
}

interface TestimonialsShowcaseProps {
  locale: string;
  testimonials?: TestimonialData[];
}

/* ── YouTube helpers ── */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/* ── Fallback data (used until CMS has real testimonials) ── */
function getDefaultTestimonials(isAr: boolean): TestimonialData[] {
  return isAr ? [
    {
      id: 'ahmed-mokhtar',
      authorName: 'أحمد مختار',
      content: 'دخلت كُن وأنا فاكر إني هاخد شهادة وخلاص، لقيت نفسي في عيلة كاملة بتدعمني وبتطلع مني حاجات ما كنتش أتخيل إنها موجودة. المنهجية غسلتني من جوا — خلتني أتقبل نفسي بكل اللي فيها، وبقيت أقدر أتقبل أي حد قدامي.',
      program: 'STCE Level 1',
      role: 'كوتش',
      location: 'مصر',
      videoUrl: 'https://www.youtube.com/watch?v=4wCVqvVEV7w',
      countryCode: 'EG',
    },
    {
      id: 'mona',
      authorName: 'منى الكعبي',
      content: 'في أول يوم من البرنامج، سألني سامر: "وين تحس هذا الكلام في جسمك؟" ما كان عندي جواب. بعد ستة أشهر، صار جسدي أول مصدر معلومات في كل جلسة كوتشينج. التفكير الحسّي مو مجرد منهجية... هو طريقة ثانية للسماع.',
      program: 'STCE Level 2',
      role: 'كوتش تنفيذي معتمد ACC',
      location: 'أبوظبي، الإمارات',
      countryCode: 'AE',
    },
    {
      id: 'fahad',
      authorName: 'فهد الدوسري',
      content: 'جيت لخلوة إحياء وأنا أظن إني بس محتاج استراحة. لكن اللي صار كان شي ثاني. خمسة أيام في صمت وحضور مع مجموعة ما تعرفهم — وتطلع منها وأنت تعرف نفسك بشكل ما عرفته من قبل.',
      program: 'خلوة إحياء',
      role: 'استشاري تطوير قيادي',
      location: 'الرياض، السعودية',
      countryCode: 'SA',
    },
    {
      id: 'haya',
      authorName: 'هيا المري',
      content: 'كنت أدور على شهادة ICF معتمدة. بس اللي لقيته في كُنْ كان أكبر من شهادة. تعلّمت إن الكوتشينج الحقيقي يبدأ من حضورك أنت — مو من أسئلتك. المنهجية ربطت لي بين التراث اللي كبرت عليه وبين ممارسة مهنية عالمية.',
      program: 'STCE Level 1',
      role: 'كوتش حياة',
      location: 'الدوحة، قطر',
      countryCode: 'QA',
    },
    {
      id: 'omar',
      authorName: 'عمر الحمادي',
      content: 'بعد Level 3 والمنتورينج مع سامر، أول شي تغيّر مو أسلوب الكوتشينج حقي — تغيّرت علاقتي بجسمي. صرت ألاحظ أشياء في الجلسة ما كنت أنتبه لها: التنفس، التوتر في الكتف، اللحظة اللي يسكت فيها العميل.',
      program: 'STCE Level 3',
      role: 'كوتش تنفيذي PCC',
      location: 'دبي، الإمارات',
      countryCode: 'AE',
    },
  ] : [
    {
      id: 'ahmed-mokhtar',
      authorName: 'Ahmed Mokhtar',
      content: 'I walked into Kun thinking I\'d just pick up a certificate, but I found a whole family that had my back and a methodology that pulled out things I never knew were inside me. It cleaned me from within — once I accepted my own mess, I could truly hold space for anyone sitting in front of me.',
      program: 'STCE Level 1',
      role: 'Coach',
      location: 'Egypt',
      countryCode: 'EG',
      videoUrl: 'https://www.youtube.com/watch?v=4wCVqvVEV7w',
    },
    {
      id: 'mona',
      authorName: 'Mona Al-Kaabi',
      content: 'On the first day, Samer asked me: "Where do you feel those words in your body?" I had no answer. Six months later, my body became my primary source of information in every coaching session. Somatic Thinking is not just a methodology — it is another way of listening.',
      program: 'STCE Level 2',
      role: 'ACC Executive Coach',
      location: 'Abu Dhabi, UAE',
      countryCode: 'AE',
    },
    {
      id: 'fahad',
      authorName: 'Fahad Al-Dosari',
      content: 'I came to the Ihya retreat thinking I just needed a break. What happened was something else entirely. Five days of silence and presence with strangers — and you leave knowing yourself in a way you never did before.',
      program: 'Ihya Retreat',
      role: 'Leadership Development Consultant',
      location: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
    },
    {
      id: 'haya',
      authorName: 'Haya Al-Marri',
      content: 'I was looking for an ICF-accredited certification. What I found at Kun was bigger than a credential. I learned that real coaching begins from your own presence — not from your questions.',
      program: 'STCE Level 1',
      role: 'Life Coach',
      location: 'Doha, Qatar',
      countryCode: 'QA',
    },
    {
      id: 'omar',
      authorName: 'Omar Al-Hammadi',
      content: 'After Level 3 and mentoring with Samer, the first thing that changed was not my coaching style — it was my relationship with my body. I started noticing things in sessions I never paid attention to.',
      program: 'STCE Level 3',
      role: 'PCC Executive Coach',
      location: 'Dubai, UAE',
      countryCode: 'AE',
    },
  ];
}


/* ── Country flag emoji from ISO code ── */
function countryFlag(code: string): string {
  const upper = code.toUpperCase();
  return String.fromCodePoint(...[...upper].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

const countryNames: Record<string, { ar: string; en: string }> = {
  AE: { ar: 'الإمارات', en: 'UAE' },
  SA: { ar: 'السعودية', en: 'Saudi Arabia' },
  QA: { ar: 'قطر', en: 'Qatar' },
  KW: { ar: 'الكويت', en: 'Kuwait' },
  BH: { ar: 'البحرين', en: 'Bahrain' },
  OM: { ar: 'عُمان', en: 'Oman' },
  EG: { ar: 'مصر', en: 'Egypt' },
  JO: { ar: 'الأردن', en: 'Jordan' },
  LB: { ar: 'لبنان', en: 'Lebanon' },
  MA: { ar: 'المغرب', en: 'Morocco' },
  TN: { ar: 'تونس', en: 'Tunisia' },
  DZ: { ar: 'الجزائر', en: 'Algeria' },
  IQ: { ar: 'العراق', en: 'Iraq' },
  SD: { ar: 'السودان', en: 'Sudan' },
  LY: { ar: 'ليبيا', en: 'Libya' },
  US: { ar: 'أمريكا', en: 'USA' },
  GB: { ar: 'بريطانيا', en: 'UK' },
  CA: { ar: 'كندا', en: 'Canada' },
  AU: { ar: 'أستراليا', en: 'Australia' },
  DE: { ar: 'ألمانيا', en: 'Germany' },
  FR: { ar: 'فرنسا', en: 'France' },
  IT: { ar: 'إيطاليا', en: 'Italy' },
  TR: { ar: 'تركيا', en: 'Turkey' },
  MY: { ar: 'ماليزيا', en: 'Malaysia' },
  PK: { ar: 'باكستان', en: 'Pakistan' },
  IN: { ar: 'الهند', en: 'India' },
};

function CountryBadge({ code, isAr }: { code: string; isAr: boolean }) {
  const name = countryNames[code.toUpperCase()];
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-neutral-500)]">
      <span className="text-sm leading-none">{countryFlag(code)}</span>
      {name ? (isAr ? name.ar : name.en) : code}
    </span>
  );
}

/* ── Video Play Overlay ── */
function VideoPlayOverlay({ isAr }: { isAr: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[var(--color-primary)]/90 to-[var(--color-primary-700)]/90 rounded-[14px] cursor-pointer group/play">
      {/* Animated play button */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[var(--color-accent)] animate-ping opacity-20" />
        <div className="relative h-14 w-14 rounded-full bg-[var(--color-accent)] flex items-center justify-center shadow-[0_4px_20px_rgba(244,126,66,0.4)] group-hover/play:scale-110 transition-transform duration-300">
          <svg className="w-6 h-6 text-white ms-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.5 4.5v11l9-5.5-9-5.5z" />
          </svg>
        </div>
      </div>
      {/* CTA text */}
      <span className="text-sm font-medium text-white/90">
        {isAr ? 'شاهد التجربة' : 'Watch Story'}
      </span>
    </div>
  );
}

/* ── YouTube Embed ── */
function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="w-full h-full rounded-[14px] overflow-hidden bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&controls=2&iv_load_policy=3&fs=0&disablekb=1&playsinline=1&widget_referrer=kunacademy.com&origin=https://kunacademy.com`}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Video testimonial"
      />
    </div>
  );
}

/* ── Avatar/Photo Frame ── */
function AvatarFrame({
  testimonial,
  isAr,
  isPlaying,
  onPlay,
}: {
  testimonial: TestimonialData;
  isAr: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  const isVideo = !!testimonial.videoUrl;
  const videoId = testimonial.videoUrl ? extractYouTubeId(testimonial.videoUrl) : null;

  return (
    <div className="relative w-40 h-48 md:w-48 md:h-56 rounded-2xl overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-600)] p-0.5">
      <div className="relative w-full h-full rounded-[14px] overflow-hidden">
        {/* Playing state: show YouTube embed */}
        {isPlaying && videoId ? (
          <YouTubeEmbed videoId={videoId} />
        ) : (
          <>
            {/* Photo or gradient initial */}
            {testimonial.photoUrl ? (
              <img
                src={testimonial.photoUrl}
                alt={testimonial.authorName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-700)]">
                {isVideo ? null : (
                  <span className="text-4xl md:text-5xl font-bold text-white/90">
                    {testimonial.authorName.charAt(0)}
                  </span>
                )}
              </div>
            )}

            {/* Video play overlay (shown on video testimonials when not playing) */}
            {isVideo && !isPlaying && (
              <div onClick={onPlay}>
                <VideoPlayOverlay isAr={isAr} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Featured Testimonial Card ── */
function FeaturedTestimonial({
  testimonial,
  isAr,
  isPlaying,
  onPlay,
  onClose,
}: {
  testimonial: TestimonialData;
  isAr: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onClose: () => void;
}) {
  const isVideo = !!testimonial.videoUrl;
  const videoId = testimonial.videoUrl ? extractYouTubeId(testimonial.videoUrl) : null;

  return (
    <div className="relative">
      {/* Large decorative quote mark */}
      <div
        className="absolute top-0 end-0 text-[12rem] md:text-[16rem] leading-none pointer-events-none select-none"
        style={{ color: 'var(--color-primary)', opacity: 0.04, fontFamily: 'Georgia, serif', transform: 'translateY(-2rem)' }}
        aria-hidden="true"
      >
        &ldquo;
      </div>

      <div className="relative">
        {/* ── EXPANDED VIDEO STATE — 2/3 video + 1/3 text on desktop ── */}
        {isPlaying && videoId ? (
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 transition-all duration-500 ease-out">
            {/* Video player — 2/3 width on desktop, full on mobile */}
            <div className="md:w-2/3 shrink-0">
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-[0_12px_40px_rgba(29,26,61,0.25)]">
                <iframe
                  src={'https://www.youtube-nocookie.com/embed/' + videoId + '?autoplay=1&rel=0&modestbranding=1&controls=2&iv_load_policy=3&fs=0&disablekb=1&playsinline=1&widget_referrer=kunacademy.com&origin=https://kunacademy.com'}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Video testimonial"
                />
              </div>
            </div>
            {/* Text side — 1/3 on desktop, below on mobile */}
            <div className="md:w-1/3 flex flex-col justify-between">
              <div>
                <blockquote>
                  <p
                    className="text-base leading-relaxed text-[var(--color-neutral-700)] line-clamp-6 md:line-clamp-none"
                    style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit', fontWeight: isAr ? 500 : 400 }}
                  >
                    {testimonial.content}
                  </p>
                </blockquote>
                <div className="mt-4 flex flex-col gap-1">
                  <span className="font-bold text-[var(--color-primary)] text-sm">{testimonial.authorName}</span>
                  {testimonial.role && (
                    <span className="text-xs text-[var(--color-neutral-600)]">{testimonial.role}</span>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {testimonial.program && (
                      <span className="inline-block text-xs bg-[var(--color-primary-50)] text-[var(--color-primary)] px-2.5 py-0.5 rounded-full font-medium">
                        {testimonial.program}
                      </span>
                    )}
                    {testimonial.countryCode ? (
                      <CountryBadge code={testimonial.countryCode} isAr={isAr} />
                    ) : testimonial.location ? (
                      <span className="text-xs text-[var(--color-neutral-500)]">{testimonial.location}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              {/* Close button */}
              <button
                onClick={onClose}
                className="mt-4 flex items-center justify-center gap-1.5 w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-neutral-200)] text-[var(--color-neutral-600)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary-200)] hover:bg-[var(--color-primary-50)] transition-all duration-200"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        ) : (
          /* ── DEFAULT STATE — side by side ── */
          <div className="flex flex-col md:flex-row items-start gap-8 md:gap-12">
            {/* Avatar/Video frame */}
            <div className="relative shrink-0 self-center md:self-start">
              <AvatarFrame testimonial={testimonial} isAr={isAr} isPlaying={false} onPlay={onPlay} />
            </div>

            {/* Quote content */}
            <div className="flex-1 min-w-0">
              <div className="hidden md:block w-12 h-0.5 bg-[var(--color-accent)] mb-6 rounded-full" />

              <blockquote>
                <p
                  className="text-lg md:text-xl leading-relaxed text-[var(--color-neutral-800)]"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit', fontWeight: isAr ? 500 : 400 }}
                >
                  {testimonial.content}
                </p>
              </blockquote>

              <div className="mt-6 flex flex-col gap-1.5">
                <cite className="not-italic">
                  <span className="font-bold text-[var(--color-primary)] text-base">{testimonial.authorName}</span>
                </cite>
                {testimonial.role && (
                  <span className="text-sm text-[var(--color-neutral-600)]">{testimonial.role}</span>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {testimonial.program && (
                    <span className="inline-block text-xs bg-[var(--color-primary-50)] text-[var(--color-primary)] px-3 py-1 rounded-full font-medium">
                      {testimonial.program}
                    </span>
                  )}
                  {testimonial.countryCode ? (
                    <CountryBadge code={testimonial.countryCode} isAr={isAr} />
                  ) : testimonial.location ? (
                    <span className="text-xs text-[var(--color-neutral-500)]">{testimonial.location}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Navigation: Arrows + Dots ── */
function Navigation({
  count, active, onSelect, onPrev, onNext, isAr,
}: {
  count: number; active: number; onSelect: (i: number) => void;
  onPrev: () => void; onNext: () => void; isAr: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-4 mt-10">
      {/* Previous arrow */}
      <button
        onClick={onPrev}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-[var(--color-neutral-500)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-all duration-200"
        aria-label={isAr ? 'السابق' : 'Previous'}
      >
        <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="hidden sm:inline">{isAr ? 'السابق' : 'Previous'}</span>
      </button>

      {/* Dots */}
      <div className="flex items-center gap-2" role="tablist">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === active}
            aria-label={`Testimonial ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-500 ${
              i === active ? 'w-8 bg-[var(--color-accent)]' : 'w-2 bg-[var(--color-primary-200)] hover:bg-[var(--color-primary-300)]'
            }`}
            onClick={() => onSelect(i)}
          />
        ))}
      </div>

      {/* Next arrow */}
      <button
        onClick={onNext}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-[var(--color-neutral-500)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-all duration-200"
        aria-label={isAr ? 'التالي' : 'Next'}
      >
        <span className="hidden sm:inline">{isAr ? 'التالي' : 'Next'}</span>
        <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}

/* ── Main Showcase Component ── */
export function TestimonialsShowcase({ locale, testimonials: propTestimonials }: TestimonialsShowcaseProps) {
  const isAr = locale === 'ar';
  const testimonials = propTestimonials && propTestimonials.length > 0
    ? propTestimonials
    : getDefaultTestimonials(isAr);

  const [activeIndex, setActiveIndex] = useState(0);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoAdvance = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
      setPlayingVideo(null); // Stop video when auto-advancing
    }, 8000);
  }, [testimonials.length]);

  const stopAutoAdvance = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  useEffect(() => {
    startAutoAdvance();
    return stopAutoAdvance;
  }, [startAutoAdvance, stopAutoAdvance]);

  const handleSelect = (i: number) => {
    stopAutoAdvance();
    setActiveIndex(i);
    setPlayingVideo(null);
    startAutoAdvance();
  };

  const handlePlay = (id: string) => {
    stopAutoAdvance(); // Don't auto-advance while watching video
    setPlayingVideo(id);
  };

  return (
    <section
      className="relative overflow-hidden py-[var(--section-padding-mobile)] md:py-[var(--section-padding)]"
      style={{ background: 'var(--color-surface-high, #f0e7db)' }}
      onMouseEnter={stopAutoAdvance}
      onMouseLeave={() => { if (!playingVideo) startAutoAdvance(); }}
    >
      <GeometricPattern pattern="girih" opacity={0.06} fade="both" />

      <div className="relative mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
        {/* Section header */}
        <div className="text-center mb-12 md:mb-16">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--color-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'الأثر لا يُقال... يُعاش' : "Impact isn't told. It's lived."}
          </h2>
          <p className="mt-3 text-[var(--color-neutral-600)] max-w-md mx-auto">
            {isAr ? 'كوتشز عاشوا التجربة وتحوّلوا من الداخل' : 'Coaches who lived the experience and transformed from within'}
          </p>

          {/* Authority line */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-5 text-sm">
            <span><strong className="text-[var(--color-primary)]">{isAr ? '٥٠٠+' : '500+'}</strong> <span className="text-[var(--color-neutral-500)]">{isAr ? 'كوتش' : 'coaches'}</span></span>
            <span className="w-px h-4 bg-[var(--color-neutral-300)]" aria-hidden="true" />
            <span><strong className="text-[var(--color-primary)]">{isAr ? '١٣' : '13'}</strong> <span className="text-[var(--color-neutral-500)]">{isAr ? 'دولة' : 'countries'}</span></span>
            <span className="w-px h-4 bg-[var(--color-neutral-300)]" aria-hidden="true" />
            <span><strong className="text-[var(--color-primary)]">ICF</strong> <span className="text-[var(--color-neutral-500)]">{isAr ? 'اعتماد دولي' : 'accredited'}</span></span>
          </div>
        </div>

        {/* Featured testimonial with crossfade */}
        <div className="relative min-h-[300px] md:min-h-[260px]">
          {testimonials.map((t, i) => (
            <div
              key={t.id}
              className="transition-opacity duration-700 ease-in-out"
              style={{
                opacity: i === activeIndex ? 1 : 0,
                position: i === activeIndex ? 'relative' : 'absolute',
                top: 0, left: 0, right: 0,
                pointerEvents: i === activeIndex ? 'auto' : 'none',
              }}
              aria-hidden={i !== activeIndex}
            >
              <FeaturedTestimonial
                testimonial={t}
                isAr={isAr}
                isPlaying={playingVideo === t.id}
                onPlay={() => handlePlay(t.id)}
                onClose={() => { setPlayingVideo(null); startAutoAdvance(); }}
              />
            </div>
          ))}
        </div>

        <Navigation
          count={testimonials.length}
          active={activeIndex}
          onSelect={handleSelect}
          onPrev={() => handleSelect((activeIndex - 1 + testimonials.length) % testimonials.length)}
          onNext={() => handleSelect((activeIndex + 1) % testimonials.length)}
          isAr={isAr}
        />

        {/* Read more link */}
        <div className="text-center mt-8">
          <a
            href={`/${locale}/testimonials/`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-600)] transition-colors duration-300 group"
          >
            {isAr ? 'اقرأ المزيد من التجارب' : 'Read more experiences'}
            <svg className="w-4 h-4 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform duration-300 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
