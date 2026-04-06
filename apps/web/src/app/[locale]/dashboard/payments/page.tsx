'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

interface Installment {
  due_date: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  paid_at: string | null;
}

interface Schedule {
  id: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  schedule_type: 'deposit_balance' | 'installment';
  installments: Installment[];
  currency: string;
  created_at: string;
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [locale, setLocale] = useState('ar');

  useEffect(() => {
    const path = window.location.pathname;
    setLocale(path.startsWith('/en') ? 'en' : 'ar');
  }, []);

  const isAr = locale === 'ar';

  useEffect(() => {
    if (!user) return;
    fetchSchedules();
  }, [user]);

  async function fetchSchedules() {
    try {
      const res = await fetch('/api/payment-schedules');
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      const parsed = (json.schedules || []).map((s: any) => ({
        ...s,
        installments: typeof s.installments === 'string' ? JSON.parse(s.installments) : s.installments,
      }));
      setSchedules(parsed);
    } catch (e) {
      console.error('Failed to fetch schedules:', e);
    }
    setLoading(false);
  }

  async function handlePayInstallment(scheduleId: string, index: number) {
    setPaying(`${scheduleId}-${index}`);
    try {
      await fetch('/api/payment-schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_id: scheduleId, installment_index: index }),
      });
      await fetchSchedules();
    } catch (e) {
      console.error('Payment failed:', e);
    }
    setPaying(null);
  }

  const formatAmount = (amount: number, currency: string) =>
    `${(amount / 100).toLocaleString(isAr ? 'ar-AE' : 'en-AE', { minimumFractionDigits: 0 })} ${currency === 'AED' ? (isAr ? 'د.إ' : 'AED') : currency}`;

  const statusColors: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    overdue: 'bg-red-100 text-red-700',
  };

  const statusLabels: Record<string, { ar: string; en: string }> = {
    paid: { ar: 'مدفوع', en: 'Paid' },
    pending: { ar: 'قيد الانتظار', en: 'Pending' },
    overdue: { ar: 'متأخر', en: 'Overdue' },
  };

  if (loading) {
    return (
      <main>
        <Section variant="white">
          <div className="py-12 text-center text-[var(--color-neutral-500)]">
            {isAr ? 'جاري التحميل...' : 'Loading...'}
          </div>
        </Section>
      </main>
    );
  }

  return (
    <main>
      <Section variant="white">
        <Heading level={1} className="mb-8">
          {isAr ? 'جدول المدفوعات' : 'Payment Schedule'}
        </Heading>

        {schedules.length === 0 ? (
          <div className="bg-[var(--color-surface-container)] rounded-2xl p-12 text-center">
            <p className="text-[var(--color-neutral-500)] text-lg">
              {isAr ? 'لا توجد أقساط مجدولة' : 'No scheduled payments'}
            </p>
            <p className="text-[var(--color-neutral-400)] text-sm mt-2">
              {isAr
                ? 'عند اختيار خيار القسط أو الإيداع عند الدفع، ستظهر الأقساط هنا'
                : 'When you choose a deposit or installment option at checkout, your schedule will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="bg-white rounded-2xl border border-[var(--color-neutral-200)] overflow-hidden">
                {/* Schedule header */}
                <div className="p-6 border-b border-[var(--color-neutral-100)]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wider">
                        {schedule.schedule_type === 'deposit_balance'
                          ? (isAr ? 'إيداع + رصيد' : 'Deposit + Balance')
                          : (isAr ? 'أقساط' : 'Installments')}
                      </span>
                      <p className="text-2xl font-bold mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(schedule.total_amount, schedule.currency)}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm text-[var(--color-neutral-500)]">
                        {isAr ? 'المتبقي' : 'Remaining'}
                      </p>
                      <p className="text-lg font-semibold text-[#474099]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(schedule.remaining_amount, schedule.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4 h-2 rounded-full bg-[var(--color-neutral-100)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#474099] transition-all duration-500"
                      style={{ width: `${(schedule.paid_amount / schedule.total_amount) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--color-neutral-400)] mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round((schedule.paid_amount / schedule.total_amount) * 100)}% {isAr ? 'مدفوع' : 'paid'}
                  </p>
                </div>

                {/* Installment rows */}
                <div className="divide-y divide-[var(--color-neutral-100)]">
                  {schedule.installments.map((inst, i) => {
                    const dueDate = new Date(inst.due_date);
                    const isOverdue = inst.status === 'pending' && dueDate < new Date();
                    const effectiveStatus = isOverdue ? 'overdue' : inst.status;

                    return (
                      <div key={i} className="flex items-center justify-between p-4 px-6">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-[var(--color-neutral-100)] flex items-center justify-center text-sm font-medium text-[var(--color-neutral-600)]">
                            {i + 1}
                          </div>
                          <div>
                            <p className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatAmount(inst.amount, schedule.currency)}
                            </p>
                            <p className="text-xs text-[var(--color-neutral-400)]">
                              {isAr ? 'يستحق في' : 'Due'}{' '}
                              {dueDate.toLocaleDateString(isAr ? 'ar-AE' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[effectiveStatus]}`}>
                            {isAr ? statusLabels[effectiveStatus].ar : statusLabels[effectiveStatus].en}
                          </span>

                          {effectiveStatus !== 'paid' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handlePayInstallment(schedule.id, i)}
                              disabled={paying === `${schedule.id}-${i}`}
                            >
                              {paying === `${schedule.id}-${i}`
                                ? (isAr ? 'جاري الدفع...' : 'Paying...')
                                : (isAr ? 'ادفع الآن' : 'Pay Now')}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </main>
  );
}
