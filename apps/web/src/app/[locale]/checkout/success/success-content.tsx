'use client';

import { useSearchParams } from 'next/navigation';

export function SuccessContent({ locale }: { locale: string }) {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('payment_id');
  const isAr = locale === 'ar';

  return (
    <div className="mt-6 space-y-3">
      {paymentId && (
        <p className="text-xs text-[var(--color-neutral-400)]">
          {isAr ? 'رقم العملية' : 'Transaction ID'}: {paymentId}
        </p>
      )}
      <a
        href={`/${locale}/portal`}
        className="inline-block rounded-lg bg-[var(--color-primary)] text-white px-6 py-3 font-medium hover:opacity-90 transition min-h-[44px]"
      >
        {isAr ? 'الذهاب إلى لوحة التحكم' : 'Go to Dashboard'}
      </a>
    </div>
  );
}
