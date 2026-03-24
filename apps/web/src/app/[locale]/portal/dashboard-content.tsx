// @ts-nocheck
'use client';

import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';

interface Stats {
  enrollments: number;
  bookings: number;
  certificates: number;
}

export function DashboardContent({ locale }: { locale: string }) {
  const { user, profile, loading, signOut } = useAuth();
  const [stats, setStats] = useState<Stats>({ enrollments: 0, bookings: 0, certificates: 0 });
  const isAr = locale === 'ar';

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient() as any;
    Promise.all([
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_id', user.id),
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('completed_at', 'is', null),
    ]).then(([e, b, c]) => {
      setStats({ enrollments: e.count ?? 0, bookings: b.count ?? 0, certificates: c.count ?? 0 });
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

  const cards = [
    { label: isAr ? 'البرامج المسجّلة' : 'Enrolled Programs', value: stats.enrollments, href: `/${locale}/portal/courses`, icon: '📚' },
    { label: isAr ? 'الحجوزات' : 'Bookings', value: stats.bookings, href: `/${locale}/portal/bookings`, icon: '📅' },
    { label: isAr ? 'الشهادات' : 'Certificates', value: stats.certificates, href: `/${locale}/portal/certificates`, icon: '🎓' },
  ];

  return (
    <div className="mt-8">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => (
          <a key={card.href} href={card.href} className="block rounded-lg border border-[var(--color-neutral-200)] p-6 hover:shadow-md transition-shadow">
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-3xl font-bold text-[var(--color-primary)]">{card.value}</div>
            <div className="text-sm text-[var(--color-neutral-600)] mt-1">{card.label}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
