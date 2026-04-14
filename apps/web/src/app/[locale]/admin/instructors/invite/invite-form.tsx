'use client';

import { useState } from 'react';
import { Button } from '@kunacademy/ui/button';
import { inviteCoach } from './actions';
import { ICF_CREDENTIALS } from '@kunacademy/db/enums';

// ICF credential options for invite form (student_coach is a pre-credential state)
const ICF_CREDENTIAL_OPTIONS = [
  { value: 'student_coach', labelAr: 'كوتش متدرب', labelEn: 'Student Coach' },
  ...ICF_CREDENTIALS.filter(c => c !== 'none').map(c => ({
    value: c,
    labelAr: c.toUpperCase(),
    labelEn: c.toUpperCase(),
  })),
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
        <label htmlFor="icf_credential" className="block text-sm font-medium text-[var(--color-neutral-700)]">
          {isAr ? 'اعتماد ICF' : 'ICF Credential'}
        </label>
        <select
          id="icf_credential"
          name="icf_credential"
          required
          className="mt-1 block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20 bg-white"
        >
          <option value="">{isAr ? 'اختر الاعتماد' : 'Select credential'}</option>
          {ICF_CREDENTIAL_OPTIONS.map((level) => (
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
