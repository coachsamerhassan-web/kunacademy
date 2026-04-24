'use client';

/**
 * DonationForm — client component for /donate.
 *
 * Wave E.3 (2026-04-25).
 *
 * Flow:
 *   1. Donor picks tier (Seed / Branch / Trunk / Canopy / Forest/custom).
 *   2. Picks currency (default AED; geo-detection via /api/geo).
 *   3. Picks designation (GPS / Ihya / Wisal / Seeds / wherever most needed).
 *   4. Enters name + email + optional message + optional anonymous flag.
 *   5. POST /api/donations/create-intent → returns Checkout Session URL.
 *   6. Client navigates to Stripe Checkout hosted page.
 *   7. On success → Stripe redirects to /[locale]/donate/success?session_id=...
 *   8. On cancel → Stripe redirects to /[locale]/donate/cancel
 *
 * Stripe Checkout natively supports card + Apple Pay + Google Pay + Link
 * without any client-side Stripe SDK. No deps added to apps/web.
 *
 * Dignity-framing: copy avoids banned words. Tier labels use Kun
 * tree metaphor (Seed / Branch / Trunk / Canopy).
 *
 * Bilingual: all strings carry AR + EN via `isAr` conditional. Latin
 * numerals inside Arabic paragraphs wrap with <bdi dir="ltr"> to prevent
 * BiDi reordering (per feedback_bidi_hyphen_rtl_dates.md).
 */

import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { Button } from '@kunacademy/ui';

type Currency = 'AED' | 'USD' | 'EUR' | 'SAR' | 'EGP' | 'GBP';
type Designation = 'gps' | 'ihya' | 'wisal' | 'seeds' | 'any';

interface TierOption {
  id: string;
  aed_major: number;
  label_ar: string;
  label_en: string;
  sub_ar: string;
  sub_en: string;
}

/**
 * Preset tiers per spec §6.1 (AED-anchored). Displayed values convert at
 * the rates below (rough, UI-only — Stripe settles in the native currency
 * and FX is Stripe-side). Not aiming for daily-accurate rates — donors
 * who care about exact AED equivalent can type a custom amount.
 */
const TIERS: ReadonlyArray<TierOption> = [
  {
    id: 'seed',
    aed_major: 100,
    label_ar: 'بذرة',
    label_en: 'Seed',
    sub_ar: 'ازرع بذرة لرحلة مدرِّب أو خرّيج قادم',
    sub_en: 'Plant a seed for a future coach or graduate',
  },
  {
    id: 'branch',
    aed_major: 500,
    label_ar: 'غصن',
    label_en: 'Branch',
    sub_ar: 'ادعم يومًا كاملاً من برنامج لمتقدّم',
    sub_en: 'Fund a full program day for an applicant',
  },
  {
    id: 'trunk',
    aed_major: 2000,
    label_ar: 'جذع',
    label_en: 'Trunk',
    sub_ar: 'غطِّ جزءًا من منحة برنامج كبير',
    sub_en: 'Cover a partial scholarship toward a big program',
  },
  {
    id: 'canopy',
    aed_major: 10000,
    label_ar: 'ظلّ وارف',
    label_en: 'Canopy',
    sub_ar: 'ادعم منحة كاملة لمتقدّم واحد',
    sub_en: 'Fund a full scholarship for one applicant',
  },
  {
    id: 'forest',
    aed_major: 0, // 0 = custom amount
    label_ar: 'غابة',
    label_en: 'Forest',
    sub_ar: 'سمِّ قدرك الخاص',
    sub_en: 'Name your own gift',
  },
];

/** Rough major-unit conversion factors from AED — UI hint only. Stripe
 *  handles actual FX at settlement. */
const AED_TO: Record<Currency, number> = {
  AED: 1,
  USD: 0.27,
  EUR: 0.25,
  SAR: 1.02,
  EGP: 13.5,
  GBP: 0.22,
};

const CURRENCY_SYMBOL: Record<Currency, string> = {
  AED: 'AED',
  USD: 'USD',
  EUR: 'EUR',
  SAR: 'SAR',
  EGP: 'EGP',
  GBP: 'GBP',
};

const MIN_AMOUNT_MAJOR: Record<Currency, number> = {
  AED: 10,
  USD: 3,
  EUR: 3,
  SAR: 10,
  EGP: 100,
  GBP: 3,
};

const MAX_AMOUNT_MAJOR: Record<Currency, number> = {
  AED: 250_000,
  USD: 70_000,
  EUR: 65_000,
  SAR: 260_000,
  EGP: 3_500_000,
  GBP: 55_000,
};

/**
 * Detect the user's default currency from /api/geo, falling back to AED.
 * Runs once on mount. Non-blocking — form is usable during detection.
 */
function useGeoCurrency(): Currency {
  const [currency, setCurrency] = useState<Currency>('AED');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/geo')
      .then((r) => r.json())
      .then((geo: { country?: string; is_egypt?: boolean }) => {
        if (cancelled || !geo) return;
        if (geo.is_egypt || geo.country === 'EG') setCurrency('EGP');
        else if (geo.country === 'SA') setCurrency('SAR');
        else if (
          geo.country &&
          ['AE', 'KW', 'QA', 'BH', 'OM'].includes(geo.country)
        )
          setCurrency('AED');
        else if (
          geo.country &&
          ['US', 'CA'].includes(geo.country)
        )
          setCurrency('USD');
        else if (
          geo.country &&
          ['GB', 'IE'].includes(geo.country)
        )
          setCurrency('GBP');
        else if (
          geo.country &&
          ['DE', 'FR', 'IT', 'ES', 'NL', 'AT', 'BE', 'PT', 'FI', 'GR'].includes(
            geo.country,
          )
        )
          setCurrency('EUR');
      })
      .catch(() => {
        /* keep AED fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return currency;
}

export function DonationForm({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const detectedCurrency = useGeoCurrency();

  const [currency, setCurrency] = useState<Currency>('AED');
  const [tierId, setTierId] = useState<string>('branch'); // default Branch (500 AED)
  const [customAmount, setCustomAmount] = useState<string>('');
  const [designation, setDesignation] = useState<Designation>('any');
  const [donorName, setDonorName] = useState<string>('');
  const [donorEmail, setDonorEmail] = useState<string>('');
  const [donorMessage, setDonorMessage] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // Apply geo-detected currency when it resolves (only if still on AED default)
  useEffect(() => {
    if (detectedCurrency !== 'AED' && currency === 'AED') {
      setCurrency(detectedCurrency);
    }
    // intentionally omit `currency` from deps — only react to detection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedCurrency]);

  const selectedTier = TIERS.find((t) => t.id === tierId)!;
  const isCustom = selectedTier.id === 'forest';

  // Displayed amount in current currency's major unit
  function displayAmountMajor(tier: TierOption, cur: Currency): number {
    if (tier.aed_major === 0) return 0;
    const raw = tier.aed_major * AED_TO[cur];
    // Round to nearest meaningful unit per currency
    if (cur === 'EGP') return Math.round(raw / 10) * 10;
    if (['USD', 'EUR', 'GBP'].includes(cur)) return Math.round(raw / 5) * 5;
    return Math.round(raw);
  }

  // Resolve the final amount (major units) being submitted
  function resolveAmountMajor(): number | null {
    if (isCustom) {
      const parsed = Number(customAmount);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      return parsed;
    }
    return displayAmountMajor(selectedTier, currency);
  }

  function validateAmount(major: number | null): boolean {
    if (major === null || !Number.isFinite(major) || major <= 0) return false;
    if (major < MIN_AMOUNT_MAJOR[currency]) return false;
    if (major > MAX_AMOUNT_MAJOR[currency]) return false;
    return true;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorKey(null);

    const amountMajor = resolveAmountMajor();
    if (!validateAmount(amountMajor)) {
      setErrorKey('invalid-amount');
      return;
    }
    if (!donorName.trim() || donorName.trim().length > 120) {
      setErrorKey('invalid-name');
      return;
    }
    if (!donorEmail.trim() || donorEmail.trim().length > 254) {
      setErrorKey('invalid-email');
      return;
    }
    if (donorMessage.length > 280) {
      setErrorKey('message-too-long');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        amount_minor: Math.round((amountMajor as number) * 100),
        currency,
        designation_preference: designation,
        is_anonymous: isAnonymous,
        donor: {
          name: donorName.trim(),
          email: donorEmail.trim(),
          message: donorMessage.trim() || null,
          locale,
        },
      };
      const res = await fetch('/api/donations/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorKey(data.error || 'submit-failed');
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        // Keep submitting=true so button stays disabled during navigation
        return;
      }
      setErrorKey('no-redirect-url');
      setSubmitting(false);
    } catch {
      setErrorKey('network-error');
      setSubmitting(false);
    }
  }

  // ─── Error messages (dignity-compliant; no banned words) ────────────────
  const errorMessage: Record<string, { ar: string; en: string }> = {
    'invalid-amount': {
      ar: 'المبلغ غير صالح. يرجى اختيار قيمة مناسبة.',
      en: 'Amount is not valid. Please choose a supported value.',
    },
    'invalid-name': {
      ar: 'الاسم غير صالح. أدخل اسمك الكامل.',
      en: 'Name is not valid. Please enter your full name.',
    },
    'invalid-email': {
      ar: 'البريد الإلكتروني غير صالح.',
      en: 'Email is not valid.',
    },
    'message-too-long': {
      ar: 'الرسالة أطول من المسموح. اختصرها إلى 280 حرفًا.',
      en: 'Message is too long. Keep it under 280 characters.',
    },
    'submit-failed': {
      ar: 'تعذّر إتمام الطلب. يرجى المحاولة لاحقًا.',
      en: 'We could not complete your request. Please try again shortly.',
    },
    'no-redirect-url': {
      ar: 'حدث خطأ مؤقت. يرجى إعادة المحاولة.',
      en: 'A temporary issue occurred. Please try again.',
    },
    'network-error': {
      ar: 'تعذّر الاتصال بالخادم. تحقّق من اتصالك وأعد المحاولة.',
      en: 'Could not reach the server. Check your connection and retry.',
    },
    'rate-limited': {
      ar: 'تم تجاوز حدّ المحاولات. يرجى الانتظار قليلاً.',
      en: 'Too many attempts. Please wait a moment and try again.',
    },
    'cross-origin-forbidden': {
      ar: 'طلب غير مسموح به.',
      en: 'Request not allowed.',
    },
  };

  function renderError(): ReactNode {
    if (!errorKey) return null;
    const e = errorMessage[errorKey] ?? {
      ar: 'حدث خطأ غير متوقَّع.',
      en: 'An unexpected error occurred.',
    };
    return (
      <div
        role="alert"
        className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300"
      >
        {isAr ? e.ar : e.en}
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Amount tiers */}
      <fieldset>
        <legend className="block text-sm font-medium text-[var(--color-neutral-700)] mb-3">
          {isAr ? 'اختر قيمة المساهمة' : 'Choose contribution amount'}
        </legend>
        <div
          role="radiogroup"
          aria-label={isAr ? 'قيمة المساهمة' : 'Contribution amount'}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {TIERS.map((tier) => {
            const selected = tier.id === tierId;
            const amountDisplay =
              tier.id === 'forest'
                ? isAr
                  ? 'قيمة مخصّصة'
                  : 'Custom amount'
                : `${displayAmountMajor(tier, currency).toLocaleString(
                    isAr ? 'ar-EG' : 'en-US',
                  )} ${CURRENCY_SYMBOL[currency]}`;
            return (
              <label
                key={tier.id}
                className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition min-h-[44px] ${
                  selected
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-neutral-200)] hover:border-[var(--color-primary)]/60'
                }`}
              >
                <input
                  type="radio"
                  name="tier"
                  value={tier.id}
                  checked={selected}
                  onChange={() => setTierId(tier.id)}
                  className="mt-1 accent-[var(--color-primary)]"
                  aria-label={isAr ? tier.label_ar : tier.label_en}
                />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-base">
                      {isAr ? tier.label_ar : tier.label_en}
                    </span>
                    <span
                      className="text-sm font-semibold text-[var(--color-primary)]"
                      dir={isAr && tier.id !== 'forest' ? 'ltr' : undefined}
                    >
                      {amountDisplay}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-neutral-500)] mt-1">
                    {isAr ? tier.sub_ar : tier.sub_en}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Custom amount input (Forest tier) */}
      {isCustom && (
        <div>
          <label
            htmlFor="custom-amount"
            className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2"
          >
            {isAr
              ? `أدخل قيمة المساهمة (${CURRENCY_SYMBOL[currency]})`
              : `Enter contribution amount (${CURRENCY_SYMBOL[currency]})`}
          </label>
          <input
            id="custom-amount"
            type="number"
            inputMode="decimal"
            min={MIN_AMOUNT_MAJOR[currency]}
            max={MAX_AMOUNT_MAJOR[currency]}
            step="1"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base min-h-[44px] focus:border-[var(--color-primary)] focus:outline-none"
            placeholder={
              isAr
                ? `الحد الأدنى ${MIN_AMOUNT_MAJOR[currency]}`
                : `Minimum ${MIN_AMOUNT_MAJOR[currency]}`
            }
            dir="ltr"
          />
          <p className="text-xs text-[var(--color-neutral-500)] mt-1">
            {isAr
              ? (
                <>
                  النطاق المقبول: من{' '}
                  <bdi dir="ltr">{MIN_AMOUNT_MAJOR[currency].toLocaleString('en-US')}</bdi>
                  {' '}إلى{' '}
                  <bdi dir="ltr">{MAX_AMOUNT_MAJOR[currency].toLocaleString('en-US')}</bdi>
                  {' '}{CURRENCY_SYMBOL[currency]}.
                </>
              )
              : `Accepted range: ${MIN_AMOUNT_MAJOR[currency].toLocaleString('en-US')} to ${MAX_AMOUNT_MAJOR[currency].toLocaleString('en-US')} ${CURRENCY_SYMBOL[currency]}.`}
          </p>
        </div>
      )}

      {/* Currency */}
      <div>
        <label
          htmlFor="currency-select"
          className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2"
        >
          {isAr ? 'العملة' : 'Currency'}
        </label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={isAr ? 'العملة' : 'Currency'}>
          {(['AED', 'USD', 'EUR', 'SAR', 'EGP', 'GBP'] as Currency[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              aria-pressed={currency === c}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition min-h-[44px] ${
                currency === c
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'border border-[var(--color-neutral-300)] hover:border-[var(--color-primary)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Designation */}
      <div>
        <label
          htmlFor="designation-select"
          className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2"
        >
          {isAr ? 'أفضّل أن تُخصَّص مساهمتي لـ' : 'Preference for program'}
        </label>
        <select
          id="designation-select"
          value={designation}
          onChange={(e) => setDesignation(e.target.value as Designation)}
          className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base min-h-[44px] focus:border-[var(--color-primary)] focus:outline-none"
        >
          <option value="any">
            {isAr ? 'حيث الاحتياج أكبر' : 'Wherever most needed'}
          </option>
          <option value="gps">GPS</option>
          <option value="ihya">{isAr ? 'إحياء Ihya' : 'Ihya'}</option>
          <option value="wisal">{isAr ? 'وِصال Wisal' : 'Wisal'}</option>
          <option value="seeds">{isAr ? 'بذور Seeds' : 'Seeds'}</option>
        </select>
        <p className="text-xs text-[var(--color-neutral-500)] mt-1">
          {isAr
            ? 'التفضيل إرشاديّ؛ قد تُعاد التخصيص حسب الحاجة الفعليّة.'
            : 'Preference only — allocation may shift based on actual need.'}
        </p>
      </div>

      {/* Donor info */}
      <div className="space-y-4">
        <div>
          <label
            htmlFor="donor-name"
            className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2"
          >
            {isAr ? 'الاسم' : 'Name'}
          </label>
          <input
            id="donor-name"
            type="text"
            required
            maxLength={120}
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base min-h-[44px] focus:border-[var(--color-primary)] focus:outline-none"
            autoComplete="name"
          />
        </div>
        <div>
          <label
            htmlFor="donor-email"
            className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2"
          >
            {isAr ? 'البريد الإلكتروني' : 'Email'}
          </label>
          <input
            id="donor-email"
            type="email"
            required
            maxLength={254}
            value={donorEmail}
            onChange={(e) => setDonorEmail(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base min-h-[44px] focus:border-[var(--color-primary)] focus:outline-none"
            autoComplete="email"
            dir="ltr"
          />
        </div>
        <div>
          <label
            htmlFor="donor-message"
            className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2"
          >
            {isAr
              ? 'رسالة للمتقدّم (اختياريّة — حتى 280 حرفًا)'
              : 'Message to the applicant (optional — up to 280 characters)'}
          </label>
          <textarea
            id="donor-message"
            maxLength={280}
            rows={3}
            value={donorMessage}
            onChange={(e) => setDonorMessage(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base focus:border-[var(--color-primary)] focus:outline-none"
          />
          <p className="text-xs text-[var(--color-neutral-500)] mt-1">
            {isAr
              ? (
                <>
                  <bdi dir="ltr">{donorMessage.length}</bdi>
                  {' / '}
                  <bdi dir="ltr">280</bdi>
                </>
              )
              : `${donorMessage.length} / 280`}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <input
            id="anonymous"
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="mt-1 accent-[var(--color-primary)] min-h-[20px] min-w-[20px]"
          />
          <label htmlFor="anonymous" className="text-sm text-[var(--color-neutral-700)]">
            {isAr
              ? 'اجعل مساهمتي مجهولة (اسمي لن يظهر في لوحة الشفافية)'
              : 'Keep my contribution anonymous (my name will not appear on the transparency board)'}
          </label>
        </div>
      </div>

      {renderError()}

      <div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={submitting}
        >
          {submitting
            ? isAr
              ? 'جارٍ التحويل إلى بوابة الدفع...'
              : 'Redirecting to payment gateway...'
            : isAr
              ? 'متابعة إلى الدفع الآمن'
              : 'Continue to secure payment'}
        </Button>
        <p className="text-xs text-[var(--color-neutral-500)] mt-3 text-center">
          {isAr
            ? 'سيُنقَل إلى صفحة Stripe الآمنة لإتمام الدفع.'
            : 'You will be taken to Stripe\u2019s secure page to complete payment.'}
        </p>
      </div>
    </form>
  );
}
