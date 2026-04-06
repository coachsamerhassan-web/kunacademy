'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  is_active: boolean;
  created_at: string;
  owner?: { full_name_ar: string | null; full_name_en: string | null; email: string };
}

interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  source_type: string | null;
  balance_after: number;
  note: string | null;
  created_at: string;
  user?: { full_name_ar: string | null; full_name_en: string | null; email: string };
}

const typeColors: Record<string, string> = {
  earn: 'bg-green-100 text-green-700',
  spend: 'bg-red-100 text-red-700',
  payout: 'bg-blue-100 text-blue-700',
};

const typeLabels: Record<string, { ar: string; en: string }> = {
  earn: { ar: 'كسب', en: 'Earned' },
  spend: { ar: 'إنفاق', en: 'Spent' },
  payout: { ar: 'سحب', en: 'Payout' },
};

export default function AdminReferralsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'codes' | 'transactions'>('codes');
  const isAr = locale === 'ar';

  async function fetchData() {
    const [codesRes, txRes] = await Promise.all([
      fetch('/api/admin/referral-codes'),
      fetch('/api/admin/credit-transactions'),
    ]);

    if (codesRes.ok) {
      const data = await codesRes.json();
      setCodes(data.codes ?? []);
    }
    if (txRes.ok) {
      const data = await txRes.json();
      setTransactions(data.transactions ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== 'admin') { router.push('/' + locale + '/auth/login'); return; }
    fetchData();
  }, [user, profile, authLoading]);

  async function toggleCode(id: string, currentActive: boolean) {
    await fetch(`/api/admin/referral-codes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentActive }),
    });
    setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentActive } : c));
  }

  const activeCodes = codes.filter(c => c.is_active).length;
  const totalEarned = transactions.filter(t => t.type === 'earn').reduce((sum, t) => sum + t.amount, 0);

  if (authLoading || loading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1}>{isAr ? 'الإحالات' : 'Referrals'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {codes.length} {isAr ? 'كود' : 'codes'} ({activeCodes} {isAr ? 'نشط' : 'active'})
              {totalEarned > 0 && (
                <span className="ms-2 font-medium text-green-600">
                  ({isAr ? 'إجمالي المكتسب' : 'Total earned'}: {totalEarned.toLocaleString()} AED)
                </span>
              )}
            </p>
          </div>
          <a href={'/' + locale + '/admin'} className="text-[var(--color-primary)] text-sm hover:underline flex items-center gap-1">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {isAr ? 'لوحة الإدارة' : 'Dashboard'}
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('codes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'codes'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
            }`}
          >
            {isAr ? 'أكواد الإحالة' : 'Referral Codes'} ({codes.length})
          </button>
          <button
            onClick={() => setTab('transactions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'transactions'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
            }`}
          >
            {isAr ? 'المعاملات' : 'Transactions'} ({transactions.length})
          </button>
        </div>

        {/* Codes Table */}
        {tab === 'codes' && (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الكوتش' : 'Owner'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الكود' : 'Code'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'التاريخ' : 'Created'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {codes.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--color-neutral-400)]">{isAr ? 'لا توجد أكواد إحالة' : 'No referral codes'}</td></tr>
                ) : codes.map(code => (
                  <tr key={code.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">{(isAr ? code.owner?.full_name_ar : code.owner?.full_name_en) || code.owner?.email || code.user_id?.slice(0, 8)}</div>
                      {code.owner?.email && <div className="text-xs text-[var(--color-neutral-400)]">{code.owner.email}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)]">{code.code}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${code.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {code.is_active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطّل' : 'Disabled')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-neutral-500)] text-xs">
                      {new Date(code.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleCode(code.id, code.is_active)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          code.is_active
                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {code.is_active ? (isAr ? 'تعطيل' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Transactions Table */}
        {tab === 'transactions' && (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'المستخدم' : 'User'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'النوع' : 'Type'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'المصدر' : 'Source'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الرصيد' : 'Balance'}</th>
                  <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'التاريخ' : 'Date'}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--color-neutral-400)]">{isAr ? 'لا توجد معاملات' : 'No transactions'}</td></tr>
                ) : transactions.map(tx => {
                  const typeColor = typeColors[tx.type] || 'bg-gray-100 text-gray-600';
                  const typeLabel = isAr ? typeLabels[tx.type]?.ar : typeLabels[tx.type]?.en;
                  return (
                    <tr key={tx.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--text-primary)]">{(isAr ? tx.user?.full_name_ar : tx.user?.full_name_en) || tx.user?.email || tx.user_id?.slice(0, 8)}</div>
                        {tx.user?.email && <div className="text-xs text-[var(--color-neutral-400)]">{tx.user.email}</div>}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        <span className={tx.type === 'earn' ? 'text-green-600' : 'text-red-600'}>
                          {tx.type === 'earn' ? '+' : '-'}{tx.amount?.toLocaleString()} AED
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
                          {typeLabel || tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-neutral-600)] text-xs">{tx.source_type || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-neutral-600)]">{tx.balance_after?.toLocaleString()} AED</td>
                      <td className="px-4 py-3 text-[var(--color-neutral-500)] text-xs">
                        {new Date(tx.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </main>
  );
}
