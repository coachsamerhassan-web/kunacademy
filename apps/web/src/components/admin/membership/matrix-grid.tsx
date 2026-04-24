'use client';

/**
 * MatrixGrid — entitlement matrix for Wave F.3.
 *
 * Rows = features, columns = tiers. Cells are checkboxes. Toggling a cell
 * does NOT fire immediately — admin stages changes in React state and
 * clicks "Save changes" to batch-submit. Prevents accidental toggles and
 * keeps audit rows traceable to an intentional save.
 *
 * Quota column (right side, hidden on narrow) lets admin set/clear a per-cell
 * numeric quota for `quota`-type features. NULL quota = unlimited.
 *
 * Mobile fallback: the matrix becomes a vertical stack of feature cards,
 * each listing tiers in a nested grid. That way a 9×2 matrix still fits on
 * 390px. For wider tier counts (Paid-2, etc.), the mobile UX scrolls.
 */

import { useMemo, useState } from 'react';

export interface TierLite {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
}

export interface FeatureLite {
  id: string;
  feature_key: string;
  name_ar: string;
  name_en: string;
  feature_type: string;
}

export interface MatrixRow {
  tier_id: string;
  feature_id: string;
  included: boolean;
  quota: number | null;
}

interface MatrixGridProps {
  locale: string;
  tiers: TierLite[];
  features: FeatureLite[];
  initialRows: MatrixRow[];
}

export function MatrixGrid({ locale, tiers, features, initialRows }: MatrixGridProps) {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const initialMap = useMemo(() => {
    const m = new Map<string, { included: boolean; quota: number | null }>();
    for (const r of initialRows) {
      m.set(`${r.tier_id}::${r.feature_id}`, { included: r.included, quota: r.quota });
    }
    return m;
  }, [initialRows]);

  // Working state: keyed by `${tier_id}::${feature_id}`
  const [cells, setCells] = useState<Map<string, { included: boolean; quota: number | null }>>(
    () => new Map(initialMap),
  );
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function cellKey(tierId: string, featureId: string) {
    return `${tierId}::${featureId}`;
  }

  function getCell(tierId: string, featureId: string) {
    return cells.get(cellKey(tierId, featureId)) ?? { included: false, quota: null as number | null };
  }

  function toggleCell(tierId: string, featureId: string) {
    const next = new Map(cells);
    const cur = getCell(tierId, featureId);
    next.set(cellKey(tierId, featureId), { included: !cur.included, quota: cur.quota });
    setCells(next);
    setDirty(true);
    setSuccess(null);
  }

  function setQuota(tierId: string, featureId: string, quota: number | null) {
    const next = new Map(cells);
    const cur = getCell(tierId, featureId);
    next.set(cellKey(tierId, featureId), { included: cur.included, quota });
    setCells(next);
    setDirty(true);
    setSuccess(null);
  }

  function computeDiff() {
    const ops: Array<{
      tier_id: string;
      feature_id: string;
      included: boolean;
      quota: number | null;
    }> = [];
    // Iterate union of keys: anything in cells OR initialMap that differs.
    const seen = new Set<string>();
    for (const [k, v] of cells.entries()) {
      seen.add(k);
      const prev = initialMap.get(k);
      if (!prev) {
        if (v.included) ops.push({ ...parseKey(k), included: v.included, quota: v.quota });
        continue;
      }
      if (prev.included !== v.included || (prev.quota ?? null) !== (v.quota ?? null)) {
        ops.push({ ...parseKey(k), included: v.included, quota: v.quota });
      }
    }
    for (const [k, prev] of initialMap.entries()) {
      if (seen.has(k)) continue;
      // Exists in initial but not in cells — treat as removed (included=false).
      if (prev.included) ops.push({ ...parseKey(k), included: false, quota: null });
    }
    return ops;
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    const ops = computeDiff();
    if (ops.length === 0) {
      setSuccess(isAr ? 'لا تغييرات' : 'No changes');
      setDirty(false);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/membership/tier-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ops }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      setSuccess(isAr ? `تم حفظ ${data.changes ?? ops.length} تعديلات` : `Saved ${data.changes ?? ops.length} change(s)`);
      setDirty(false);
      setSubmitting(false);
      // Refresh page so initial state reflects server truth
      setTimeout(() => window.location.reload(), 600);
    } catch {
      setError(isAr ? 'تعذّر الاتصال' : 'Connection error');
      setSubmitting(false);
    }
  }

  const sortedTiers = [...tiers].sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug));
  const sortedFeatures = [...features].sort((a, b) => a.feature_key.localeCompare(b.feature_key));

  return (
    <div dir={dir} className="space-y-6">
      {/* Desktop/tablet matrix */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-[var(--color-neutral-100)] bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-primary-50)]/50">
            <tr>
              <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)] sticky start-0 bg-[var(--color-primary-50)]/50">
                {isAr ? 'الميزة' : 'Feature'}
              </th>
              {sortedTiers.map((t) => (
                <th key={t.id} className="px-4 py-3 text-center font-semibold text-[var(--color-neutral-700)]">
                  {isAr ? t.name_ar : t.name_en}
                  <div className="text-xs font-mono text-[var(--color-neutral-400)]">{t.slug}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedFeatures.map((f) => (
              <tr key={f.id} className="border-t border-[var(--color-neutral-100)] hover:bg-[var(--color-primary-50)]/10">
                <td className="px-4 py-3 sticky start-0 bg-white">
                  <div className="font-medium text-[var(--text-primary)]">
                    {isAr ? f.name_ar : f.name_en}
                  </div>
                  <div className="text-xs font-mono text-[var(--color-neutral-500)]">
                    {f.feature_key}
                  </div>
                  <div className="text-xs text-[var(--color-neutral-400)] mt-0.5">
                    {f.feature_type}
                  </div>
                </td>
                {sortedTiers.map((t) => {
                  const cell = getCell(t.id, f.id);
                  return (
                    <td key={t.id} className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <input
                          type="checkbox"
                          checked={cell.included}
                          onChange={() => toggleCell(t.id, f.id)}
                          aria-label={`${isAr ? f.name_ar : f.name_en} / ${isAr ? t.name_ar : t.name_en}`}
                          className="w-5 h-5 cursor-pointer"
                        />
                        {f.feature_type === 'quota' && cell.included && (
                          <input
                            type="number"
                            min={0}
                            step={1}
                            placeholder={isAr ? 'بلا حد' : 'unlimited'}
                            value={cell.quota ?? ''}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              setQuota(t.id, f.id, v === '' ? null : Math.max(0, parseInt(v, 10) || 0));
                            }}
                            className="w-20 text-xs rounded border border-[var(--color-neutral-200)] px-2 py-1 text-center"
                            dir="ltr"
                          />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: vertical stack */}
      <div className="md:hidden space-y-4">
        {sortedFeatures.map((f) => (
          <div key={f.id} className="rounded-xl border border-[var(--color-neutral-100)] bg-white p-4">
            <div className="mb-3">
              <div className="font-medium text-[var(--text-primary)]">
                {isAr ? f.name_ar : f.name_en}
              </div>
              <div className="text-xs font-mono text-[var(--color-neutral-500)]">{f.feature_key}</div>
              <div className="text-xs text-[var(--color-neutral-400)]">{f.feature_type}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {sortedTiers.map((t) => {
                const cell = getCell(t.id, f.id);
                return (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer select-none p-2 rounded border border-[var(--color-neutral-100)]">
                    <input
                      type="checkbox"
                      checked={cell.included}
                      onChange={() => toggleCell(t.id, f.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{isAr ? t.name_ar : t.name_en}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800" role="status">
          {success}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap sticky bottom-0 bg-white/90 backdrop-blur py-3 border-t border-[var(--color-neutral-100)]">
        <button
          onClick={handleSave}
          disabled={submitting || !dirty}
          className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--color-accent-500)] disabled:opacity-60"
        >
          {submitting
            ? (isAr ? 'جارٍ الحفظ…' : 'Saving…')
            : (isAr ? 'حفظ التغييرات' : 'Save changes')}
        </button>
        {dirty && !submitting && (
          <span className="text-xs text-amber-700">
            {isAr ? 'توجد تغييرات غير محفوظة' : 'Unsaved changes'}
          </span>
        )}
      </div>
    </div>
  );
}

function parseKey(k: string): { tier_id: string; feature_id: string } {
  const [tier_id, feature_id] = k.split('::');
  return { tier_id, feature_id };
}
