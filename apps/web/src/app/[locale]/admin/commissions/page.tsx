'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter, usePathname } from 'next/navigation';
import type { CommissionRate, Earning, PayoutRequest, CoachProfile } from '@/types/commission-system';
import { ArrowLeft } from 'lucide-react';

// Extended types for API responses with joined data
interface EarningWithCoach extends Earning {
  profiles?: { full_name: string } | null;
}

interface PayoutWithCoach extends PayoutRequest {
  profiles?: { full_name: string } | null;
}

const statusColors: Record<string, string> = {
  pending: '#EAB308',
  available: '#22C55E',
  paid_out: '#3B82F6',
  cancelled: '#EF4444',
  requested: '#EAB308',
  approved: '#22C55E',
  processing: '#3B82F6',
  completed: '#3B82F6',
  rejected: '#EF4444',
};

const statusLabelsAr: Record<string, string> = {
  pending: 'قيد الانتظار',
  available: 'متاح',
  paid_out: 'تم الصرف',
  cancelled: 'ملغى',
  requested: 'مطلوب',
  approved: 'موافق عليه',
  processed: 'مكتمل',
  rejected: 'مرفوض',
};

function formatAmount(amount: number, currency: string): string {
  return `${(amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency}`;
}

function formatDate(dateStr: string, isAr: boolean): string {
  return new Date(dateStr).toLocaleDateString(isAr ? 'ar-AE' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminCommissionsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAr = locale === 'ar';

  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [earnings, setEarnings] = useState<EarningWithCoach[]>([]);
  const [payouts, setPayouts] = useState<PayoutWithCoach[]>([]);
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Global rate editing
  const [serviceRate, setServiceRate] = useState('');
  const [productRate, setProductRate] = useState('');
  const [savingRates, setSavingRates] = useState(false);

  // Coach override form
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideCoachId, setOverrideCoachId] = useState('');
  const [overrideRate, setOverrideRate] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Payout action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchAll() {
    // All routes now use session-cookie auth — no Bearer token needed
    const ratesRes = await fetch('/api/commissions');
    if (ratesRes.ok) {
      const data = await ratesRes.json();
      setRates(data.rates ?? []);
      const globals = (data.rates ?? []).filter((r: CommissionRate) => r.scope === 'global');
      const sorted = globals.sort((a: CommissionRate, b: CommissionRate) => Number(b.rate_pct) - Number(a.rate_pct));
      if (sorted.length >= 2) {
        setServiceRate(String(sorted[0].rate_pct));
        setProductRate(String(sorted[1].rate_pct));
      } else if (sorted.length === 1) {
        setServiceRate(String(sorted[0].rate_pct));
      }
    }

    const earningsRes = await fetch('/api/admin/earnings-list');
    if (earningsRes.ok) {
      const data = await earningsRes.json();
      setEarnings((data.earnings as EarningWithCoach[]) ?? []);
    }

    const payoutsRes = await fetch('/api/payouts');
    if (payoutsRes.ok) {
      const data = await payoutsRes.json();
      setPayouts(data.payouts ?? []);
    }

    const coachesRes = await fetch('/api/admin/coaches-list');
    if (coachesRes.ok) {
      const data = await coachesRes.json();
      setCoaches((data.coaches as CoachProfile[]) ?? []);
    }

    setLoading(false);
  }

  async function saveGlobalRate(scope: 'service' | 'product', newRate: string) {
    setSavingRates(true);

    const globals = rates.filter((r) => r.scope === 'global');
    const sorted = globals.sort((a, b) => Number(b.rate_pct) - Number(a.rate_pct));
    const target = scope === 'service' ? sorted[0] : sorted[sorted.length - 1];

    if (target) {
      await fetch('/api/commissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'global', scope_id: null, rate: parseFloat(newRate) }),
      });
    }

    await fetchAll();
    setSavingRates(false);
  }

  async function addCoachOverride() {
    if (!overrideCoachId || !overrideRate) return;

    await fetch('/api/commissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'coach',
        scope_id: overrideCoachId,
        rate: parseFloat(overrideRate),
      }),
    });

    setOverrideCoachId('');
    setOverrideRate('');
    setShowOverrideForm(false);
    fetchAll();
  }

  async function deleteCoachOverride(rateId: string) {
    await fetch(`/api/commissions?id=${rateId}`, { method: 'DELETE' });
    fetchAll();
  }

  async function handlePayoutAction(payoutId: string, action: 'approve' | 'reject' | 'complete') {
    setActionLoading(payoutId);

    await fetch('/api/payouts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payout_id: payoutId, action }),
    });

    await fetchAll();
    setActionLoading(null);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) {
      router.push('/' + locale + '/auth/login?redirect=' + encodeURIComponent(pathname));
      return;
    }
    fetchAll();
  }, [user, profile, authLoading]);

  if (authLoading || loading) {
    return (
      <Section>
        <p className="text-center py-12">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p>
      </Section>
    );
  }

  // Coach overrides from rates
  const coachOverrides = rates.filter((r) => r.scope === 'coach');

  // Filtered earnings
  const filteredEarnings = earnings.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (searchQuery) {
      const name = (e.profiles as any)?.full_name || '';
      if (!name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        <div className="flex items-center justify-between mb-8">
          <Heading level={1} className={isAr ? 'font-[var(--font-arabic-heading)]' : ''}>
            {isAr ? 'إدارة العمولات' : 'Commission Management'}
          </Heading>
          <a
            href={`/${locale}/admin`}
            className="text-[var(--color-primary)] text-sm hover:underline"
          >
            <><ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'لوحة الإدارة' : 'Dashboard'}</>
          </a>
        </div>

        {/* ── Global Rates ── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--color-neutral-100)] mb-8">
          <h2 className="text-lg font-semibold mb-4">
            {isAr ? 'النسب العامة' : 'Global Rates'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Service Rate */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {isAr ? 'عمولة الخدمات (%)' : 'Service Commission (%)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={serviceRate}
                  onChange={(e) => setServiceRate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[var(--color-neutral-200)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                />
                <button
                  onClick={() => saveGlobalRate('service', serviceRate)}
                  disabled={savingRates}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary, #474099)' }}
                >
                  {isAr ? 'حفظ' : 'Save'}
                </button>
              </div>
            </div>
            {/* Product Rate */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {isAr ? 'عمولة المنتجات (%)' : 'Product Commission (%)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={productRate}
                  onChange={(e) => setProductRate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[var(--color-neutral-200)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                />
                <button
                  onClick={() => saveGlobalRate('product', productRate)}
                  disabled={savingRates}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary, #474099)' }}
                >
                  {isAr ? 'حفظ' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Per-Coach Overrides ── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--color-neutral-100)] mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {isAr ? 'نسب خاصة بالكوتش' : 'Per-Coach Overrides'}
            </h2>
            <button
              onClick={() => setShowOverrideForm(!showOverrideForm)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--color-primary, #474099)' }}
            >
              {showOverrideForm
                ? (isAr ? 'إلغاء' : 'Cancel')
                : (isAr ? '+ إضافة نسبة' : '+ Add Override')}
            </button>
          </div>

          {showOverrideForm && (
            <div className="flex gap-3 mb-4 items-end flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium mb-1">
                  {isAr ? 'الكوتش' : 'Coach'}
                </label>
                <select
                  value={overrideCoachId}
                  onChange={(e) => setOverrideCoachId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-neutral-200)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">{isAr ? 'اختر كوتش' : 'Select coach'}</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium mb-1">
                  {isAr ? 'النسبة %' : 'Rate %'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={overrideRate}
                  onChange={(e) => setOverrideRate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-neutral-200)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                />
              </div>
              <button
                onClick={addCoachOverride}
                disabled={!overrideCoachId || !overrideRate}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#22C55E' }}
              >
                {isAr ? 'إضافة' : 'Add'}
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--color-neutral-200)]">
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'الكوتش' : 'Coach'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'النسبة' : 'Custom Rate'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'إجراء' : 'Action'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {coachOverrides.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-[var(--color-neutral-400)]">
                      {isAr ? 'لا توجد نسب خاصة' : 'No overrides set'}
                    </td>
                  </tr>
                ) : (
                  coachOverrides.map((r) => {
                    const coach = coaches.find((c) => c.id === r.scope_id);
                    return (
                      <tr key={r.id} className="border-b border-[var(--color-neutral-100)]">
                        <td className="px-3 py-2">{coach?.full_name ?? r.scope_id}</td>
                        <td className="px-3 py-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {Number(r.rate_pct).toFixed(1)}%
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => deleteCoachOverride(r.id)}
                            className="text-[#EF4444] text-xs hover:underline"
                          >
                            {isAr ? 'حذف' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── All Earnings ── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--color-neutral-100)] mb-8">
          <h2 className="text-lg font-semibold mb-4">
            {isAr ? 'جميع الأرباح' : 'All Earnings'}
          </h2>
          <div className="flex gap-3 mb-4 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[var(--color-neutral-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="all">{isAr ? 'كل الحالات' : 'All Statuses'}</option>
              <option value="pending">{isAr ? 'قيد الانتظار' : 'Pending'}</option>
              <option value="available">{isAr ? 'متاح' : 'Available'}</option>
              <option value="paid_out">{isAr ? 'تم الصرف' : 'Paid Out'}</option>
              <option value="cancelled">{isAr ? 'ملغى' : 'Cancelled'}</option>
            </select>
            <input
              type="text"
              placeholder={isAr ? 'بحث بالاسم...' : 'Search by coach...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[var(--color-neutral-200)] text-sm flex-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <p className="text-xs text-[var(--color-neutral-400)] mb-3">
            {filteredEarnings.length} {isAr ? 'سجل' : 'records'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--color-neutral-200)]">
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'الكوتش' : 'Coach'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'المصدر' : 'Source'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'إجمالي' : 'Gross'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'النسبة' : 'Rate'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'صافي' : 'Net'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'الحالة' : 'Status'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'التاريخ' : 'Date'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEarnings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[var(--color-neutral-400)]">
                      {isAr ? 'لا توجد سجلات' : 'No records'}
                    </td>
                  </tr>
                ) : (
                  filteredEarnings.map((e, i) => (
                    <tr
                      key={e.id}
                      className={`border-b border-[var(--color-neutral-100)] ${
                        i % 2 === 1 ? 'bg-[var(--color-neutral-50)]' : ''
                      }`}
                    >
                      <td className="px-3 py-2">{(e.profiles as any)?.full_name ?? '—'}</td>
                      <td className="px-3 py-2">
                        {e.source_type === 'service_booking'
                          ? (isAr ? 'خدمة' : 'Service')
                          : (isAr ? 'منتج' : 'Product')}
                      </td>
                      <td className="px-3 py-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(e.gross_amount, e.currency)}
                      </td>
                      <td className="px-3 py-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {Number(e.commission_pct).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(e.net_amount, e.currency)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: statusColors[e.status ?? 'pending'] }}
                        >
                          {isAr ? statusLabelsAr[e.status ?? 'pending'] : (e.status ?? 'pending').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {e.created_at ? formatDate(e.created_at, isAr) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Payout Queue ── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--color-neutral-100)]">
          <h2 className="text-lg font-semibold mb-4">
            {isAr ? 'طلبات الصرف' : 'Payout Queue'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--color-neutral-200)]">
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'الكوتش' : 'Coach'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'المبلغ' : 'Amount'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'الحالة' : 'Status'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'التاريخ' : 'Requested'}
                  </th>
                  <th className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'إجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[var(--color-neutral-400)]">
                      {isAr ? 'لا توجد طلبات صرف' : 'No payout requests'}
                    </td>
                  </tr>
                ) : (
                  payouts.map((p, i) => (
                    <tr
                      key={p.id}
                      className={`border-b border-[var(--color-neutral-100)] ${
                        i % 2 === 1 ? 'bg-[var(--color-neutral-50)]' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        {(p.profiles as any)?.full_name ?? '—'}
                      </td>
                      <td className="px-3 py-2 font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(p.amount, p.currency)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: statusColors[p.status] }}
                        >
                          {isAr ? statusLabelsAr[p.status] : p.status}
                        </span>
                      </td>
                      <td className="px-3 py-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatDate(p.requested_at, isAr)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          {p.status === 'requested' && (
                            <>
                              <button
                                onClick={() => handlePayoutAction(p.id, 'approve')}
                                disabled={actionLoading === p.id}
                                className="px-2 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                                style={{ backgroundColor: '#22C55E' }}
                              >
                                {isAr ? 'موافقة' : 'Approve'}
                              </button>
                              <button
                                onClick={() => handlePayoutAction(p.id, 'reject')}
                                disabled={actionLoading === p.id}
                                className="px-2 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                                style={{ backgroundColor: '#EF4444' }}
                              >
                                {isAr ? 'رفض' : 'Reject'}
                              </button>
                            </>
                          )}
                          {p.status === 'approved' && (
                            <button
                              onClick={() => handlePayoutAction(p.id, 'complete')}
                              disabled={actionLoading === p.id}
                              className="px-2 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                              style={{ backgroundColor: '#3B82F6' }}
                            >
                              {isAr ? 'إتمام' : 'Complete'}
                            </button>
                          )}
                          {['processing', 'completed', 'rejected'].includes(p.status) && (
                            <span className="text-xs text-[var(--color-neutral-400)]">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </main>
  );
}
