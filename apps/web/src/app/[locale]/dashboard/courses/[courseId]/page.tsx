'use client';

import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface Section {
  id: string;
  title_ar: string;
  title_en: string;
  order: number;
}

interface LessonRow {
  id: string;
  course_id: string;
  section_id: string | null;
  title_ar: string;
  title_en: string;
  order: number;
  duration_minutes: number | null;
  is_preview: boolean;
  video_url: string | null;
}

interface ProgressRow {
  lesson_id: string;
  completed: boolean;
  playback_position_seconds: number;
}

interface CourseRow {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
  thumbnail_url: string | null;
  total_lessons: number;
  total_video_minutes: number;
  instructor_id: string | null;
}

interface EnrollmentRow {
  id: string;
  status: string;
  enrolled_at: string;
}

export default function CourseLearningPage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string }>;
}) {
  const { locale, courseId } = use(params);
  const isAr = locale === 'ar';
  const { user, session } = useAuth();

  const [course, setCourse] = useState<CourseRow | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollmentRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !session) return;
    const supabase = createBrowserClient();

    async function load() {
      // Fetch course details
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, title_ar, title_en, description_ar, description_en, thumbnail_url, total_lessons, total_video_minutes, instructor_id')
        .eq('id', courseId)
        .single();

      if (courseData) setCourse(courseData as CourseRow);

      // Fetch sections
      const { data: sectionData } = await supabase
        .from('course_sections')
        .select('*')
        .eq('course_id', courseId)
        .order('order');

      if (sectionData) setSections(sectionData as Section[]);

      // Fetch lessons (RLS will only return if enrolled or preview)
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('id, course_id, section_id, title_ar, title_en, order, duration_minutes, is_preview, video_url')
        .eq('course_id', courseId)
        .order('order');

      if (lessonData) setLessons(lessonData as LessonRow[]);

      // Fetch progress via API (bypasses RLS complexity)
      const res = await fetch(`/api/lms/progress?courseId=${courseId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProgress(data.progress ?? []);
        if (data.enrollment) setEnrollment(data.enrollment);
      }

      setLoading(false);
    }

    load();
  }, [user, session, courseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--text-muted)]">{isAr ? 'الدورة غير موجودة' : 'Course not found'}</p>
      </div>
    );
  }

  const completedCount = progress.filter((p) => p.completed).length;
  const totalLessons = lessons.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  // Find first incomplete lesson for "Continue" button
  const nextLesson = lessons.find((l) => {
    const p = progress.find((pr) => pr.lesson_id === l.id);
    return !p?.completed;
  }) ?? lessons[0];

  // Group lessons by section
  const unsectioned = lessons.filter((l) => !l.section_id);
  const sectionLessons = sections.map((s) => ({
    ...s,
    lessons: lessons.filter((l) => l.section_id === s.id),
  }));

  const title = isAr ? course.title_ar : course.title_en;

  return (
    <div className="space-y-6">
      {/* Course Header */}
      <div className="flex flex-col sm:flex-row gap-5">
        {course.thumbnail_url && (
          <div className="w-full sm:w-48 aspect-video rounded-xl overflow-hidden shrink-0">
            <img src={course.thumbnail_url} alt={title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1">
          <a href={`/${locale}/dashboard/courses`} className="text-sm text-[var(--color-primary)] hover:underline mb-2 inline-block">
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'دوراتي' : 'My Courses'}
          </a>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
          {enrollment && (
            <p className="text-sm text-[var(--color-neutral-500)] mt-1">
              {isAr ? 'تاريخ التسجيل:' : 'Enrolled:'} {new Date(enrollment.enrolled_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
            </p>
          )}

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[var(--color-neutral-600)]">
                {completedCount}/{totalLessons} {isAr ? 'درس مكتمل' : 'lessons completed'}
              </span>
              <span className="font-semibold text-[var(--color-primary)]">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[var(--color-neutral-100)] overflow-hidden">
              <div
                className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Continue button */}
          {nextLesson && (
            <a
              href={`/${locale}/dashboard/courses/${courseId}/lessons/${nextLesson.id}`}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white min-h-[44px] hover:opacity-90 transition-opacity"
            >
              <svg className="w-5 h-5 ltr:mr-2 rtl:ml-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              {completedCount > 0
                ? (isAr ? 'أكمل الدورة' : 'Continue Learning')
                : (isAr ? 'ابدأ التعلّم' : 'Start Learning')}
            </a>
          )}
        </div>
      </div>

      {/* Completion badge */}
      {progressPercent === 100 && (
        <Card accent className="p-5 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-green-800">{isAr ? 'أكملت الدورة!' : 'Course Completed!'}</p>
              <a href={`/${locale}/dashboard/certificates`} className="text-sm text-green-600 hover:underline">
                {isAr ? 'عرض الشهادة' : 'View Certificate'} <ArrowRight className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" />
              </a>
            </div>
          </div>
        </Card>
      )}

      {/* Curriculum */}
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">
          {isAr ? 'المنهج' : 'Curriculum'}
        </h2>

        {/* Unsectioned lessons (if any) */}
        {unsectioned.length > 0 && (
          <div className="mb-4">
            <LessonList lessons={unsectioned} progress={progress} locale={locale} courseId={courseId} isAr={isAr} />
          </div>
        )}

        {/* Sections with lessons */}
        {sectionLessons.map((section) => (
          <div key={section.id} className="mb-4">
            <Card className="overflow-hidden">
              <div className="px-5 py-3 bg-[var(--color-surface-dim)]">
                <h3 className="font-semibold text-[var(--text-primary)]">
                  {isAr ? section.title_ar : section.title_en}
                </h3>
                <p className="text-xs text-[var(--color-neutral-500)]">
                  {section.lessons.length} {isAr ? 'دروس' : 'lessons'}
                  {' · '}
                  {section.lessons.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0)} {isAr ? 'دقيقة' : 'min'}
                </p>
              </div>
              <LessonList lessons={section.lessons} progress={progress} locale={locale} courseId={courseId} isAr={isAr} />
            </Card>
          </div>
        ))}

        {lessons.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--color-neutral-500)]">
              {isAr ? 'محتوى الدورة قيد الإعداد' : 'Course content is being prepared'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LessonList({
  lessons,
  progress,
  locale,
  courseId,
  isAr,
}: {
  lessons: LessonRow[];
  progress: ProgressRow[];
  locale: string;
  courseId: string;
  isAr: boolean;
}) {
  return (
    <div className="divide-y divide-[var(--color-neutral-100)]">
      {lessons.map((lesson, idx) => {
        const p = progress.find((pr) => pr.lesson_id === lesson.id);
        const isCompleted = p?.completed ?? false;
        const title = isAr ? lesson.title_ar : lesson.title_en;

        return (
          <a
            key={lesson.id}
            href={`/${locale}/dashboard/courses/${courseId}/lessons/${lesson.id}`}
            className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-surface-dim)] transition-colors min-h-[52px]"
          >
            {/* Status indicator */}
            <div className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
              isCompleted
                ? 'bg-green-100 text-green-600'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]'
            }`}>
              {isCompleted ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                idx + 1
              )}
            </div>

            {/* Lesson info */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isCompleted ? 'text-[var(--color-neutral-500)]' : 'text-[var(--text-primary)]'}`}>
                {title}
              </p>
              {lesson.duration_minutes && (
                <p className="text-xs text-[var(--color-neutral-400)]">
                  {lesson.duration_minutes} {isAr ? 'دقيقة' : 'min'}
                </p>
              )}
            </div>

            {/* Video icon */}
            {lesson.video_url && (
              <svg className="w-4 h-4 text-[var(--color-neutral-400)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </a>
        );
      })}
    </div>
  );
}
