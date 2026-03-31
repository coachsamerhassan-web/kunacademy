'use client';

import { useState, type FormEvent } from 'react';

interface LeadCaptureFormProps {
  locale: string;
  programCode: string;
  programName: string;
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export function LeadCaptureForm({ locale, programCode, programName }: LeadCaptureFormProps) {
  const isAr = locale === 'ar';
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      programCode,
      programName,
      message: formData.get('message') as string,
      locale,
      _hp: formData.get('_hp') as string,
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(isAr ? (data.error_ar || data.error) : data.error);
        return;
      }

      setStatus('success');
      form.reset();
    } catch {
      setStatus('error');
      setErrorMessage(
        isAr
          ? 'حدث خطأ في الاتصال. يرجى المحاولة لاحقًا.'
          : 'Connection error. Please try again later.',
      );
    }
  }

  const inputClasses =
    'block w-full rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-3 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none transition-all duration-200';

  if (status === 'success') {
    return (
      <div className="rounded-2xl bg-white shadow-sm border border-[var(--color-neutral-100)] p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <p className="text-[var(--color-neutral-800)] font-medium leading-relaxed">
          {isAr
            ? 'سيتواصل معك أحد مرشدي كُن قريبًا'
            : 'A Kun guide will contact you soon'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-[var(--color-neutral-100)] p-6">
      {/* Program context */}
      <p className="text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wide mb-1">
        {isAr ? 'البرنامج' : 'Program'}
      </p>
      <p className="text-sm font-semibold text-[var(--color-primary)] mb-5">
        {programName}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Honeypot */}
        <div className="absolute opacity-0 pointer-events-none" aria-hidden="true" tabIndex={-1}>
          <label htmlFor="lcf-hp">Leave empty</label>
          <input type="text" id="lcf-hp" name="_hp" tabIndex={-1} autoComplete="off" />
        </div>

        <div>
          <label htmlFor="lcf-name" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5">
            {isAr ? 'الاسم الكامل' : 'Full Name'} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="lcf-name"
            name="name"
            required
            maxLength={200}
            className={inputClasses}
            disabled={status === 'submitting'}
          />
        </div>

        <div>
          <label htmlFor="lcf-email" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5">
            {isAr ? 'البريد الإلكتروني' : 'Email'} <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="lcf-email"
            name="email"
            required
            className={inputClasses}
            disabled={status === 'submitting'}
          />
        </div>

        <div>
          <label htmlFor="lcf-phone" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5">
            {isAr ? 'رقم الهاتف' : 'Phone'} <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="lcf-phone"
            name="phone"
            required
            className={inputClasses}
            disabled={status === 'submitting'}
          />
        </div>

        <div>
          <label htmlFor="lcf-message" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5">
            {isAr ? 'رسالة' : 'Message'}{' '}
            <span className="text-[var(--color-neutral-400)] font-normal">
              {isAr ? '(اختياري)' : '(optional)'}
            </span>
          </label>
          <textarea
            id="lcf-message"
            name="message"
            rows={2}
            maxLength={2000}
            className={`${inputClasses} resize-none`}
            disabled={status === 'submitting'}
          />
        </div>

        {status === 'error' && errorMessage && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-red-800 text-sm">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full rounded-xl bg-[var(--color-accent)] px-6 py-3.5 font-semibold text-white min-h-[48px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_16px_rgba(228,96,30,0.25)] hover:shadow-[0_8px_24px_rgba(228,96,30,0.35)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {status === 'submitting'
            ? (isAr ? 'جارٍ الإرسال...' : 'Sending...')
            : (isAr ? 'تحدّث مع مرشد كُن' : 'Talk to a Kun Guide')}
        </button>
      </form>
    </div>
  );
}
