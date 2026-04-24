'use client';

import { useState, type FormEvent } from 'react';
import type { LpLeadCaptureConfig, LpLeadField } from '@/lib/lp/composition-types';

interface LpLeadFormProps {
  slug: string;
  locale: string;
  config: LpLeadCaptureConfig;
  /** Optional analytics conversion event name to fire on success. */
  conversionEventName?: string;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

const FIELD_LABELS: Record<LpLeadField, { ar: string; en: string }> = {
  name:    { ar: 'الاسم الكامل', en: 'Full name' },
  email:   { ar: 'البريد الإلكتروني', en: 'Email' },
  phone:   { ar: 'رقم الهاتف', en: 'Phone' },
  message: { ar: 'رسالتك', en: 'Message' },
  company: { ar: 'الشركة / المؤسسة', en: 'Company / organization' },
  role:    { ar: 'دورك', en: 'Your role' },
};

const FIELD_INPUT_TYPE: Record<LpLeadField, string> = {
  name: 'text',
  email: 'email',
  phone: 'tel',
  message: 'textarea',
  company: 'text',
  role: 'text',
};

const FIELD_MAX: Record<LpLeadField, number> = {
  name: 200,
  email: 320,
  phone: 30,
  message: 2000,
  company: 200,
  role: 200,
};

export function LpLeadForm({ slug, locale, config, conversionEventName }: LpLeadFormProps) {
  const isAr = locale === 'ar';
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  function getFieldLabel(field: LpLeadField): string {
    const override = config.field_labels?.[field];
    if (override) {
      return (isAr ? override.ar : override.en) || FIELD_LABELS[field][isAr ? 'ar' : 'en'];
    }
    return FIELD_LABELS[field][isAr ? 'ar' : 'en'];
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, string | undefined> = {
      slug,
      locale,
      _hp: formData.get('_hp') as string,
    };
    for (const f of config.fields) {
      const v = formData.get(f);
      if (typeof v === 'string') payload[f] = v;
    }
    // Capture UTM params from URL (read at submit time so we get current ?utm_*)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const utmSource = params.get('utm_source');
      const utmMedium = params.get('utm_medium');
      const utmCampaign = params.get('utm_campaign');
      if (utmSource) payload.utm_source = utmSource;
      if (utmMedium) payload.utm_medium = utmMedium;
      if (utmCampaign) payload.utm_campaign = utmCampaign;
    }

    try {
      const res = await fetch('/api/lp/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(
          (isAr ? data.error_ar : data.error) ||
            data.error ||
            (isAr ? 'حدث خطأ. حاول لاحقًا.' : 'Something went wrong. Please try again.'),
        );
        return;
      }

      // Fire GA4 conversion event if dataLayer present
      if (typeof window !== 'undefined' && conversionEventName) {
        const w = window as unknown as { dataLayer?: Array<Record<string, unknown>>; gtag?: (...args: unknown[]) => void };
        if (typeof w.gtag === 'function') {
          w.gtag('event', conversionEventName, { lp_slug: slug, locale });
        } else if (Array.isArray(w.dataLayer)) {
          w.dataLayer.push({ event: conversionEventName, lp_slug: slug, locale });
        }
      }

      setStatus('success');

      if (data.redirect_to && typeof window !== 'undefined') {
        // Brief pause so the success state is visible
        setTimeout(() => {
          window.location.href = data.redirect_to as string;
        }, 600);
      }
    } catch {
      setStatus('error');
      setErrorMessage(
        isAr ? 'تعذّر الاتصال. حاول مرة أخرى.' : 'Connection error. Please try again.',
      );
    }
  }

  const inputClasses =
    'block w-full rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-3 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none transition-all duration-200';

  if (status === 'success') {
    return (
      <div className="rounded-2xl bg-white shadow-sm border border-green-100 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-[var(--color-neutral-800)] font-medium leading-relaxed">
          {isAr ? 'شكرًا لك. سنتواصل معك قريبًا.' : 'Thank you. We will be in touch shortly.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir={isAr ? 'rtl' : 'ltr'} noValidate>
      {/* Honeypot (visually hidden, accessible-hidden) */}
      <div className="absolute opacity-0 pointer-events-none" aria-hidden="true" tabIndex={-1}>
        <label htmlFor="lp-hp">Leave empty</label>
        <input type="text" id="lp-hp" name="_hp" tabIndex={-1} autoComplete="off" />
      </div>

      {config.fields.map((f) => {
        const id = `lp-${f}`;
        const label = getFieldLabel(f);
        const required = config.required_fields.includes(f);
        const inputType = FIELD_INPUT_TYPE[f];
        const max = FIELD_MAX[f];

        return (
          <div key={f}>
            <label
              htmlFor={id}
              className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5"
            >
              {label}
              {required && <span className="text-red-500 ms-1">*</span>}
            </label>
            {inputType === 'textarea' ? (
              <textarea
                id={id}
                name={f}
                required={required}
                maxLength={max}
                rows={3}
                disabled={status === 'submitting'}
                className={`${inputClasses} resize-y`}
                dir="auto"
              />
            ) : (
              <input
                id={id}
                name={f}
                type={inputType}
                required={required}
                maxLength={max}
                disabled={status === 'submitting'}
                className={inputClasses}
                dir={f === 'email' || f === 'phone' ? 'ltr' : 'auto'}
              />
            )}
          </div>
        );
      })}

      {(config.consent_text_ar || config.consent_text_en) && (
        <p className="text-xs text-[var(--color-neutral-500)] leading-relaxed">
          {isAr ? config.consent_text_ar : config.consent_text_en}
        </p>
      )}

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
          ? isAr ? 'جارٍ الإرسال…' : 'Sending…'
          : isAr ? 'أرسل' : 'Send'}
      </button>
    </form>
  );
}
