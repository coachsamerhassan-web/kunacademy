// @ts-nocheck
'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams } from 'next/navigation';

interface Enrollment {
  id: string;
  enrolled_at: string;
  completed_at: string | null;
  progress_data: Record<string, unknown>;
  course: { id: string; title_ar: string; title_en: string; slug: string; thumbnail_url: string | null };
}

export default function MyCourses() {
  const { locale } = useParams<{ locale: string }>();
  const { user, loading: authLoading } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient() as any;
    supabase
      .from('enrollments')
      .select('id, enrolled_at, completed_at, progress_data, course:courses(id, title_ar, title_en, slug, thumbnail_url)')
      .eq('user_id', user.id)
      .order('enrolled_at', { ascending: false })
      .then(({ data }) => {
        setEnrollments((data as unknown as Enrollment[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  if (authLoading || loading) return <Section><p className="text-center py-12">{isAr ? 'جاري التحميل...' : 'Loading...'}</p></Section>;

  return (
    <main>
      <Section variant="white">
        <Heading level={1}>{isAr ? 'برامجي' : 'My Programs'}</Heading>
        {enrollments.length === 0 ? (
          <div className="mt-8 text-center py-12 rounded-lg border-2 border-dashed border-[var(--color-neutral-200)]">
            <p className="text-[var(--color-neutral-500)]">{isAr ? 'لم تسجّل في أي برنامج بعد' : 'You haven\'t enrolled in any programs yet'}</p>
            <a href={`/${locale}/programs`} className="mt-4 inline-block text-[var(--color-primary)] font-medium hover:underline">
              {isAr ? 'استكشف البرامج' : 'Explore Programs'}
            </a>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrollments.map((e) => {
              const title = isAr ? e.course.title_ar : e.course.title_en;
              const lessonsCompleted = Object.keys(e.progress_data).length;
              return (
                <a key={e.id} href={`/${locale}/portal/courses/${e.course.id}/lesson/1`} className="flex gap-4 rounded-lg border border-[var(--color-neutral-200)] p-4 hover:shadow-md transition-shadow">
                  <div className="h-20 w-20 shrink-0 rounded bg-[var(--color-primary-100)] flex items-center justify-center text-[var(--color-primary)] text-2xl">📖</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{title}</h3>
                    <p className="text-sm text-[var(--color-neutral-500)] mt-1">
                      {e.completed_at ? (isAr ? 'مكتمل ✓' : 'Completed ✓') : `${lessonsCompleted} ${isAr ? 'دروس مكتملة' : 'lessons completed'}`}
                    </p>
                    <div className="mt-2 h-1.5 rounded-full bg-[var(--color-neutral-100)] overflow-hidden">
                      <div className="h-full bg-[var(--color-primary)] rounded-full" style={{ width: e.completed_at ? '100%' : `${Math.min(lessonsCompleted * 10, 95)}%` }} />
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </Section>
    </main>
  );
}
