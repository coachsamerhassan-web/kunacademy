'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, useCallback } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Graduate {
  id: string;
  slug: string | null;
  name_ar: string | null;
  name_en: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  member_type: 'alumni' | 'coach' | 'both';
  coaching_status: string | null;
  is_visible: boolean;
  student_number: string | null;
  created_at: string;
  certificates_count: number;
  programs: string[];
  profile_id: string | null;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MEMBER_TYPE_BADGE: Record<string, string> = {
  alumni: 'bg-amber-100 text-amber-700',
  coach: 'bg-blue-100 text-blue-700',
  both: 'bg-purple-100 text-purple-700',
};

const MEMBER_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  alumni: { ar: 'خريج', en: 'Alumni' },
  coach: { ar: 'كوتش', en: 'Coach' },
  both: { ar: 'خريج وكوتش', en: 'Alumni & Coach' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminGraduatesPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAr = locale === 'ar';

  // Data state
  const [members, setMembers] = useState<Graduate[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: 25, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [memberTypeFilter, setMemberTypeFilter] = useState<'all' | 'alumni' | 'coach' | 'both'>('all');
  const [emailFilter, setEmailFilter] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);

  // Inline update state
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [memberTypeFilter, emailFilter]);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) {
      router.push('/' + locale + '/auth/login?redirect=' + encodeURIComponent(pathname));
    }
  }, [user, profile, authLoading]);

  // Fetch
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '25' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (memberTypeFilter !== 'all') params.set('member_type', memberTypeFilter);
      if (emailFilter !== 'all') params.set('has_email', emailFilter);

      const res = await fetch(`/api/admin/graduates?${params}`);
      if (res.status === 403) { router.push('/' + locale + '/auth/login?redirect=' + encodeURIComponent(pathname)); return; }
      const data = await res.json();
      setMembers(data.members ?? []);
      if (data.pagination) setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, memberTypeFilter, emailFilter]);

  useEffect(() => {
    if (!authLoading && user && profile?.role === 'admin') {
      fetchMembers();
    }
  }, [fetchMembers, authLoading, user, profile]);

  // Toggle visibility
  async function toggleVisibility(member: Graduate) {
    setUpdatingId(member.id);
    try {
      const res = await fetch(`/api/admin/graduates/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_visible: !member.is_visible }),
      });
      if (res.ok) {
        setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_visible: !m.is_visible } : m));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  // Delete member
  async function deleteMember(member: Graduate) {
    const confirmMsg = isAr
      ? `هل أنت متأكد من حذف "${member.name_ar || member.name_en}"؟`
      : `Delete "${member.name_en || member.name_ar}"? This cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    setDeletingId(member.id);
    try {
      const res = await fetch(`/api/admin/graduates/${member.id}`, { method: 'DELETE' });
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.id !== member.id));
        setPagination(prev => ({ ...prev, total: prev.total - 1 }));
      }
    } finally {
      setDeletingId(null);
    }
  }

  // Stats (from current page — real counts come from server via total)
  const totalMembers = pagination.total;
  const withEmail = members.filter(m => m.email).length;
  const coaches = members.filter(m => m.member_type === 'coach' || m.member_type === 'both').length;
  const alumni = members.filter(m => m.member_type === 'alumni' || m.member_type === 'both').length;

  if (authLoading) return <Section><p className="text-center py-12">{isAr ? 'جاري التحميل...' : 'Loading...'}</p></Section>;

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1}>{isAr ? 'الخريجون' : 'Graduates'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {totalMembers} {isAr ? 'عضو' : 'total members'}
            </p>
          </div>
          <a
            href={'/' + locale + '/admin'}
            className="text-[var(--color-primary)] text-sm hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {isAr ? 'لوحة الإدارة' : 'Dashboard'}
          </a>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: isAr ? 'إجمالي الأعضاء' : 'Total Members', value: totalMembers, color: 'bg-amber-50 text-amber-700 border-amber-200' },
            { label: isAr ? 'لديهم بريد' : 'With Email', value: withEmail, color: 'bg-green-50 text-green-700 border-green-200' },
            { label: isAr ? 'كوتشز' : 'Coaches', value: coaches, color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { label: isAr ? 'خريجون' : 'Alumni', value: alumni, color: 'bg-purple-50 text-purple-700 border-purple-200' },
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl border px-4 py-3 ${stat.color}`}>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs mt-0.5 font-medium opacity-80">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث بالاسم أو البريد الإلكتروني...' : 'Search by name or email...'}
            className="w-full sm:max-w-sm rounded-xl border border-[var(--color-neutral-200)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Member type */}
          <div className="flex gap-1">
            {(['all', 'alumni', 'coach', 'both'] as const).map(type => (
              <button
                key={type}
                onClick={() => setMemberTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  memberTypeFilter === type
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
                }`}
              >
                {type === 'all'
                  ? (isAr ? 'الكل' : 'All')
                  : (isAr ? MEMBER_TYPE_LABELS[type]?.ar : MEMBER_TYPE_LABELS[type]?.en)}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px bg-[var(--color-neutral-200)] mx-1" aria-hidden="true" />

          {/* Email filter */}
          <div className="flex gap-1">
            {(['all', 'true', 'false'] as const).map(val => (
              <button
                key={val}
                onClick={() => setEmailFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  emailFilter === val
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
                }`}
              >
                {val === 'all'
                  ? (isAr ? 'كل البريد' : 'All Email')
                  : val === 'true'
                    ? (isAr ? 'لديه بريد' : 'Has Email')
                    : (isAr ? 'بدون بريد' : 'No Email')}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-[var(--color-neutral-400)]">
            {isAr ? 'جاري التحميل...' : 'Loading...'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الاسم' : 'Name'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'البريد' : 'Email'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الدولة' : 'Country'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'النوع' : 'Type'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'البرامج' : 'Programs'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الشهادات' : 'Certs'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'مطالب' : 'Claimed'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'ظاهر' : 'Visible'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-[var(--color-neutral-400)]">
                      {isAr ? 'لا يوجد خريجون' : 'No graduates found'}
                    </td>
                  </tr>
                ) : members.map(member => {
                  const displayName = (isAr ? member.name_ar : member.name_en) || member.name_en || member.name_ar;
                  const altName = (isAr ? member.name_en : member.name_ar);
                  const typeColor = MEMBER_TYPE_BADGE[member.member_type] || 'bg-gray-100 text-gray-600';
                  const typeLabel = isAr ? MEMBER_TYPE_LABELS[member.member_type]?.ar : MEMBER_TYPE_LABELS[member.member_type]?.en;
                  const isBusy = updatingId === member.id || deletingId === member.id;

                  return (
                    <tr key={member.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--text-primary)]">{displayName || '—'}</div>
                        {altName && altName !== displayName && (
                          <div className="text-xs text-[var(--color-neutral-400)]">{altName}</div>
                        )}
                        {member.student_number && (
                          <div className="text-xs text-[var(--color-neutral-400)] font-mono">{member.student_number}</div>
                        )}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3">
                        {member.email
                          ? <span className="text-[var(--color-neutral-600)]">{member.email}</span>
                          : <span className="text-[var(--color-neutral-300)] text-xs">{isAr ? 'لا يوجد' : '—'}</span>
                        }
                      </td>

                      {/* Country */}
                      <td className="px-4 py-3 text-[var(--color-neutral-600)]">
                        {member.country || '—'}
                      </td>

                      {/* Type badge */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
                          {typeLabel || member.member_type}
                        </span>
                      </td>

                      {/* Programs count */}
                      <td className="px-4 py-3 text-center">
                        {member.programs?.length > 0 ? (
                          <span
                            title={member.programs.join(', ')}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] text-xs font-medium"
                          >
                            {member.programs.length}
                          </span>
                        ) : (
                          <span className="text-[var(--color-neutral-300)] text-xs">—</span>
                        )}
                      </td>

                      {/* Certificates count */}
                      <td className="px-4 py-3 text-center">
                        {member.certificates_count > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                            {member.certificates_count}
                          </span>
                        ) : (
                          <span className="text-[var(--color-neutral-300)] text-xs">0</span>
                        )}
                      </td>

                      {/* Claimed */}
                      <td className="px-4 py-3 text-center">
                        {member.profile_id ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            {isAr ? 'نعم' : 'Yes'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]">
                            {isAr ? 'لا' : 'No'}
                          </span>
                        )}
                      </td>

                      {/* Visibility toggle */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleVisibility(member)}
                          disabled={isBusy}
                          aria-label={member.is_visible ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                            member.is_visible ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-200)]'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              member.is_visible ? 'translate-x-4.5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {member.slug && (
                            <a
                              href={`/${locale}/graduates/${member.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)] min-h-[28px] inline-flex items-center"
                            >
                              {isAr ? 'عرض' : 'View'}
                            </a>
                          )}
                          <button
                            onClick={() => deleteMember(member)}
                            disabled={isBusy}
                            className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 min-h-[28px]"
                          >
                            {deletingId === member.id ? '...' : (isAr ? 'حذف' : 'Delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)] disabled:opacity-40 min-h-[44px]"
            >
              {isAr ? 'السابق' : 'Prev'}
            </button>

            {Array.from({ length: Math.min(pagination.total_pages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  disabled={loading}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    page === p
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            {pagination.total_pages > 7 && page < pagination.total_pages - 3 && (
              <span className="text-[var(--color-neutral-400)] text-sm">…{pagination.total_pages}</span>
            )}

            <button
              onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
              disabled={page === pagination.total_pages || loading}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)] disabled:opacity-40 min-h-[44px]"
            >
              {isAr ? 'التالي' : 'Next'}
            </button>
          </div>
        )}

        {/* Page info */}
        {pagination.total > 0 && (
          <p className="text-center text-xs text-[var(--color-neutral-400)] mt-3">
            {isAr
              ? `الصفحة ${pagination.page} من ${pagination.total_pages} — ${pagination.total} عضو`
              : `Page ${pagination.page} of ${pagination.total_pages} — ${pagination.total} members`}
          </p>
        )}
      </Section>
    </main>
  );
}
