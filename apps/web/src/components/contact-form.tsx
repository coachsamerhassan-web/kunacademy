'use client';

import { useState, type FormEvent } from 'react';

interface ContactFormProps {
  locale: string;
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export function ContactForm({ locale }: ContactFormProps) {
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
      subject: formData.get('subject') as string,
      message: formData.get('message') as string,
      locale,
      _hp: formData.get('_hp') as string, // honeypot
    };

    try {
      const res = await fetch('/api/contact', {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot — hidden from real users, bots fill it */}
      <div className="absolute opacity-0 pointer-events-none" aria-hidden="true" tabIndex={-1}>
        <label htmlFor="_hp">Leave empty</label>
        <input type="text" id="_hp" name="_hp" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5"
          >
            {isAr ? 'الاسم الكامل' : 'Full Name'} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            maxLength={200}
            className={inputClasses}
            disabled={status === 'submitting'}
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5"
          >
            {isAr ? 'البريد الإلكتروني' : 'Email'} <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className={inputClasses}
            disabled={status === 'submitting'}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5"
        >
          {isAr ? 'رقم الهاتف' : 'Phone Number'}
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          className={inputClasses}
          disabled={status === 'submitting'}
        />
      </div>

      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5"
        >
          {isAr ? 'الموضوع' : 'Subject'} <span className="text-red-500">*</span>
        </label>
        <select
          id="subject"
          name="subject"
          required
          className={inputClasses}
          disabled={status === 'submitting'}
        >
          <option value="">{isAr ? 'اختر الموضوع' : 'Select a subject'}</option>
          <option value="programs">{isAr ? 'استفسار عن البرامج' : 'Program Inquiry'}</option>
          <option value="corporate">{isAr ? 'حلول المؤسسات' : 'Corporate Solutions'}</option>
          <option value="coaching">{isAr ? 'حجز جلسة كوتشينج' : 'Book a Coaching Session'}</option>
          <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5"
        >
          {isAr ? 'الرسالة' : 'Message'} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          maxLength={5000}
          className={`${inputClasses} resize-y min-h-[120px]`}
          disabled={status === 'submitting'}
        />
      </div>

      {/* Success message */}
      {status === 'success' && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-green-800 text-sm">
          {isAr
            ? 'تم إرسال رسالتك بنجاح. سنعود إليك في أقرب وقت.'
            : 'Your message has been sent successfully. We will get back to you shortly.'}
        </div>
      )}

      {/* Error message */}
      {status === 'error' && errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
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
          : (isAr ? 'أرسل الرسالة' : 'Send Message')}
      </button>
    </form>
  );
}
