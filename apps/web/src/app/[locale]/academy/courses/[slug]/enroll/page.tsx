'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /academy/courses/[slug]/enroll
 * Auto-enrolls the user in a free course and redirects to the dashboard.
 * If not logged in, redirects to login with return URL.
 */
export default function EnrollPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = use(params);
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (authLoading) return;

    // Not logged in → redirect to login with return URL
    if (!user || !session) {
      router.replace(
        `/${locale}/auth/login?redirect=/${locale}/academy/courses/${slug}/enroll`
      );
      return;
    }

    // Logged in → call enroll API
    async function enroll() {
      try {
        // First find the course ID from slug
        const res = await fetch(`/api/lms/enroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseSlug: slug }),
        });

        if (res.ok) {
          const data = await res.json();
          const courseId = data.enrollment?.course_id;
          router.replace(
            courseId
              ? `/${locale}/dashboard/courses/${courseId}`
              : `/${locale}/dashboard/courses`
          );
        } else {
          const data = await res.json();
          if (res.status === 402) {
            // Not free — redirect to checkout
            router.replace(`/${locale}/checkout?program=${slug}`);
          } else {
            setError(data.error || 'Enrollment failed');
          }
        }
      } catch {
        setError('Network error');
      }
    }

    enroll();
  }, [authLoading, user, session, locale, slug, router]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <a
            href={`/${locale}/academy/courses/${slug}`}
            className="mt-4 inline-block text-[var(--color-primary)] hover:underline text-sm"
          >
            {isAr ? 'العودة للدورة' : 'Back to Course'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        <p className="mt-4 text-sm text-[var(--color-neutral-500)]">
          {isAr ? 'جاري التسجيل...' : 'Enrolling...'}
        </p>
      </div>
    </div>
  );
}
