'use client';

import { useState } from 'react';
import { Button } from '@kunacademy/ui/button';
import { inviteCoach } from './actions';

const COACH_LEVELS = [
  { value: 'student_coach', labelAr: 'كوتش متدرب', labelEn: 'Student Coach' },
  { value: 'ACC', labelAr: 'ACC', labelEn: 'ACC' },
  { value: 'PCC', labelAr: 'PCC', labelEn: 'PCC' },
  { value: 'MCC', labelAr: 'MCC', labelEn: 'MCC' },
];

export function InviteForm({ locale }: { locale: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const isAr = locale === 'ar';

  async function handleSubmit(formData: FormData) {
    setStatus('loading');
    setErrorMsg('');
    const result = await inviteCoach(formData);
    if (result.success) {
      setStatus('success');
    } else {
      setStatus('error');
      setErrorMsg(result.error || 'Unknown error');
    }
  }

  if (status === 'success') {
    return (
      <div className="mt-8 rounded-lg bg-green-50 p-6 text-center">
        <p className="text-green-800 font-medium">
          {isAr ? 'تم إرسال الدعوة بنجاح!' : 'Invitation sent successfully!'}
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => setStatus('idle')}
        >
          {isAr ? 'دعوة كوتش آخر' : 'Invite Another'}
        </Button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-[var(--color-neutral-700)]">
          {isAr ? 'البريد الإلكتروني' : 'Email'}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20"
          dir="ltr"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name_ar" className="block text-sm font-medium text-[var(--color-neutral-700)]">
            {isAr ? 'الاسم بالعربية' : 'Name (Arabic)'}
          </label>
          <input
            id="name_ar"
            name="name_ar"
            type="text"
            required
            dir="rtl"
            className="mt-1 block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20"
          />
        </div>
        <div>
          <label htmlFor="name_en" className="block text-sm font-medium text-[var(--color-neutral-700)]">
            {isAr ? 'الاسم بالإنجليزية' : 'Name (English)'}
          </label>
          <input
            id="name_en"
            name="name_en"
            type="text"
            required
            dir="ltr"
            className="mt-1 block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20"
          />
        </div>
      </div>

      <div>
        <label htmlFor="coach_level" className="block text-sm font-medium text-[var(--color-neutral-700)]">
          {isAr ? 'مستوى الكوتش' : 'Coach Level'}
        </label>
        <select
          id="coach_level"
          name="coach_level"
          required
          className="mt-1 block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20 bg-white"
        >
          <option value="">{isAr ? 'اختر المستوى' : 'Select level'}</option>
          {COACH_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {isAr ? level.labelAr : level.labelEn}
            </option>
          ))}
        </select>
      </div>

      {status === 'error' && (
        <p className="text-red-600 text-sm">{errorMsg}</p>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={status === 'loading'}>
        {status === 'loading'
          ? (isAr ? 'جاري الإرسال...' : 'Sending...')
          : (isAr ? 'إرسال الدعوة' : 'Send Invitation')}
      </Button>
    </form>
  );
}
