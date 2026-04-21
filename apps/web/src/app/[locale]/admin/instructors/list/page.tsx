'use client';

/**
 * /admin/instructors/list — admin instructors list + CRUD entry point.
 * Phase 2b (CMS→DB, 2026-04-21). The /admin/instructors root remains the
 * legacy visibility-toggle view; this `list` sub-route is the CRUD list
 * mirroring the Phase 2a services + Phase 1c testimonials UI.
 */

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, useCallback } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Plus, Pencil, Trash2, Check, X, Link as LinkIcon } from 'lucide-react';

interface InstructorRow {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  name_ar: string | null;
  name_en: string | null;
  photo_url: string | null;
  icf_credential: string | null;
  kun_level: string | null;
  is_visible: boolean;
  is_bookable: boolean;
  is_platform_coach: boolean;
  published: boolean;
  display_order: number;
  profile_id: string | null;
  last_edited_at: string | null;
  languages: string[] | null;
  specialties: string[] | null;
}

export default function AdminInstructorsListPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [items, setItems] = useState<InstructorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ published: '', bookable: '', linked: '' });
  const [preview, setPreview] = useState<InstructorRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InstructorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/instructors');
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.instructors ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const role = (profile as { role?: string } | null)?.role;
    if (!user || (role !== 'admin' && role !== 'super_admin')) {
      router.push(`/${locale}/auth/login`);
      return;
    }
    load();
  }, [user, profile, authLoading, load, locale, router]);

  async function togglePublished(r: InstructorRow) {
    await fetch(`/api/admin/instructors/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !r.published }),
    });
    await load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/instructors/${confirmDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `HTTP ${res.status}`);
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
      await load();
    }
  }

  if (authLoading || loading) {
    return (
      <Section>
        <p className="text-center py-12">Loading...</p>
      </Section>
    );
  }

  const filtered = items.filter((r) => {
    if (filter.published === 'true' && !r.published) return false;
    if (filter.published === 'false' && r.published) return false;
    if (filter.bookable === 'true' && !r.is_bookable) return false;
    if (filter.bookable === 'false' && r.is_bookable) return false;
    if (filter.linked === 'true' && !r.profile_id) return false;
    if (filter.linked === 'false' && r.profile_id) return false;
    return true;
  });

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between">
          <Heading level={1}>{isAr ? 'إدارة الكوتشز' : 'Coaches'}</Heading>
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/admin/instructors/new`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] text-white px-3 py-1.5 text-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> {isAr ? 'إضافة كوتش' : 'New Coach'}
            </Link>
            <Link href={`/${locale}/admin/instructors`} className="text-[var(--color-primary)] text-sm hover:underline">
              {isAr ? 'العرض المختصر' : 'Compact view'}
            </Link>
            <Link href={`/${locale}/admin`} className="text-[var(--color-primary)] text-sm hover:underline">
              <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" /> {isAr ? 'لوحة الإدارة' : 'Dashboard'}
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <select
            value={filter.published}
            onChange={(e) => setFilter((f) => ({ ...f, published: e.target.value }))}
            className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]"
          >
            <option value="">{isAr ? 'كل حالات النشر' : 'All publish'}</option>
            <option value="true">{isAr ? 'منشور' : 'Published'}</option>
            <option value="false">{isAr ? 'مسوّدة' : 'Draft'}</option>
          </select>
          <select
            value={filter.bookable}
            onChange={(e) => setFilter((f) => ({ ...f, bookable: e.target.value }))}
            className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]"
          >
            <option value="">{isAr ? 'كل حالات الحجز' : 'All booking'}</option>
            <option value="true">{isAr ? 'قابل للحجز' : 'Bookable'}</option>
            <option value="false">{isAr ? 'غير قابل للحجز' : 'Not bookable'}</option>
          </select>
          <select
            value={filter.linked}
            onChange={(e) => setFilter((f) => ({ ...f, linked: e.target.value }))}
            className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]"
          >
            <option value="">{isAr ? 'كل الحسابات' : 'All accounts'}</option>
            <option value="true">{isAr ? 'مربوط' : 'Linked'}</option>
            <option value="false">{isAr ? 'غير مربوط' : 'Unlinked'}</option>
          </select>
          <span className="text-sm text-[var(--color-neutral-400)] ms-auto">
            {filtered.length} / {items.length} {isAr ? 'كوتش' : 'coaches'}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)] w-14">
                  {isAr ? 'ترتيب' : 'Order'}
                </th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'الكوتش' : 'Coach'}
                </th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">Slug</th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">ICF</th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'مستوى كُن' : 'Kun'}
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'حجز' : 'Book'}
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'مرئي' : 'Vis'}
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'ربط' : 'Link'}
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'منشور' : 'Pub'}
                </th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]"
                >
                  <td className="px-3 py-2.5 text-center text-[var(--color-neutral-500)] tabular-nums">
                    {r.display_order}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-neutral-200)] flex items-center justify-center text-xs font-medium text-[var(--color-neutral-600)] overflow-hidden">
                        {r.photo_url ? (
                          <img src={r.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (r.name_en || r.title_en || '?')[0]
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">
                          {isAr ? r.name_ar || r.title_ar : r.name_en || r.title_en}
                        </div>
                        <div className="text-xs text-[var(--color-neutral-500)]">
                          {isAr ? r.title_ar : r.title_en}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-500)] text-xs font-mono">
                    {r.slug || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs">
                    {r.icf_credential ? (
                      <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">
                        {r.icf_credential}
                      </span>
                    ) : (
                      <span className="text-[var(--color-neutral-300)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs">
                    {r.kun_level ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{r.kun_level}</span>
                    ) : (
                      <span className="text-[var(--color-neutral-300)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.is_bookable ? (
                      <Check className="w-4 h-4 text-green-600 inline" aria-label="yes" />
                    ) : (
                      <X className="w-4 h-4 text-[var(--color-neutral-300)] inline" aria-label="no" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.is_visible ? (
                      <Check className="w-4 h-4 text-green-600 inline" aria-label="yes" />
                    ) : (
                      <X className="w-4 h-4 text-[var(--color-neutral-300)] inline" aria-label="no" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.profile_id ? (
                      <LinkIcon className="w-4 h-4 text-emerald-600 inline" aria-label="linked" />
                    ) : (
                      <span className="text-[var(--color-neutral-300)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => togglePublished(r)}
                      className="p-1"
                      aria-label={isAr ? 'تبديل النشر' : 'Toggle publish'}
                      title={r.published ? 'Published' : 'Draft'}
                    >
                      {r.published ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <X className="w-4 h-4 text-[var(--color-neutral-400)]" />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreview(r)}
                        className="p-1.5 rounded-lg hover:bg-[var(--color-neutral-100)]"
                        aria-label={isAr ? 'معاينة' : 'Preview'}
                      >
                        <Eye className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" />
                      </button>
                      <Link
                        href={`/${locale}/admin/instructors/${r.id}`}
                        className="p-1.5 rounded-lg hover:bg-[var(--color-neutral-100)]"
                        aria-label={isAr ? 'تعديل' : 'Edit'}
                      >
                        <Pencil className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" />
                      </Link>
                      <button
                        onClick={() => setConfirmDelete(r)}
                        className="p-1.5 rounded-lg hover:bg-red-50"
                        aria-label={isAr ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-md max-h-[70vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">
                {isAr ? preview.name_ar || preview.title_ar : preview.name_en || preview.title_en}
              </h3>
              <button
                onClick={() => setPreview(null)}
                className="p-1 rounded-lg hover:bg-[var(--color-neutral-100)]"
                aria-label={isAr ? 'إغلاق' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-[var(--color-neutral-400)] mb-3 flex flex-wrap gap-2">
              {preview.slug && <span>slug: {preview.slug}</span>}
              {preview.icf_credential && <span>· ICF {preview.icf_credential}</span>}
              {preview.kun_level && <span>· kun {preview.kun_level}</span>}
              {preview.profile_id && <span>· linked</span>}
            </div>
            {preview.languages && preview.languages.length > 0 && (
              <div className="mb-2 text-xs">
                <span className="text-[var(--color-neutral-500)]">
                  {isAr ? 'اللغات:' : 'Languages:'}
                </span>{' '}
                {preview.languages.join(', ')}
              </div>
            )}
            {preview.specialties && preview.specialties.length > 0 && (
              <div className="mb-2 text-xs">
                <span className="text-[var(--color-neutral-500)]">
                  {isAr ? 'التخصصات:' : 'Specialties:'}
                </span>{' '}
                {preview.specialties.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="font-bold mb-2">{isAr ? 'تأكيد الحذف' : 'Confirm delete'}</h3>
            <p className="text-sm text-[var(--color-neutral-500)] mb-4">
              {isAr
                ? 'إذا كان هذا الكوتش مرتبطاً بحجوزات أو دورات، سيتم إلغاء تفعيله بدلاً من حذفه.'
                : 'If this coach is referenced by bookings or courses, they will be deactivated instead of deleted.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 rounded-lg border border-[var(--color-neutral-200)] text-sm"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={doDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600 disabled:opacity-60"
              >
                {deleting ? '...' : isAr ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
