'use client';

/**
 * /admin/programs/[id]/overrides — Region-level price override manager.
 *
 * Introduced 2026-04-21 for service-type programs (Wisal, Seeds-Parents,
 * Seeds-Caregivers) that have region-specific pricing (UAE/EG/KSA/other).
 *
 * UI flow:
 *   - Lists existing overrides for the program (fetched via slug).
 *   - Inline Add form: region + price + currency + optional notes.
 *   - Edit row: opens same form pre-filled; PATCH on save.
 *   - Delete row: confirmation modal.
 *
 * API: /api/admin/programs/[slug]/overrides (GET, POST, PATCH [id], DELETE [id])
 */

import { use, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@kunacademy/auth';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { ArrowLeft, Plus, Pencil, Trash2, X, Check } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Override {
  id: string;
  program_slug: string;
  region: string;
  price: string;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ProgramSummary {
  slug: string;
  title_en: string;
}

const CURRENCIES = ['AED', 'EGP', 'SAR', 'USD', 'EUR'] as const;
type Currency = (typeof CURRENCIES)[number];

// ── Suggested region presets (admin can also type a free-form value) ──────────

const REGION_PRESETS = ['AE', 'EG', 'SA', 'OTHER'] as const;

// ── Blank form state ──────────────────────────────────────────────────────────

interface FormState {
  region: string;
  price: string;
  currency: Currency;
  notes: string;
}

const BLANK: FormState = { region: '', price: '', currency: 'AED', notes: '' };

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProgramOverridesPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id: programId } = use(params);
  const { locale } = useParams<{ locale: string }>();
  const isAr = locale === 'ar';
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [program, setProgram] = useState<ProgramSummary | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [programSlug, setProgramSlug] = useState<string | null>(null);

  // Form state (shared between Add and Edit modes)
  const [formMode, setFormMode] = useState<'idle' | 'add' | 'edit'>('idle');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<Override | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    const role = (profile as { role?: string } | null)?.role;
    if (!user || (role !== 'admin' && role !== 'super_admin')) {
      router.push(`/${locale}/auth/login`);
    }
  }, [user, profile, authLoading, locale, router]);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadProgram = useCallback(async () => {
    const res = await fetch(`/api/admin/programs/${programId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.program as { slug: string; title_en: string } | null;
  }, [programId]);

  const loadOverrides = useCallback(async (slug: string) => {
    const res = await fetch(`/api/admin/programs/${slug}/overrides`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.overrides ?? []) as Override[];
  }, []);

  const initialLoad = useCallback(async () => {
    const prog = await loadProgram();
    if (!prog) {
      setLoading(false);
      return;
    }
    setProgram({ slug: prog.slug, title_en: prog.title_en });
    setProgramSlug(prog.slug);
    const rows = await loadOverrides(prog.slug);
    setOverrides(rows);
    setLoading(false);
  }, [loadProgram, loadOverrides]);

  useEffect(() => {
    if (authLoading) return;
    initialLoad();
  }, [authLoading, initialLoad]);

  // ── Form helpers ────────────────────────────────────────────────────────────

  function openAdd() {
    setForm(BLANK);
    setEditingId(null);
    setFormError(null);
    setFormMode('add');
  }

  function openEdit(o: Override) {
    setForm({
      region: o.region,
      price: o.price,
      currency: o.currency as Currency,
      notes: o.notes ?? '',
    });
    setEditingId(o.id);
    setFormError(null);
    setFormMode('edit');
  }

  function closeForm() {
    setFormMode('idle');
    setEditingId(null);
    setFormError(null);
  }

  async function saveForm() {
    if (!programSlug) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        region: form.region.trim().toUpperCase(),
        price: parseFloat(form.price),
        currency: form.currency,
        notes: form.notes.trim() || null,
      };

      let res: Response;
      if (formMode === 'add') {
        res = await fetch(`/api/admin/programs/${programSlug}/overrides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/admin/programs/${programSlug}/overrides/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError((err as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }

      closeForm();
      const rows = await loadOverrides(programSlug);
      setOverrides(rows);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete || !programSlug) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/programs/${programSlug}/overrides/${confirmDelete.id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      setConfirmDelete(null);
      const rows = await loadOverrides(programSlug);
      setOverrides(rows);
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <Section>
        <p className="text-center py-12">Loading...</p>
      </Section>
    );
  }

  if (!program) {
    return (
      <Section>
        <p className="text-center py-12 text-red-600">
          {isAr ? 'البرنامج غير موجود' : 'Program not found'}
        </p>
      </Section>
    );
  }

  return (
    <main>
      <Section variant="white">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Link
              href={`/${locale}/admin/programs/${programId}`}
              className="text-[var(--color-primary)] text-sm hover:underline inline-flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              {isAr ? 'تعديل البرنامج' : `Edit: ${program.title_en}`}
            </Link>
            <Heading level={1}>
              {isAr ? 'تسعير حسب المنطقة' : 'Region Price Overrides'}
            </Heading>
            <p className="text-sm text-[var(--color-neutral-500)] mt-1 font-mono">
              {program.slug}
            </p>
            <p className="text-xs text-[var(--color-neutral-400)] mt-0.5">
              {isAr
                ? 'يتم عرض سعر المنطقة بدلاً من السعر الأساسي عند توفر تطابق للمنطقة.'
                : 'Region price overrides replace the base program price when a region match is found.'}
            </p>
          </div>

          {formMode === 'idle' && (
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] text-white text-sm px-3 py-2"
            >
              <Plus className="w-4 h-4" />
              {isAr ? 'إضافة منطقة' : 'Add region'}
            </button>
          )}
        </div>

        {/* Add / Edit form */}
        {formMode !== 'idle' && (
          <div className="mt-6 rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">
                {formMode === 'add'
                  ? isAr ? 'إضافة منطقة جديدة' : 'Add new region override'
                  : isAr ? 'تعديل منطقة' : 'Edit region override'}
              </h2>
              <button onClick={closeForm} className="text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-800)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Region */}
              <label className="block">
                <span className="text-xs font-medium text-[var(--color-neutral-600)] block mb-1">
                  {isAr ? 'المنطقة' : 'Region'} <span className="text-red-500">*</span>
                </span>
                <div className="flex gap-2">
                  <select
                    value={REGION_PRESETS.includes(form.region as typeof REGION_PRESETS[number]) ? form.region : ''}
                    onChange={(e) => {
                      if (e.target.value) setForm((f) => ({ ...f, region: e.target.value }));
                    }}
                    className="rounded border border-[var(--color-neutral-300)] px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="">{isAr ? 'اختر...' : 'Quick select'}</option>
                    {REGION_PRESETS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value.toUpperCase() }))}
                    placeholder="AE / EG / SA / OTHER"
                    maxLength={16}
                    className="flex-1 rounded border border-[var(--color-neutral-300)] px-2 py-1.5 text-sm"
                  />
                </div>
              </label>

              {/* Price */}
              <label className="block">
                <span className="text-xs font-medium text-[var(--color-neutral-600)] block mb-1">
                  {isAr ? 'السعر' : 'Price'} <span className="text-red-500">*</span>
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="e.g. 2500"
                  className="w-full rounded border border-[var(--color-neutral-300)] px-2 py-1.5 text-sm"
                />
              </label>

              {/* Currency */}
              <label className="block">
                <span className="text-xs font-medium text-[var(--color-neutral-600)] block mb-1">
                  {isAr ? 'العملة' : 'Currency'} <span className="text-red-500">*</span>
                </span>
                <select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as Currency }))}
                  className="w-full rounded border border-[var(--color-neutral-300)] px-2 py-1.5 text-sm bg-white"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              {/* Notes */}
              <label className="block">
                <span className="text-xs font-medium text-[var(--color-neutral-600)] block mb-1">
                  {isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                </span>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={isAr ? 'ملاحظة للمسؤول' : 'Admin memo'}
                  className="w-full rounded border border-[var(--color-neutral-300)] px-2 py-1.5 text-sm"
                />
              </label>
            </div>

            {formError && (
              <p className="mt-3 text-sm text-red-600">{formError}</p>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={saveForm}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] text-white text-sm px-4 py-2 disabled:opacity-60"
              >
                <Check className="w-4 h-4" />
                {saving
                  ? isAr ? 'جارٍ الحفظ...' : 'Saving...'
                  : isAr ? 'حفظ' : 'Save'}
              </button>
              <button
                onClick={closeForm}
                className="rounded-lg border border-[var(--color-neutral-200)] px-4 py-2 text-sm"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Overrides table */}
        <div className="mt-6 overflow-x-auto">
          {overrides.length === 0 ? (
            <p className="py-8 text-center text-[var(--color-neutral-500)] text-sm">
              {isAr
                ? 'لا توجد تسعيرات مخصصة بعد. أضف منطقة أعلاه.'
                : 'No region overrides yet. Add one above.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--color-neutral-500)] uppercase">
                <tr className="text-left rtl:text-right">
                  <th className="py-2 pr-4">{isAr ? 'المنطقة' : 'Region'}</th>
                  <th className="py-2 pr-4">{isAr ? 'السعر' : 'Price'}</th>
                  <th className="py-2 pr-4">{isAr ? 'العملة' : 'Currency'}</th>
                  <th className="py-2 pr-4">{isAr ? 'ملاحظات' : 'Notes'}</th>
                  <th className="py-2 pr-4">{isAr ? 'آخر تحديث' : 'Updated'}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.id} className="border-t border-[var(--color-neutral-100)]">
                    <td className="py-2 pr-4 font-mono font-medium">{o.region}</td>
                    <td className="py-2 pr-4">{parseFloat(o.price).toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      <span className="inline-block rounded bg-[var(--color-neutral-100)] px-1.5 py-0.5 text-xs font-mono">
                        {o.currency}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-[var(--color-neutral-500)]">
                      {o.notes ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-xs text-[var(--color-neutral-400)]">
                      {new Date(o.updated_at).toLocaleDateString(locale)}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(o)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)]"
                          title={isAr ? 'تعديل' : 'Edit'}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(o)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                          title={isAr ? 'حذف' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={() => setConfirmDelete(null)}
          >
            <div
              className="bg-white rounded-xl max-w-md w-full mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <Heading level={3}>{isAr ? 'تأكيد الحذف' : 'Confirm delete'}</Heading>
              <p className="mt-2 text-sm">
                {isAr
                  ? `هل تريد حذف تسعير المنطقة `
                  : `Delete the override for region `}
                <span className="font-mono font-semibold">{confirmDelete.region}</span>
                {isAr ? '؟' : '?'}
              </p>
              <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
                {parseFloat(confirmDelete.price).toLocaleString()} {confirmDelete.currency}
              </p>
              <div className="mt-5 flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={doDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm disabled:opacity-60"
                >
                  {deleting
                    ? isAr ? 'جارٍ الحذف...' : 'Deleting...'
                    : isAr ? 'حذف' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Section>
    </main>
  );
}
