// @ts-nocheck
'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

interface PayoutRequest {
  id: string;
  amount: number;
  currency: string;
  status: 'requested' | 'approved' | 'processed' | 'rejected';
  bank_details: { bank_name: string; iban: string; account_name: string };
  admin_note: string | null;
  requested_at: string;
  processed_at: string | null;
}

const statusColors: Record<string, string> = {
  requested: '#EAB308',
  approved: '#22C55E',
  processing: '#3B82F6',
  completed: '#3B82F6',
  rejected: '#EF4444',
};

const statusLabelsAr: Record<string, string> = {
  requested: 'مطلوب',
  approved: 'موافق عليه',
  processed: 'قيد المعالجة',
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

  const [availableBalance, setAvailableBalance] = useState(0);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [accountName, setAccountName] = useState('');

  const amountMinor = Math.round(parseFloat(amount || '0') * 100);
  const isValid =
    amountMinor > 0 &&
    amountMinor <= availableBalance &&
    bankName.trim() !== '' &&
    iban.trim() !== '' &&
    accountName.trim() !== '';

  async function getAuthToken() {
    const supabase = createBrowserClient();
    if (!supabase) return null;
    const { data: session } = await supabase.auth.getSession();
    return session?.session?.access_token || null;
  }

  async function fetchData() {
    const token = await getAuthToken();
    if (!token) { setLoading(false); return; }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess(false);

    const token = await getAuthToken();
    if (!token) { setError(isAr ? 'يرجى تسجيل الدخول' : 'Please sign in'); setSubmitting(false); return; }

    const res = await fetch('/api/payouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency: 'AED',
        bank_details: {
          bank_name: bankName.trim(),
          iban: iban.trim(),
          account_name: accountName.trim(),
        },
      }),
    });

    if (res.ok) {
      setSuccess(true);
      setAmount('');
      setBankName('');
      setIban('');
      setAccountName('');
      fetchData(); // refresh
    } else {
      const data = await res.json();
      setError(data.error || (isAr ? 'حدث خطأ' : 'An error occurred'));
    }
    setSubmitting(false);
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

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        <div className="flex items-center justify-between mb-8">
          <Heading level={1} className={isAr ? 'font-[var(--font-arabic-heading)]' : ''}>
            {isAr ? 'طلب صرف' : 'Request Payout'}
          </Heading>
          <a
            href={`/${locale}/dashboard/earnings`}
            className="text-[var(--color-primary)] text-sm hover:underline"
          >
            {isAr ? '← الأرباح' : '← Earnings'}
          </a>
        </div>

        {/* Available Balance */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--color-neutral-100)] mb-8 text-center">
          <p className="text-sm text-[var(--color-neutral-500)] mb-1">
            {isAr ? 'الرصيد المتاح للصرف' : 'Available Balance'}
          </p>
          <p
            className="text-3xl font-bold"
            style={{ fontVariantNumeric: 'tabular-nums', color: '#22C55E' }}
          >
            {formatAmount(availableBalance, 'AED')}
          </p>
        </div>

        {/* Payout Form */}
        <form onSubmit={handleSubmit} className="max-w-lg mx-auto mb-12">
          <div className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {isAr ? 'المبلغ (درهم)' : 'Amount (AED)'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={(availableBalance / 100).toFixed(2)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={isAr ? 'أدخل المبلغ' : 'Enter amount'}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-neutral-200)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
                required
              />
              {amountMinor > availableBalance && amount !== '' && (
                <p className="text-xs text-[#EF4444] mt-1">
                  {isAr ? 'المبلغ يتجاوز الرصيد المتاح' : 'Amount exceeds available balance'}
                </p>
              )}
            </div>

            {/* Bank Name */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {isAr ? 'اسم البنك' : 'Bank Name'}
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder={isAr ? 'مثال: بنك الإمارات دبي الوطني' : 'e.g. Emirates NBD'}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-neutral-200)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                required
              />
            </div>

            {/* IBAN */}
            <div>
              <label className="block text-sm font-medium mb-1">
                IBAN
              </label>
              <input
                type="text"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="AE00 0000 0000 0000 0000 000"
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-neutral-200)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-mono"
                dir="ltr"
                required
              />
            </div>

            {/* Account Holder */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {isAr ? 'اسم صاحب الحساب' : 'Account Holder Name'}
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder={isAr ? 'الاسم كما هو مسجل في البنك' : 'Name as registered with bank'}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-neutral-200)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="w-full py-3 rounded-xl text-white font-medium transition-opacity disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary, #474099)' }}
            >
              {submitting
                ? (isAr ? 'جارٍ الإرسال...' : 'Submitting...')
                : (isAr ? 'إرسال طلب الصرف' : 'Submit Payout Request')}
            </button>

            {/* Feedback */}
            {success && (
              <div className="p-4 rounded-xl bg-green-50 text-green-700 text-sm text-center">
                {isAr
                  ? 'تم إرسال طلب الصرف بنجاح! سيتم مراجعته قريبًا.'
                  : 'Payout request submitted successfully! It will be reviewed shortly.'}
              </div>
            )}
            {error && (
              <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm text-center">
                {error}
              </div>
            )}
          </div>
        </form>

        {/* Payout History */}
        <div>
          <h2 className="text-lg font-semibold mb-4">
            {isAr ? 'سجل طلبات الصرف' : 'Payout History'}
          </h2>
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
                    {isAr ? 'البنك' : 'Bank'}
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'الحالة' : 'Status'}
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                    {isAr ? 'ملاحظة' : 'Note'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[var(--color-neutral-400)]">
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
                        {p.bank_details?.bank_name ?? '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: statusColors[p.status] }}
                        >
                          {isAr ? statusLabelsAr[p.status] : p.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[var(--color-neutral-500)]">
                        {p.admin_note || '—'}
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
