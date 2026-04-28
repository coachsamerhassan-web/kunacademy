'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, useCallback } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Direction {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
  icon: string | null;
  benefits_mode: 'list' | 'all';
  display_order: number;
  published: boolean;
}

interface Benefit {
  id: string;
  slug: string;
  direction_slug: string;
  label_ar: string;
  label_en: string;
  description_ar: string | null;
  description_en: string | null;
  citation_ar: string | null;
  citation_en: string | null;
  benchmark_improvement_pct: number;
  roi_category: 'productivity' | 'turnover' | 'absenteeism' | 'engagement' | 'conflict';
  self_assessment_prompt_ar: string | null;
  self_assessment_prompt_en: string | null;
  display_order: number;
  published: boolean;
}

const ROI_CATEGORIES: Benefit['roi_category'][] = [
  'productivity', 'turnover', 'absenteeism', 'engagement', 'conflict',
];

const EMPTY_DIRECTION: Partial<Direction> = {
  slug: '', title_ar: '', title_en: '', description_ar: '', description_en: '',
  icon: '', benefits_mode: 'list', display_order: 0, published: true,
};

const EMPTY_BENEFIT: Partial<Benefit> = {
  slug: '', direction_slug: '', label_ar: '', label_en: '',
  description_ar: '', description_en: '', citation_ar: '', citation_en: '',
  benchmark_improvement_pct: 0, roi_category: 'productivity',
  self_assessment_prompt_ar: '', self_assessment_prompt_en: '',
  display_order: 0, published: true,
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCorporateBenefitsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAr = locale === 'ar';

  const [tab, setTab] = useState<'directions' | 'benefits'>('directions');
  const [directions, setDirections] = useState<Direction[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ direction: string; roi: string; search: string }>({
    direction: '', roi: '', search: '',
  });

  // Dialog state
  const [dlg, setDlg] = useState<null | { kind: 'direction' | 'benefit'; editId: string | null }>(null);
  const [dirForm, setDirForm] = useState<Partial<Direction>>(EMPTY_DIRECTION);
  const [benForm, setBenForm] = useState<Partial<Benefit>>(EMPTY_BENEFIT);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<null | { kind: 'direction' | 'benefit'; id: string; label: string }>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirections = useCallback(async () => {
    const res = await fetch('/api/admin/corporate-benefits/directions');
    const data = await res.json();
    setDirections((data.directions ?? []) as Direction[]);
  }, []);

  const loadBenefits = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter.direction) params.set('direction', filter.direction);
    if (filter.roi) params.set('roi', filter.roi);
    if (filter.search) params.set('search', filter.search);
    const res = await fetch(`/api/admin/corporate-benefits?${params}`);
    const data = await res.json();
    setBenefits((data.benefits ?? []) as Benefit[]);
  }, [filter]);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadDirections(), loadBenefits()]);
    setLoading(false);
  }, [loadDirections, loadBenefits]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) {
      router.push('/' + locale + '/auth/login?redirect=' + encodeURIComponent(pathname));
      return;
    }
    load();
  }, [user, profile, authLoading, load, locale, router]);

  // ── Save handlers ────────────────────────────────────────────────────────
  async function saveDirection() {
    setSaving(true);
    setError(null);
    try {
      const url = dlg?.editId
        ? `/api/admin/corporate-benefits/directions/${dlg.editId}`
        : '/api/admin/corporate-benefits/directions';
      const method = dlg?.editId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dirForm),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setDlg(null);
      setDirForm(EMPTY_DIRECTION);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveBenefit() {
    setSaving(true);
    setError(null);
    try {
      const url = dlg?.editId
        ? `/api/admin/corporate-benefits/${dlg.editId}`
        : '/api/admin/corporate-benefits';
      const method = dlg?.editId ? 'PATCH' : 'POST';
      const payload = {
        ...benForm,
        benchmark_improvement_pct: Number(benForm.benchmark_improvement_pct ?? 0),
        display_order: Number(benForm.display_order ?? 0),
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setDlg(null);
      setBenForm(EMPTY_BENEFIT);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const url = deleteTarget.kind === 'direction'
        ? `/api/admin/corporate-benefits/directions/${deleteTarget.id}`
        : `/api/admin/corporate-benefits/${deleteTarget.id}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setDeleteTarget(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <Section>
        <p className="py-24 text-center opacity-60">{isAr ? 'جارِ التحميل…' : 'Loading…'}</p>
      </Section>
    );
  }

  return (
    <Section>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/${locale}/admin`)}>
            <ArrowLeft className="w-4 h-4 me-2" />
            {isAr ? 'رجوع' : 'Back'}
          </Button>
          <Heading level={1}>{isAr ? 'مزايا كوتشينج الشركات' : 'Corporate Coaching Benefits'}</Heading>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab('directions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'directions' ? 'border-primary text-primary' : 'border-transparent opacity-60 hover:opacity-100'}`}
        >
          {isAr ? `الاتجاهات (${directions.length})` : `Directions (${directions.length})`}
        </button>
        <button
          type="button"
          onClick={() => setTab('benefits')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'benefits' ? 'border-primary text-primary' : 'border-transparent opacity-60 hover:opacity-100'}`}
        >
          {isAr ? `المزايا (${benefits.length})` : `Benefits (${benefits.length})`}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── Directions tab ───────────────────────────── */}
      {tab === 'directions' && (
        <>
          <div className="mb-4 flex justify-end">
            <Button size="sm" onClick={() => { setDirForm(EMPTY_DIRECTION); setDlg({ kind: 'direction', editId: null }); }}>
              <Plus className="w-4 h-4 me-1" /> {isAr ? 'اتجاه جديد' : 'New Direction'}
            </Button>
          </div>

          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Slug</th>
                  <th className="px-3 py-2">Title AR</th>
                  <th className="px-3 py-2">Title EN</th>
                  <th className="px-3 py-2">Icon</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Pub.</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {directions.map((d, i) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2 opacity-60">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.slug}</td>
                    <td className="px-3 py-2" dir="rtl">{d.title_ar}</td>
                    <td className="px-3 py-2">{d.title_en}</td>
                    <td className="px-3 py-2 text-xs">{d.icon ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{d.benefits_mode}</td>
                    <td className="px-3 py-2">{d.display_order}</td>
                    <td className="px-3 py-2">{d.published ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-primary hover:underline me-2"
                        onClick={() => { setDirForm(d); setDlg({ kind: 'direction', editId: d.id }); }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-red-600 hover:underline"
                        onClick={() => setDeleteTarget({ kind: 'direction', id: d.id, label: d.title_en })}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Benefits tab ─────────────────────────────── */}
      {tab === 'benefits' && (
        <>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs flex flex-col">
                Direction
                <select
                  value={filter.direction}
                  onChange={(e) => setFilter((f) => ({ ...f, direction: e.target.value }))}
                  className="mt-1 rounded border px-2 py-1 text-sm"
                >
                  <option value="">All</option>
                  {directions.map((d) => (
                    <option key={d.id} value={d.slug}>{d.title_en}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs flex flex-col">
                ROI
                <select
                  value={filter.roi}
                  onChange={(e) => setFilter((f) => ({ ...f, roi: e.target.value }))}
                  className="mt-1 rounded border px-2 py-1 text-sm"
                >
                  <option value="">All</option>
                  {ROI_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="text-xs flex flex-col">
                Search
                <input
                  type="text"
                  value={filter.search}
                  onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
                  placeholder="label…"
                  className="mt-1 rounded border px-2 py-1 text-sm"
                />
              </label>
              <Button size="sm" variant="secondary" onClick={loadBenefits}>Apply</Button>
            </div>
            <Button size="sm" onClick={() => { setBenForm(EMPTY_BENEFIT); setDlg({ kind: 'benefit', editId: null }); }}>
              <Plus className="w-4 h-4 me-1" /> {isAr ? 'ميزة جديدة' : 'New Benefit'}
            </Button>
          </div>

          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Slug</th>
                  <th className="px-3 py-2">Direction</th>
                  <th className="px-3 py-2">Label AR</th>
                  <th className="px-3 py-2">Label EN</th>
                  <th className="px-3 py-2">ROI</th>
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Pub.</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {benefits.map((b, i) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-3 py-2 opacity-60">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs">{b.slug}</td>
                    <td className="px-3 py-2 text-xs">{b.direction_slug}</td>
                    <td className="px-3 py-2" dir="rtl">{b.label_ar}</td>
                    <td className="px-3 py-2">{b.label_en}</td>
                    <td className="px-3 py-2 text-xs">{b.roi_category}</td>
                    <td className="px-3 py-2">{b.benchmark_improvement_pct}</td>
                    <td className="px-3 py-2">{b.display_order}</td>
                    <td className="px-3 py-2">{b.published ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-primary hover:underline me-2"
                        onClick={() => { setBenForm(b); setDlg({ kind: 'benefit', editId: b.id }); }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-red-600 hover:underline"
                        onClick={() => setDeleteTarget({ kind: 'benefit', id: b.id, label: b.label_en })}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Direction dialog ─────────────────────────── */}
      {dlg?.kind === 'direction' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded bg-background p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {dlg.editId ? (isAr ? 'تحرير اتجاه' : 'Edit Direction') : (isAr ? 'اتجاه جديد' : 'New Direction')}
              </h2>
              <button type="button" onClick={() => setDlg(null)}><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="col-span-2 flex flex-col">
                Slug
                <input
                  className="mt-1 rounded border px-2 py-1 font-mono"
                  value={dirForm.slug ?? ''}
                  onChange={(e) => setDirForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                />
              </label>
              <label className="flex flex-col">
                Title AR
                <input
                  dir="rtl"
                  className="mt-1 rounded border px-2 py-1"
                  value={dirForm.title_ar ?? ''}
                  onChange={(e) => setDirForm((f) => ({ ...f, title_ar: e.target.value }))}
                />
              </label>
              <label className="flex flex-col">
                Title EN
                <input
                  className="mt-1 rounded border px-2 py-1"
                  value={dirForm.title_en ?? ''}
                  onChange={(e) => setDirForm((f) => ({ ...f, title_en: e.target.value }))}
                />
              </label>
              <label className="flex flex-col">
                Description AR
                <textarea
                  dir="rtl"
                  rows={3}
                  className="mt-1 rounded border px-2 py-1"
                  value={dirForm.description_ar ?? ''}
                  onChange={(e) => setDirForm((f) => ({ ...f, description_ar: e.target.value }))}
                />
              </label>
              <label className="flex flex-col">
                Description EN
                <textarea
                  rows={3}
                  className="mt-1 rounded border px-2 py-1"
                  value={dirForm.description_en ?? ''}
                  onChange={(e) => setDirForm((f) => ({ ...f, description_en: e.target.value }))}
                />
              </label>
              <label className="flex flex-col">
                Icon
                <input
                  className="mt-1 rounded border px-2 py-1"
                  value={dirForm.icon ?? ''}
                  onChange={(e) => setDirForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="crown / building / user / settings"
                />
              </label>
              <label className="flex flex-col">
                Benefits Mode
                <select
                  className="mt-1 rounded border px-2 py-1"
                  value={dirForm.benefits_mode ?? 'list'}
                  onChange={(e) => setDirForm((f) => ({ ...f, benefits_mode: e.target.value as 'list' | 'all' }))}
                >
                  <option value="list">list — scoped benefits</option>
                  <option value="all">all — flatten all other directions</option>
                </select>
              </label>
              <label className="flex flex-col">
                Display Order
                <input
                  type="number"
                  className="mt-1 rounded border px-2 py-1"
                  value={dirForm.display_order ?? 0}
                  onChange={(e) => setDirForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dirForm.published ?? true}
                  onChange={(e) => setDirForm((f) => ({ ...f, published: e.target.checked }))}
                />
                Published
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDlg(null)} disabled={saving}>Cancel</Button>
              <Button onClick={saveDirection} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Benefit dialog ───────────────────────────── */}
      {dlg?.kind === 'benefit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {dlg.editId ? (isAr ? 'تحرير ميزة' : 'Edit Benefit') : (isAr ? 'ميزة جديدة' : 'New Benefit')}
              </h2>
              <button type="button" onClick={() => setDlg(null)}><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="flex flex-col">
                Slug
                <input
                  className="mt-1 rounded border px-2 py-1 font-mono"
                  value={benForm.slug ?? ''}
                  onChange={(e) => setBenForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                />
              </label>
              <label className="flex flex-col">
                Direction
                <select
                  className="mt-1 rounded border px-2 py-1"
                  value={benForm.direction_slug ?? ''}
                  onChange={(e) => setBenForm((f) => ({ ...f, direction_slug: e.target.value }))}
                >
                  <option value="">— select —</option>
                  {directions.filter((d) => d.benefits_mode === 'list').map((d) => (
                    <option key={d.id} value={d.slug}>{d.title_en}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col">
                Label AR
                <input
                  dir="rtl"
                  className="mt-1 rounded border px-2 py-1"
                  value={benForm.label_ar ?? ''}
                  onChange={(e) => setBenForm((f) => ({ ...f, label_ar: e.target.value }))}
                />
              </label>
              <label className="flex flex-col">
                Label EN
                <input
                  className="mt-1 rounded border px-2 py-1"
                  value={benForm.label_en ?? ''}
                  onChange={(e) => setBenForm((f) => ({ ...f, label_en: e.target.value }))}
                />
              </label>
              <label className="col-span-2 flex flex-col">
                Description AR
                <textarea
                  dir="rtl"
                  rows={2}
                  className="mt-1 rounded border px-2 py-1"
                  value={benForm.description_ar ?? ''}
                  onChange={(e) => setBenForm((f) => ({ ...f, description_ar: e.target.value }))}
                />
              </label>
              <label className="col-span-2 flex flex-col">
                Description EN
                <textarea
                  rows={2}
                  className="mt-1 rounded border px-2 py-1"
                  value={benForm.description_en ?? ''}
                  onChange={(e) => setBenForm((f) => ({ ...f, description_en: e.target.value }))}
                />
              </label>
              <label className="col-span-2 flex flex-col">
                Citation AR
                <input
                  dir="rtl"
                  className="mt-1 rounded border px-2 py-1"
                  value={benForm.citation_ar ?? ''}
                  onChange={(e) => setBenForm((f) => ({ ...f, citation_ar: e.target.value }))}
                />
              </label>
              <label className="col-span-2 flex flex-col">
                Citation EN
                <input
                  className="mt-1 rounded border px-2 py-1"
                  value={benForm.citation_en ?? ''}
                  onChange={(e) => setBenForm((f) => ({ ...f, citation_en: e.target.value }))}
                />
              </label>
              <label className="flex flex-col">
                Benchmark % improvement
                <input
                  type="number"
                  className="mt-1 rounded border px-2 py-1"
                  value={benForm.benchmark_improvement_pct ?? 0}
                  onChange={(e) => setBenForm((f) => ({ ...f, benchmark_improvement_pct: Number(e.target.value) }))}
                />
              </label>
              <label className="flex flex-col">
                ROI Category
                <select
                  className="mt-1 rounded border px-2 py-1"
                  value={benForm.roi_category ?? 'productivity'}
                  onChange={(e) => setBenForm((f) => ({ ...f, roi_category: e.target.value as Benefit['roi_category'] }))}
                >
                  {ROI_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="col-span-2 flex flex-col">
                Self-assessment Prompt AR
                <textarea
                  dir="rtl"
                  rows={2}
                  className="mt-1 rounded border px-2 py-1"
                  value={benForm.self_assessment_prompt_ar ?? ''}
                  onChange={(e) => setBenForm((f) => ({ ...f, self_assessment_prompt_ar: e.target.value }))}
                />
              </label>
              <label className="col-span-2 flex flex-col">
                Self-assessment Prompt EN
                <textarea
                  rows={2}
                  className="mt-1 rounded border px-2 py-1"
                  value={benForm.self_assessment_prompt_en ?? ''}
                  onChange={(e) => setBenForm((f) => ({ ...f, self_assessment_prompt_en: e.target.value }))}
                />
              </label>
              <label className="flex flex-col">
                Display Order
                <input
                  type="number"
                  className="mt-1 rounded border px-2 py-1"
                  value={benForm.display_order ?? 0}
                  onChange={(e) => setBenForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={benForm.published ?? true}
                  onChange={(e) => setBenForm((f) => ({ ...f, published: e.target.checked }))}
                />
                Published
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDlg(null)} disabled={saving}>Cancel</Button>
              <Button onClick={saveBenefit} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ───────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded bg-background p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold">
              {isAr ? 'تأكيد الحذف' : 'Confirm delete'}
            </h3>
            <p className="mb-4 text-sm opacity-80">
              {isAr ? 'سيُحذف بشكل نهائي:' : 'This will permanently delete:'}{' '}
              <strong>{deleteTarget.label}</strong>
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={deleting}
                className="!bg-red-600 hover:!bg-red-700 !text-white"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
