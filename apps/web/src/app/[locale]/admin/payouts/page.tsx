'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface PayoutRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  notes: string | null;
  processed_at: string | null;
  created_at: string;
  requester?: { full_name: string; email: string };
}

const statusColors: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  processed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, { ar: string; en: string }> = {
  requested: { ar: 'مطلوب', en: 'Requested' },
  approved: { ar: 'موافق عليه', en: 'Approved' },
  processed: { ar: 'تم التحويل', en: 'Processed' },
  rejected: { ar: 'مرفوض', en: 'Rejected' },
};

export default function AdminPayoutsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const isAr = locale === 'ar';

  const supabase = createBrowserClient();

  async function fetchPayouts() {
    const { data } = await supabase
      .from('payout_requests')
      .select('*, requester:profiles!payout_requests_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(200);
    setPayouts((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== 'admin') { router.push('/' + locale + '/auth/login'); return; }
    fetchPayouts();
  }, [user, profile, authLoading]);

  async function updateStatus(id: string, newStatus: string) {
    setUpdating(id);
    const updates: Record<string, any> = { status: newStatus, processed_by: user?.id };
    if (newStatus === 'processed' || newStatus === 'rejected') {
      updates.processed_at = new Date().toISOString();
    }
    await supabase.from('payout_requests').update(updates).eq('id', id);
    setPayouts(prev => prev.map(p => p.id === id ? { ...p, status: newStatus, processed_at: updates.processed_at || p.processed_at } : p));
    setUpdating(null);
  }

  const filtered = filter === 'all' ? payouts : payouts.filter(p => p.status === filter);
  const totalRequested = payouts.filter(p => p.status === 'requested').reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalProcessed = payouts.filter(p => p.status === 'processed').reduce((sum, p) => sum + (p.amount || 0), 0);

  if (authLoading || loading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1}>{isAr ? 'المستحقات' : 'Payouts'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {payouts.length} {isAr ? 'طلب' : 'requests'}
              {totalRequested > 0 && (
                <span className="ms-2 font-medium text-yellow-600">
                  ({isAr ? 'في الانتظار' : 'Pending'}: {totalRequested.toLocaleString()} AED)
                </span>
              )}
              {totalProcessed > 0 && (
                <span className="ms-2 font-medium text-green-600">
                  ({isAr ? 'تم التحويل' : 'Paid out'}: {totalProcessed.toLocaleString()} AED)
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
          {['all', 'requested', 'approved', 'processed', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
              }`}
            >
              {s === 'all' ? (isAr ? 'الكل' : 'All') : (isAr ? statusLabels[s]?.ar : statusLabels[s]?.en) || s}
              {s !== 'all' && ` (${payouts.filter(p => p.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الكوتش' : 'Coach'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'المبلغ' : 'Amount'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'طريقة الدفع' : 'Method'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--color-neutral-400)]">{isAr ? 'لا توجد طلبات' : 'No payout requests'}</td></tr>
              ) : filtered.map(payout => {
                const name = payout.requester?.full_name || payout.user_id?.slice(0, 8);
                const statusColor = statusColors[payout.status] || 'bg-gray-100 text-gray-600';
                const statusLabel = isAr ? statusLabels[payout.status]?.ar : statusLabels[payout.status]?.en;
                const dateStr = payout.created_at
                  ? new Date(payout.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '-';

                return (
                  <tr key={payout.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">{name}</div>
                      {payout.requester?.email && (
                        <div className="text-xs text-[var(--color-neutral-400)]">{payout.requester.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                      {payout.amount?.toLocaleString()} {payout.currency || 'AED'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-neutral-600)] text-xs">
                      {payout.payment_method || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                        {statusLabel || payout.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-neutral-500)] text-xs">{dateStr}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {payout.status === 'requested' && (
                          <>
                            <button
                              onClick={() => updateStatus(payout.id, 'approved')}
                              disabled={updating === payout.id}
                              className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            >
                              {isAr ? 'موافقة' : 'Approve'}
                            </button>
                            <button
                              onClick={() => updateStatus(payout.id, 'rejected')}
                              disabled={updating === payout.id}
                              className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              {isAr ? 'رفض' : 'Reject'}
                            </button>
                          </>
                        )}
                        {payout.status === 'approved' && (
                          <button
                            onClick={() => updateStatus(payout.id, 'processed')}
                            disabled={updating === payout.id}
                            className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            {isAr ? 'تم التحويل' : 'Mark Paid'}
                          </button>
                        )}
                      </div>
                    </td>
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
