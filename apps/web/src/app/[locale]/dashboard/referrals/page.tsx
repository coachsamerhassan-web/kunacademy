'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@kunacademy/auth';

interface ReferralData {
  code: string | null;
  is_active: boolean;
  total_referrals: number;
  total_earned: number;
  balance: number;
}

interface Transaction {
  id: string;
  amount: number;
  type: 'earn' | 'spend' | 'payout';
  source_type: string;
  balance_after: number;
  note: string;
  created_at: string;
}

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();

  const [data, setData] = useState<ReferralData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function fetchData() {
    const [referralRes, txRes] = await Promise.all([
      fetch('/api/referrals'),
      fetch('/api/user/credit-transactions'),
    ]);

    if (referralRes.ok) {
      setData(await referralRes.json());
    }

    if (txRes.ok) {
      const txData = await txRes.json();
      setTransactions(txData.transactions || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (user) fetchData();
    else setLoading(false);
  }, [user]);

  async function generateCode() {
    setGenerating(true);

    const res = await fetch('/api/referrals', {
      method: 'POST',
    });
    if (res.ok) {
      const result = await res.json();
      setData(prev => prev ? { ...prev, code: result.code } : null);
    }
    setGenerating(false);
  }

  function copyLink() {
    if (!data?.code) return;
    const link = `${window.location.origin}/${locale}/auth/signup?ref=${data.code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatAmount(amount: number): string {
    return `${(amount / 100).toLocaleString()} ${isAr ? 'د.إ' : 'AED'}`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(isAr ? 'ar-AE' : 'en-AE', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  if (!user) {
    return (
      <main className="px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'يرجى تسجيل الدخول للوصول إلى الإحالات' : 'Please sign in to access referrals'}
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-40 bg-[var(--color-surface-container)] rounded-2xl" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-24 bg-[var(--color-surface-container)] rounded-2xl" />
              <div className="h-24 bg-[var(--color-surface-container)] rounded-2xl" />
              <div className="h-24 bg-[var(--color-surface-container)] rounded-2xl" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Hero Card */}
        <div
          className="rounded-2xl p-6 text-white"
          style={{ background: 'linear-gradient(135deg, #474099 0%, #5a4fbf 100%)' }}
        >
          <h1 className="text-2xl font-bold mb-2">
            {isAr ? 'ادعُ أصدقاءك واكسب رصيدًا' : 'Refer friends, earn credits'}
          </h1>
          <p className="text-white/80 text-sm mb-5">
            {isAr
              ? 'شارك رابطك مع أصدقائك واحصل على 50 د.إ رصيد عن كل تسجيل جديد'
              : 'Share your link with friends and earn 50 AED credit for each new signup'}
          </p>

          {data?.code ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/15 rounded-xl px-4 py-3 font-mono text-sm tracking-wider">
                {data.code}
              </div>
              <button
                onClick={copyLink}
                className="bg-white text-[#474099] rounded-xl px-5 py-3 font-medium text-sm hover:bg-white/90 transition min-h-[44px]"
              >
                {copied
                  ? (isAr ? 'تم النسخ!' : 'Copied!')
                  : (isAr ? 'نسخ الرابط' : 'Copy Link')}
              </button>
            </div>
          ) : (
            <button
              onClick={generateCode}
              disabled={generating}
              className="bg-white text-[#474099] rounded-xl px-6 py-3 font-medium text-sm hover:bg-white/90 transition min-h-[44px]"
            >
              {generating
                ? (isAr ? 'جاري الإنشاء...' : 'Generating...')
                : (isAr ? 'أنشئ رابط الإحالة' : 'Generate Referral Link')}
            </button>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--color-surface-container)] rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-[var(--color-neutral-500)] mb-1">
              {isAr ? 'إجمالي الإحالات' : 'Total Referrals'}
            </p>
            <p className="text-2xl font-bold text-[var(--color-neutral-900)]">
              {data?.total_referrals || 0}
            </p>
          </div>
          <div className="bg-[var(--color-surface-container)] rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-[var(--color-neutral-500)] mb-1">
              {isAr ? 'الرصيد المكتسب' : 'Credits Earned'}
            </p>
            <p className="text-2xl font-bold text-[var(--color-neutral-900)]">
              {formatAmount(data?.total_earned || 0)}
            </p>
          </div>
          <div className="bg-[var(--color-surface-container)] rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-[var(--color-neutral-500)] mb-1">
              {isAr ? 'الرصيد الحالي' : 'Current Balance'}
            </p>
            <p className="text-2xl font-bold" style={{ color: '#474099' }}>
              {formatAmount(data?.balance || 0)}
            </p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-[var(--color-surface-container)] rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--color-neutral-900)] mb-4">
            {isAr ? 'سجل المعاملات' : 'Transaction History'}
          </h2>

          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[var(--color-neutral-400)]">
                {isAr ? 'لا توجد معاملات بعد' : 'No transactions yet'}
              </p>
              <p className="text-sm text-[var(--color-neutral-400)] mt-1">
                {isAr ? 'شارك رابط الإحالة للبدء' : 'Share your referral link to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-neutral-200)]">
                    <th className="text-start py-2 px-2 font-medium text-[var(--color-neutral-500)]">
                      {isAr ? 'التاريخ' : 'Date'}
                    </th>
                    <th className="text-start py-2 px-2 font-medium text-[var(--color-neutral-500)]">
                      {isAr ? 'النوع' : 'Type'}
                    </th>
                    <th className="text-end py-2 px-2 font-medium text-[var(--color-neutral-500)]">
                      {isAr ? 'المبلغ' : 'Amount'}
                    </th>
                    <th className="text-end py-2 px-2 font-medium text-[var(--color-neutral-500)]">
                      {isAr ? 'الرصيد' : 'Balance'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(txn => (
                    <tr key={txn.id} className="border-b border-[var(--color-neutral-100)]">
                      <td className="py-3 px-2 text-[var(--color-neutral-600)]">
                        {formatDate(txn.created_at)}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          txn.type === 'earn'
                            ? 'bg-green-100 text-green-700'
                            : txn.type === 'spend'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {txn.type === 'earn'
                            ? (isAr ? 'اكتساب' : 'Earned')
                            : txn.type === 'spend'
                            ? (isAr ? 'صرف' : 'Spent')
                            : (isAr ? 'صرف نقدي' : 'Payout')}
                        </span>
                      </td>
                      <td className={`py-3 px-2 text-end font-medium ${
                        txn.type === 'earn' ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {txn.type === 'earn' ? '+' : '-'}{formatAmount(txn.amount)}
                      </td>
                      <td className="py-3 px-2 text-end text-[var(--color-neutral-600)]">
                        {formatAmount(txn.balance_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
