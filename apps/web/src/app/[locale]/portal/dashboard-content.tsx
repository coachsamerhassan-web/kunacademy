'use client';

import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@kunacademy/db';

interface Enrollment {
  id: string;
  status: string;
  enrollment_type: string;
  enrolled_at: string;
  completed_at: string | null;
  course: { title_ar: string; title_en: string; slug: string; thumbnail_url: string | null } | null;
}

interface Booking {
  id: string;
  status: string;
  booking_date: string;
  start_time: string;
  service: { name_ar: string; name_en: string } | null;
}

interface Stats {
  enrollments: number;
  completedCourses: number;
  upcomingBookings: number;
}

export function DashboardContent({ locale }: { locale: string }) {
  const { user, profile, loading, signOut } = useAuth();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<Stats>({ enrollments: 0, completedCourses: 0, upcomingBookings: 0 });
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const isAr = locale === 'ar';

  // Redirect to onboarding if new user
  useEffect(() => {
    if (searchParams.get('onboarding') === 'true' && user) {
      window.location.href = `/${locale}/portal/onboarding`;
    }
  }, [searchParams, user, locale]);

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    if (!supabase) return;

    Promise.all([
      supabase
        .from('enrollments')
        .select('id, status, enrollment_type, enrolled_at, completed_at, course:courses(title_ar, title_en, slug, thumbnail_url)')
        .eq('user_id', user.id)
        .order('enrolled_at', { ascending: false })
        .limit(10),
      supabase
        .from('bookings')
        .select('id, status, booking_date, start_time, service:services(name_ar, name_en)')
        .eq('customer_id', user.id)
        .order('booking_date', { ascending: false })
        .limit(5),
    ]).then(([enrollRes, bookingRes]) => {
      const enrs = enrollRes.data || [];
      setEnrollments(enrs as Enrollment[]);
      setBookings((bookingRes.data || []) as Booking[]);
      setStats({
        enrollments: enrs.length,
        completedCourses: enrs.filter((e: any) => e.completed_at).length,
        upcomingBookings: (bookingRes.data || []).filter((b: any) => b.status === 'confirmed').length,
      });
      setDataLoading(false);
    });
  }, [user]);

  if (loading) return <div className="py-12 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;

  if (!user) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-neutral-600)] mb-4">{isAr ? 'يرجى تسجيل الدخول للوصول إلى البوابة' : 'Please sign in to access the portal'}</p>
        <Button variant="primary" onClick={() => window.location.href = `/${locale}/auth/login`}>
          {isAr ? 'تسجيل الدخول' : 'Sign In'}
        </Button>
      </div>
    );
  }

  const statCards = [
    { label: isAr ? 'البرامج المسجّلة' : 'Enrolled Programs', value: stats.enrollments, href: `/${locale}/portal/courses` },
    { label: isAr ? 'برامج مكتملة' : 'Completed', value: stats.completedCourses, href: `/${locale}/portal/certificates` },
    { label: isAr ? 'جلسات قادمة' : 'Upcoming Sessions', value: stats.upcomingBookings, href: `/${locale}/portal/bookings` },
  ];

  function getStatusBadge(status: string) {
    const map: Record<string, { label: string; className: string }> = {
      enrolled: { label: isAr ? 'مسجّل' : 'Enrolled', className: 'bg-blue-100 text-blue-700' },
      in_progress: { label: isAr ? 'قيد التقدم' : 'In Progress', className: 'bg-amber-100 text-amber-700' },
      completed: { label: isAr ? 'مكتمل' : 'Completed', className: 'bg-green-100 text-green-700' },
      dropped: { label: isAr ? 'منسحب' : 'Dropped', className: 'bg-red-100 text-red-700' },
    };
    const badge = map[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
    return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>;
  }

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-lg font-medium">
            {isAr ? `مرحبًا، ${profile?.full_name_ar || profile?.full_name_en || user.email}` : `Welcome, ${profile?.full_name_en || profile?.full_name_ar || user.email}`}
          </p>
          <p className="text-sm text-[var(--color-neutral-500)]">{user.email}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={signOut}>
          {isAr ? 'تسجيل الخروج' : 'Sign Out'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => (
          <a key={card.href} href={card.href} className="block rounded-lg border border-[var(--color-neutral-200)] p-6 hover:shadow-md transition-shadow text-center">
            <div className="text-3xl font-bold text-[var(--color-primary)]">{card.value}</div>
            <div className="text-sm text-[var(--color-neutral-600)] mt-1">{card.label}</div>
          </a>
        ))}
      </div>

      {/* My Journey — Enrollments */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-4">{isAr ? 'رحلتي التعليمية' : 'My Learning Journey'}</h2>
        {dataLoading ? (
          <p className="text-[var(--color-neutral-500)] text-sm">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
        ) : enrollments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-neutral-300)] p-8 text-center">
            <p className="text-[var(--color-neutral-500)]">{isAr ? 'لم تسجّل في أي برنامج بعد' : 'You haven\'t enrolled in any programs yet'}</p>
            <a href={`/${locale}/academy`} className="inline-block mt-3 text-[var(--color-primary)] font-medium hover:underline">
              {isAr ? 'تصفّح البرامج' : 'Browse Programs'}
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {enrollments.map((e) => (
              <a
                key={e.id}
                href={`/${locale}/portal/courses/${e.course?.slug || e.id}`}
                className="flex items-center gap-4 rounded-lg border border-[var(--color-neutral-200)] p-4 hover:shadow-sm transition-shadow"
              >
                <div className="w-12 h-12 rounded-lg bg-[var(--color-neutral-100)] flex-shrink-0 overflow-hidden">
                  {e.course?.thumbnail_url ? (
                    <img src={e.course.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-neutral-400)] text-xs">
                      {e.enrollment_type === 'recorded' ? 'REC' : e.enrollment_type === 'live' ? 'LIVE' : 'PKG'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{isAr ? e.course?.title_ar : e.course?.title_en}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(e.status)}
                    <span className="text-xs text-[var(--color-neutral-500)]">
                      {new Date(e.enrolled_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                    </span>
                  </div>
                </div>
                {e.status === 'in_progress' && (
                  <span className="text-sm text-[var(--color-primary)] font-medium">
                    {isAr ? 'استمر' : 'Resume'}
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Bookings */}
      {bookings.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-4">{isAr ? 'الجلسات القادمة' : 'Upcoming Sessions'}</h2>
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center gap-4 rounded-lg border border-[var(--color-neutral-200)] p-4">
                <div className="flex-1">
                  <p className="font-medium">{isAr ? b.service?.name_ar : b.service?.name_en}</p>
                  <p className="text-sm text-[var(--color-neutral-500)]">
                    {new Date(b.booking_date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')} — {b.start_time}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {b.status === 'confirmed' ? (isAr ? 'مؤكد' : 'Confirmed') : (isAr ? 'معلّق' : 'Pending')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
