'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

/* ─── Types ───────────────────────────────────────────── */

interface Service {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  duration_minutes: number;
  price_aed: number;
  price_egp: number;
  price_usd: number;
  is_active: boolean;
  category_id: string | null;
  sessions_count: number | null;
  validity_days: number | null;
}

interface Category {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
}

type FormData = Omit<Service, 'id'>;

const EMPTY_FORM: FormData = {
  name_ar: '', name_en: '', description_ar: null, description_en: null,
  duration_minutes: 60, price_aed: 0, price_egp: 0, price_usd: 0,
  is_active: true, category_id: null, sessions_count: null, validity_days: null,
};

const DURATIONS = [30, 45, 60, 90, 120];

/* ─── Component ───────────────────────────────────────── */

export function ProductsManager({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const { user } = useAuth();

  const [items, setItems] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Fetch ───────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/coach/products');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(data.services ?? []);
      setCategories(data.categories ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  // ─── Save (create or update) ─────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const url = editId ? `/api/coach/products/${editId}` : '/api/coach/products';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      setDialogOpen(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      showToast(isAr ? 'تم الحفظ' : 'Saved', true);
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed', false);
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete ──────────────────────────────────────────
  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/coach/products/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setDeleteId(null);
      showToast(isAr ? 'تم الحذف' : 'Deleted', true);
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Delete failed', false);
    } finally {
      setDeleting(false);
    }
  }

  // ─── Toggle active ───────────────────────────────────
  async function toggleActive(s: Service) {
    try {
      await fetch(`/api/coach/products/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !s.is_active }),
      });
      await load();
    } catch { /* silent */ }
  }

  // ─── Open edit dialog ────────────────────────────────
  function openEdit(s: Service) {
    setEditId(s.id);
    setForm({
      name_ar: s.name_ar, name_en: s.name_en,
      description_ar: s.description_ar, description_en: s.description_en,
      duration_minutes: s.duration_minutes, price_aed: s.price_aed,
      price_egp: s.price_egp, price_usd: s.price_usd,
      is_active: s.is_active, category_id: s.category_id,
      sessions_count: s.sessions_count, validity_days: s.validity_days,
    });
    setDialogOpen(true);
  }

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  // ─── Render ──────────────────────────────────────────
  if (loading) return <div className="py-8 text-center text-[var(--color-neutral-400)]">Loading...</div>;
  if (error) return <div className="py-8 text-center text-red-500">{error}</div>;

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-[var(--color-neutral-500)]">
          {items.length} {isAr ? 'خدمة' : 'service(s)'}
        </span>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 me-1" />
          {isAr ? 'إضافة خدمة' : 'Add Service'}
        </Button>
      </div>

      {/* Card grid */}
      {items.length === 0 ? (
        <p className="text-center py-12 text-[var(--color-neutral-400)]">
          {isAr ? 'لا توجد خدمات بعد' : 'No services yet'}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((s) => {
            const catName = categories.find(c => c.id === s.category_id);
            return (
              <div
                key={s.id}
                className={`rounded-xl border p-4 transition-colors ${s.is_active ? 'border-[var(--color-neutral-200)] bg-white' : 'border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)] opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[var(--text-primary)] truncate">
                      {isAr ? s.name_ar : s.name_en}
                    </h3>
                    <p className="text-xs text-[var(--color-neutral-400)] mt-0.5">
                      {s.duration_minutes} {isAr ? 'دقيقة' : 'min'}
                      {catName ? ` · ${isAr ? catName.name_ar : catName.name_en}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-[var(--color-neutral-100)] transition-colors" title={isAr ? 'تعديل' : 'Edit'}>
                      <Pencil className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" />
                    </button>
                    <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title={isAr ? 'حذف' : 'Delete'}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-bold text-[var(--color-primary)]">
                    {s.price_aed > 0 ? `${s.price_aed} AED` : (isAr ? 'مجاني' : 'Free')}
                  </span>
                  {/* Active toggle */}
                  <button
                    onClick={() => toggleActive(s)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${s.is_active ? 'bg-green-500' : 'bg-[var(--color-neutral-300)]'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${s.is_active ? 'start-5' : 'start-0.5'}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create/Edit Dialog ─────────────────────── */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDialogOpen(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {editId ? (isAr ? 'تعديل الخدمة' : 'Edit Service') : (isAr ? 'خدمة جديدة' : 'New Service')}
              </h2>
              <button onClick={() => setDialogOpen(false)} className="p-1 rounded-lg hover:bg-[var(--color-neutral-100)]" aria-label={isAr ? 'إغلاق' : 'Close'}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Names */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'الاسم (عربي)' : 'Name (AR)'}</span>
                  <input value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" dir="rtl" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'الاسم (إنجليزي)' : 'Name (EN)'}</span>
                  <input value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
                </label>
              </div>

              {/* Duration + Category */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'المدة' : 'Duration'}</span>
                  <select value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]">
                    {DURATIONS.map(d => <option key={d} value={d}>{d} {isAr ? 'دقيقة' : 'min'}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'الفئة' : 'Category'}</span>
                  <select value={form.category_id ?? ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]">
                    <option value="">{isAr ? 'بدون فئة' : 'No category'}</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{isAr ? c.name_ar : c.name_en}</option>)}
                  </select>
                </label>
              </div>

              {/* Price */}
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">AED</span>
                  <input type="number" min={0} value={form.price_aed} onChange={e => setForm(f => ({ ...f, price_aed: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">EGP</span>
                  <input type="number" min={0} value={form.price_egp} onChange={e => setForm(f => ({ ...f, price_egp: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-500)]">USD</span>
                  <input type="number" min={0} value={form.price_usd} onChange={e => setForm(f => ({ ...f, price_usd: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]" />
                </label>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-[var(--color-neutral-300)]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'start-5' : 'start-0.5'}`} />
                </button>
                <span className="text-sm text-[var(--text-primary)]">{form.is_active ? (isAr ? 'نشطة' : 'Active') : (isAr ? 'غير نشطة' : 'Inactive')}</span>
              </label>
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !form.name_ar || !form.name_en}>
                {saving ? '...' : editId ? (isAr ? 'حفظ' : 'Save') : (isAr ? 'إنشاء' : 'Create')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation ────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteId(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center" onClick={e => e.stopPropagation()}>
            <Trash2 className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              {isAr ? 'حذف الخدمة؟' : 'Delete Service?'}
            </h3>
            <p className="text-sm text-[var(--color-neutral-500)] mb-6">
              {isAr ? 'لا يمكن التراجع عن هذا الإجراء.' : 'This action cannot be undone.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button variant="primary" size="sm" className="!bg-red-500 hover:!bg-red-600" onClick={handleDelete} disabled={deleting}>
                {deleting ? '...' : (isAr ? 'حذف' : 'Delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Toast ──────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 start-1/2 -translate-x-1/2 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg transition-all ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}
          style={{ animation: 'slide-up 0.3s ease-out' }}
        >
          {toast.msg}
        </div>
      )}

      <style>{`@keyframes slide-up { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}
