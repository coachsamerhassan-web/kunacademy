'use client';

import { use, useEffect, useState, type FormEvent } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import {
  PricingRowEditor,
  type PricingRow,
} from '@/components/admin/membership/pricing-row-editor';

const CURRENCY_OPTS = ['AED', 'EGP', 'EUR', 'USD'] as const;
const SNAKE_RE = /^[a-z][a-z0-9_]{0,63}$/;

interface NewRowState {
  entity_type: string;
  entity_key: string;
  value_cents: number;
  currency: string;
  reason: string;
}

const EMPTY_NEW: NewRowState = {
  entity_type: '',
  entity_key: '',
  value_cents: 0,
  currency: 'AED',
  reason: '',
};

export default function AdminMembershipPricing({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const [rows, setRows] = useState<PricingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newRow, setNewRow] = useState<NewRowState>(EMPTY_NEW);
  const [submittingNew, setSubmittingNew] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    fetch('/api/admin/membership/pricing')
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          setError(b.error || `HTTP ${r.status}`);
          return;
        }
        const b = await r.json();
        setRows(b.pricing ?? []);
      })
      .catch(() => setError(isAr ? 'فشل التحميل' : 'Failed to load'));
  }

  function onRowUpdated(updated: PricingRow) {
    setRows((current) => {
      if (!current) return current;
      return current.map((r) => (r.id === updated.id ? updated : r));
    });
  }

  async function handleDelete(row: PricingRow) {
    const msg = isAr
      ? `حذف سعر ${row.entity_type}/${row.entity_key}؟`
      : `Delete pricing row ${row.entity_type}/${row.entity_key}?`;
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/admin/membership/pricing/${row.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || `HTTP ${res.status}`);
        return;
      }
      setRows((current) => current?.filter((r) => r.id !== row.id) ?? null);
    } catch {
      alert(isAr ? 'تعذّر الاتصال' : 'Connection error');
    }
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNewError(null);
    if (!SNAKE_RE.test(newRow.entity_type)) {
      setNewError(isAr ? 'نوع الكيان يجب أن يكون snake_case' : 'entity_type must be snake_case');
      return;
    }
    if (!newRow.entity_key || newRow.entity_key.length > 128) {
      setNewError(isAr ? 'مفتاح الكيان مطلوب' : 'entity_key required');
      return;
    }
    if (!Number.isFinite(newRow.value_cents) || newRow.value_cents < 0) {
      setNewError(isAr ? 'القيمة غير صالحة' : 'Invalid value_cents');
      return;
    }
    setSubmittingNew(true);
    try {
      const res = await fetch('/api/admin/membership/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: newRow.entity_type,
          entity_key: newRow.entity_key,
          value_cents: newRow.value_cents,
          currency: newRow.currency || null,
          reason: newRow.reason || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNewError(data.error || `HTTP ${res.status}`);
        setSubmittingNew(false);
        return;
      }
      setSubmittingNew(false);
      setNewRow(EMPTY_NEW);
      setShowNew(false);
      load();
    } catch {
      setNewError(isAr ? 'تعذّر الاتصال' : 'Connection error');
      setSubmittingNew(false);
    }
  }

  return (
    <Section variant="white">
      <div dir={dir}>
        <div className="mb-6">
          <a
            href={`/${locale}/admin/membership`}
            className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)]"
          >
            {isAr ? '← الاشتراكات' : '← Membership'}
          </a>
        </div>

        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1
              className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'الأسعار القابلة للتحرير' : 'Editable pricing'}
            </h1>
            <p className="text-[var(--color-neutral-600)]">
              {isAr
                ? 'أسعار الجلسات والاشتراكات ونسب الخصم — كلها قابلة للتحرير من هنا مع سجل تدقيق لكل تغيير.'
                : 'Session rates, subscription rates, discount percentages — all editable with an audit trail for every change.'}
            </p>
          </div>
          <button
            onClick={() => setShowNew(!showNew)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--color-accent-500)]"
          >
            {showNew ? (isAr ? 'إغلاق' : 'Close') : (isAr ? '+ سعر جديد' : '+ New pricing row')}
          </button>
        </div>

        {showNew && (
          <Card className="p-6 mb-6 border-2 border-[var(--color-accent)]/30">
            <form onSubmit={handleCreate} className="space-y-4">
              <h2 className="text-lg font-semibold" style={{ fontFamily: headingFont }}>
                {isAr ? 'إنشاء سعر جديد' : 'Create new pricing row'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">
                    {isAr ? 'نوع الكيان (entity_type)' : 'entity_type'}
                  </label>
                  <input
                    type="text"
                    value={newRow.entity_type}
                    onChange={(e) => setNewRow({ ...newRow, entity_type: e.target.value.toLowerCase().trim() })}
                    required
                    className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 font-mono"
                    dir="ltr"
                  />
                  <span className="text-xs text-[var(--color-neutral-500)]">
                    {isAr ? 'أمثلة: coach_session، samer_session، program_discount' : 'Examples: coach_session, samer_session, program_discount'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">entity_key</label>
                  <input
                    type="text"
                    value={newRow.entity_key}
                    onChange={(e) => setNewRow({ ...newRow, entity_key: e.target.value })}
                    required
                    maxLength={128}
                    className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 font-mono"
                    dir="ltr"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">value_cents</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={newRow.value_cents}
                    onChange={(e) => setNewRow({ ...newRow, value_cents: parseInt(e.target.value, 10) || 0 })}
                    required
                    className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2"
                    dir="ltr"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">{isAr ? 'العملة' : 'Currency'}</label>
                  <select
                    value={newRow.currency}
                    onChange={(e) => setNewRow({ ...newRow, currency: e.target.value })}
                    className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 bg-white"
                    dir="ltr"
                  >
                    <option value="">—</option>
                    {CURRENCY_OPTS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <span className="text-xs text-[var(--color-neutral-500)]">
                    {isAr ? 'اتركه فارغاً للنِسب المئوية' : 'Leave blank for percentages'}
                  </span>
                </div>
              </div>
              <input
                type="text"
                value={newRow.reason}
                onChange={(e) => setNewRow({ ...newRow, reason: e.target.value })}
                placeholder={isAr ? 'سبب الإنشاء (اختياري)' : 'Creation reason (optional)'}
                maxLength={500}
                className="w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
              />
              {newError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800" role="alert">
                  {newError}
                </div>
              )}
              <button
                type="submit"
                disabled={submittingNew}
                className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--color-accent-500)] disabled:opacity-60"
              >
                {submittingNew ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'إنشاء' : 'Create')}
              </button>
            </form>
          </Card>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 mb-6">
            {error}
          </div>
        )}

        {rows === null && !error && (
          <p className="text-[var(--color-neutral-500)]">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-neutral-100)] bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-primary-50)]/50">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">entity_type</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">entity_key</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'العملة' : 'Currency'}</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'القيمة' : 'Value'}</th>
                  <th className="px-4 py-3 text-start font-semibold text-[var(--color-neutral-700)]">{isAr ? 'آخر تعديل' : 'Updated'}</th>
                  <th className="px-4 py-3 text-end font-semibold text-[var(--color-neutral-700)]"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <PricingRowEditor
                    key={row.id}
                    locale={locale}
                    row={row}
                    onUpdated={onRowUpdated}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {rows.map((row) => (
              <button
                key={`del-${row.id}`}
                onClick={() => handleDelete(row)}
                className="text-xs text-red-700 hover:underline opacity-40 hover:opacity-100"
              >
                {isAr ? 'حذف' : 'delete'} {row.entity_type}/{row.entity_key}
              </button>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
