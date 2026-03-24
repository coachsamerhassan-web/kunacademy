// @ts-nocheck
'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';

interface AdminStats {
  students: number;
  courses: number;
  bookings: number;
  orders: number;
  testimonials: number;
  instructors: number;
  products: number;
  posts: number;
}

export default function AdminDashboard() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (loading) return;
    if (!user || profile?.role !== 'admin') {
      router.push(`/${locale}/auth/login`);
      return;
    }
    const s = createBrowserClient() as any;
    Promise.all([
      s.from('profiles').select('id', { count: 'exact', head: true }),
      s.from('courses').select('id', { count: 'exact', head: true }),
      s.from('bookings').select('id', { count: 'exact', head: true }),
      s.from('orders').select('id', { count: 'exact', head: true }),
      s.from('testimonials').select('id', { count: 'exact', head: true }),
      s.from('instructors').select('id', { count: 'exact', head: true }),
      s.from('products').select('id', { count: 'exact', head: true }),
      s.from('posts').select('id', { count: 'exact', head: true }),
    ]).then(([students, courses, bookings, orders, testimonials, instructors, products, posts]) => {
      setStats({
        students: students.count ?? 0, courses: courses.count ?? 0,
        bookings: bookings.count ?? 0, orders: orders.count ?? 0,
        testimonials: testimonials.count ?? 0, instructors: instructors.count ?? 0,
        products: products.count ?? 0, posts: posts.count ?? 0,
      });
    });
  }, [user, profile, loading]);

  if (loading || !stats) return <Section><p className="text-center py-12">Loading...</p></Section>;

  const sections = [
    { label: isAr ? 'الطلاب' : 'Students', count: stats.students, href: `/${locale}/admin/students`, icon: '👥' },
    { label: isAr ? 'البرامج' : 'Courses', count: stats.courses, href: `/${locale}/admin/courses`, icon: '📚' },
    { label: isAr ? 'الحجوزات' : 'Bookings', count: stats.bookings, href: `/${locale}/admin/bookings`, icon: '📅' },
    { label: isAr ? 'الطلبات' : 'Orders', count: stats.orders, href: `/${locale}/admin/orders`, icon: '🛒' },
    { label: isAr ? 'الشهادات' : 'Testimonials', count: stats.testimonials, href: `/${locale}/admin/testimonials`, icon: '⭐' },
    { label: isAr ? 'المدرّبون' : 'Instructors', count: stats.instructors, href: `/${locale}/admin/instructors`, icon: '🎓' },
    { label: isAr ? 'المنتجات' : 'Products', count: stats.products, href: `/${locale}/admin/products`, icon: '📦' },
    { label: isAr ? 'المقالات' : 'Posts', count: stats.posts, href: `/${locale}/admin/posts`, icon: '✏️' },
  ];

  return (
    <main>
      <Section variant="white">
        <Heading level={1}>{isAr ? 'لوحة الإدارة' : 'Admin Dashboard'}</Heading>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {sections.map((s) => (
            <a key={s.href} href={s.href} className="block rounded-lg border border-[var(--color-neutral-200)] p-6 hover:shadow-md transition-shadow text-center">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-3xl font-bold text-[var(--color-primary)]">{s.count}</div>
              <div className="text-sm text-[var(--color-neutral-600)] mt-1">{s.label}</div>
            </a>
          ))}
        </div>
      </Section>
    </main>
  );
}
