'use client';

/**
 * /[locale]/admin/quizzes
 *
 * Admin list of all quizzes. Bilingual, RTL-aware.
 * Auth: admin / super_admin only — redirects to dashboard otherwise.
 *
 * Wave S9 — 2026-04-20
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────────

interface QuizRow {
  id: string;
  lesson_id: string | null;
  title_ar: string;
  title_en: string;
  is_published: boolean;
  attempts_allowed: number | null;
  time_limit_seconds: number | null;
  pass_threshold: number;
  question_count: number;
  updated_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function PublishedPill({ published, isAr }: { published: boolean; isAr: boolean }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
        published
          ? 'bg-green-100 text-green-700'
          : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]'
      }`}
    >
      {published ? (isAr ? 'منشور' : 'Published') : (isAr ? 'مسودة' : 'Draft')}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function QuizzesAdminPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [rows, setRows] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; msg: string } | null>(null);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    const role = (profile as { role?: string } | null)?.role;
    if (!user || (role !== 'admin' && role !== 'super_admin')) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [user, profile, authLoading, locale, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/quizzes');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { quizzes: QuizRow[] };
      setRows(data.quizzes ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  async function handleDelete(quiz: QuizRow) {
    const confirmMsg = isAr
      ? `هل أنت متأكد من حذف "${quiz.title_ar}"؟`
      : `Delete quiz "${quiz.title_en}"? This cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    setDeletingId(quiz.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/quizzes/${quiz.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(
            isAr
              ? 'لا يمكن حذف الاختبار — توجد محاولات مُقدَّمة'
              : 'Cannot delete — quiz has submitted attempts'
          );
        }
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setRows((prev) => prev.filter((r) => r.id !== quiz.id));
    } catch (err: unknown) {
      setDeleteError({ id: quiz.id, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading) {
    return (
      <Section>
        <p className="text-center py-16 text-[var(--color-neutral-500)]">
          {isAr ? 'جارٍ التحميل...' : 'Loading...'}
        </p>
      </Section>
    );
  }

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <Heading level={1}>{isAr ? 'الاختبارات' : 'Quizzes'}</Heading>
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/admin/quizzes/new`}
              className="min-h-[44px] inline-flex items-center px-5 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition"
            >
              {isAr ? '+ اختبار جديد' : '+ New Quiz'}
            </Link>
            <Link
              href={`/${locale}/admin`}
              className="text-sm text-[var(--color-primary)] hover:underline min-h-[44px] inline-flex items-center"
            >
              {isAr ? '← لوحة الإدارة' : '← Admin Dashboard'}
            </Link>
          </div>
        </div>

        {/* Content */}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
            {isAr ? `خطأ: ${error}` : `Error: ${error}`}
          </div>
        ) : loading ? (
          <div className="rounded-lg border border-[var(--color-neutral-200)] px-4 py-16 text-center text-sm text-[var(--color-neutral-400)]">
            {isAr ? 'جارٍ التحميل...' : 'Loading...'}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-[var(--color-neutral-200)] px-4 py-16 text-center text-sm text-[var(--color-neutral-400)]">
            {isAr ? 'لا توجد اختبارات بعد' : 'No quizzes yet'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-neutral-200)]">
            <table className="w-full text-sm border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[var(--color-neutral-200)] bg-[var(--color-surface-dim)] text-[var(--color-neutral-500)] text-xs uppercase tracking-wide">
                  <th className="py-3 px-4 text-start font-medium">
                    {isAr ? 'العنوان' : 'Title'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium w-40">
                    {isAr ? 'الدرس' : 'Lesson ID'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium w-28">
                    {isAr ? 'الحالة' : 'Status'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium w-24">
                    {isAr ? 'المحاولات' : 'Attempts'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium w-24">
                    {isAr ? 'الوقت (ث)' : 'Time (s)'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium w-24">
                    {isAr ? 'الأسئلة' : 'Questions'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium w-32">
                    {isAr ? 'إجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-surface-low)] transition"
                  >
                    <td className="py-3 px-4 align-top">
                      <span className="block font-medium text-[var(--color-neutral-800)]">
                        {isAr ? row.title_ar : row.title_en}
                      </span>
                      <span className="block text-xs text-[var(--color-neutral-400)] mt-0.5">
                        {isAr ? row.title_en : row.title_ar}
                      </span>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <span className="font-mono text-[11px] text-[var(--color-neutral-500)]" title={row.lesson_id ?? ''}>
                        {row.lesson_id ? row.lesson_id.slice(0, 8) + '…' : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <PublishedPill published={row.is_published} isAr={isAr} />
                    </td>
                    <td className="py-3 px-4 align-top text-[var(--color-neutral-600)]">
                      {row.attempts_allowed ?? (isAr ? 'غير محدود' : '∞')}
                    </td>
                    <td className="py-3 px-4 align-top text-[var(--color-neutral-600)]">
                      {row.time_limit_seconds ?? '—'}
                    </td>
                    <td className="py-3 px-4 align-top text-center text-[var(--color-neutral-700)] font-medium">
                      {row.question_count}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/${locale}/admin/quizzes/${row.id}/edit`}
                          className="min-h-[36px] inline-flex items-center px-3 py-1 rounded-md border border-[var(--color-primary)] text-[var(--color-primary)] text-xs font-semibold hover:bg-[var(--color-primary)] hover:text-white transition"
                        >
                          {isAr ? 'تعديل' : 'Edit'}
                        </Link>
                        <button
                          type="button"
                          disabled={deletingId === row.id}
                          onClick={() => handleDelete(row)}
                          className="min-h-[36px] px-3 py-1 rounded-md border border-red-400 text-red-600 text-xs font-semibold hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === row.id ? '...' : (isAr ? 'حذف' : 'Delete')}
                        </button>
                      </div>
                      {deleteError?.id === row.id && (
                        <p className="mt-1 text-xs text-red-600 max-w-[180px] break-words">
                          {deleteError.msg}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </main>
  );
}
