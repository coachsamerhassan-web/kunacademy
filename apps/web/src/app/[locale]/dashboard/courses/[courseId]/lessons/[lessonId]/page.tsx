'use client';

import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { useState, useEffect, useRef, useCallback, use } from 'react';

interface LessonData {
  id: string;
  course_id: string;
  section_id: string | null;
  title_ar: string;
  title_en: string;
  content_ar: string | null;
  content_en: string | null;
  video_url: string | null;
  video_provider: string | null;
  video_id: string | null;
  order: number;
  duration_minutes: number | null;
}

interface ProgressData {
  playback_position_seconds: number;
  completed: boolean;
}

interface NavLesson {
  id: string;
  title_ar: string;
  title_en: string;
  order: number;
}

export default function LessonPlayerPage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string; lessonId: string }>;
}) {
  const { locale, courseId, lessonId } = use(params);
  const isAr = locale === 'ar';
  const { user, session } = useAuth();

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [courseName, setCourseName] = useState('');
  const [allLessons, setAllLessons] = useState<NavLesson[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Save progress periodically
  const saveProgress = useCallback(async (playbackPos?: number, markComplete?: boolean) => {
    if (!session?.access_token) return;
    const body: Record<string, unknown> = { lessonId, courseId };
    if (typeof playbackPos === 'number') body.playbackPosition = playbackPos;
    if (markComplete) body.completed = true;

    await fetch('/api/lms/progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
  }, [session, lessonId, courseId]);

  useEffect(() => {
    if (!user || !session) return;
    const supabase = createBrowserClient();

    async function load() {
      // Fetch lesson
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

      if (lessonData) setLesson(lessonData as unknown as LessonData);

      // Fetch course name
      const { data: courseData } = await supabase
        .from('courses')
        .select('title_ar, title_en')
        .eq('id', courseId)
        .single();

      if (courseData) {
        setCourseName(isAr ? (courseData as any).title_ar : (courseData as any).title_en);
      }

      // Fetch all lessons for navigation
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, title_ar, title_en, order')
        .eq('course_id', courseId)
        .order('order');

      if (lessonsData) setAllLessons(lessonsData as NavLesson[]);

      // Fetch progress
      const res = await fetch(`/api/lms/progress?courseId=${courseId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const lessonProgress = (data.progress ?? []).find(
          (p: { lesson_id: string }) => p.lesson_id === lessonId
        );
        if (lessonProgress) {
          setProgress({
            playback_position_seconds: lessonProgress.playback_position_seconds ?? 0,
            completed: lessonProgress.completed ?? false,
          });
        }
      }

      setLoading(false);
    }

    load();

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [user, session, lessonId, courseId, isAr]);

  // Set up periodic progress saving when video plays
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !lesson?.video_url) return;

    // Restore playback position
    if (progress && progress.playback_position_seconds > 0 && !progress.completed) {
      video.currentTime = progress.playback_position_seconds;
    }

    const handlePlay = () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      progressTimer.current = setInterval(() => {
        if (video && !video.paused) {
          saveProgress(video.currentTime);
        }
      }, 15000); // save every 15 seconds
    };

    const handlePause = () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      saveProgress(video.currentTime);
    };

    const handleEnded = () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      saveProgress(video.duration, true);
      setProgress((prev) => prev ? { ...prev, completed: true } : { playback_position_seconds: 0, completed: true });
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [lesson, progress, saveProgress]);

  const handleMarkComplete = async () => {
    setCompleting(true);
    await saveProgress(undefined, true);
    setProgress((prev) => prev ? { ...prev, completed: true } : { playback_position_seconds: 0, completed: true });
    setCompleting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--text-muted)]">{isAr ? 'الدرس غير موجود' : 'Lesson not found'}</p>
      </div>
    );
  }

  const currentIdx = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;
  const title = isAr ? lesson.title_ar : lesson.title_en;
  const content = isAr ? lesson.content_ar : lesson.content_en;

  return (
    <div className="relative">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed bottom-4 ltr:right-4 rtl:left-4 z-50 h-12 w-12 rounded-full bg-[var(--color-primary)] text-white shadow-lg flex items-center justify-center"
        aria-label={isAr ? 'قائمة الدروس' : 'Lesson list'}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Main content area */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-[var(--color-neutral-500)]">
            <a href={`/${locale}/dashboard/courses/${courseId}`} className="hover:text-[var(--color-primary)] transition-colors truncate">
              {courseName}
            </a>
            <span>/</span>
            <span className="text-[var(--text-primary)] font-medium truncate">{title}</span>
          </div>

          {/* Video player */}
          {lesson.video_url && (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
              {lesson.video_provider === 'youtube' && lesson.video_id ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${lesson.video_id}?rel=0`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : lesson.video_provider === 'bunny' && lesson.video_id ? (
                <iframe
                  src={`https://iframe.mediadelivery.net/embed/${lesson.video_id}?autoplay=false&preload=true`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              ) : (
                <video
                  ref={videoRef}
                  src={lesson.video_url}
                  controls
                  className="absolute inset-0 w-full h-full"
                  playsInline
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                />
              )}
            </div>
          )}

          {/* Lesson title + mark complete */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{title}</h1>
              {lesson.duration_minutes && (
                <p className="text-sm text-[var(--color-neutral-500)] mt-1">
                  {lesson.duration_minutes} {isAr ? 'دقيقة' : 'min'}
                </p>
              )}
            </div>
            {progress?.completed ? (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 shrink-0">
                <svg className="w-3.5 h-3.5 ltr:mr-1 rtl:ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {isAr ? 'مكتمل' : 'Completed'}
              </span>
            ) : (
              <button
                onClick={handleMarkComplete}
                disabled={completing}
                className="shrink-0 inline-flex items-center px-4 py-2 rounded-lg border-2 border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-semibold hover:bg-[var(--color-primary)] hover:text-white transition-colors min-h-[44px] disabled:opacity-50"
              >
                {completing
                  ? (isAr ? 'جارٍ...' : 'Saving...')
                  : (isAr ? 'إكمال الدرس' : 'Mark Complete')}
              </button>
            )}
          </div>

          {/* Lesson content */}
          {content && (
            <div
              className="prose prose-neutral max-w-none text-[var(--text-primary)] [&_a]:text-[var(--color-primary)]"
              style={{ direction: isAr ? 'rtl' : 'ltr' }}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-[var(--color-neutral-100)]">
            {prevLesson ? (
              <a
                href={`/${locale}/dashboard/courses/${courseId}/lessons/${prevLesson.id}`}
                className="flex items-center gap-2 text-sm text-[var(--color-neutral-600)] hover:text-[var(--color-primary)] transition-colors min-h-[44px]"
              >
                <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="truncate max-w-[140px]">{isAr ? prevLesson.title_ar : prevLesson.title_en}</span>
              </a>
            ) : <div />}

            {nextLesson ? (
              <a
                href={`/${locale}/dashboard/courses/${courseId}/lessons/${nextLesson.id}`}
                className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:opacity-80 transition-opacity min-h-[44px]"
              >
                <span className="truncate max-w-[140px]">{isAr ? nextLesson.title_ar : nextLesson.title_en}</span>
                <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            ) : (
              <a
                href={`/${locale}/dashboard/courses/${courseId}`}
                className="flex items-center gap-2 text-sm font-semibold text-green-600 hover:opacity-80 transition-opacity min-h-[44px]"
              >
                {isAr ? 'العودة للدورة' : 'Back to Course'}
              </a>
            )}
          </div>
        </div>

        {/* Sidebar — lesson list */}
        <div className={`
          fixed md:relative inset-y-0 ltr:right-0 rtl:left-0 z-40
          w-72 md:w-64 shrink-0
          bg-white md:bg-transparent
          shadow-xl md:shadow-none
          transform transition-transform duration-300 md:transform-none
          ${sidebarOpen ? 'translate-x-0' : 'ltr:translate-x-full rtl:-translate-x-full md:translate-x-0'}
          overflow-y-auto
        `}>
          {/* Mobile close */}
          <div className="md:hidden flex items-center justify-between p-4 border-b border-[var(--color-neutral-100)]">
            <h3 className="font-semibold text-sm">{isAr ? 'الدروس' : 'Lessons'}</h3>
            <button onClick={() => setSidebarOpen(false)} className="p-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-3 md:p-0 space-y-1">
            {allLessons.map((l, idx) => {
              const isCurrent = l.id === lessonId;
              return (
                <a
                  key={l.id}
                  href={`/${locale}/dashboard/courses/${courseId}/lessons/${l.id}`}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] ${
                    isCurrent
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-neutral-600)] hover:bg-[var(--color-surface-dim)]'
                  }`}
                >
                  <span className={`text-xs font-mono ${isCurrent ? 'text-white/70' : 'text-[var(--color-neutral-400)]'}`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate">{isAr ? l.title_ar : l.title_en}</span>
                </a>
              );
            })}
          </div>
        </div>

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
