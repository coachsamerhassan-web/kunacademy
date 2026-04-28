'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, useCallback } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { EnrollmentManager } from './enrollment-manager';

interface Student {
  id: string;
  full_name_en: string | null;
  full_name_ar: string | null;
  email: string;
  enrollment_count: number;
  created_at: string;
}

export default function AdminStudentsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAr = locale === 'ar';

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const res = await fetch(`/api/admin/students-list?${params}`);
    const data = await res.json();
    setStudents(data.students ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) { router.push('/' + locale + '/auth/login?redirect=' + encodeURIComponent(pathname)); return; }
    load();
  }, [user, profile, authLoading, load]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [search]);

  if (authLoading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between">
          <Heading level={1}>{isAr ? 'إدارة الطلاب والتسجيلات' : 'Students & Enrollments'}</Heading>
          <a href={'/' + locale + '/admin'} className="text-[var(--color-primary)] text-sm hover:underline">
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" /> {isAr ? 'لوحة الإدارة' : 'Dashboard'}
          </a>
        </div>

        {/* Search */}
        <div className="mt-4 relative max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-neutral-400)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
            className="w-full ps-10 pe-3 py-2.5 rounded-xl border border-[var(--color-neutral-200)] text-sm min-h-[44px]"
          />
        </div>

        <p className="mt-3 text-sm text-[var(--color-neutral-400)]">{students.length} {isAr ? 'طالب' : 'students'}</p>

        {/* Student list */}
        <div className="mt-4 space-y-2">
          {loading ? (
            <p className="text-center py-8 text-[var(--color-neutral-400)]">Loading...</p>
          ) : students.length === 0 ? (
            <p className="text-center py-8 text-[var(--color-neutral-400)]">{isAr ? 'لا توجد نتائج' : 'No results'}</p>
          ) : students.map(s => (
            <div key={s.id} className="rounded-xl border border-[var(--color-neutral-200)] overflow-hidden">
              {/* Student row */}
              <button
                onClick={() => setExpandedId(prev => prev === s.id ? null : s.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-neutral-50)] transition-colors text-start"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text-primary)] truncate">
                    {isAr ? (s.full_name_ar || s.full_name_en || s.email) : (s.full_name_en || s.full_name_ar || s.email)}
                  </p>
                  <p className="text-xs text-[var(--color-neutral-400)] mt-0.5">{s.email}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] px-2 py-0.5 rounded-full">
                    {s.enrollment_count} {isAr ? 'تسجيل' : 'enrollments'}
                  </span>
                  <span className="text-xs text-[var(--color-neutral-400)]">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                  {expandedId === s.id ? <ChevronUp className="w-4 h-4 text-[var(--color-neutral-400)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-neutral-400)]" />}
                </div>
              </button>

              {/* Expanded: enrollment manager */}
              {expandedId === s.id && (
                <div className="border-t border-[var(--color-neutral-100)] p-4 bg-[var(--color-neutral-50)]">
                  <EnrollmentManager locale={locale} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
