// @ts-nocheck — TODO: fix Supabase client types (types regenerated, needs 'as any' removal)
'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Button } from '@kunacademy/ui/button';
import { useParams, useRouter } from 'next/navigation';

interface Lesson {
  id: string;
  title_ar: string;
  title_en: string;
  content_ar: string | null;
  content_en: string | null;
  video_url: string | null;
  order: number;
  duration_minutes: number | null;
}

export default function LessonPlayer() {
  const { locale, slug: courseId, lessonId } = useParams<{ locale: string; slug: string; lessonId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [enrollment, setEnrollment] = useState<{ id: string; progress_data: Record<string, boolean> } | null>(null);
  const isAr = locale === 'ar';

  useEffect(() => {
    const supabase = createBrowserClient() as any;
    // Fetch all lessons for this course
    supabase.from('lessons').select('*').eq('course_id', courseId).order('order').then(({ data }) => {
      const allLessons = (data ?? []) as Lesson[];
      setLessons(allLessons);
      const idx = parseInt(lessonId, 10) - 1;
      setCurrentLesson(allLessons[idx] ?? allLessons[0] ?? null);
    });

    // Fetch enrollment for progress tracking
    if (user) {
      supabase.from('enrollments').select('id, progress_data').eq('user_id', user.id).eq('course_id', courseId).single().then(({ data }) => {
        setEnrollment(data as { id: string; progress_data: Record<string, boolean> } | null);
      });
    }
  }, [courseId, lessonId, user]);

  async function markComplete() {
    if (!enrollment || !currentLesson) return;
    const supabase = createBrowserClient() as any;
    const newProgress = { ...enrollment.progress_data, [currentLesson.id]: true };
    await supabase.from('enrollments').update({ progress_data: newProgress }).eq('id', enrollment.id);
    setEnrollment({ ...enrollment, progress_data: newProgress });

    // Go to next lesson
    const idx = lessons.findIndex((l) => l.id === currentLesson.id);
    if (idx < lessons.length - 1) {
      router.push(`/${locale}/portal/courses/${courseId}/lesson/${idx + 2}`);
    }
  }

  if (!currentLesson) return <Section><p className="text-center py-12">{isAr ? 'جاري التحميل...' : 'Loading...'}</p></Section>;

  const isComplete = enrollment?.progress_data[currentLesson.id];
  const currentIdx = lessons.findIndex((l) => l.id === currentLesson.id);

  return (
    <main>
      <Section variant="white">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar: lesson list */}
          <aside className="lg:w-64 shrink-0 order-2 lg:order-1">
            <h3 className="font-bold mb-3">{isAr ? 'الدروس' : 'Lessons'}</h3>
            <nav className="space-y-1">
              {lessons.map((l, i) => {
                const done = enrollment?.progress_data[l.id];
                const active = l.id === currentLesson.id;
                return (
                  <a
                    key={l.id}
                    href={`/${locale}/portal/courses/${courseId}/lesson/${i + 1}`}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${active ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-[var(--color-neutral-100)]'}`}
                  >
                    <span className="inline-block w-5">{done ? '✓' : `${i + 1}.`}</span>
                    {isAr ? l.title_ar : l.title_en}
                  </a>
                );
              })}
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex-1 order-1 lg:order-2">
            <h1 className="text-2xl font-bold">{isAr ? currentLesson.title_ar : currentLesson.title_en}</h1>
            {currentLesson.duration_minutes && (
              <p className="text-sm text-[var(--color-neutral-500)] mt-1">{currentLesson.duration_minutes} {isAr ? 'دقيقة' : 'min'}</p>
            )}

            {/* Video player */}
            {currentLesson.video_url && (
              <div className="mt-4 aspect-video rounded-lg overflow-hidden bg-black">
                <iframe
                  src={currentLesson.video_url}
                  className="w-full h-full"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </div>
            )}

            {/* Lesson content */}
            <div className="mt-6 prose prose-lg max-w-none" dir={isAr ? 'rtl' : 'ltr'}>
              {isAr ? currentLesson.content_ar : currentLesson.content_en}
            </div>

            {/* Actions */}
            <div className="mt-8 flex gap-3">
              {currentIdx > 0 && (
                <Button variant="secondary" onClick={() => router.push(`/${locale}/portal/courses/${courseId}/lesson/${currentIdx}`)}>
                  {isAr ? 'الدرس السابق' : 'Previous'}
                </Button>
              )}
              {!isComplete && (
                <Button variant="primary" onClick={markComplete}>
                  {isAr ? 'إتمام الدرس والمتابعة' : 'Complete & Continue'}
                </Button>
              )}
              {isComplete && currentIdx < lessons.length - 1 && (
                <Button variant="primary" onClick={() => router.push(`/${locale}/portal/courses/${courseId}/lesson/${currentIdx + 2}`)}>
                  {isAr ? 'الدرس التالي' : 'Next Lesson'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Section>
    </main>
  );
}
