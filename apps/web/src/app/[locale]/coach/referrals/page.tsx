'use client';

import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use, useCallback } from 'react';

export default function CoachReferralsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(() => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [referralCode]);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      fetch('/api/referrals'),
      // Note: referral_uses table referenced in original code does not exist in schema.
      // Using the referral count from /api/referrals instead.
    ]).then(async ([codeRes]) => {
      if (codeRes.ok) {
        const data = await codeRes.json();
        setReferralCode(data.code ?? null);
        setReferralCount(data.total_referrals ?? 0);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  return (
    <Section variant="white">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{isAr ? 'الإحالات' : 'Referrals'}</h1>
      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card accent className="p-6 text-center">
              <p className="text-3xl font-bold text-[var(--color-primary)]">{referralCount}</p>
              <p className="text-sm text-[var(--color-neutral-500)] mt-1">{isAr ? 'إحالات ناجحة' : 'Successful Referrals'}</p>
            </Card>
            <Card accent className="p-6 text-center">
              <p className="text-sm text-[var(--color-neutral-500)] mb-2">{isAr ? 'كود الإحالة' : 'Referral Code'}</p>
              <p className="text-xl font-mono font-bold text-[var(--text-primary)]">{referralCode || (isAr ? 'لا يوجد' : 'None')}</p>
              {referralCode && (
                <button
                  onClick={copyCode}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-600)] transition-colors min-h-[44px]"
                >
                  {copied ? (isAr ? '✓ تم النسخ' : '✓ Copied!') : (isAr ? 'نسخ الكود' : 'Copy Code')}
                </button>
              )}
            </Card>
          </div>
          <p className="text-sm text-[var(--color-neutral-500)] text-center">
            {isAr ? 'شارك كود الإحالة مع عملائك واكسب عمولة على كل تسجيل' : 'Share your referral code with clients and earn commission on each signup'}
          </p>
        </div>
      )}
    </Section>
  );
}
