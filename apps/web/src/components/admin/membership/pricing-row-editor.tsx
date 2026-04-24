'use client';

/**
 * PricingRowEditor — inline row editor for pricing_config.
 *
 * Each row binds to a single (entity_type, entity_key, currency) tuple.
 * Admin toggles to edit mode → modifies value_cents (+ optional change_reason) → save.
 * On save, API writes the new value + audit row in same transaction.
 *
 * For percentage rows (entity_type='program_discount' | 'early_bird'),
 * value_cents is stored as (percent × 100) — e.g. 1000 = 10.00%. UI formats
 * both displays clearly.
 */

import { useState } from 'react';

export interface PricingRow {
  id: string;
  entity_type: string;
  entity_key: string;
  value_cents: number | null;
  currency: string | null;
  updated_at: string;
  updated_by: string | null;
}

interface PricingRowEditorProps {
  locale: string;
  row: PricingRow;
  onUpdated: (updated: PricingRow) => void;
}

const PERCENT_ENTITIES = new Set(['program_discount', 'early_bird']);

export function PricingRowEditor({ locale, row, onUpdated }: PricingRowEditorProps) {
  const isAr = locale === 'ar';
  const isPercent = PERCENT_ENTITIES.has(row.entity_type);

  const [editing, setEditing] = useState(false);
  const [valueCents, setValueCents] = useState<number>(row.value_cents ?? 0);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function formatDisplay(cents: number | null): string {
    if (cents === null || cents === undefined) return '—';
    if (isPercent) return `${(cents / 100).toFixed(2)}%`;
    const majorUnits = (cents / 100).toFixed(2);
    return row.currency ? `${majorUnits} ${row.currency}` : majorUnits;
  }

  async function handleSave() {
    setError(null);
    if (!Number.isFinite(valueCents) || valueCents < 0) {
      setError(isAr ? 'القيمة غير صالحة' : 'Invalid value');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/membership/pricing/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value_cents: Math.round(valueCents),
          reason: reason.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      onUpdated(data.row as PricingRow);
      setEditing(false);
      setReason('');
      setSubmitting(false);
    } catch {
      setError(isAr ? 'تعذّر الاتصال' : 'Connection error');
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setValueCents(row.value_cents ?? 0);
    setReason('');
    setError(null);
    setEditing(false);
  }

  // Wrap ISO dates in <bdi dir="ltr"> to prevent BiDi reordering in RTL.
  const updatedAtStr = new Date(row.updated_at).toISOString().split('T')[0];

  return (
    <tr className="border-t border-[var(--color-neutral-100)]">
      <td className="px-4 py-3 font-mono text-xs text-[var(--color-neutral-700)]">
        {row.entity_type}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-[var(--color-neutral-700)]">
        {row.entity_key}
      </td>
      <td className="px-4 py-3">
        <span className="text-[var(--color-neutral-500)]">{row.currency ?? '—'}</span>
      </td>
      <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              type="number"
              min={0}
              step={1}
              value={valueCents}
              onChange={(e) => setValueCents(parseInt(e.target.value, 10) || 0)}
              disabled={submitting}
              className="w-32 rounded-lg border border-[var(--color-neutral-200)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--color-primary)]"
              dir="ltr"
            />
            <span className="text-xs text-[var(--color-neutral-500)]">
              = {formatDisplay(valueCents)}
            </span>
            <input
              type="text"
              placeholder={isAr ? 'سبب التغيير (اختياري)' : 'Change reason (optional)'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              maxLength={500}
              className="rounded-lg border border-[var(--color-neutral-200)] px-2 py-1 text-xs focus:outline-none focus:border-[var(--color-primary)]"
            />
            {error && (
              <span className="text-xs text-red-700" role="alert">{error}</span>
            )}
          </div>
        ) : (
          <span>{formatDisplay(row.value_cents)}</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-[var(--color-neutral-500)]">
        <bdi dir="ltr">{updatedAtStr}</bdi>
      </td>
      <td className="px-4 py-3 text-end whitespace-nowrap">
        {editing ? (
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleSave}
              disabled={submitting}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--color-accent-500)] disabled:opacity-60"
            >
              {submitting ? (isAr ? '…' : '…') : (isAr ? 'حفظ' : 'Save')}
            </button>
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1 text-xs font-semibold text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-50)] disabled:opacity-60"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            {isAr ? 'تعديل' : 'edit'}
          </button>
        )}
      </td>
    </tr>
  );
}
