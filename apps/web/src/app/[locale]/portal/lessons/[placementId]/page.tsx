'use client';

/**
 * /[locale]/portal/lessons/[placementId] — Student Lesson Player
 *
 * LESSON-BLOCKS Session C-1 (2026-04-22). Renders a reusable lesson inside the
 * course scope defined by the placement. Keys on placement_id (NOT lesson_id)
 * so audio-exchange responses + progress anchor to the course, not the shared
 * lesson.
 *
 * Renders 8 block types: video, text, pdf, image, audio, callout, quiz_ref,
 * audio_exchange. Unauthenticated / not-enrolled redirects handled by the
 * middleware + API's 404. Bilingual + RTL.
 */

import { useAuth } from '@kunacademy/auth';
import { useState, useEffect, useRef, useCallback, use } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlockBase {
  id: string;
  block_type:
    | 'video'
    | 'text'
    | 'pdf'
    | 'image'
    | 'audio'
    | 'callout'
    | 'quiz_ref'
    | 'audio_exchange';
  sort_order: number;
  block_data: Record<string, unknown>;
}

interface AudioExchange {
  id: string;
  prompt_audio_url: string;
  prompt_duration_sec: number | null;
  prompt_transcript_ar: string | null;
  prompt_transcript_en: string | null;
  instructions_ar: string | null;
  instructions_en: string | null;
  response_mode: 'audio_only' | 'text_only' | 'either';
  response_time_limit_sec: number | null;
  requires_review: boolean;
}

interface MyResponse {
  id: string;
  audio_url: string | null;
  audio_duration_sec: number | null;
  text_response: string | null;
  coach_comment: string | null;
  coach_commented_at: string | null;
  review_status: string | null;
  submitted_at: string;
}

interface ExchangeBlock extends BlockBase {
  block_type: 'audio_exchange';
  audio_exchange: AudioExchange | null;
  my_response: MyResponse | null;
}

interface QuizBlock extends BlockBase {
  block_type: 'quiz_ref';
  quiz: { id: string; title_ar: string; title_en: string; is_published: boolean | null } | null;
}

type Block = BlockBase | ExchangeBlock | QuizBlock;

interface Sibling {
  placement_id: string;
  section_id: string | null;
  sort_order: number;
  title_ar: string;
  title_en: string;
  duration_minutes: number | null;
  completed: boolean;
}

interface SectionInfo {
  id: string;
  title_ar: string;
  title_en: string;
  order: number;
}

interface PlayerData {
  placement: { id: string; course_id: string; section_id: string | null; title_ar: string; title_en: string };
  course: { id: string; title_ar: string; title_en: string } | null;
  lesson: { id: string; title_ar: string; title_en: string; description_ar: string | null; description_en: string | null; duration_minutes: number | null };
  blocks: Block[];
  sections: SectionInfo[];
  siblings: Sibling[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectVideoProvider(url: string): { provider: 'youtube' | 'vimeo' | 'drive' | 'direct'; embedUrl: string } {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v') ?? '';
      return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean)[0] ?? '';
      return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` };
    }
    if (u.hostname.includes('drive.google.com')) {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      const id = m?.[1] ?? '';
      return { provider: 'drive', embedUrl: `https://drive.google.com/file/d/${id}/preview` };
    }
  } catch {}
  return { provider: 'direct', embedUrl: url };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function StudentLessonPlayer({
  params,
}: {
  params: Promise<{ locale: string; placementId: string }>;
}) {
  const { locale, placementId } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();

  const [data, setData] = useState<PlayerData | null>(null);
  const [appState, setAppState] = useState<'loading' | 'error' | 'not_found' | 'ready'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // ── Load ──
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setAppState('loading');
      try {
        const res = await fetch(`/api/lms/placements/${placementId}`);
        if (res.status === 404) {
          if (!cancelled) setAppState('not_found');
          return;
        }
        if (!res.ok) {
          if (!cancelled) {
            setErrMsg(isAr ? 'تعذّر تحميل الدرس' : 'Failed to load lesson');
            setAppState('error');
          }
          return;
        }
        const json = (await res.json()) as PlayerData;
        if (!cancelled) {
          setData(json);
          setAppState('ready');
          // Check if already completed from siblings list
          const me = json.siblings.find((s) => s.placement_id === placementId);
          if (me?.completed) setCompleted(true);
        }
      } catch {
        if (!cancelled) {
          setErrMsg(isAr ? 'خطأ في الاتصال' : 'Connection error');
          setAppState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, placementId, isAr]);

  // ── Mark complete ──
  const handleMarkComplete = useCallback(async () => {
    if (!data) return;
    setCompleting(true);
    try {
      await fetch('/api/lms/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: data.lesson.id,
          courseId: data.placement.course_id,
          placementId: placementId,
          completed: true,
        }),
      });
      setCompleted(true);
    } finally {
      setCompleting(false);
    }
  }, [data, placementId]);

  // ── Guards ──
  if (!user && appState !== 'loading') {
    return <Shell isAr={isAr}>{isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first'}</Shell>;
  }
  if (appState === 'loading') {
    return (
      <Shell isAr={isAr}>
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </Shell>
    );
  }
  if (appState === 'not_found') {
    return (
      <Shell isAr={isAr}>
        <div className="text-center space-y-3">
          <p className="text-[var(--text-primary)] font-semibold">
            {isAr ? 'الدرس غير متاح' : 'Lesson not available'}
          </p>
          <p className="text-sm text-[var(--color-neutral-500)]">
            {isAr
              ? 'قد تحتاج إلى التسجيل في الدورة للوصول إلى هذا الدرس'
              : 'You may need to enroll in the course to access this lesson'}
          </p>
        </div>
      </Shell>
    );
  }
  if (appState === 'error' || !data) {
    return <Shell isAr={isAr}><p className="text-red-600">{errMsg}</p></Shell>;
  }

  const title = isAr ? data.placement.title_ar : data.placement.title_en;
  const courseName = data.course ? (isAr ? data.course.title_ar : data.course.title_en) : '';
  const description = isAr ? data.lesson.description_ar : data.lesson.description_en;

  // Sibling nav: previous/next
  const orderedSiblings = [...data.siblings].sort((a, b) => a.sort_order - b.sort_order);
  const currentIdx = orderedSiblings.findIndex((s) => s.placement_id === placementId);
  const prevSib = currentIdx > 0 ? orderedSiblings[currentIdx - 1] : null;
  const nextSib = currentIdx >= 0 && currentIdx < orderedSiblings.length - 1 ? orderedSiblings[currentIdx + 1] : null;

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--color-background)] py-8 px-4">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Breadcrumb */}
        {courseName && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-neutral-500)]">
            <a
              href={`/${locale}/dashboard/courses/${data.placement.course_id}`}
              className="hover:text-[var(--color-primary)] transition-colors truncate"
            >
              {courseName}
            </a>
            <span>/</span>
            <span className="text-[var(--text-primary)] font-medium truncate">{title}</span>
          </div>
        )}

        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
          {description && (
            <p className="text-[var(--color-neutral-600)] text-sm leading-relaxed">{description}</p>
          )}
          {data.lesson.duration_minutes && (
            <p className="text-xs text-[var(--color-neutral-400)]">
              {data.lesson.duration_minutes} {isAr ? 'دقيقة' : 'min'}
            </p>
          )}
        </header>

        {/* Blocks */}
        <div className="space-y-6">
          {data.blocks.map((b) => (
            <BlockRenderer
              key={b.id}
              block={b}
              locale={locale}
              isAr={isAr}
              placementId={placementId}
            />
          ))}
          {data.blocks.length === 0 && (
            <p className="text-center text-sm text-[var(--color-neutral-400)] py-8">
              {isAr ? 'لا يوجد محتوى بعد' : 'No content yet'}
            </p>
          )}
        </div>

        {/* Mark complete */}
        <div className="rounded-2xl border border-[var(--color-neutral-100)] bg-white p-5 flex items-center justify-between gap-4">
          {completed ? (
            <>
              <div>
                <p className="font-semibold text-green-700">
                  ✓ {isAr ? 'أتممت هذا الدرس' : 'Lesson completed'}
                </p>
                <p className="text-xs text-[var(--color-neutral-500)]">
                  {isAr ? 'يمكنك الانتقال إلى الدرس التالي' : 'You can move on to the next lesson'}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  {isAr ? 'أنهيت الدرس؟' : 'Done with this lesson?'}
                </p>
                <p className="text-xs text-[var(--color-neutral-500)]">
                  {isAr ? 'حدِّد كمكتمل لتنتقل للدرس التالي' : 'Mark as complete to track your progress'}
                </p>
              </div>
              <button
                onClick={handleMarkComplete}
                disabled={completing}
                className="shrink-0 inline-flex items-center px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity min-h-[44px] disabled:opacity-50"
              >
                {completing
                  ? (isAr ? 'جارٍ...' : 'Saving...')
                  : (isAr ? 'إكمال الدرس' : 'Mark Complete')}
              </button>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex items-center justify-between pt-4 border-t border-[var(--color-neutral-100)]">
          {prevSib ? (
            <a
              href={`/${locale}/portal/lessons/${prevSib.placement_id}`}
              className="flex items-center gap-2 text-sm text-[var(--color-neutral-600)] hover:text-[var(--color-primary)] transition-colors min-h-[44px]"
            >
              <span aria-hidden className="rtl:rotate-180">←</span>
              <span className="truncate max-w-[160px]">{isAr ? prevSib.title_ar : prevSib.title_en}</span>
            </a>
          ) : (
            <span />
          )}
          {nextSib ? (
            <a
              href={`/${locale}/portal/lessons/${nextSib.placement_id}`}
              className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:opacity-80 transition-opacity min-h-[44px]"
            >
              <span className="truncate max-w-[160px]">{isAr ? nextSib.title_ar : nextSib.title_en}</span>
              <span aria-hidden className="rtl:rotate-180">→</span>
            </a>
          ) : data.course ? (
            <a
              href={`/${locale}/dashboard/courses/${data.placement.course_id}`}
              className="text-sm font-semibold text-green-600 hover:opacity-80 min-h-[44px] flex items-center"
            >
              {isAr ? 'العودة للدورة' : 'Back to Course'}
            </a>
          ) : null}
        </nav>
      </div>
    </div>
  );
}

// ── Shell for full-screen states ─────────────────────────────────────────────

function Shell({ isAr, children }: { isAr: boolean; children: React.ReactNode }) {
  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4"
    >
      {children}
    </div>
  );
}

// ── Block renderer ───────────────────────────────────────────────────────────

function BlockRenderer({
  block,
  locale,
  isAr,
  placementId,
}: {
  block: Block;
  locale: string;
  isAr: boolean;
  placementId: string;
}) {
  switch (block.block_type) {
    case 'video':
      return <VideoBlock data={block.block_data} isAr={isAr} />;
    case 'text':
      return <TextBlock data={block.block_data} isAr={isAr} />;
    case 'pdf':
      return <PdfBlock data={block.block_data} isAr={isAr} />;
    case 'image':
      return <ImageBlock data={block.block_data} isAr={isAr} />;
    case 'audio':
      return <AudioBlock data={block.block_data} isAr={isAr} />;
    case 'callout':
      return <CalloutBlock data={block.block_data} isAr={isAr} />;
    case 'quiz_ref': {
      const q = (block as QuizBlock).quiz;
      if (!q) return null;
      return (
        <div className="rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-primary-50)] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wider">
              {isAr ? 'اختبار' : 'Quiz'}
            </p>
            <p className="font-bold text-[var(--text-primary)]">{isAr ? q.title_ar : q.title_en}</p>
          </div>
          <a
            href={`/${locale}/portal/quiz/${q.id}`}
            className="shrink-0 inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:bg-[var(--color-accent-500)] transition-colors min-h-[44px]"
          >
            {isAr ? 'ابدأ الاختبار' : 'Take Quiz'}
          </a>
        </div>
      );
    }
    case 'audio_exchange': {
      const eb = block as ExchangeBlock;
      if (!eb.audio_exchange) return null;
      return (
        <AudioExchangeBlock
          exchange={eb.audio_exchange}
          existingResponse={eb.my_response}
          placementId={placementId}
          isAr={isAr}
        />
      );
    }
    default:
      return null;
  }
}

// ── Individual block renderers ───────────────────────────────────────────────

function VideoBlock({ data, isAr }: { data: Record<string, unknown>; isAr: boolean }) {
  const url = str(data.url);
  if (!url) return null;
  const provider = str(data.provider);
  if (provider === 'bunny' && data.video_id) {
    const libId = process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID ?? '';
    return (
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={`https://iframe.mediadelivery.net/embed/${libId}/${String(data.video_id)}?autoplay=false&preload=true`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }
  const { provider: detected, embedUrl } = detectVideoProvider(url);
  if (detected === 'direct') {
    return (
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
        <video
          src={embedUrl}
          controls
          className="absolute inset-0 w-full h-full"
          playsInline
          controlsList="nodownload"
          aria-label={isAr ? 'مشغّل الفيديو' : 'Video player'}
        />
      </div>
    );
  }
  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
      <iframe
        src={embedUrl}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        title={isAr ? 'فيديو الدرس' : 'Lesson video'}
      />
    </div>
  );
}

function TextBlock({ data, isAr }: { data: Record<string, unknown>; isAr: boolean }) {
  const content = str(isAr ? data.content_ar : data.content_en);
  if (!content) return null;
  return (
    <div
      className="prose prose-neutral max-w-none text-[var(--text-primary)] [&_a]:text-[var(--color-primary)] whitespace-pre-wrap"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {content}
    </div>
  );
}

function PdfBlock({ data, isAr }: { data: Record<string, unknown>; isAr: boolean }) {
  const url = str(data.url);
  if (!url) return null;
  const filename = str(data.filename) || (isAr ? 'ملف PDF' : 'PDF document');
  return (
    <div className="rounded-2xl border border-[var(--color-neutral-100)] bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-neutral-100)] flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{filename}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-[var(--color-primary)] hover:underline"
        >
          {isAr ? 'فتح في تبويب جديد' : 'Open in new tab'}
        </a>
      </div>
      <iframe src={url} className="w-full h-[70vh] min-h-[400px]" title={filename} />
    </div>
  );
}

function ImageBlock({ data, isAr }: { data: Record<string, unknown>; isAr: boolean }) {
  const url = str(data.url);
  if (!url) return null;
  const alt = str(isAr ? data.alt_ar : data.alt_en) || '';
  const caption = str(isAr ? data.caption_ar : data.caption_en);
  return (
    <figure className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="w-full rounded-xl" />
      {caption && (
        <figcaption className="text-xs text-[var(--color-neutral-500)] text-center">{caption}</figcaption>
      )}
    </figure>
  );
}

function AudioBlock({ data, isAr }: { data: Record<string, unknown>; isAr: boolean }) {
  const url = str(data.url);
  if (!url) return null;
  const transcript = str(isAr ? data.transcript_ar : data.transcript_en);
  return (
    <div className="rounded-2xl border border-[var(--color-neutral-100)] bg-white p-4 space-y-3">
      <audio src={url} controls className="w-full" aria-label={isAr ? 'ملف صوتي' : 'Audio'} />
      {transcript && (
        <details className="text-sm text-[var(--color-neutral-600)]">
          <summary className="cursor-pointer font-medium">{isAr ? 'النص المكتوب' : 'Transcript'}</summary>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed">{transcript}</p>
        </details>
      )}
    </div>
  );
}

function CalloutBlock({ data, isAr }: { data: Record<string, unknown>; isAr: boolean }) {
  const variant = str(data.variant) || 'info';
  const title = str(isAr ? data.title_ar : data.title_en);
  const body = str(isAr ? data.body_ar : data.body_en);
  if (!title && !body) return null;
  const colorMap: Record<string, string> = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    tip: 'border-green-200 bg-green-50 text-green-900',
  };
  const cls = colorMap[variant] ?? colorMap.info;
  return (
    <div className={`rounded-2xl border-2 p-4 ${cls}`}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      {body && <p className="text-sm whitespace-pre-wrap leading-relaxed">{body}</p>}
    </div>
  );
}

// ── Audio-exchange response widget ───────────────────────────────────────────

type RecorderStatus =
  | { kind: 'idle' }
  | { kind: 'recording'; startedAt: number }
  | { kind: 'recorded'; blob: Blob; durationSec: number; previewUrl: string }
  | { kind: 'uploading' }
  | { kind: 'error'; message: string };

function AudioExchangeBlock({
  exchange,
  existingResponse,
  placementId,
  isAr,
}: {
  exchange: AudioExchange;
  existingResponse: MyResponse | null;
  placementId: string;
  isAr: boolean;
}) {
  const [submitted, setSubmitted] = useState<MyResponse | null>(existingResponse);
  const [tab, setTab] = useState<'audio' | 'text'>(
    exchange.response_mode === 'text_only' ? 'text' : 'audio',
  );
  const [textValue, setTextValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Recorder state
  const [rec, setRec] = useState<RecorderStatus>({ kind: 'idle' });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const MAX_SEC = exchange.response_time_limit_sec ?? 600;

  const instructions = isAr ? exchange.instructions_ar : exchange.instructions_en;
  const transcript = isAr ? exchange.prompt_transcript_ar : exchange.prompt_transcript_en;

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      const startedAt = Date.now();
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const previewUrl = URL.createObjectURL(blob);
        const durationSec = Math.floor((Date.now() - startedAt) / 1000);
        setRec({ kind: 'recorded', blob, durationSec, previewUrl });
      };
      mr.start(1000);
      setElapsed(0);
      setRec({ kind: 'recording', startedAt });
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(secs);
        if (secs >= MAX_SEC) {
          mr.stop();
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setRec({ kind: 'error', message: msg });
    }
  }, [MAX_SEC]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const discard = useCallback(() => {
    if (rec.kind === 'recorded') URL.revokeObjectURL(rec.previewUrl);
    setRec({ kind: 'idle' });
    setElapsed(0);
  }, [rec]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      let res: Response;
      if (tab === 'audio' && rec.kind === 'recorded') {
        const fd = new FormData();
        fd.append('placement_id', placementId);
        fd.append('voice', rec.blob, 'response.webm');
        fd.append('audio_duration_sec', String(rec.durationSec));
        if (exchange.response_mode === 'either' && textValue.trim()) {
          fd.append('text_response', textValue.trim());
        }
        res = await fetch(`/api/lms/audio-exchanges/${exchange.id}/responses`, {
          method: 'POST',
          body: fd,
        });
      } else {
        const body = {
          placement_id: placementId,
          text_response: textValue.trim() || undefined,
        };
        res = await fetch(`/api/lms/audio-exchanges/${exchange.id}/responses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (res.status === 409) {
        setSubmitError(isAr ? 'أرسلت ردًا بالفعل' : 'You already submitted a response');
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSubmitError(d?.error ?? (isAr ? 'تعذّر الإرسال' : 'Submission failed'));
        setSubmitting(false);
        return;
      }
      const json = await res.json();
      setSubmitted(json.response as MyResponse);
      if (rec.kind === 'recorded') URL.revokeObjectURL(rec.previewUrl);
    } catch {
      setSubmitError(isAr ? 'خطأ في الاتصال' : 'Connection error');
    } finally {
      setSubmitting(false);
    }
  }, [tab, rec, textValue, placementId, exchange.id, exchange.response_mode, isAr]);

  const elapsedStr = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  // ── Submitted state ──
  if (submitted) {
    return (
      <div className="rounded-2xl border-2 border-[var(--color-primary-200)] bg-[var(--color-primary-50)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎙️</span>
          <h3 className="font-semibold text-[var(--text-primary)]">
            {isAr ? 'تبادل صوتي' : 'Audio Exchange'}
          </h3>
          <span className="ms-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            ✓ {isAr ? 'تم الإرسال' : 'Submitted'}
          </span>
        </div>
        {instructions && <p className="text-sm text-[var(--color-neutral-600)]">{instructions}</p>}
        <audio src={exchange.prompt_audio_url} controls className="w-full" />

        <div className="rounded-xl bg-white border border-[var(--color-neutral-100)] p-4 space-y-2">
          <p className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
            {isAr ? 'ردك' : 'Your response'}
          </p>
          {submitted.audio_url && (
            <audio src={submitted.audio_url} controls className="w-full" />
          )}
          {submitted.text_response && (
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
              {submitted.text_response}
            </p>
          )}
          <p className="text-xs text-[var(--color-neutral-400)]">
            {isAr ? 'أُرسل في' : 'Submitted'} {new Date(submitted.submitted_at).toLocaleString(isAr ? 'ar-AE' : 'en-GB')}
          </p>
        </div>

        {exchange.requires_review && submitted.review_status && (
          <ReviewStatusBadge status={submitted.review_status} isAr={isAr} />
        )}
        {submitted.coach_comment && (
          <div className="rounded-xl bg-white border border-[var(--color-neutral-100)] p-4">
            <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wider mb-1">
              {isAr ? 'تعليق الكوتش' : "Coach's comment"}
            </p>
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
              {submitted.coach_comment}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Compose state ──
  return (
    <div className="rounded-2xl border-2 border-[var(--color-primary-200)] bg-[var(--color-primary-50)] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎙️</span>
        <h3 className="font-semibold text-[var(--text-primary)]">
          {isAr ? 'تبادل صوتي' : 'Audio Exchange'}
        </h3>
        {exchange.requires_review && (
          <span className="ms-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
            {isAr ? 'يتطلب مراجعة' : 'Requires review'}
          </span>
        )}
      </div>
      {instructions && <p className="text-sm text-[var(--color-neutral-600)]">{instructions}</p>}

      <div>
        <p className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider mb-2">
          {isAr ? 'استمع إلى السؤال' : 'Listen to the prompt'}
        </p>
        <audio src={exchange.prompt_audio_url} controls className="w-full" />
        {transcript && (
          <details className="mt-2 text-sm text-[var(--color-neutral-600)]">
            <summary className="cursor-pointer font-medium">{isAr ? 'النص المكتوب' : 'Transcript'}</summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{transcript}</p>
          </details>
        )}
      </div>

      {/* Mode switcher */}
      {exchange.response_mode === 'either' && (
        <div className="flex gap-2 border-b border-[var(--color-neutral-200)]">
          <button
            onClick={() => setTab('audio')}
            className={`px-4 py-2 text-sm font-semibold ${tab === 'audio' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' : 'text-[var(--color-neutral-500)]'}`}
          >
            {isAr ? '🎙️ صوت' : '🎙️ Audio'}
          </button>
          <button
            onClick={() => setTab('text')}
            className={`px-4 py-2 text-sm font-semibold ${tab === 'text' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' : 'text-[var(--color-neutral-500)]'}`}
          >
            {isAr ? '✍️ نص' : '✍️ Text'}
          </button>
        </div>
      )}

      {/* Audio recorder */}
      {(tab === 'audio' && exchange.response_mode !== 'text_only') && (
        <div className="space-y-2">
          {rec.kind === 'idle' && (
            <button
              onClick={() => void startRecording()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 min-h-[44px]"
            >
              <span className="h-2 w-2 rounded-full bg-white" />
              {isAr ? 'بدء التسجيل' : 'Start Recording'}
            </button>
          )}
          {rec.kind === 'recording' && (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                {isAr ? 'جارٍ التسجيل' : 'Recording'} — {elapsedStr}
              </span>
              <button
                onClick={stopRecording}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 min-h-[44px]"
              >
                {isAr ? 'إيقاف' : 'Stop'}
              </button>
            </div>
          )}
          {rec.kind === 'recorded' && (
            <div className="space-y-2">
              <audio controls src={rec.previewUrl} className="w-full h-9" />
              <button
                onClick={discard}
                className="text-xs text-[var(--color-neutral-500)] hover:text-red-600"
              >
                {isAr ? '✗ حذف وإعادة التسجيل' : '✗ Discard & re-record'}
              </button>
            </div>
          )}
          {rec.kind === 'error' && (
            <p className="text-sm text-red-600">{rec.message}</p>
          )}
        </div>
      )}

      {/* Text input */}
      {(tab === 'text' || exchange.response_mode === 'text_only' || exchange.response_mode === 'either') && (
        <div className={tab === 'text' || exchange.response_mode !== 'either' ? '' : 'hidden'}>
          <textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder={isAr ? 'اكتب ردّك هنا...' : 'Type your response...'}
            rows={5}
            dir={isAr ? 'rtl' : 'ltr'}
            className="w-full rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
      )}

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <button
        onClick={submit}
        disabled={
          submitting ||
          (tab === 'audio' && rec.kind !== 'recorded' && !textValue.trim() && exchange.response_mode !== 'text_only') ||
          (tab === 'text' && !textValue.trim())
        }
        className="w-full min-h-[48px] rounded-xl bg-[var(--color-accent)] text-white text-sm font-bold hover:bg-[var(--color-accent-500)] transition-colors disabled:opacity-50"
      >
        {submitting ? (isAr ? 'جارٍ الإرسال...' : 'Submitting...') : (isAr ? 'إرسال الرد' : 'Submit Response')}
      </button>
    </div>
  );
}

function ReviewStatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const map: Record<string, { cls: string; ar: string; en: string }> = {
    pending: { cls: 'bg-amber-100 text-amber-700', ar: 'بانتظار المراجعة', en: 'Pending review' },
    reviewed: { cls: 'bg-blue-100 text-blue-700', ar: 'تمت المراجعة', en: 'Reviewed' },
    approved: { cls: 'bg-green-100 text-green-700', ar: 'مقبول', en: 'Approved' },
    needs_rework: { cls: 'bg-red-100 text-red-700', ar: 'يحتاج تعديل', en: 'Needs rework' },
  };
  const m = map[status] ?? { cls: 'bg-neutral-100 text-neutral-700', ar: status, en: status };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${m.cls}`}>
      {isAr ? m.ar : m.en}
    </span>
  );
}
