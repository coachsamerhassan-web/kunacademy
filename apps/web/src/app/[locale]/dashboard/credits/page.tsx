'use client';

import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use } from 'react';

export default function CreditsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    supabase
      .from('credit_transactions')
      .select('amount')
      .eq('user_id', user.id)
      .then(({ data }: { data: any }) => {
        const total = (data ?? []).reduce((sum: number, t: any) => sum + (t.amount ?? 0), 0);
        setBalance(total);
        setLoading(false);
      });
  }, [user]);

  return (
    <Section variant="white">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        {isAr ? 'رصيدي' : 'My Credits'}
      </h1>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : (
        <div>
          <Card accent className="p-8 text-center mb-8">
            <p className="text-sm text-[var(--color-neutral-500)] mb-2">{isAr ? 'الرصيد المتاح' : 'Available Balance'}</p>
            <p className="text-4xl font-bold text-[var(--color-primary)]">{balance} <span className="text-lg">{isAr ? 'نقطة' : 'credits'}</span></p>
          </Card>
          <p className="text-sm text-[var(--color-neutral-500)] text-center">
            {isAr ? 'اكسب نقاط من خلال الإحالات وإكمال الدورات' : 'Earn credits through referrals and course completions'}
          </p>
        </div>
      )}
    </Section>
  );
}
