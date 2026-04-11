'use client';

import { useState, useEffect } from 'react';

interface EventRegistrationFormProps {
  eventSlug: string;
  eventName: string;
  isFree: boolean;
  priceAed: number;
  priceEgp: number;
  priceUsd: number;
  capacity?: number;
  locale: string;
  registrationDeadline?: string;
  /** ISO date string for the event start date (e.g. "2026-05-15").
   *  Forwarded to /api/events/register so the server can compute
   *  balance_due_date = event_date - balance_due_days_before_event.
   *  Pass null / omit for "coming soon" events with no confirmed date. */
  eventDate?: string | null;
}

type FormState = 'idle' | 'loading' | 'success' | 'duplicate' | 'error';

const t = {
  ar: {
    free: 'مجاني',
    price: (aed: number) => `${aed} د.إ`,
    registerNow: 'سجّل الآن',
    name: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف (اختياري)',
    namePlaceholder: 'أدخل اسمك الكامل',
    emailPlaceholder: 'أدخل بريدك الإلكتروني',
    phonePlaceholder: '+971 50 000 0000',
    submitting: 'جاري التسجيل...',
    successTitle: 'تم التسجيل بنجاح',
    successNote: 'تحقق من بريدك الإلكتروني للتأكيد',
    duplicateTitle: 'أنت مسجّل بالفعل',
    duplicateNote: 'لقد سجّلت في هذه الفعالية مسبقاً',
    deadline: 'آخر موعد للتسجيل: ',
    seats: (n: number) => `${n} مقعداً متاحاً`,
    errorDefault: 'حدث خطأ، يرجى المحاولة مجدداً',
    requiredName: 'الاسم مطلوب',
    requiredEmail: 'البريد الإلكتروني مطلوب',
    invalidEmail: 'بريد إلكتروني غير صالح',
    loginRequired: 'يرجى تسجيل الدخول للتسجيل في الفعاليات المدفوعة',
  },
  en: {
    free: 'Free',
    price: (aed: number) => `${aed} AED`,
    registerNow: 'Register Now',
    name: 'Full Name',
    email: 'Email Address',
    phone: 'Phone Number (optional)',
    namePlaceholder: 'Enter your full name',
    emailPlaceholder: 'Enter your email address',
    phonePlaceholder: '+971 50 000 0000',
    submitting: 'Registering...',
    successTitle: 'Registration confirmed',
    successNote: 'Check your email for confirmation',
    duplicateTitle: 'Already registered',
    duplicateNote: "You've already registered for this event",
    deadline: 'Registration deadline: ',
    seats: (n: number) => `${n} seats available`,
    errorDefault: 'Something went wrong. Please try again.',
    requiredName: 'Name is required',
    requiredEmail: 'Email is required',
    invalidEmail: 'Invalid email address',
    loginRequired: 'Please sign in to register for paid events',
  },
};

export function EventRegistrationForm({
  eventSlug,
  eventName,
  isFree,
  priceAed,
  capacity,
  locale,
  registrationDeadline,
  eventDate,
}: EventRegistrationFormProps) {
  const isAr = locale === 'ar';
  const copy = isAr ? t.ar : t.en;

  // Auth is optional — guest registration is supported for free events
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  useEffect(() => {
    // Fetch session from next-auth to pre-fill form fields
    fetch('/api/auth/session')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user?.email) {
          setUser({ id: data.user.id ?? '', email: data.user.email });
        }
      })
      .catch(() => {});
  }, []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});

  // Pre-fill email from auth if available
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  function validate(): boolean {
    const errors: { name?: string; email?: string } = {};
    if (!name.trim()) errors.name = copy.requiredName;
    if (!email.trim()) {
      errors.email = copy.requiredEmail;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = copy.invalidEmail;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    // Paid events require auth
    if (!isFree && !user) {
      setErrorMsg(copy.loginRequired);
      setFormState('error');
      return;
    }

    setFormState('loading');
    setErrorMsg('');

    try {
      // price_amount: server expects minor units (AED × 100) for deposit threshold.
      const priceAmountMinorUnits = priceAed > 0 ? Math.round(priceAed * 100) : 0;

      const res = await fetch('/api/events/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_slug: eventSlug,
          event_name: eventName,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          user_id: user?.id,
          is_free: isFree,
          locale,
          // ── Wave S0 Phase 4 #11 ───────────────────────────────────────────
          // event_date: lets the server compute balance_due_date = event_date
          //   minus balance_due_days_before_event (instead of N days from now).
          //   Omitted (null) when the event has no confirmed date yet.
          event_date: eventDate ?? null,
          // price_amount in minor units (AED × 100) for deposit threshold check.
          price_amount: priceAmountMinorUnits,
          // capacity snapshot so the server-side atomic register_for_event()
          // function has the current limit without re-querying the CMS.
          capacity: capacity ?? null,
        }),
      });

      if (res.status === 409) {
        setFormState('duplicate');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data?.message || copy.errorDefault);
        setFormState('error');
        return;
      }

      const data = await res.json();

      // Paid events: redirect to checkout
      if (!isFree && data?.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      setFormState('success');
    } catch {
      setErrorMsg(copy.errorDefault);
      setFormState('error');
    }
  }

  const deadlineStr = registrationDeadline
    ? new Date(registrationDeadline + 'T00:00:00').toLocaleDateString(
        isAr ? 'ar-SA' : 'en-US',
        { month: 'long', day: 'numeric' }
      )
    : null;

  return (
    <div
      className="sticky top-24 rounded-2xl border border-[var(--color-neutral-200)] p-6"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Price display */}
      <div className="text-center mb-5">
        <div
          className="text-2xl font-bold text-[var(--color-primary)]"
          style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
        >
          {isFree ? copy.free : copy.price(priceAed)}
        </div>
      </div>

      {/* Success state */}
      {formState === 'success' && (
        <div className="text-center py-4">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-green-100">
            <svg
              className="w-6 h-6 text-green-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p
            className="font-semibold text-[var(--text-primary)] mb-1"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {copy.successTitle}
          </p>
          <p
            className="text-sm text-[var(--color-neutral-500)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {copy.successNote}
          </p>
        </div>
      )}

      {/* Already registered state */}
      {formState === 'duplicate' && (
        <div className="text-center py-4">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-blue-100">
            <svg
              className="w-6 h-6 text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p
            className="font-semibold text-[var(--text-primary)] mb-1"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {copy.duplicateTitle}
          </p>
          <p
            className="text-sm text-[var(--color-neutral-500)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {copy.duplicateNote}
          </p>
        </div>
      )}

      {/* Registration form */}
      {formState !== 'success' && formState !== 'duplicate' && (
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label
                htmlFor="reg-name"
                className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
              >
                {copy.name}
              </label>
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                required
                aria-required="true"
                aria-describedby={fieldErrors.name ? 'reg-name-error' : undefined}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined }));
                }}
                placeholder={copy.namePlaceholder}
                className="w-full rounded-xl border border-[var(--color-neutral-300)] px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
              />
              {fieldErrors.name && (
                <p
                  id="reg-name-error"
                  role="alert"
                  className="mt-1.5 text-xs text-red-600"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                >
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="reg-email"
                className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
              >
                {copy.email}
              </label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                required
                aria-required="true"
                aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
                }}
                placeholder={copy.emailPlaceholder}
                className="w-full rounded-xl border border-[var(--color-neutral-300)] px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
              />
              {fieldErrors.email && (
                <p
                  id="reg-email-error"
                  role="alert"
                  className="mt-1.5 text-xs text-red-600"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                >
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="reg-phone"
                className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
              >
                {copy.phone}
              </label>
              <input
                id="reg-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={copy.phonePlaceholder}
                className="w-full rounded-xl border border-[var(--color-neutral-300)] px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
              />
            </div>

            {/* Error message */}
            {formState === 'error' && errorMsg && (
              <p
                role="alert"
                className="text-sm text-red-600 text-center"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
              >
                {errorMsg}
              </p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={formState === 'loading'}
              aria-busy={formState === 'loading'}
              className="w-full rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
            >
              {formState === 'loading' ? copy.submitting : copy.registerNow}
            </button>
          </div>
        </form>
      )}

      {/* Deadline */}
      {deadlineStr && (
        <p
          className="text-xs text-center text-[var(--color-neutral-500)] mt-3"
          style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
        >
          {copy.deadline}
          {deadlineStr}
        </p>
      )}

      {/* Capacity */}
      {capacity && (
        <p
          className="text-xs text-center text-[var(--color-neutral-500)] mt-2"
          style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
        >
          {copy.seats(capacity)}
        </p>
      )}
    </div>
  );
}
