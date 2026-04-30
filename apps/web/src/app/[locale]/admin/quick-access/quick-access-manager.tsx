'use client';

import { useEffect, useState, useCallback } from 'react';

const COLOR_TOKENS = [
  'mandarin', 'sky', 'primary', 'charleston', 'rose',
  'deepsky', 'sand', 'mist', 'violet', 'amber', 'jade',
] as const;
type ColorToken = (typeof COLOR_TOKENS)[number];

interface QuickAccessTile {
  id: string;
  label_ar: string;
  label_en: string;
  href: string;
  icon_path: string;
  color_token: ColorToken;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DraftTile {
  label_ar: string;
  label_en: string;
  href: string;
  icon_path: string;
  color_token: ColorToken;
  is_active: boolean;
}

const EMPTY_DRAFT: DraftTile = {
  label_ar: '',
  label_en: '',
  href: '/admin/',
  icon_path: '',
  color_token: 'primary',
  is_active: true,
};

export function QuickAccessManager({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const [tiles, setTiles] = useState<QuickAccessTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<DraftTile>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/quick-access', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTiles(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId('new');
    setError(null);
  };

  const startEdit = (tile: QuickAccessTile) => {
    setDraft({
      label_ar: tile.label_ar,
      label_en: tile.label_en,
      href: tile.href,
      icon_path: tile.icon_path,
      color_token: tile.color_token,
      is_active: tile.is_active,
    });
    setEditingId(tile.id);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  };

  const save = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const isNew = editingId === 'new';
      const url = isNew ? '/api/admin/quick-access' : `/api/admin/quick-access/${editingId}`;
      const method = isNew ? 'POST' : 'PATCH';
      const body = isNew
        ? { ...draft, sort_order: (tiles[tiles.length - 1]?.sort_order ?? 0) + 10 }
        : draft;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (tile: QuickAccessTile) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/quick-access/${tile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !tile.is_active }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const remove = async (tile: QuickAccessTile) => {
    if (!confirm(isAr ? `حذف "${tile.label_ar}"؟ هذا الإجراء لا يمكن التراجع عنه.` : `Delete "${tile.label_en}"? This cannot be undone.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/quick-access/${tile.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const move = async (tile: QuickAccessTile, direction: 'up' | 'down') => {
    const sorted = [...tiles].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((t) => t.id === tile.id);
    if (idx === -1) return;
    const swapWith = direction === 'up' ? sorted[idx - 1] : sorted[idx + 1];
    if (!swapWith) return;
    const updates = [
      { id: tile.id, sort_order: swapWith.sort_order },
      { id: swapWith.id, sort_order: tile.sort_order },
    ];
    setError(null);
    try {
      const res = await fetch('/api/admin/quick-access/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: updates }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed');
    }
  };

  const sorted = [...tiles].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--color-neutral-600)]">
          {loading
            ? (isAr ? 'جاري التحميل...' : 'Loading...')
            : (isAr
                ? `${tiles.length} اختصار · ${tiles.filter((t) => t.is_active).length} نشط`
                : `${tiles.length} tiles · ${tiles.filter((t) => t.is_active).length} active`)}
        </div>
        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-white text-sm font-medium hover:opacity-90 transition-opacity min-h-[40px]"
          disabled={editingId !== null}
        >
          {isAr ? '+ اختصار جديد' : '+ New Tile'}
        </button>
      </div>

      {error && (
        <div className="kun-shell-card p-4 border border-red-200 bg-red-50 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Editor (inline) */}
      {editingId && (
        <TileEditor
          isAr={isAr}
          isNew={editingId === 'new'}
          draft={draft}
          onChange={setDraft}
          onSave={save}
          onCancel={cancelEdit}
          saving={saving}
        />
      )}

      {/* List */}
      <div className="kun-shell-card p-4 md:p-5">
        {loading ? null : sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--color-neutral-500)]">
            {isAr ? 'لا توجد اختصارات. ابدأ بإضافة واحد.' : 'No tiles yet. Add one to get started.'}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-100)]">
            {sorted.map((tile, idx) => (
              <TileRow
                key={tile.id}
                tile={tile}
                isAr={isAr}
                isFirst={idx === 0}
                isLast={idx === sorted.length - 1}
                onMove={(dir) => move(tile, dir)}
                onEdit={() => startEdit(tile)}
                onToggle={() => toggleActive(tile)}
                onDelete={() => remove(tile)}
                disabled={editingId !== null}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Tile row — list view
// ─────────────────────────────────────────────────────────────────

function TileRow({
  tile, isAr, isFirst, isLast, onMove, onEdit, onToggle, onDelete, disabled,
}: {
  tile: QuickAccessTile;
  isAr: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: 'up' | 'down') => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `var(--shell-tile-${tile.color_token}-bg)` }}
        aria-hidden="true"
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-white"
          style={{ background: `var(--shell-tile-${tile.color_token}-icon)` }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={tile.icon_path} />
          </svg>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[var(--text-primary)] text-sm">
            {isAr ? tile.label_ar : tile.label_en}
          </span>
          <span className="text-xs text-[var(--color-neutral-500)]">
            {isAr ? tile.label_en : tile.label_ar}
          </span>
          {!tile.is_active && (
            <span className="text-[10px] uppercase font-semibold text-[var(--color-neutral-500)] bg-[var(--color-neutral-100)] px-2 py-0.5 rounded">
              {isAr ? 'غير نشط' : 'inactive'}
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--color-neutral-600)] truncate font-mono">{tile.href}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onMove('up')}
          disabled={disabled || isFirst}
          className="w-8 h-8 rounded text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={isAr ? 'تحريك للأعلى' : 'Move up'}
        >
          <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onMove('down')}
          disabled={disabled || isLast}
          className="w-8 h-8 rounded text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={isAr ? 'تحريك للأسفل' : 'Move down'}
        >
          <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="px-3 py-1.5 rounded text-xs font-medium border border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-100)] disabled:opacity-50"
        >
          {tile.is_active ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="px-3 py-1.5 rounded text-xs font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50"
        >
          {isAr ? 'تعديل' : 'Edit'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="px-3 py-1.5 rounded text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {isAr ? 'حذف' : 'Delete'}
        </button>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────
// Editor (inline form)
// ─────────────────────────────────────────────────────────────────

function TileEditor({
  isAr, isNew, draft, onChange, onSave, onCancel, saving,
}: {
  isAr: boolean;
  isNew: boolean;
  draft: DraftTile;
  onChange: (d: DraftTile) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const update = <K extends keyof DraftTile>(key: K, value: DraftTile[K]) => onChange({ ...draft, [key]: value });

  return (
    <div className="kun-shell-card p-5 md:p-6 space-y-4 border-2 border-[var(--color-accent)]/30">
      <div className="flex items-center justify-between">
        <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">
          {isNew ? (isAr ? 'اختصار جديد' : 'New Tile') : (isAr ? 'تعديل الاختصار' : 'Edit Tile')}
        </h3>
        <PreviewTile draft={draft} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={isAr ? 'العنوان (عربي)' : 'Label (Arabic)'} dir="rtl">
          <input
            type="text"
            value={draft.label_ar}
            onChange={(e) => update('label_ar', e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]"
            dir="rtl"
            required
          />
        </Field>
        <Field label={isAr ? 'العنوان (إنجليزي)' : 'Label (English)'}>
          <input
            type="text"
            value={draft.label_en}
            onChange={(e) => update('label_en', e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]"
            required
          />
        </Field>
        <Field label={isAr ? 'الرابط' : 'Link (href)'} className="md:col-span-2">
          <input
            type="text"
            value={draft.href}
            onChange={(e) => update('href', e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] font-mono"
            placeholder="/admin/example"
            required
          />
        </Field>
        <Field label={isAr ? 'مسار الأيقونة (SVG)' : 'Icon SVG path'} className="md:col-span-2"
          help={isAr
            ? 'انسخ مسار d من Heroicons (heroicons.com) — اختر "outline" ثم انسخ القيمة بدون علامات الاقتباس.'
            : 'Copy the d-attribute from a Heroicons-outline icon (heroicons.com).'}
        >
          <textarea
            value={draft.icon_path}
            onChange={(e) => update('icon_path', e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] font-mono"
            rows={2}
            required
          />
        </Field>
        <Field label={isAr ? 'اللون' : 'Color'} className="md:col-span-2">
          <div className="flex flex-wrap gap-2">
            {COLOR_TOKENS.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => update('color_token', token)}
                className={`w-12 h-12 rounded-lg flex items-center justify-center border-2 transition-all ${
                  draft.color_token === token
                    ? 'border-[var(--color-accent)] scale-105'
                    : 'border-transparent hover:border-[var(--color-neutral-300)]'
                }`}
                style={{ background: `var(--shell-tile-${token}-bg)` }}
                aria-label={token}
                aria-pressed={draft.color_token === token}
              >
                <span
                  className="w-5 h-5 rounded"
                  style={{ background: `var(--shell-tile-${token}-icon)` }}
                />
              </button>
            ))}
          </div>
        </Field>
        <Field label="" className="md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            {isAr ? 'مرئي على لوحة التحكم' : 'Visible on dashboard'}
          </label>
        </Field>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !draft.label_ar.trim() || !draft.label_en.trim() || !draft.href.trim() || !draft.icon_path.trim()}
          className="px-5 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 min-h-[40px]"
        >
          {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-5 py-2 rounded-lg border border-[var(--color-neutral-300)] text-sm font-medium hover:bg-[var(--color-neutral-100)] disabled:opacity-50 min-h-[40px]"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label, children, className, help, dir,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  help?: string;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <div className={className} dir={dir}>
      {label && (
        <label className="block text-xs font-semibold text-[var(--color-neutral-700)] uppercase tracking-wide mb-1">
          {label}
        </label>
      )}
      {children}
      {help && <p className="text-xs text-[var(--color-neutral-500)] mt-1">{help}</p>}
    </div>
  );
}

function PreviewTile({ draft }: { draft: DraftTile }) {
  if (!draft.icon_path.trim()) return null;
  return (
    <div
      className="w-16 h-16 rounded-lg flex items-center justify-center"
      style={{ background: `var(--shell-tile-${draft.color_token}-bg)` }}
      aria-label="preview"
    >
      <div
        className="w-10 h-10 rounded-md flex items-center justify-center text-white"
        style={{ background: `var(--shell-tile-${draft.color_token}-icon)` }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={draft.icon_path} />
        </svg>
      </div>
    </div>
  );
}
