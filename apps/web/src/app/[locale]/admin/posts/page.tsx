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
  title_en: string;
  slug: string;
  category: string | null;
  is_published: boolean;
  published_at: string | null;
  content_doc_id: string | null;
  meta_title_ar: string | null;
  meta_title_en: string | null;
  meta_description_ar: string | null;
  meta_description_en: string | null;
}

const EMPTY: Partial<Post> = {
  title_ar: '', title_en: '', slug: '', category: null,
  is_published: false, published_at: null, content_doc_id: null,
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
  const [filter, setFilter] = useState<{ status: string; category: string }>({ status: '', category: '' });
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
    const res = await fetch(`/api/admin/posts?${params}`);
    const data = await res.json();
    setItems(data.posts ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== 'admin') { router.push('/' + locale + '/auth/login'); return; }
    load();
  }, [user, profile, authLoading, load]);

  async function handleSave() {
    setSaving(true);
    try {
      const url = editId ? `/api/admin/posts/${editId}` : '/api/admin/posts';
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      setDialogOpen(false); setEditId(null); setForm(EMPTY);
      await load();
    } catch { /* ignore */ } finally { setSaving(false); }
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
                  <td className="px-3 py-2.5 font-medium text-[var(--text-primary)] max-w-[200px] truncate">
                    {isAr ? p.title_ar : p.title_en}
                    {p.content_doc_id && (
                      <a href={`https://docs.google.com/document/d/${p.content_doc_id}`} target="_blank" rel="noopener noreferrer" className="ms-1 inline-block text-[var(--color-neutral-400)] hover:text-[var(--color-primary)]">
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-500)] font-mono text-xs">{p.slug}</td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-500)]">{p.category || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${p.is_published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.is_published ? (isAr ? 'منشور' : 'Published') : (isAr ? 'مسودة' : 'Draft')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-500)] text-xs">
                    {p.published_at ? new Date(p.published_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-[var(--color-neutral-100)]"><Pencil className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" /></button>
                    <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDialogOpen(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editId ? (isAr ? 'تعديل المقال' : 'Edit Post') : (isAr ? 'مقال جديد' : 'New Post')}</h2>
              <button onClick={() => setDialogOpen(false)} className="p-1 rounded-lg hover:bg-[var(--color-neutral-100)]" aria-label={isAr ? 'إغلاق' : 'Close'}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'العنوان (عربي)' : 'Title (AR)'}</span>
                  <input value={form.title_ar ?? ''} onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" dir="rtl" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'العنوان (إنجليزي)' : 'Title (EN)'}</span>
                  <input value={form.title_en ?? ''} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, title_en: v, slug: editId ? f.slug : slugify(v) })); }} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-[var(--color-neutral-500)]">Slug</span>
                <input value={form.slug ?? ''} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm font-mono min-h-[44px]" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'الفئة' : 'Category'}</span>
                  <input value={form.category ?? ''} onChange={e => setForm(f => ({ ...f, category: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">Google Doc ID</span>
                  <input value={form.content_doc_id ?? ''} onChange={e => setForm(f => ({ ...f, content_doc_id: e.target.value || null }))} placeholder="1abc..." className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm font-mono min-h-[44px]" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-[var(--color-neutral-500)]">Meta Title (EN)</span>
                <input value={form.meta_title_en ?? ''} onChange={e => setForm(f => ({ ...f, meta_title_en: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--color-neutral-500)]">Meta Description (EN)</span>
                <textarea value={form.meta_description_en ?? ''} onChange={e => setForm(f => ({ ...f, meta_description_en: e.target.value || null }))} rows={2} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
              </label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))} className={`relative w-10 h-5 rounded-full transition-colors ${form.is_published ? 'bg-green-500' : 'bg-[var(--color-neutral-300)]'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_published ? 'start-5' : 'start-0.5'}`} />
                </button>
                <span className="text-sm">{form.is_published ? (isAr ? 'منشور' : 'Published') : (isAr ? 'مسودة' : 'Draft')}</span>
              </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !form.title_ar || !form.title_en}>
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
