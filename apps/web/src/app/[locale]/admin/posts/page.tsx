'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, useCallback } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Pencil, Trash2, X, ExternalLink } from 'lucide-react';

interface Post {
  id: string;
  title_ar: string;
  title_en: string | null;
  slug: string;
  category: string | null;
  tags: string[] | null;
  published: boolean;
  published_at: string | null;
  content_ar: string | null;
  content_en: string | null;
  content_doc_id: string | null;
  featured_image_url: string | null;
  author_slug: string | null;
  excerpt_ar: string | null;
  excerpt_en: string | null;
  reading_time_minutes: number | null;
  is_featured: boolean;
  display_order: number;
  meta_title_ar: string | null;
  meta_title_en: string | null;
  meta_description_ar: string | null;
  meta_description_en: string | null;
}

const EMPTY: Partial<Post> = {
  title_ar: '', title_en: '', slug: '', category: null, tags: null,
  published: false, published_at: null,
  content_ar: null, content_en: null, content_doc_id: null,
  featured_image_url: null, author_slug: null,
  excerpt_ar: null, excerpt_en: null,
  reading_time_minutes: null, is_featured: false, display_order: 0,
  meta_title_ar: null, meta_title_en: null, meta_description_ar: null, meta_description_en: null,
};

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

export default function AdminPostsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ status: string; category: string; search: string }>({ status: '', category: '', search: '' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Post>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.category) params.set('category', filter.category);
    if (filter.search) params.set('search', filter.search);
    const res = await fetch(`/api/admin/posts?${params}`);
    const data = await res.json();
    setItems(data.posts ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) { router.push('/' + locale + '/auth/login'); return; }
    load();
  }, [user, profile, authLoading, load, locale, router]);

  async function handleSave() {
    setSaving(true);
    try {
      const url = editId ? `/api/admin/posts/${editId}` : '/api/admin/posts';
      const method = editId ? 'PATCH' : 'POST';
      // Convert tags CSV string → array if user edited as CSV
      const payload: any = { ...form };
      if (typeof payload.tags === 'string') {
        payload.tags = (payload.tags as string).split(',').map(s => s.trim()).filter(Boolean);
      }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      setDialogOpen(false); setEditId(null); setForm(EMPTY);
      await load();
    } catch (err) {
      console.error('Save failed', err);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/posts/${deleteId}`, { method: 'DELETE' });
      setDeleteId(null);
      await load();
    } catch { /* ignore */ } finally { setDeleting(false); }
  }

  function openEdit(p: Post) {
    setEditId(p.id);
    setForm({ ...p });
    setDialogOpen(true);
  }

  function openCreate() {
    setEditId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }

  if (authLoading || loading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  const categories = [...new Set(items.map(p => p.category).filter(Boolean))] as string[];
  const tagsAsString = (t: string[] | null | undefined | string) =>
    typeof t === 'string' ? t : Array.isArray(t) ? t.join(', ') : '';

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between">
          <Heading level={1}>{isAr ? 'إدارة المقالات' : 'Blog Posts'}</Heading>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 me-1" />{isAr ? 'مقال جديد' : 'New Post'}
            </Button>
            <a href={'/' + locale + '/admin'} className="text-[var(--color-primary)] text-sm hover:underline">
              <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" /> {isAr ? 'لوحة الإدارة' : 'Dashboard'}
            </a>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="search"
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
            placeholder={isAr ? 'بحث بالعنوان...' : 'Search by title...'}
            className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px] min-w-[220px]"
          />
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]">
            <option value="">{isAr ? 'كل الحالات' : 'All Status'}</option>
            <option value="published">{isAr ? 'منشور' : 'Published'}</option>
            <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
          </select>
          <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm min-h-[36px]">
            <option value="">{isAr ? 'كل الفئات' : 'All Categories'}</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-sm text-[var(--color-neutral-400)] self-center ms-auto">{items.length} {isAr ? 'مقال' : 'posts'}</span>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'العنوان' : 'Title'}</th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">Slug</th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الفئة' : 'Category'}</th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-3 py-2.5 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="px-3 py-2.5 text-end font-medium text-[var(--color-neutral-500)]"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                  <td className="px-3 py-2.5 font-medium text-[var(--text-primary)] max-w-[260px] truncate">
                    {(isAr ? p.title_ar : p.title_en) || p.title_ar}
                    {p.is_featured && <span className="ms-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">★</span>}
                    {p.content_doc_id && (
                      <a href={`https://docs.google.com/document/d/${p.content_doc_id}`} target="_blank" rel="noopener noreferrer" className="ms-1 inline-block text-[var(--color-neutral-400)] hover:text-[var(--color-primary)]">
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-500)] font-mono text-xs">{p.slug}</td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-500)]">{p.category || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${p.published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.published ? (isAr ? 'منشور' : 'Published') : (isAr ? 'مسودة' : 'Draft')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-500)] text-xs">
                    {p.published_at ? new Date(p.published_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-end whitespace-nowrap">
                    <a href={`/${locale}/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-[var(--color-neutral-100)] inline-block" title={isAr ? 'معاينة' : 'Preview'}><ExternalLink className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" /></a>
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-[var(--color-neutral-100)]"><Pencil className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" /></button>
                    <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--color-neutral-400)]">{isAr ? 'لا توجد مقالات' : 'No posts found'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDialogOpen(false)}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-3 border-b border-[var(--color-neutral-100)]">
              <h2 className="text-lg font-bold">{editId ? (isAr ? 'تعديل المقال' : 'Edit Post') : (isAr ? 'مقال جديد' : 'New Post')}</h2>
              <button onClick={() => setDialogOpen(false)} className="p-1 rounded-lg hover:bg-[var(--color-neutral-100)]" aria-label={isAr ? 'إغلاق' : 'Close'}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {/* Titles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'العنوان (عربي)' : 'Title (AR)'} *</span>
                  <input value={form.title_ar ?? ''} onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" dir="rtl" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'العنوان (إنجليزي)' : 'Title (EN)'}</span>
                  <input value={form.title_en ?? ''} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, title_en: v, slug: editId ? f.slug : slugify(v) })); }} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
                </label>
              </div>

              {/* Slug + category + author */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">Slug *</span>
                  <input value={form.slug ?? ''} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm font-mono min-h-[44px]" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'الفئة' : 'Category'}</span>
                  <input list="cat-list" value={form.category ?? ''} onChange={e => setForm(f => ({ ...f, category: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
                  <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'الكاتب (slug)' : 'Author slug'}</span>
                  <input value={form.author_slug ?? ''} onChange={e => setForm(f => ({ ...f, author_slug: e.target.value || null }))} placeholder="samer-hassan" className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm font-mono min-h-[44px]" />
                </label>
              </div>

              {/* Excerpts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'المقتطف (عربي)' : 'Excerpt (AR)'}</span>
                  <textarea value={form.excerpt_ar ?? ''} onChange={e => setForm(f => ({ ...f, excerpt_ar: e.target.value || null }))} rows={2} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm" dir="rtl" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'المقتطف (إنجليزي)' : 'Excerpt (EN)'}</span>
                  <textarea value={form.excerpt_en ?? ''} onChange={e => setForm(f => ({ ...f, excerpt_en: e.target.value || null }))} rows={2} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm" />
                </label>
              </div>

              {/* Content body (Markdown) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'المحتوى (عربي, Markdown)' : 'Content (AR, Markdown)'}</span>
                  <textarea value={form.content_ar ?? ''} onChange={e => setForm(f => ({ ...f, content_ar: e.target.value || null }))} rows={10} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm font-mono" dir="rtl" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'المحتوى (إنجليزي, Markdown)' : 'Content (EN, Markdown)'}</span>
                  <textarea value={form.content_en ?? ''} onChange={e => setForm(f => ({ ...f, content_en: e.target.value || null }))} rows={10} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm font-mono" />
                </label>
              </div>

              {/* Image + doc + tags + reading time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'رابط الصورة' : 'Featured Image URL'}</span>
                  <input value={form.featured_image_url ?? ''} onChange={e => setForm(f => ({ ...f, featured_image_url: e.target.value || null }))} placeholder="/images/blog/..." className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">Google Doc ID</span>
                  <input value={form.content_doc_id ?? ''} onChange={e => setForm(f => ({ ...f, content_doc_id: e.target.value || null }))} placeholder="1abc..." className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm font-mono min-h-[44px]" />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'الوسوم (مفصولة بفاصلة)' : 'Tags (comma-separated)'}</span>
                  <input value={tagsAsString(form.tags as any)} onChange={e => setForm(f => ({ ...f, tags: e.target.value as any }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'دقائق القراءة' : 'Reading Time (min)'}</span>
                  <input type="number" min={0} value={form.reading_time_minutes ?? ''} onChange={e => setForm(f => ({ ...f, reading_time_minutes: e.target.value ? Number(e.target.value) : null }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
                </label>
              </div>

              {/* SEO */}
              <div className="pt-3 border-t border-[var(--color-neutral-100)]">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-neutral-400)] mb-2">SEO</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-[var(--color-neutral-500)]">Meta Title (AR)</span>
                    <input value={form.meta_title_ar ?? ''} onChange={e => setForm(f => ({ ...f, meta_title_ar: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" dir="rtl" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[var(--color-neutral-500)]">Meta Title (EN)</span>
                    <input value={form.meta_title_en ?? ''} onChange={e => setForm(f => ({ ...f, meta_title_en: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[var(--color-neutral-500)]">Meta Description (AR)</span>
                    <textarea value={form.meta_description_ar ?? ''} onChange={e => setForm(f => ({ ...f, meta_description_ar: e.target.value || null }))} rows={2} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm" dir="rtl" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[var(--color-neutral-500)]">Meta Description (EN)</span>
                    <textarea value={form.meta_description_en ?? ''} onChange={e => setForm(f => ({ ...f, meta_description_en: e.target.value || null }))} rows={2} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm" />
                  </label>
                </div>
              </div>

              {/* Publish + featured + order */}
              <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-[var(--color-neutral-100)]">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setForm(f => ({ ...f, published: !f.published }))} className={`relative w-10 h-5 rounded-full transition-colors ${form.published ? 'bg-green-500' : 'bg-[var(--color-neutral-300)]'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.published ? 'start-5' : 'start-0.5'}`} />
                  </button>
                  <span className="text-sm">{form.published ? (isAr ? 'منشور' : 'Published') : (isAr ? 'مسودة' : 'Draft')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setForm(f => ({ ...f, is_featured: !f.is_featured }))} className={`relative w-10 h-5 rounded-full transition-colors ${form.is_featured ? 'bg-amber-500' : 'bg-[var(--color-neutral-300)]'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_featured ? 'start-5' : 'start-0.5'}`} />
                  </button>
                  <span className="text-sm">{isAr ? 'مميز' : 'Featured'}</span>
                </div>
                <label className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'ترتيب العرض' : 'Display order'}</span>
                  <input type="number" min={0} value={form.display_order ?? 0} onChange={e => setForm(f => ({ ...f, display_order: Number(e.target.value) || 0 }))} className="w-20 rounded-xl border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm" />
                </label>
              </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end sticky bottom-0 bg-white pt-3 border-t border-[var(--color-neutral-100)]">
              <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !form.title_ar || !form.slug}>
                {saving ? '...' : editId ? (isAr ? 'حفظ' : 'Save') : (isAr ? 'إنشاء' : 'Create')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteId(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center" onClick={e => e.stopPropagation()}>
            <Trash2 className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-2">{isAr ? 'حذف المقال؟' : 'Delete Post?'}</h3>
            <p className="text-sm text-[var(--color-neutral-500)] mb-6">{isAr ? 'لا يمكن التراجع.' : 'This cannot be undone.'}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button variant="primary" size="sm" className="!bg-red-500" onClick={handleDelete} disabled={deleting}>{deleting ? '...' : (isAr ? 'حذف' : 'Delete')}</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
