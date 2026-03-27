'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { ArrowRight } from 'lucide-react';

interface PayoutRequest {
  id: string;
  amount: number;
  currency: string;
  status: string;
  bank_details: { bank_name: string; iban: string; account_name: string } | null;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
}

function formatAmount(amount: number, currency: string) {
  return `${(amount / 100).toLocaleString()} ${currency}`;
}

function statusBadge(status: string, isAr: boolean) {
  const map: Record<string, { label: string; labelAr: string; cls: string }> = {
    requested: { label: 'Pending', labelAr: 'قيد المراجعة', cls: 'bg-amber-100 text-amber-800' },
    approved: { label: 'Approved', labelAr: 'تمت الموافقة', cls: 'bg-blue-100 text-blue-800' },
    processed: { label: 'Paid', labelAr: 'تم الدفع', cls: 'bg-green-100 text-green-800' },
    rejected: { label: 'Rejected', labelAr: 'مرفوض', cls: 'bg-red-100 text-red-800' },
  };
  const s = map[status] || { label: status, labelAr: status, cls: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {isAr ? s.labelAr : s.label}
    </span>
  );
}

export function PayoutDashboard({ locale }: { locale: string }) {
  const { user, session, loading: authLoading } = useAuth();
  const isAr = locale === 'ar';
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [accountName, setAccountName] = useState('');

  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/payouts', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(data => {
        setPayouts(data.payouts || []);
        setBalance(data.available_balance || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.access_token) return;
    setError('');
    setSuccess('');
    setSubmitting(true);

    const amountMinor = Math.round(parseFloat(amount) * 100);
    if (!amountMinor || amountMinor <= 0) {
      setError(isAr ? 'أدخل مبلغًا صحيحًا' : 'Enter a valid amount');
      setSubmitting(false);
      return;
    }

    const res = await fetch('/api/payouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency: 'AED',
        bank_details: { bank_name: bankName, iban, account_name: accountName },
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || 'Failed');
      return;
    }

    setSuccess(isAr ? 'تم إرسال طلب السحب بنجاح' : 'Payout request submitted');
    setShowForm(false);
    setAmount('');
    // Refresh
    setPayouts(prev => [data.payout, ...prev]);
    setBalance(prev => prev - amountMinor);
  }

  if (authLoading || loading) {
    return <div className="text-center py-12 text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  if (!user) {
    return <div className="text-center py-12 text-[var(--color-neutral-500)]">{isAr ? 'يرجى تسجيل الدخول' : 'Please sign in'}</div>;
  }

  return (
    <div className="space-y-8">
      {/* Balance Card */}
      <div className="bg-[var(--color-surface-container)] rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--color-neutral-500)] mb-1">{isAr ? 'الرصيد المتاح للسحب' : 'Available Balance'}</p>
            <p className="text-3xl font-bold text-[var(--color-primary)]">{formatAmount(balance, 'AED')}</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            disabled={balance <= 0}
            className="whitespace-nowrap"
          >
            {isAr ? 'طلب سحب' : 'Request Payout'}
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Payout Request Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[var(--color-neutral-200)] rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-lg">{isAr ? 'طلب سحب جديد' : 'New Payout Request'}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{isAr ? 'المبلغ (AED)' : 'Amount (AED)'}</label>
              <input
                type="number"
                min="1"
                max={balance / 100}
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                className="w-full border border-[var(--color-neutral-300)] rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                placeholder={`Max ${(balance / 100).toFixed(2)}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{isAr ? 'اسم البنك' : 'Bank Name'}</label>
              <input
                type="text"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                required
                className="w-full border border-[var(--color-neutral-300)] rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">IBAN</label>
              <input
                type="text"
                value={iban}
                onChange={e => setIban(e.target.value)}
                required
                className="w-full border border-[var(--color-neutral-300)] rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                placeholder="AE..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{isAr ? 'اسم صاحب الحساب' : 'Account Holder Name'}</label>
              <input
                type="text"
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                required
                className="w-full border border-[var(--color-neutral-300)] rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'إرسال الطلب' : 'Submit Request')}
            </Button>
            <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        </form>
      )}

      {/* Payout History */}
      <div>
        <h3 className="font-semibold text-lg mb-4">{isAr ? 'سجل الطلبات' : 'Payout History'}</h3>
        {payouts.length === 0 ? (
          <p className="text-[var(--color-neutral-500)] text-sm">{isAr ? 'لا توجد طلبات سابقة' : 'No payout requests yet'}</p>
        ) : (
          <div className="space-y-3">
            {payouts.map(p => (
              <div key={p.id} className="bg-[var(--color-surface-container)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="font-medium">{formatAmount(p.amount, p.currency)}</span>
                  <span className="mx-2">{statusBadge(p.status, isAr)}</span>
                  {p.admin_note && (
                    <p className="text-xs text-[var(--color-neutral-500)] mt-1">{p.admin_note}</p>
                  )}
                </div>
                <div className="text-sm text-[var(--color-neutral-500)]">
                  {new Date(p.created_at).toLocaleDateString(isAr ? 'ar-AE' : 'en-GB')}
                  {p.processed_at && (
                    <span className="ms-2">
                      <ArrowRight className="w-3.5 h-3.5 inline-block" aria-hidden="true" /> {new Date(p.processed_at).toLocaleDateString(isAr ? 'ar-AE' : 'en-GB')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
