'use client';

/**
 * /admin/coupons — Wave F.5 admin UI for the coupon table.
 *
 * Three tabs:
 *   1. Coupons — CRUD list + create form
 *   2. Redemptions — log view with filters
 *   3. Export — CSV download trigger
 *
 * Bilingual (AR/EN). Mobile-first; desktop table view.
 */

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Download, ExternalLink } from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  currency: string | null;
  redemptions_max: number | null;
  redemptions_used: number;
  valid_from: string | null;
  valid_to: string | null;
  single_use_per_customer: boolean;
  scope_kind: 'all' | 'programs' | 'tiers';
  scope_program_ids: string[];
  scope_tier_ids: string[];
  admin_override: boolean;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface Redemption {
  id: string;
  coupon_id: string;
  coupon_code: string | null;
  coupon_type: string | null;
  coupon_value: number | null;
  customer_id: string | null;
  customer_email: string | null;
  customer_name_en: string | null;
  customer_name_ar: string | null;
  order_id: string | null;
  amount_applied: number;
  currency: string;
  redeemed_at: string;
}

interface Program {
  id: string;
  slug: string;
  title_en: string;
  title_ar: string;
  member_discount_eligible: boolean | null;
}

interface Tier {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
}

const CURRENCIES = ['AED', 'EGP', 'USD', 'EUR'] as const;
const inputClass =
  'w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function statusBadge(c: Coupon): { label: string; arLabel: string; color: string } {
  const now = Date.now();
  if (!c.is_active) return { label: 'Inactive', arLabel: 'غير نشط', color: 'bg-red-100 text-red-700' };
  if (c.valid_to && new Date(c.valid_to).getTime() < now) {
    return { label: 'Expired', arLabel: 'منتهي', color: 'bg-amber-100 text-amber-700' };
  }
  if (c.valid_from && new Date(c.valid_from).getTime() > now) {
    return { label: 'Scheduled', arLabel: 'مجدول', color: 'bg-sky-100 text-sky-700' };
  }
  if (c.redemptions_max && c.redemptions_used >= c.redemptions_max) {
    return { label: 'Exhausted', arLabel: 'مستنفد', color: 'bg-purple-100 text-purple-700' };
  }
  return { label: 'Active', arLabel: 'نشط', color: 'bg-green-100 text-green-700' };
}

export default function AdminCouponsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const [tab, setTab] = useState<'coupons' | 'redemptions'>('coupons');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filterCouponId, setFilterCouponId] = useState<string>('');
  const [filterSince, setFilterSince] = useState<string>('');
  const [filterUntil, setFilterUntil] = useState<string>('');

  const [form, setForm] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    currency: 'AED',
    redemptions_max: '',
    valid_from: '',
    valid_to: '',
    single_use_per_customer: false,
    scope_kind: 'all' as 'all' | 'programs' | 'tiers',
    scope_program_ids: [] as string[],
    scope_tier_ids: [] as string[],
    admin_override: false,
    description: '',
    is_active: true,
  });

  function resetForm() {
    setForm({
      code: '',
      type: 'percentage',
      value: '',
      currency: 'AED',
      redemptions_max: '',
      valid_from: '',
      valid_to: '',
      single_use_per_customer: false,
      scope_kind: 'all',
      scope_program_ids: [],
      scope_tier_ids: [],
      admin_override: false,
      description: '',
      is_active: true,
    });
    setError(null);
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const [cRes, pRes, tRes] = await Promise.all([
        fetch('/api/admin/coupons'),
        fetch('/api/admin/membership/programs').catch(() => fetch('/api/admin/programs')),
        fetch('/api/admin/membership/tiers'),
      ]);
      const cData = await cRes.json().catch(() => ({}));
      const pData = await pRes.json().catch(() => ({}));
      const tData = await tRes.json().catch(() => ({}));
      setCoupons(cData.coupons ?? []);
      setPrograms(pData.programs ?? []);
      setTiers(tData.tiers ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRedemptions() {
    const params = new URLSearchParams();
    if (filterCouponId) params.set('coupon_id', filterCouponId);
    if (filterSince) params.set('since', new Date(filterSince).toISOString());
    if (filterUntil) params.set('until', new Date(filterUntil).toISOString());
    const res = await fetch(`/api/admin/coupons/redemptions?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    setRedemptions(data.redemptions ?? []);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) {
      router.push('/' + locale + '/auth/login');
      return;
    }
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading]);

  useEffect(() => {
    if (tab === 'redemptions') fetchRedemptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleCreate() {
    setError(null);
    const code = form.code.toUpperCase().trim();
    if (!code) { setError(isAr ? 'الكود مطلوب' : 'Code is required'); return; }
    if (!/^[A-Z0-9][A-Z0-9-]{3,31}$/.test(code)) {
      setError(isAr ? 'كود غير صالح' : 'Invalid code format');
      return;
    }
    if (!form.value || !Number.isFinite(Number(form.value)) || Number(form.value) <= 0) {
      setError(isAr ? 'قيمة الخصم مطلوبة' : 'Discount value is required');
      return;
    }
    if (form.type === 'fixed' && !form.currency) {
      setError(isAr ? 'العملة مطلوبة للخصم الثابت' : 'Currency required for fixed coupon');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code,
        type: form.type,
        value: form.type === 'fixed'
          ? Math.round(Number(form.value) * 100) // form value is whole amount; store cents
          : Math.round(Number(form.value)),       // for percentage, store as int
        currency: form.type === 'fixed' ? form.currency : null,
        redemptions_max: form.redemptions_max ? Number(form.redemptions_max) : null,
        valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
        valid_to: form.valid_to ? new Date(form.valid_to).toISOString() : null,
        single_use_per_customer: form.single_use_per_customer,
        scope_kind: form.scope_kind,
        scope_program_ids: form.scope_kind === 'programs' ? form.scope_program_ids : [],
        scope_tier_ids: form.scope_kind === 'tiers' ? form.scope_tier_ids : [],
        admin_override: form.admin_override,
        description: form.description || null,
        is_active: form.is_active,
      };
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'error'); return; }
      setShowCreate(false);
      resetForm();
      await fetchAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(c: Coupon) {
    setActionId(c.id);
    try {
      await fetch(`/api/admin/coupons/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      setCoupons((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: !x.is_active } : x)));
    } finally {
      setActionId(null);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm(isAr ? 'هل تريد إلغاء تفعيل هذا الكوبون؟' : 'Deactivate this coupon?')) return;
    setActionId(id);
    try {
      await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
      setCoupons((prev) => prev.map((x) => (x.id === id ? { ...x, is_active: false } : x)));
    } finally {
      setActionId(null);
    }
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (filterCouponId) params.set('coupon_id', filterCouponId);
    if (filterSince) params.set('since', new Date(filterSince).toISOString());
    if (filterUntil) params.set('until', new Date(filterUntil).toISOString());
    window.location.href = `/api/admin/coupons/redemptions/export?${params.toString()}`;
  }

  function toggleProgram(pid: string) {
    setForm((f) => ({
      ...f,
      scope_program_ids: f.scope_program_ids.includes(pid)
        ? f.scope_program_ids.filter((x) => x !== pid)
        : [...f.scope_program_ids, pid],
    }));
  }
  function toggleTier(tid: string) {
    setForm((f) => ({
      ...f,
      scope_tier_ids: f.scope_tier_ids.includes(tid)
        ? f.scope_tier_ids.filter((x) => x !== tid)
        : [...f.scope_tier_ids, tid],
    }));
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] grid place-items-center" dir={dir}>
        <div className="text-sm text-[var(--color-text-secondary)]">
          {isAr ? 'جارٍ التحميل...' : 'Loading...'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]" dir={dir}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/' + locale + '/admin/membership')}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] inline-flex items-center gap-1 text-sm"
              aria-label={isAr ? 'رجوع' : 'Back'}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isAr ? 'رجوع' : 'Back'}</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-semibold">
              {isAr ? 'كوبونات الخصم' : 'Discount Coupons'}
            </h1>
          </div>
          <button
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] text-white px-4 py-2 text-sm hover:opacity-90 min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? 'كوبون جديد' : 'New Coupon'}</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-[var(--color-neutral-200)] mb-4">
          <nav className="flex gap-4" role="tablist">
            <button
              onClick={() => setTab('coupons')}
              role="tab"
              aria-selected={tab === 'coupons'}
              className={`px-3 py-2 text-sm border-b-2 ${tab === 'coupons' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-secondary)]'}`}
            >
              {isAr ? `الكوبونات (${coupons.length})` : `Coupons (${coupons.length})`}
            </button>
            <button
              onClick={() => setTab('redemptions')}
              role="tab"
              aria-selected={tab === 'redemptions'}
              className={`px-3 py-2 text-sm border-b-2 ${tab === 'redemptions' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-secondary)]'}`}
            >
              {isAr ? 'سجل الاستبدالات' : 'Redemptions Log'}
            </button>
          </nav>
        </div>

        {/* Coupons tab */}
        {tab === 'coupons' && (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-neutral-200)] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-neutral-50)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-3 py-2 text-start">{isAr ? 'الكود' : 'Code'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'النوع' : 'Type'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'القيمة' : 'Value'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'الاستخدام' : 'Usage'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'النطاق' : 'Scope'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'الصلاحية' : 'Validity'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-3 py-2 text-end">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {coupons.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[var(--color-text-secondary)]">
                      {isAr ? 'لا توجد كوبونات' : 'No coupons yet'}
                    </td>
                  </tr>
                )}
                {coupons.map((c) => {
                  const s = statusBadge(c);
                  return (
                    <tr key={c.id} className="border-t border-[var(--color-neutral-100)]">
                      <td className="px-3 py-2 font-mono">{c.code}</td>
                      <td className="px-3 py-2">{c.type === 'percentage' ? '%' : (isAr ? 'ثابت' : 'Fixed')}</td>
                      <td className="px-3 py-2">
                        {c.type === 'percentage'
                          ? `${c.value}%`
                          : (c.currency ? formatMoney(c.value, c.currency) : c.value)}
                      </td>
                      <td className="px-3 py-2">
                        {c.redemptions_used}
                        {c.redemptions_max ? ` / ${c.redemptions_max}` : (isAr ? ' / ∞' : ' / ∞')}
                        {c.single_use_per_customer && (
                          <span className="ml-1 inline-block text-[10px] uppercase bg-blue-100 text-blue-700 rounded px-1">
                            {isAr ? '1×زبون' : '1×customer'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 capitalize">
                        {c.scope_kind === 'all' && (isAr ? 'الكل' : 'all')}
                        {c.scope_kind === 'programs' && `${isAr ? 'برامج' : 'programs'} (${c.scope_program_ids.length})`}
                        {c.scope_kind === 'tiers' && `${isAr ? 'فئات' : 'tiers'} (${c.scope_tier_ids.length})`}
                        {c.admin_override && (
                          <span className="ml-1 inline-block text-[10px] uppercase bg-amber-100 text-amber-800 rounded px-1">
                            {isAr ? 'تجاوز' : 'override'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {c.valid_from && <div>{new Date(c.valid_from).toLocaleDateString()}</div>}
                        {c.valid_to && <div>→ {new Date(c.valid_to).toLocaleDateString()}</div>}
                        {!c.valid_from && !c.valid_to && (isAr ? 'مفتوح' : 'open')}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs ${s.color}`}>
                          {isAr ? s.arLabel : s.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-end whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(c)}
                          disabled={actionId === c.id}
                          className="text-xs underline text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] mx-1"
                        >
                          {c.is_active ? (isAr ? 'إيقاف' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}
                        </button>
                        <button
                          onClick={() => handleDeactivate(c.id)}
                          disabled={actionId === c.id || !c.is_active}
                          className="text-xs underline text-red-600 hover:text-red-700 mx-1 disabled:opacity-30"
                        >
                          {isAr ? 'إلغاء' : 'Deactivate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Redemptions tab */}
        {tab === 'redemptions' && (
          <div>
            <div className="flex items-end gap-3 flex-wrap mb-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                  {isAr ? 'الكوبون' : 'Coupon'}
                </label>
                <select
                  value={filterCouponId}
                  onChange={(e) => setFilterCouponId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{isAr ? 'كل الكوبونات' : 'All coupons'}</option>
                  {coupons.map((c) => (
                    <option key={c.id} value={c.id}>{c.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                  {isAr ? 'منذ' : 'Since'}
                </label>
                <input type="date" value={filterSince} onChange={(e) => setFilterSince(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                  {isAr ? 'حتى' : 'Until'}
                </label>
                <input type="date" value={filterUntil} onChange={(e) => setFilterUntil(e.target.value)} className={inputClass} />
              </div>
              <button
                onClick={fetchRedemptions}
                className="rounded-lg bg-[var(--color-primary)] text-white px-4 py-2 text-sm hover:opacity-90 min-h-[44px]"
              >
                {isAr ? 'تطبيق' : 'Apply'}
              </button>
              <button
                onClick={exportCsv}
                className="rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm hover:bg-[var(--color-neutral-50)] min-h-[44px] inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>CSV</span>
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[var(--color-neutral-200)] bg-white">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-neutral-50)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="px-3 py-2 text-start">{isAr ? 'الكود' : 'Code'}</th>
                    <th className="px-3 py-2 text-start">{isAr ? 'الزبون' : 'Customer'}</th>
                    <th className="px-3 py-2 text-start">{isAr ? 'القيمة' : 'Amount'}</th>
                    <th className="px-3 py-2 text-start">{isAr ? 'الطلب' : 'Order'}</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-[var(--color-text-secondary)]">
                        {isAr ? 'لا توجد استبدالات' : 'No redemptions match filter'}
                      </td>
                    </tr>
                  )}
                  {redemptions.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--color-neutral-100)]">
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {new Date(r.redeemed_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono">{r.coupon_code}</td>
                      <td className="px-3 py-2">{r.customer_email ?? '—'}</td>
                      <td className="px-3 py-2">
                        {formatMoney(r.amount_applied, r.currency)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.order_id ? r.order_id.slice(0, 8) + '…' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/40 z-40 grid place-items-center p-4" onClick={() => setShowCreate(false)}>
            <div
              className="bg-white rounded-xl p-5 max-w-2xl w-full max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{isAr ? 'كوبون جديد' : 'New Coupon'}</h2>
                <button onClick={() => setShowCreate(false)} aria-label="Close" className="p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-3 rounded-md bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1">{isAr ? 'الكود' : 'Code'}</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className={`${inputClass} font-mono`}
                    placeholder="WELCOME20"
                    maxLength={32}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">{isAr ? 'النوع' : 'Type'}</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'percentage' | 'fixed' }))}
                    className={inputClass}
                  >
                    <option value="percentage">{isAr ? 'نسبة %' : 'Percentage %'}</option>
                    <option value="fixed">{isAr ? 'مبلغ ثابت' : 'Fixed amount'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">
                    {form.type === 'percentage'
                      ? (isAr ? 'النسبة (1-100)' : 'Percentage (1-100)')
                      : (isAr ? 'المبلغ (بالعملة الكاملة)' : 'Amount (whole units)')}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    className={inputClass}
                    min={1}
                    max={form.type === 'percentage' ? 100 : undefined}
                  />
                </div>
                {form.type === 'fixed' && (
                  <div>
                    <label className="block text-xs mb-1">{isAr ? 'العملة' : 'Currency'}</label>
                    <select
                      value={form.currency}
                      onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                      className={inputClass}
                    >
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs mb-1">{isAr ? 'حد الاستبدالات' : 'Max redemptions'}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.redemptions_max}
                    onChange={(e) => setForm((f) => ({ ...f, redemptions_max: e.target.value }))}
                    className={inputClass}
                    placeholder={isAr ? 'بدون حد' : 'unlimited'}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">{isAr ? 'صالح من' : 'Valid from'}</label>
                  <input
                    type="datetime-local"
                    value={form.valid_from}
                    onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">{isAr ? 'صالح حتى' : 'Valid until'}</label>
                  <input
                    type="datetime-local"
                    value={form.valid_to}
                    onChange={(e) => setForm((f) => ({ ...f, valid_to: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    id="single_use"
                    type="checkbox"
                    checked={form.single_use_per_customer}
                    onChange={(e) => setForm((f) => ({ ...f, single_use_per_customer: e.target.checked }))}
                  />
                  <label htmlFor="single_use" className="text-sm">
                    {isAr ? 'استخدام واحد لكل زبون' : 'Single use per customer'}
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs mb-1">{isAr ? 'النطاق' : 'Scope'}</label>
                  <select
                    value={form.scope_kind}
                    onChange={(e) => setForm((f) => ({ ...f, scope_kind: e.target.value as 'all' | 'programs' | 'tiers' }))}
                    className={inputClass}
                  >
                    <option value="all">{isAr ? 'كل البرامج / الفئات' : 'All programs/tiers'}</option>
                    <option value="programs">{isAr ? 'برامج محددة' : 'Specific programs'}</option>
                    <option value="tiers">{isAr ? 'فئات محددة' : 'Specific tiers'}</option>
                  </select>
                </div>
                {form.scope_kind === 'programs' && (
                  <div className="sm:col-span-2 max-h-40 overflow-auto rounded border border-[var(--color-neutral-200)] p-2 text-sm">
                    {programs.length === 0 && (
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {isAr ? 'لا توجد برامج' : 'No programs'}
                      </div>
                    )}
                    {programs.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={form.scope_program_ids.includes(p.id)}
                          onChange={() => toggleProgram(p.id)}
                        />
                        <span className="text-xs">{isAr ? p.title_ar : p.title_en}</span>
                        {p.member_discount_eligible === false && (
                          <span className="text-[10px] uppercase bg-amber-100 text-amber-800 rounded px-1">
                            {isAr ? 'مستثنى' : 'F-W4'}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                {form.scope_kind === 'tiers' && (
                  <div className="sm:col-span-2 max-h-40 overflow-auto rounded border border-[var(--color-neutral-200)] p-2 text-sm">
                    {tiers.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={form.scope_tier_ids.includes(t.id)}
                          onChange={() => toggleTier(t.id)}
                        />
                        <span className="text-xs">{isAr ? t.name_ar : t.name_en}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    id="admin_override"
                    type="checkbox"
                    checked={form.admin_override}
                    onChange={(e) => setForm((f) => ({ ...f, admin_override: e.target.checked }))}
                  />
                  <label htmlFor="admin_override" className="text-sm">
                    {isAr
                      ? 'تجاوز قاعدة F-W4 (يسمح بالخصم على STFC وريادة الأعمال)'
                      : 'Admin override — bypass F-W4 (allow on STFC + entrepreneurs)'}
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs mb-1">
                    {isAr ? 'الوصف الإداري (اختياري)' : 'Admin description (optional)'}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className={inputClass}
                    maxLength={500}
                    rows={2}
                    placeholder={isAr
                      ? 'لا تكتب تفاصيل المنهجية هنا — وصف إداري فقط'
                      : 'Internal note only — never publish program methodology'}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm min-h-[44px]"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="rounded-lg bg-[var(--color-primary)] text-white px-4 py-2 text-sm hover:opacity-90 min-h-[44px] disabled:opacity-50"
                >
                  {saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'إنشاء' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
