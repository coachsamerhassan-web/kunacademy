'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

interface Stats {
  students: number;
  coaches: number;
  enrollments: number;
  bookings: number;
  payments: number;
}

export default function AdminDashboard() {
  const { locale } = useParams<{ locale: string }>();
  const isAr = locale === 'ar';
  const [stats, setStats] = useState<Stats>({ students: 0, coaches: 0, enrollments: 0, bookings: 0, payments: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setStats({
            students: data.students ?? 0,
            coaches: data.coaches ?? 0,
            enrollments: data.enrollments ?? 0,
            bookings: data.bookings ?? 0,
            payments: data.payments ?? 0,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sections = [
    { href: `/${locale}/admin/students`, labelAr: 'التسجيلات', labelEn: 'Enrollments', count: stats.enrollments, icon: '📋' },
    { href: `/${locale}/admin/instructors`, labelAr: 'الكوتشز', labelEn: 'Coaches', count: stats.coaches, icon: '👤' },
    { href: `/${locale}/admin/bookings`, labelAr: 'الحجوزات', labelEn: 'Bookings', count: stats.bookings, icon: '📅' },
    { href: `/${locale}/admin/orders`, labelAr: 'الطلبات', labelEn: 'Orders', count: stats.payments, icon: '💳' },
    { href: `/${locale}/admin/courses`, labelAr: 'الدورات', labelEn: 'Courses', count: '-', icon: '🎓' },
    { href: `/${locale}/admin/products`, labelAr: 'المنتجات', labelEn: 'Products', count: '-', icon: '📦' },
    { href: `/${locale}/admin/testimonials`, labelAr: 'التوصيات', labelEn: 'Testimonials', count: '-', icon: '⭐' },
    { href: `/${locale}/admin/coach-ratings`, labelAr: 'تقييمات المدربين', labelEn: 'Coach Ratings', count: '-', icon: '🌟' },
    { href: `/${locale}/admin/referrals`, labelAr: 'الإحالات', labelEn: 'Referrals', count: '-', icon: '🔗' },
    { href: `/${locale}/admin/payouts`, labelAr: 'المستحقات', labelEn: 'Payouts', count: '-', icon: '💰' },
    { href: `/${locale}/admin/content`, labelAr: 'المحتوى', labelEn: 'Content CMS', count: '-', icon: '📄' },
    { href: `/${locale}/admin/community`, labelAr: 'المجتمع', labelEn: 'Community', count: '-', icon: '👥' },
    { href: `/${locale}/admin/pathfinder`, labelAr: 'تقييمات المُرشد', labelEn: 'Pathfinder Leads', count: '-', icon: '🧭' },
    { href: `/${locale}/admin/email-outbox`, labelAr: 'رسائل فاشلة', labelEn: 'Failed Emails', count: '-', icon: '⚠️' },
  ];

  const statCards = [
    { labelAr: 'طلاب', labelEn: 'Students', value: stats.students },
    { labelAr: 'كوتشز', labelEn: 'Coaches', value: stats.coaches },
    { labelAr: 'تسجيلات', labelEn: 'Enrollments', value: stats.enrollments },
    { labelAr: 'حجوزات', labelEn: 'Bookings', value: stats.bookings },
    { labelAr: 'مدفوعات', labelEn: 'Payments', value: stats.payments },
  ];

  return (
    <main>
      <Section variant="white">
        <Heading level={1}>{isAr ? 'لوحة الإدارة' : 'Admin Dashboard'}</Heading>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 mb-8">
          {statCards.map(s => (
            <div key={s.labelEn} className="rounded-lg border border-[var(--color-neutral-200)] p-4 text-center">
              <div className="text-2xl font-bold text-[var(--color-primary)]">{loading ? '...' : s.value}</div>
              <div className="text-xs text-[var(--color-neutral-500)] mt-1">{isAr ? s.labelAr : s.labelEn}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {sections.map(s => (
            <a
              key={s.href}
              href={s.href}
              className="rounded-lg border border-[var(--color-neutral-200)] p-6 hover:border-[var(--color-primary)] hover:shadow-sm transition text-center"
            >
              <div className="font-medium text-lg">{isAr ? s.labelAr : s.labelEn}</div>
              {s.count !== '-' && <div className="text-sm text-[var(--color-neutral-500)] mt-1">{s.count} {isAr ? 'سجل' : 'records'}</div>}
            </a>
          ))}
        </div>
      </Section>
    </main>
  );
}
