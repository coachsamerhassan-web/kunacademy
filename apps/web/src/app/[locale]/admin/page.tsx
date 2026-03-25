// @ts-nocheck
import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { createClient } from '@supabase/supabase-js';

async function getAdminStats() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const [students, coaches, enrollments, bookings, payments] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('instructors').select('id', { count: 'exact', head: true }),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }),
    supabase.from('bookings').select('id', { count: 'exact', head: true }),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
  ]);
  return {
    students: students.count ?? 0,
    coaches: coaches.count ?? 0,
    enrollments: enrollments.count ?? 0,
    bookings: bookings.count ?? 0,
    payments: payments.count ?? 0,
  };
}

export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  let stats = { students: 0, coaches: 0, enrollments: 0, bookings: 0, payments: 0 };
  try { stats = await getAdminStats(); } catch {}

  const sections = [
    { href: `/${locale}/admin/students`, labelAr: 'التسجيلات', labelEn: 'Enrollments', count: stats.enrollments },
    { href: `/${locale}/admin/instructors`, labelAr: 'الكوتشز', labelEn: 'Coaches', count: stats.coaches },
    { href: `/${locale}/admin/bookings`, labelAr: 'الحجوزات', labelEn: 'Bookings', count: stats.bookings },
    { href: `/${locale}/admin/testimonials`, labelAr: 'الشهادات', labelEn: 'Testimonials', count: '-' },
    { href: `/${locale}/admin/community`, labelAr: 'المجتمع', labelEn: 'Community', count: '-' },
    { href: `/${locale}/admin/content`, labelAr: 'المحتوى', labelEn: 'Content', count: '-' },
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
              <div className="text-2xl font-bold text-[var(--color-primary)]">{s.value}</div>
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
