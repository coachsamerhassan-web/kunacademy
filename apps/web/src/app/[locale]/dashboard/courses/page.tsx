'use client';

import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use } from 'react';

export default function MyCoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Array<{ id: string; course_id: string; enrolled_at: string; completed_at: string | null; progress_data: { percent?: number } }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    supabase
      .from('enrollments')
      .select('*')
      .eq('user_id', user.id)
      .order('enrolled_at', { ascending: false })
      .then(({ data }: { data: any }) => {
        setEnrollments((data ?? []) as typeof enrollments);
        setLoading(false);
      });
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
        <div className="space-y-4">
          {enrollments.map((e) => (
            <Card key={e.id} accent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--color-neutral-500)]">
                    {new Date(e.enrolled_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                  </p>
                </div>
                {e.completed_at ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                    {isAr ? 'مكتمل' : 'Completed'}
                  </span>
                ) : (
                  <div className="w-24 h-2 rounded-full bg-[var(--color-neutral-100)] overflow-hidden">
                    <div className="h-full bg-[var(--color-primary)] rounded-full" style={{ width: `${e.progress_data?.percent ?? 0}%` }} />
                  </div>
                )}
              </div>
            </Card>
          ))}
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
