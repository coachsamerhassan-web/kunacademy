'use client';

/**
 * /admin/landing-pages — list + CRUD entry point.
 * CMS→DB Phase 2c (2026-04-21).
 */

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, useCallback } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Plus, Pencil, Trash2, Check, X, ExternalLink } from 'lucide-react';

interface PageRow {
  id: string;
  slug: string;
  page_type: 'page' | 'landing' | 'legal';
  program_slug: string | null;
  sections_json: Record<string, Record<string, { ar: string; en: string }>>;
  hero_json: Record<string, unknown>;
  seo_meta_json: Record<string, string | undefined>;
  published: boolean;
  published_at: string | null;
  last_edited_at: string | null;
}

export default function AdminLandingPagesPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [items, setItems] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ page_type: '', published: '' });
  const [preview, setPreview] = useState<PageRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PageRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/landing-pages');
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.pages ?? []);
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

  async function togglePublished(p: PageRow) {
    await fetch(`/api/admin/landing-pages/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !p.published }),
    });
    await load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/landing-pages/${confirmDelete.id}`, {
        method: 'DELETE',
      });
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

  const filtered = items.filter((p) => {
    if (filter.page_type && p.page_type !== filter.page_type) return false;
    if (filter.published === 'true' && !p.published) return false;
    if (filter.published === 'false' && p.published) return false;
    return true;
  });

  function pageHref(p: PageRow): string {
    return p.page_type === 'landing' ? `/${locale}/landing/${p.slug}` : `/${locale}/${p.slug}`;
  }

  function sectionSummary(p: PageRow): { sections: number; keys: number } {
    const sections = Object.keys(p.sections_json ?? {}).length;
    const keys = Object.values(p.sections_json ?? {}).reduce(
      (n, s) => n + Object.keys(s ?? {}).length,
      0,
    );
    return { sections, keys };
  }

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between">
          <Heading level={1}>{isAr ? 'الصفحات المنشورة' : 'Landing Pages'}</Heading>
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/admin/landing-pages/new`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] text-white px-3 py-1.5 text-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> {isAr ? 'صفحة جديدة' : 'New Page'}
            </Link>
            <Link
              href={`/${locale}/admin`}
              className="text-[var(--color-primary)] text-sm hover:underline"
            >
              <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" />{' '}
              {isAr ? 'لوحة الإدارة' : 'Dashboard'}
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <select
            value={filter.page_type}
            onChange={(e) => setFilter((f) => ({ ...f, page_type: e.target.value }))}
            className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]"
          >
            <option value="">{isAr ? 'كل الأنواع' : 'All Types'}</option>
            <option value="page">page</option>
            <option value="landing">landing</option>
            <option value="legal">legal</option>
          </select>
          <select
            value={filter.published}
            onChange={(e) => setFilter((f) => ({ ...f, published: e.target.value }))}
            className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]"
          >
            <option value="">{isAr ? 'الكل' : 'All'}</option>
            <option value="true">{isAr ? 'منشور' : 'Published'}</option>
            <option value="false">{isAr ? 'مسوّدة' : 'Draft'}</option>
          </select>
          <span className="text-sm text-[var(--color-neutral-400)] ms-auto">
            {filtered.length} / {items.length} {isAr ? 'صفحة' : 'pages'}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'المعرّف' : 'Slug'}
                </th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'النوع' : 'Type'}
                </th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'البرنامج' : 'Program'}
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'أقسام/مفاتيح' : 'Sections/Keys'}
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'منشور' : 'Pub'}
                </th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const { sections, keys } = sectionSummary(p);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]"
                  >
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-primary)]">
                      {p.slug}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          p.page_type === 'landing'
                            ? 'bg-emerald-50 text-emerald-700'
                            : p.page_type === 'legal'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-sky-50 text-sky-700'
                        }`}
                      >
                        {p.page_type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--color-neutral-500)] font-mono">
                      {p.program_slug || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs tabular-nums text-[var(--color-neutral-500)]">
                      {sections} / {keys}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => togglePublished(p)}
                        className="p-1"
                        aria-label={isAr ? 'تبديل النشر' : 'Toggle publish'}
                        title={p.published ? 'Published' : 'Draft'}
                      >
                        {p.published ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <X className="w-4 h-4 text-[var(--color-neutral-400)]" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <a
                          href={pageHref(p)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-[var(--color-neutral-100)]"
                          aria-label={isAr ? 'فتح' : 'Open'}
                          title={pageHref(p)}
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" />
                        </a>
                        <button
                          onClick={() => setPreview(p)}
                          className="p-1.5 rounded-lg hover:bg-[var(--color-neutral-100)]"
                          aria-label={isAr ? 'معاينة JSON' : 'Preview JSON'}
                        >
                          <Eye className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" />
                        </button>
                        <Link
                          href={`/${locale}/admin/landing-pages/${p.id}`}
                          className="p-1.5 rounded-lg hover:bg-[var(--color-neutral-100)]"
                          aria-label={isAr ? 'تعديل' : 'Edit'}
                        >
                          <Pencil className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" />
                        </Link>
                        <button
                          onClick={() => setConfirmDelete(p)}
                          className="p-1.5 rounded-lg hover:bg-red-50"
                          aria-label={isAr ? 'حذف' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Preview Modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)] font-mono text-sm">
                {preview.slug}
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
              <span>type: {preview.page_type}</span>
              {preview.program_slug && <span>· program: {preview.program_slug}</span>}
              <span>· published: {String(preview.published)}</span>
            </div>
            <details open className="mb-3">
              <summary className="text-xs font-semibold cursor-pointer text-[var(--color-neutral-500)]">
                sections_json
              </summary>
              <pre className="mt-2 text-[11px] bg-[var(--color-neutral-50)] p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(preview.sections_json, null, 2)}
              </pre>
            </details>
            <details className="mb-3">
              <summary className="text-xs font-semibold cursor-pointer text-[var(--color-neutral-500)]">
                hero_json
              </summary>
              <pre className="mt-2 text-[11px] bg-[var(--color-neutral-50)] p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(preview.hero_json, null, 2)}
              </pre>
            </details>
            <details className="mb-3">
              <summary className="text-xs font-semibold cursor-pointer text-[var(--color-neutral-500)]">
                seo_meta_json
              </summary>
              <pre className="mt-2 text-[11px] bg-[var(--color-neutral-50)] p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(preview.seo_meta_json, null, 2)}
              </pre>
            </details>
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
                ? `حذف صفحة "${confirmDelete.slug}"؟ لا يمكن التراجع.`
                : `Delete page "${confirmDelete.slug}"? This cannot be undone.`}
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
