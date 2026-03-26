'use client';

import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use } from 'react';

interface EnrollmentWithCourse {
  id: string;
  course_id: string;
  enrolled_at: string;
  completed_at: string | null;
  status: string;
  course: {
    title_ar: string;
    title_en: string;
    thumbnail_url: string | null;
    total_lessons: number;
    total_video_minutes: number;
    slug: string;
  } | null;
}

interface LessonProgressCount {
  course_id: string;
  completed_count: number;
  total_count: number;
}

export default function MyCoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgressCount>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();

    async function load() {
      // Fetch enrollments with course data
      const { data } = await supabase
        .from('enrollments')
        .select('id, course_id, enrolled_at, completed_at, status, courses(title_ar, title_en, thumbnail_url, total_lessons, total_video_minutes, slug)')
        .eq('user_id', user!.id)
        .in('status', ['enrolled', 'in_progress', 'completed'])
        .order('enrolled_at', { ascending: false });

      const enrollmentData = (data ?? []).map((e: any) => ({
        ...e,
        course: e.courses ?? null,
      }));

      setEnrollments(enrollmentData);

      // Fetch lesson progress counts per course
      if (enrollmentData.length > 0) {
        const courseIds = enrollmentData.map((e: EnrollmentWithCourse) => e.course_id);
        const { data: progressData } = await supabase
          .from('lesson_progress')
          .select('lesson_id, completed, lessons!inner(course_id)')
          .eq('user_id', user!.id)
          .eq('completed', true);

        // Count completed lessons per course
        const counts: Record<string, number> = {};
        (progressData ?? []).forEach((p: any) => {
          const cid = p.lessons?.course_id;
          if (cid) counts[cid] = (counts[cid] ?? 0) + 1;
        });

        // Get total lessons per course
        const { data: lessonCounts } = await supabase
          .from('lessons')
          .select('course_id')
          .in('course_id', courseIds);

        const totals: Record<string, number> = {};
        (lessonCounts ?? []).forEach((l: any) => {
          totals[l.course_id] = (totals[l.course_id] ?? 0) + 1;
        });

        const map: Record<string, LessonProgressCount> = {};
        courseIds.forEach((cid: string) => {
          map[cid] = {
            course_id: cid,
            completed_count: counts[cid] ?? 0,
            total_count: totals[cid] ?? 0,
          };
        });
        setProgressMap(map);
      }

      setLoading(false);
    }

    load();
  }, [user]);

  return (
    <Section variant="white">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        {isAr ? 'دوراتي' : 'My Courses'}
      </h1>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : enrollments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {enrollments.map((e) => {
            const course = e.course;
            if (!course) return null;

            const title = isAr ? course.title_ar : course.title_en;
            const prog = progressMap[e.course_id];
            const percent = prog && prog.total_count > 0
              ? Math.round((prog.completed_count / prog.total_count) * 100)
              : 0;

            return (
              <a key={e.id} href={`/${locale}/dashboard/courses/${e.course_id}`} className="group">
                <Card accent className="p-0 overflow-hidden h-full">
                  {/* Thumbnail */}
                  {course.thumbnail_url && (
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <img
                        src={course.thumbnail_url}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      {/* Progress overlay */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                        <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="p-4">
                    <h3 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-2 line-clamp-2">
                      {title}
                    </h3>

                    <div className="flex items-center justify-between text-xs text-[var(--color-neutral-500)]">
                      <span>
                        {prog ? `${prog.completed_count}/${prog.total_count}` : '0'} {isAr ? 'درس' : 'lessons'}
                      </span>
                      {e.status === 'completed' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          {isAr ? 'مكتمل' : 'Completed'}
                        </span>
                      ) : (
                        <span className="font-semibold text-[var(--color-primary)]">{percent}%</span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {e.status !== 'completed' && (
                      <div className="mt-2 w-full h-1.5 rounded-full bg-[var(--color-neutral-100)] overflow-hidden">
                        <div className="h-full bg-[var(--color-primary)] rounded-full transition-all" style={{ width: `${percent}%` }} />
                      </div>
                    )}
                  </div>
                </Card>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{isAr ? 'لم تسجّل في أي دورة بعد' : 'No courses yet'}</h2>
          <p className="text-sm text-[var(--color-neutral-500)] mt-2 mb-6">{isAr ? 'استكشف البرامج المتاحة وابدأ رحلة التعلّم' : 'Explore available programs and start your learning journey'}</p>
          <a href={`/${locale}/academy`} className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white min-h-[44px]">
            {isAr ? 'تصفّح البرامج' : 'Browse Programs'}
          </a>
        </div>
      )}
    </Section>
  );
}
