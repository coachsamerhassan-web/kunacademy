'use client';

import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { use } from 'react';

export default function CoachSchedulePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';

  return (
    <Section variant="white">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{isAr ? 'المواعيد' : 'Schedule'}</h1>
      <Card accent className="p-8 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
          <svg className="w-7 h-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{isAr ? 'إدارة المواعيد' : 'Schedule Manager'}</h2>
        <p className="text-sm text-[var(--color-neutral-500)] mt-2 max-w-md mx-auto">
          {isAr ? 'حدّد أوقات توفّرك للجلسات وسيتمكّن العملاء من الحجز تلقائيًا في الأوقات المتاحة.' : 'Set your availability for sessions and clients will be able to book automatically during available times.'}
        </p>
        <p className="text-xs text-[var(--color-neutral-400)] mt-6">{isAr ? 'التقويم التفاعلي قادم في التحديث القادم' : 'Interactive calendar coming in the next update'}</p>
      </Card>
    </Section>
  );
}
