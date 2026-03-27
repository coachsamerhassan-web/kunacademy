// @ts-nocheck — TODO: fix Supabase client types (types regenerated, needs 'as any' removal)
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { createBrowserClient } from '@kunacademy/db';

interface Lesson {
  id: string;
  title_ar: string;
  title_en: string;
  video_url: string | null;
  order: number;
  duration_minutes: number | null;
  content_ar: string | null;
  content_en: string | null;
}

interface LessonProgress {
  lesson_id: string;
  playback_position_seconds: number;
  completed: boolean;
}

interface Material {
  id: string;
  title_ar: string;
  title_en: string;
  type: string;
  url: string;
}

interface Course {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
}

export function CoursePlayer({ locale, courseSlug }: { locale: string; courseSlug: string }) {
  const { user, loading: authLoading } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({});
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    if (!supabase) return;

    supabase.from('courses').select('id, title_ar, title_en, description_ar, description_en').eq('slug', courseSlug).single()
      .then(({ data: courseData }) => {
        if (!courseData) { setLoading(false); return; }
        setCourse(courseData);

        Promise.all([
          supabase.from('lessons').select('*').eq('course_id', courseData.id).order('order'),
          supabase.from('materials').select('*').eq('course_id', courseData.id).eq('is_published', true).order('display_order'),
          supabase.from('lesson_progress').select('lesson_id, playback_position_seconds, completed').eq('user_id', user.id),
        ]).then(([lessonsRes, matsRes, progRes]) => {
          const ls = lessonsRes.data || [];
          setLessons(ls);
          setMaterials(matsRes.data || []);

          const progMap: Record<string, LessonProgress> = {};
          (progRes.data || []).forEach((p: any) => { progMap[p.lesson_id] = p; });
          setProgress(progMap);

          // Find first incomplete lesson or first lesson
          const firstIncomplete = ls.find(l => !progMap[l.id]?.completed);
          setActiveLesson(firstIncomplete || ls[0] || null);
          setLoading(false);
        });
      });
  }, [user, courseSlug]);

  const saveProgress = useCallback((lessonId: string, position: number, completed: boolean) => {
    if (!user) return;
    const supabase = createBrowserClient();
    if (!supabase) return;

    supabase.from('lesson_progress').upsert({
      user_id: user.id,
      lesson_id: lessonId,
      playback_position_seconds: Math.floor(position),
      completed,
      ...(completed ? { completed_at: new Date().toISOString() } : {}),
    }, { onConflict: 'user_id,lesson_id' });

    setProgress(prev => ({
      ...prev,
      [lessonId]: { lesson_id: lessonId, playback_position_seconds: Math.floor(position), completed },
    }));
  }, [user]);

  function handleTimeUpdate() {
    if (!videoRef.current || !activeLesson) return;
    const video = videoRef.current;
    const position = video.currentTime;
    const duration = video.duration;

    // Auto-complete at 90%
    const isComplete = duration > 0 && position / duration >= 0.9;

    // Throttle saves to every 10 seconds
    if (progressSaveTimeout.current) clearTimeout(progressSaveTimeout.current);
    progressSaveTimeout.current = setTimeout(() => {
      saveProgress(activeLesson.id, position, isComplete || progress[activeLesson.id]?.completed || false);
    }, 10000);
  }

  function handleLessonEnd() {
    if (!activeLesson) return;
    saveProgress(activeLesson.id, 0, true);

    // Auto-advance to next lesson
    const idx = lessons.findIndex(l => l.id === activeLesson.id);
    if (idx < lessons.length - 1) {
      setActiveLesson(lessons[idx + 1]);
    }
  }

  function selectLesson(lesson: Lesson) {
    // Save current progress before switching
    if (activeLesson && videoRef.current) {
      saveProgress(activeLesson.id, videoRef.current.currentTime, progress[activeLesson.id]?.completed || false);
    }
    setActiveLesson(lesson);
  }

  // Restore playback position when lesson changes
  useEffect(() => {
    if (!activeLesson || !videoRef.current) return;
    const saved = progress[activeLesson.id];
    if (saved && saved.playback_position_seconds > 0 && !saved.completed) {
      videoRef.current.currentTime = saved.playback_position_seconds;
    }
  }, [activeLesson]);

  if (authLoading || loading) {
    return <div className="py-12 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  if (!course) {
    return <div className="py-12 text-center text-[var(--color-neutral-500)]">{isAr ? 'لم يتم العثور على البرنامج' : 'Course not found'}</div>;
  }

  const completedCount = lessons.filter(l => progress[l.id]?.completed).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  return (
    <div className="flex flex-col lg:flex-row gap-6 py-4">
      {/* Video Player */}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold mb-2">{isAr ? course.title_ar : course.title_en}</h1>

        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-2 bg-[var(--color-neutral-200)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-primary)] rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm text-[var(--color-neutral-600)] whitespace-nowrap">
            {progressPercent}% ({completedCount}/{lessons.length})
          </span>
        </div>

        {/* Video */}
        {activeLesson?.video_url ? (
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              key={activeLesson.id}
              src={activeLesson.video_url}
              controls
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleLessonEnd}
              className="w-full h-full"
              preload="metadata"
            />
          </div>
        ) : (
          <div className="bg-[var(--color-neutral-100)] rounded-lg aspect-video flex items-center justify-center">
            <p className="text-[var(--color-neutral-500)]">{isAr ? 'لا يوجد فيديو لهذا الدرس' : 'No video for this lesson'}</p>
          </div>
        )}

        {/* Lesson title + content */}
        {activeLesson && (
          <div className="mt-4">
            <h2 className="text-lg font-medium">{isAr ? activeLesson.title_ar : activeLesson.title_en}</h2>
            {(isAr ? activeLesson.content_ar : activeLesson.content_en) && (
              <div className="mt-2 text-sm text-[var(--color-neutral-600)] prose prose-sm max-w-none">
                {isAr ? activeLesson.content_ar : activeLesson.content_en}
              </div>
            )}
          </div>
        )}

        {/* Materials */}
        {materials.length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium mb-2">{isAr ? 'المواد المرفقة' : 'Materials'}</h3>
            <div className="space-y-2">
              {materials.map(m => (
                <a
                  key={m.id}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-neutral-200)] p-3 hover:bg-[var(--color-neutral-50)] text-sm min-h-[44px]"
                >
                  <span className="text-[var(--color-neutral-400)] uppercase text-xs font-medium w-10">{m.type}</span>
                  <span className="flex-1">{isAr ? m.title_ar : m.title_en}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lesson sidebar */}
      <div className="lg:w-80 flex-shrink-0">
        <h3 className="font-medium mb-3">{isAr ? 'الدروس' : 'Lessons'}</h3>
        <div className="space-y-1">
          {lessons.map((lesson, i) => {
            const isActive = activeLesson?.id === lesson.id;
            const isCompleted = progress[lesson.id]?.completed;
            return (
              <button
                key={lesson.id}
                type="button"
                onClick={() => selectLesson(lesson)}
                className={`w-full text-start flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'hover:bg-[var(--color-neutral-50)]'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-500)]'
                }`}>
                  {isCompleted ? '\u2713' : i + 1}
                </span>
                <span className="flex-1 truncate">{isAr ? lesson.title_ar : lesson.title_en}</span>
                {lesson.duration_minutes && (
                  <span className={`text-xs ${isActive ? 'text-white/70' : 'text-[var(--color-neutral-400)]'}`}>
                    {lesson.duration_minutes}m
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
