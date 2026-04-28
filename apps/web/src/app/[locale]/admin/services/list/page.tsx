'use client';

/**
 * /admin/services/list — admin services list + CRUD entry point.
 * Phase 2a (CMS→DB, 2026-04-21). The /admin/services root is the matrix;
 * this `list` sub-route is the CRUD list mirroring the Phase 1c testimonials UI.
 */

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, useCallback } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Plus, Pencil, Trash2, Check, X } from 'lucide-react';

interface ServiceRow {
  id: string;
  slug: string | null;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  duration_minutes: number;
  price_aed: number | null;
  price_egp: number | null;
  price_usd: number | null;
  price_eur: number | null;
  price_sar: number | null;
  is_active: boolean;
  category_id: string | null;
  category: { id: string; slug: string | null; name_ar: string; name_en: string } | null;
  bundle_id: string | null;
  discount_percentage: number | null;
  discount_valid_until: string | null;
  installment_enabled: boolean;
  coach_level_min: string | null;
  coach_level_exact: string | null;
  icf_credential_target: string | null;
  coach_slug: string | null;
  display_order: number;
  is_free: boolean;
  student_only: boolean;
  program_slug: string | null;
  published: boolean;
  last_edited_at: string | null;
}

interface Category {
  id: string;
  slug: string | null;
  name_ar: string;
  name_en: string;
}

export default function AdminServicesListPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAr = locale === 'ar';

  const [items, setItems] = useState<ServiceRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: '', published: '', program: '' });
  const [preview, setPreview] = useState<ServiceRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ServiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/services');
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setItems(data.services ?? []);
    setCategories(data.categories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const role = (profile as { role?: string } | null)?.role;
    if (!user || (role !== 'admin' && role !== 'super_admin')) {
      router.push(`/${locale}/auth/login?redirect=` + encodeURIComponent(pathname));
      return;
    }
    load();
  }, [user, profile, authLoading, load, locale, router]);

  async function togglePublished(s: ServiceRow) {
    await fetch(`/api/admin/services/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !s.published }),
    });
    await load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/services/${confirmDelete.id}`, { method: 'DELETE' });
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

  if (authLoading || loading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  const filtered = items.filter(s => {
    if (filter.category && s.category_id !== filter.category) return false;
    if (filter.published === 'true' && !s.published) return false;
    if (filter.published === 'false' && s.published) return false;
    if (filter.program && s.program_slug !== filter.program) return false;
    return true;
  });

  const programs = [...new Set(items.map(s => s.program_slug).filter(Boolean))] as string[];

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between">
          <Heading level={1}>{isAr ? 'إدارة الخدمات' : 'Services'}</Heading>
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/admin/services/new`} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] text-white px-3 py-1.5 text-sm hover:opacity-90">
              <Plus className="w-4 h-4" /> {isAr ? 'إضافة خدمة' : 'New Service'}
            </Link>
            <Link href={`/${locale}/admin/services`} className="text-[var(--color-primary)] text-sm hover:underline">
              {isAr ? 'مصفوفة الخدمات' : 'Matrix'}
            </Link>
            <Link href={`/${locale}/admin`} className="text-[var(--color-primary)] text-sm hover:underline">
              <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" /> {isAr ? 'لوحة الإدارة' : 'Dashboard'}
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]">
            <option value="">{isAr ? 'كل الفئات' : 'All Categories'}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{isAr ? c.name_ar : c.name_en}</option>)}
          </select>
          <select value={filter.published} onChange={e => setFilter(f => ({ ...f, published: e.target.value }))} className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]">
            <option value="">{isAr ? 'الكل' : 'All'}</option>
            <option value="true">{isAr ? 'منشور' : 'Published'}</option>
            <option value="false">{isAr ? 'مسوّدة' : 'Draft'}</option>
          </select>
          <select value={filter.program} onChange={e => setFilter(f => ({ ...f, program: e.target.value }))} className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]">
            <option value="">{isAr ? 'كل البرامج' : 'All Programs'}</option>
            {programs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="text-sm text-[var(--color-neutral-400)] ms-auto">{filtered.length} / {items.length} {isAr ? 'خدمة' : 'services'}</span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)] w-14">{isAr ? 'ترتيب' : 'Order'}</th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الاسم' : 'Name'}</th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'المعرّف' : 'Slug'}</th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الفئة' : 'Category'}</th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">{isAr ? 'المدة' : 'Duration'}</th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">AED</th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">ICF</th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">{isAr ? 'خصم' : 'Disc'}</th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">{isAr ? 'تقسيط' : 'Inst'}</th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">{isAr ? 'منشور' : 'Pub'}</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                  <td className="px-3 py-2.5 text-center text-[var(--color-neutral-500)] tabular-nums">{s.display_order}</td>
                  <td className="px-3 py-2.5 font-medium text-[var(--text-primary)]">
                    {isAr ? s.name_ar : s.name_en}
                    {s.bundle_id && <span className="ms-2 text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">bundle:{s.bundle_id}</span>}
                    {s.program_slug && <span className="ms-2 text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{s.program_slug}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-500)] text-xs font-mono">{s.slug || '—'}</td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-500)] text-xs">{s.category ? (isAr ? s.category.name_ar : s.category.name_en) : '—'}</td>
                  <td className="px-3 py-2.5 text-center text-[var(--color-neutral-500)] tabular-nums">{s.duration_minutes}m</td>
                  <td className="px-3 py-2.5 text-center text-[var(--color-neutral-500)] tabular-nums">{s.price_aed ?? 0}</td>
                  <td className="px-3 py-2.5 text-center text-xs">
                    {s.icf_credential_target
                      ? <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">{s.icf_credential_target}</span>
                      : <span className="text-[var(--color-neutral-300)]">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs tabular-nums">
                    {s.discount_percentage ? `${s.discount_percentage}%` : <span className="text-[var(--color-neutral-300)]">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {s.installment_enabled
                      ? <Check className="w-4 h-4 text-green-600 inline" aria-label="yes" />
                      : <X className="w-4 h-4 text-[var(--color-neutral-300)] inline" aria-label="no" />}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => togglePublished(s)} className="p-1" aria-label={isAr ? 'تبديل النشر' : 'Toggle publish'} title={s.published ? 'Published' : 'Draft'}>
                      {s.published
                        ? <Check className="w-4 h-4 text-green-600" />
                        : <X className="w-4 h-4 text-[var(--color-neutral-400)]" />}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPreview(s)} className="p-1.5 rounded-lg hover:bg-[var(--color-neutral-100)]" aria-label={isAr ? 'معاينة' : 'Preview'}>
                        <Eye className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" />
                      </button>
                      <Link href={`/${locale}/admin/services/${s.id}`} className="p-1.5 rounded-lg hover:bg-[var(--color-neutral-100)]" aria-label={isAr ? 'تعديل' : 'Edit'}>
                        <Pencil className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" />
                      </Link>
                      <button onClick={() => setConfirmDelete(s)} className="p-1.5 rounded-lg hover:bg-red-50" aria-label={isAr ? 'حذف' : 'Delete'}>
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

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-md max-h-[70vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">{isAr ? preview.name_ar : preview.name_en}</h3>
              <button onClick={() => setPreview(null)} className="p-1 rounded-lg hover:bg-[var(--color-neutral-100)]" aria-label={isAr ? 'إغلاق' : 'Close'}><X className="w-5 h-5" /></button>
            </div>
            <div className="text-xs text-[var(--color-neutral-400)] mb-3 flex flex-wrap gap-2">
              {preview.slug && <span>slug: {preview.slug}</span>}
              <span>· {preview.duration_minutes} min</span>
              {preview.category && <span>· {isAr ? preview.category.name_ar : preview.category.name_en}</span>}
              {preview.icf_credential_target && <span>· ICF {preview.icf_credential_target}</span>}
              {preview.coach_level_min && <span>· min {preview.coach_level_min}</span>}
              {preview.coach_level_exact && <span>· exact {preview.coach_level_exact}</span>}
            </div>
            {preview.description_ar && <div className="text-sm leading-relaxed mb-3 whitespace-pre-line" dir="rtl">{preview.description_ar}</div>}
            {preview.description_en && <div className="text-sm leading-relaxed whitespace-pre-line">{preview.description_en}</div>}
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-center">
              <span>AED {preview.price_aed ?? 0}</span>
              <span>EGP {preview.price_egp ?? 0}</span>
              <span>USD {preview.price_usd ?? 0}</span>
              <span>EUR {preview.price_eur ?? 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="font-bold mb-2">{isAr ? 'تأكيد الحذف' : 'Confirm delete'}</h3>
            <p className="text-sm text-[var(--color-neutral-500)] mb-4">
              {isAr
                ? 'إذا كانت هذه الخدمة مرتبطة بحجوزات، سيتم إلغاء تفعيلها بدلاً من حذفها.'
                : 'If this service is referenced by bookings, it will be deactivated instead of deleted.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 rounded-lg border border-[var(--color-neutral-200)] text-sm">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={doDelete} disabled={deleting} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600 disabled:opacity-60">
                {deleting ? '...' : (isAr ? 'حذف' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
