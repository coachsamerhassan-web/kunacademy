'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { trackEvent, trackMetaEvent } from '@/components/analytics';

export function SuccessContent({ locale }: { locale: string }) {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('payment_id');
  const amount = searchParams.get('amount');
  const program = searchParams.get('program');
  const isAr = locale === 'ar';

  useEffect(() => {
    trackEvent('purchase', {
      transaction_id: paymentId,
      value: amount ? parseFloat(amount) : undefined,
      currency: 'AED',
      items: program ? [{ item_name: program }] : undefined,
    });
    trackMetaEvent('Purchase', {
      value: amount ? parseFloat(amount) : undefined,
      currency: 'AED',
      content_name: program,
    });
  }, [paymentId, amount, program]);

  return (
    <div className="mt-6 space-y-3">
      {paymentId && (
        <p className="text-xs text-[var(--color-neutral-400)]">
          {isAr ? 'رقم العملية' : 'Transaction ID'}: {paymentId}
        </p>
      )}
      <a
        href={`/${locale}/dashboard`}
        className="inline-block rounded-lg bg-[var(--color-primary)] text-white px-6 py-3 font-medium hover:opacity-90 transition min-h-[44px]"
      >
        {isAr ? 'الذهاب إلى لوحة التحكم' : 'Go to Dashboard'}
      </a>
    </div>
  );
}
