'use client';

import { useAuth } from '@kunacademy/auth';
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
  section_id: string | null;
  title_ar: string;
  title_en: string;
  order: number;
  duration_minutes: number | null;
}

interface SectionData {
  id: string;
  title_ar: string;
  title_en: string;
  order: number;
}

interface AllProgress {
  lesson_id: string;
  completed: boolean;
  playback_position_seconds: number;
}

interface LessonQuiz {
  id: string;
  title_ar: string;
  title_en: string;
  is_published: boolean;
}

export default function LessonPlayerPage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string; lessonId: string }>;
}) {
  const { locale, courseId, lessonId } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [courseName, setCourseName] = useState('');
  const [allLessons, setAllLessons] = useState<NavLesson[]>([]);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [allProgress, setAllProgress] = useState<AllProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [lessonQuiz, setLessonQuiz] = useState<LessonQuiz | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Save progress periodically
  const saveProgress = useCallback(async (playbackPos?: number, markComplete?: boolean) => {
    if (!user) return;
    const body: Record<string, unknown> = { lessonId, courseId };
    if (typeof playbackPos === 'number') body.playbackPosition = playbackPos;
    if (markComplete) body.completed = true;

    await fetch('/api/lms/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }, [user, lessonId, courseId]);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const [lessonDataRes, progressRes] = await Promise.all([
        fetch(`/api/lms/lesson/${lessonId}?courseId=${courseId}`),
        fetch(`/api/lms/progress?courseId=${courseId}`),
      ]);

      if (lessonDataRes.ok) {
        const data = await lessonDataRes.json();
        if (data.lesson) setLesson(data.lesson as LessonData);
        if (data.courseName) setCourseName(isAr ? data.courseName.title_ar : data.courseName.title_en);
        if (data.allLessons) setAllLessons(data.allLessons as NavLesson[]);
        if (data.sections) setSections(data.sections as SectionData[]);
      }

      if (progressRes.ok) {
        const data = await progressRes.json();
        const progressList = data.progress ?? [];
        setAllProgress(progressList);
        const lessonProgress = progressList.find(
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
  }, [user, lessonId, courseId, isAr]);

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
      }, 15000);
    };

    const handlePause = () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      saveProgress(video.currentTime);
    };

    const handleEnded = () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      saveProgress(video.duration, true);
      setProgress((prev) => prev ? { ...prev, completed: true } : { playback_position_seconds: 0, completed: true });
      // Update allProgress too
      setAllProgress((prev) => {
        const existing = prev.findIndex((p) => p.lesson_id === lessonId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], completed: true };
          return updated;
        }
        return [...prev, { lesson_id: lessonId, completed: true, playback_position_seconds: 0 }];
      });
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
  }, [lesson, progress, saveProgress, lessonId]);

  // Fetch quiz for this lesson — only when lesson is completed
  useEffect(() => {
    const isCompleted = progress?.completed || allProgress.some((p) => p.lesson_id === lessonId && p.completed);
    if (!isCompleted || !lessonId) return;
    fetch(`/api/lms/lessons/${lessonId}/quiz`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.quiz) setLessonQuiz(data.quiz as LessonQuiz);
      })
      .catch(() => {/* non-critical — quiz CTA is optional */});
  }, [progress?.completed, allProgress, lessonId]);

  const handleMarkComplete = async () => {
    setCompleting(true);
    await saveProgress(undefined, true);
    setProgress((prev) => prev ? { ...prev, completed: true } : { playback_position_seconds: 0, completed: true });
    setAllProgress((prev) => {
      const existing = prev.findIndex((p) => p.lesson_id === lessonId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], completed: true };
        return updated;
      }
      return [...prev, { lesson_id: lessonId, completed: true, playback_position_seconds: 0 }];
    });
    setCompleting(false);
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const isLessonCompleted = (id: string) => allProgress.some((p) => p.lesson_id === id && p.completed);

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

  const completedCount = allProgress.filter((p) => p.completed).length;
  const totalLessons = allLessons.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  // Group lessons by section for sidebar
  const unsectioned = allLessons.filter((l) => !l.section_id);
  const sectionGroups = sections.map((s) => ({
    ...s,
    lessons: allLessons.filter((l) => l.section_id === s.id),
    completedCount: allLessons.filter((l) => l.section_id === s.id && isLessonCompleted(l.id)).length,
  }));

  function renderLessonItem(l: NavLesson, globalIdx: number) {
    const isCurrent = l.id === lessonId;
    const completed = isLessonCompleted(l.id);

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
        {/* Status circle */}
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
          completed
            ? isCurrent ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600'
            : isCurrent ? 'bg-white/20 text-white' : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]'
        }`}>
          {completed ? (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            String(globalIdx + 1).padStart(2, '0')
          )}
        </span>
        <span className="truncate flex-1">{isAr ? l.title_ar : l.title_en}</span>
        {l.duration_minutes && (
          <span className={`text-[10px] shrink-0 ${isCurrent ? 'text-white/60' : 'text-[var(--color-neutral-400)]'}`}>
            {l.duration_minutes}m
          </span>
        )}
      </a>
    );
  }

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
          {lesson.video_url ? (
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
                  src={`https://iframe.mediadelivery.net/embed/${process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID ?? ''}/${lesson.video_id}?autoplay=false&preload=true`}
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
          ) : (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-[var(--color-neutral-100)] flex items-center justify-center">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto text-[var(--color-neutral-300)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <p className="mt-2 text-sm text-[var(--color-neutral-400)]">
                  {isAr ? 'الفيديو قيد الإعداد' : 'Video coming soon'}
                </p>
              </div>
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

          {/* Quiz CTA — shown after lesson is completed and a quiz exists */}
          {lessonQuiz && (
            <div className="mt-6 rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-primary-50)] p-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wider">
                  {isAr ? 'اختبار هذا الدرس' : 'Lesson Quiz'}
                </p>
                <p className="font-bold text-[var(--text-primary)]">
                  {isAr ? lessonQuiz.title_ar : lessonQuiz.title_en}
                </p>
              </div>
              <a
                href={`/${locale}/portal/quiz/${lessonQuiz.id}`}
                className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:bg-[var(--color-accent-500)] hover:scale-[1.02] transition-all min-h-[44px]"
              >
                {isAr ? 'ابدأ الاختبار' : 'Take Quiz'}
                <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Sidebar — lesson list grouped by section */}
        <div className={`
          fixed md:relative inset-y-0 ltr:right-0 rtl:left-0 z-40
          w-80 md:w-72 shrink-0
          bg-white md:bg-transparent
          shadow-xl md:shadow-none
          transform transition-transform duration-300 md:transform-none
          ${sidebarOpen ? 'translate-x-0' : 'ltr:translate-x-full rtl:-translate-x-full md:translate-x-0'}
          overflow-y-auto
        `}>
          {/* Sidebar header */}
          <div className="p-4 border-b border-[var(--color-neutral-100)]">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">{isAr ? 'المنهج' : 'Curriculum'}</h3>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2" aria-label={isAr ? 'إغلاق' : 'Close'}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Overall progress */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-[var(--color-neutral-500)] mb-1">
                <span>{completedCount}/{totalLessons} {isAr ? 'مكتمل' : 'done'}</span>
                <span className="font-semibold text-[var(--color-primary)]">{progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--color-neutral-100)] overflow-hidden">
                <div className="h-full bg-[var(--color-primary)] rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="p-3 space-y-1">
            {/* Unsectioned lessons first */}
            {unsectioned.map((l) => {
              const globalIdx = allLessons.findIndex((al) => al.id === l.id);
              return renderLessonItem(l, globalIdx);
            })}

            {/* Sectioned lessons */}
            {sectionGroups.map((section) => {
              const isCollapsed = collapsedSections.has(section.id);
              const sectionTotal = section.lessons.length;
              const sectionDone = section.completedCount;

              return (
                <div key={section.id} className="mt-2">
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-[var(--color-neutral-500)] uppercase tracking-wider hover:text-[var(--text-primary)] transition-colors"
                  >
                    <svg
                      className={`w-3 h-3 shrink-0 transition-transform ${isCollapsed ? (isAr ? 'rotate-90' : '-rotate-90') : ''}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className="truncate flex-1 text-start">{isAr ? section.title_ar : section.title_en}</span>
                    <span className="text-[10px] font-normal text-[var(--color-neutral-400)]">
                      {sectionDone}/{sectionTotal}
                    </span>
                  </button>

                  {/* Section lessons */}
                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {section.lessons.map((l) => {
                        const globalIdx = allLessons.findIndex((al) => al.id === l.id);
                        return renderLessonItem(l, globalIdx);
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* No sections fallback */}
            {sections.length === 0 && unsectioned.length === 0 && (
              <p className="text-xs text-center text-[var(--color-neutral-400)] py-4">
                {isAr ? 'لا توجد دروس' : 'No lessons'}
              </p>
            )}
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
