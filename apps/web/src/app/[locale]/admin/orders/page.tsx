'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface Payment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string;
  gateway_payment_id: string | null;
  item_type: string | null;
  item_id: string | null;
  created_at: string;
  metadata?: { user_email?: string; user_id?: string; item_type?: string; item_name?: string; sender_name?: string };
}

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-purple-100 text-purple-700',
};

export default function AdminOrdersPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const isAr = locale === 'ar';

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== 'admin') { router.push('/' + locale + '/auth/login'); return; }
    const s = createBrowserClient();
    s.from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }: any) => {
        setPayments(data ?? []);
        setLoading(false);
      });
  }, [user, profile, authLoading]);

  const filtered = filter === 'all' ? payments : payments.filter(p => p.status === filter);
  const totalCompleted = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);

  if (authLoading || loading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  const formatCurrency = (amount: number, currency: string) => {
    const c = currency?.toUpperCase() || 'AED';
    return `${amount.toLocaleString()} ${c}`;
  };

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1}>{isAr ? 'المدفوعات' : 'Payments'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {payments.length} {isAr ? 'عملية' : 'transactions'}
              {totalCompleted > 0 && (
                <span className="ms-2 font-medium text-green-600">
                  ({isAr ? 'إجمالي المكتمل' : 'Completed total'}: {totalCompleted.toLocaleString()} AED)
                </span>
              )}
            </p>
          </div>
          <a href={'/' + locale + '/admin'} className="text-[var(--color-primary)] text-sm hover:underline flex items-center gap-1">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {isAr ? 'لوحة الإدارة' : 'Dashboard'}
          </a>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'completed', 'pending', 'failed', 'refunded'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
              }`}
            >
              {s === 'all' ? (isAr ? 'الكل' : 'All') : s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'all' && ` (${payments.filter(p => p.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'العميل' : 'Customer'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'المبلغ' : 'Amount'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'البوابة' : 'Gateway'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'النوع' : 'Type'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'التاريخ' : 'Date'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--color-neutral-400)]">{isAr ? 'لا توجد مدفوعات' : 'No payments found'}</td></tr>
              ) : filtered.map(payment => {
                const meta = (payment.metadata || {}) as Record<string, string>;
                const customerName = meta.sender_name || meta.user_email || meta.user_id?.slice(0, 8) || '-';
                const statusColor = statusColors[payment.status] || 'bg-gray-100 text-gray-600';
                const dateStr = payment.created_at
                  ? new Date(payment.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '-';

                return (
                  <tr key={payment.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">{customerName}</div>
                      {meta.user_email && (
                        <div className="text-xs text-[var(--color-neutral-400)]">{meta.user_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                      {formatCurrency(payment.amount || 0, payment.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]">
                        {payment.gateway || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-neutral-600)] text-xs">
                      {meta.item_type || meta.item_name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-neutral-500)] text-xs">{dateStr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
