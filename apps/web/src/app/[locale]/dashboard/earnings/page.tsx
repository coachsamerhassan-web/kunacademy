'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import type { Earning, PayoutRequest } from '@/types/commission-system';
import { ArrowLeft } from 'lucide-react';

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

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();

  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  // Summary calculations
  const totalEarned = earnings.reduce((s, e) => s + e.net_amount, 0);
  const pendingAmount = earnings
    .filter((e) => e.status === 'pending')
    .reduce((s, e) => s + e.net_amount, 0);
  const paidOut = earnings
    .filter((e) => e.status === 'paid_out')
    .reduce((s, e) => s + e.net_amount, 0);

  async function getAuthToken() {
    // TODO: Regenerate Supabase types once earnings/commission_rates/payout_requests tables exist
    const supabase = createBrowserClient();
    if (!supabase) return null;
    const { data: session } = await supabase.auth.getSession();
    return session?.session?.access_token || null;
  }

  async function fetchData() {
    const token = await getAuthToken();
    if (!token) { setLoading(false); return; }

    // Fetch earnings
    const supabase = createBrowserClient();
    if (supabase && user) {
      const { data: earningsData } = await supabase
        .from('earnings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      setEarnings(earningsData ?? []);
    }

    // Fetch payouts + available balance
    const res = await fetch('/api/payouts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setPayouts(data.payouts ?? []);
      setAvailableBalance(data.available_balance ?? 0);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (user) fetchData();
    else setLoading(false);
  }, [user]);

  if (loading) {
    return (
      <Section variant="white">
        <p className="text-center py-12 text-[var(--color-neutral-500)]">
          {isAr ? 'جارٍ التحميل...' : 'Loading...'}
        </p>
      </Section>
    );
  }

  const summaryCards = [
    {
      label: isAr ? 'إجمالي الأرباح' : 'Total Earned',
      value: formatAmount(totalEarned, 'AED'),
      color: 'var(--color-primary, #474099)',
    },
    {
      label: isAr ? 'الرصيد المتاح' : 'Available',
      value: formatAmount(availableBalance, 'AED'),
      color: '#22C55E',
    },
    {
      label: isAr ? 'قيد الانتظار' : 'Pending',
      value: formatAmount(pendingAmount, 'AED'),
      color: '#EAB308',
    },
    {
      label: isAr ? 'تم الصرف' : 'Paid Out',
      value: formatAmount(paidOut, 'AED'),
      color: '#3B82F6',
    },
  ];

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        <div className="flex items-center justify-between mb-8">
          <Heading level={1} className={isAr ? 'font-[var(--font-arabic-heading)]' : ''}>
            {isAr ? 'أرباحي' : 'My Earnings'}
          </Heading>
          <a
            href={`/${locale}/dashboard`}
            className="text-[var(--color-primary)] text-sm hover:underline"
          >
            <><ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'لوحة التحكم' : 'Dashboard'}</>
          </a>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--color-neutral-100)]"
            >
              <p
                className="text-2xl font-bold"
                style={{ fontVariantNumeric: 'tabular-nums', color: card.color }}
              >
                {card.value}
              </p>
              <p className="text-sm text-[var(--color-neutral-500)] mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Earnings Table */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-4">
            {isAr ? 'سجل الأرباح' : 'Earnings History'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--color-neutral-200)]">
                  <th className="px-3 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'التاريخ' : 'Date'}
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'المصدر' : 'Source'}
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'المبلغ الإجمالي' : 'Gross'}
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'النسبة' : 'Rate'}
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'صافي الربح' : 'Net'}
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'الحالة' : 'Status'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {earnings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[var(--color-neutral-400)]">
                      {isAr ? 'لا توجد أرباح بعد' : 'No earnings yet'}
                    </td>
                  </tr>
                ) : (
                  earnings.map((e, i) => (
                    <tr
                      key={e.id}
                      className={`border-b border-[var(--color-neutral-100)] ${
                        i % 2 === 1 ? 'bg-[var(--color-neutral-50)]' : ''
                      }`}
                    >
                      <td className="px-3 py-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {e.created_at ? formatDate(e.created_at, isAr) : '-'}
                      </td>
                      <td className="px-3 py-3">
                        {e.source_type === 'service_booking'
                          ? (isAr ? 'حجز خدمة' : 'Service Booking')
                          : (isAr ? 'بيع منتج' : 'Product Sale')}
                      </td>
                      <td className="px-3 py-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(e.gross_amount, e.currency)}
                      </td>
                      <td className="px-3 py-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {Number(e.commission_pct).toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(e.net_amount, e.currency)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: statusColors[e.status ?? 'pending'] }}
                        >
                          {isAr ? statusLabelsAr[e.status ?? 'pending'] : (e.status ?? 'pending').replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payout Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {isAr ? 'طلبات الصرف' : 'Payout Requests'}
            </h2>
            <a
              href={`/${locale}/dashboard/payout`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--color-primary, #474099)' }}
            >
              {isAr ? 'طلب صرف' : 'Request Payout'}
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--color-neutral-200)]">
                  <th className="px-3 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'التاريخ' : 'Date'}
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'المبلغ' : 'Amount'}
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'الحالة' : 'Status'}
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'تاريخ المعالجة' : 'Processed'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[var(--color-neutral-400)]">
                      {isAr ? 'لا توجد طلبات صرف' : 'No payout requests yet'}
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
                      <td className="px-3 py-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatDate(p.requested_at, isAr)}
                      </td>
                      <td className="px-3 py-3 font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(p.amount, p.currency)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: statusColors[p.status] }}
                        >
                          {isAr ? statusLabelsAr[p.status] : p.status}
                        </span>
                      </td>
                      <td className="px-3 py-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {p.processed_at ? formatDate(p.processed_at, isAr) : '—'}
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
