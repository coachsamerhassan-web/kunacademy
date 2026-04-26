'use client';

/**
 * /[locale]/dashboard/membership — Wave F.4 + F.6 (2026-04-27)
 *
 * Member dashboard surface. Shows:
 *   1. Current tier card (name, status, billing frequency, next renewal)
 *   2. Entitlements list (features the user has access to)
 *   3. Auto-coupon (Paid-1+ only) — code + scope + expiry + copy button
 *   4. Monthly Q&A — registration buttons (AR / EN), shows registered status
 *   5. Upgrade CTA (if Free) or Cancel/Resume CTA (if Paid; F.6 wires the full flow)
 *
 * F.6 changes:
 *   - Cancel CTA wired to POST /api/membership/cancel with bilingual modal
 *     (no native window.confirm/alert — proper Modal with optional reason)
 *   - Resume membership CTA visible when cancel_at is set (calls /reactivate)
 *
 * IP rule: NO program methodology in any copy here.
 */

import { useEffect, useState, use, useCallback } from 'react';
import { useAuth } from '@kunacademy/auth';

interface Tier {
  slug: string;
  name_ar: string;
  name_en: string;
  price_monthly_cents: number;
  price_annual_cents: number;
  currency: string;
}

interface Feature {
  feature_key: string;
  name_ar: string;
  name_en: string;
  quota: number | null;
  config: Record<string, unknown> | null;
}

interface AutoCoupon {
  code: string;
  value: number;
  currency: string | null;
  valid_to: string | null;
  scope_program_ids: string[];
}

interface MembershipResponse {
  tier: Tier;
  status: 'active' | 'past_due' | 'paused' | 'trialing' | 'cancelled' | 'expired';
  billing_frequency: 'monthly' | 'annual' | null;
  started_at: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  features: Feature[];
  auto_coupon: AutoCoupon | null;
  qa_registrations: Record<string, string> | null;
}

function formatDate(iso: string | null, locale: 'ar' | 'en'): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatMoneyMinor(minor: number, currency: string, locale: 'ar' | 'en'): string {
  try {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(0)} ${currency}`;
  }
}

export default function MembershipDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState<MembershipResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error' | 'no_membership'>(
    'loading',
  );
  const [copyOk, setCopyOk] = useState(false);
  const [qaBusyAr, setQaBusyAr] = useState(false);
  const [qaBusyEn, setQaBusyEn] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  // F.6 cancel/reactivate UI state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelToast, setCancelToast] = useState<string | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeToast, setResumeToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const r = await fetch('/api/membership/me');
    if (r.ok) {
      const j = (await r.json()) as MembershipResponse;
      setData(j);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoadState('error');
      return;
    }
    fetch('/api/membership/me')
      .then((r) => {
        if (r.status === 404) {
          setLoadState('no_membership');
          return null;
        }
        if (!r.ok) {
          throw new Error(`status ${r.status}`);
        }
        return r.json();
      })
      .then((d) => {
        if (d) {
          setData(d as MembershipResponse);
          setLoadState('loaded');
        }
      })
      .catch(() => setLoadState('error'));
  }, [user, authLoading]);

  // Auto-dismiss toasts after 5s
  useEffect(() => {
    if (!cancelToast && !resumeToast) return;
    const t = setTimeout(() => {
      setCancelToast(null);
      setResumeToast(null);
    }, 5000);
    return () => clearTimeout(t);
  }, [cancelToast, resumeToast]);

  if (authLoading || loadState === 'loading') {
    return (
      <main className="container mx-auto px-4 py-12" dir={dir}>
        <p className="text-[var(--color-neutral-500)] text-center">
          {isAr ? '...جارٍ التحميل' : 'Loading…'}
        </p>
      </main>
    );
  }

  if (loadState === 'error' || !user) {
    return (
      <main className="container mx-auto px-4 py-12" dir={dir}>
        <p className="text-[var(--color-neutral-700)] text-center">
          {isAr
            ? 'يلزم تسجيل الدخول لعرض هذه الصفحة.'
            : 'Sign in to view your membership.'}
        </p>
        <div className="text-center mt-4">
          <a
            href={`/${locale}/auth/login?redirect=/${locale}/dashboard/membership`}
            className="inline-block rounded-xl bg-[var(--color-primary)] px-6 py-3 text-white font-semibold"
          >
            {isAr ? 'تسجيل الدخول' : 'Sign in'}
          </a>
        </div>
      </main>
    );
  }

  if (loadState === 'no_membership' || !data) {
    return (
      <main className="container mx-auto px-4 py-12" dir={dir}>
        <h1
          className="text-2xl font-bold mb-4"
          style={{ fontFamily: headingFont }}
        >
          {isAr ? 'العضويّة' : 'Membership'}
        </h1>
        <p className="text-[var(--color-neutral-700)]">
          {isAr
            ? 'لا توجد عضويّة نشطة. يمكنك الانضمام إلى الباقة المجانيّة من هنا.'
            : 'No active membership. Start with the Free tier:'}
        </p>
        <a
          href={`/${locale}/membership`}
          className="inline-block mt-6 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-white font-semibold"
        >
          {isAr ? 'الانضمام' : 'Join'}
        </a>
      </main>
    );
  }

  const isPaid = data.tier.slug !== 'free';
  const tierName = isAr ? data.tier.name_ar : data.tier.name_en;
  const periodLabel =
    data.billing_frequency === 'annual'
      ? isAr
        ? 'سنويّ'
        : 'Annual'
      : data.billing_frequency === 'monthly'
        ? isAr
          ? 'شهريّ'
          : 'Monthly'
        : '—';

  const onCopy = async () => {
    if (!data.auto_coupon?.code) return;
    try {
      await navigator.clipboard.writeText(data.auto_coupon.code);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch {
      /* no-op */
    }
  };

  const onQaRegister = async (lang: 'ar' | 'en') => {
    setQaError(null);
    if (lang === 'ar') setQaBusyAr(true);
    else setQaBusyEn(true);
    try {
      const r = await fetch('/api/qa/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });
      const j = await r.json();
      if (!r.ok) {
        setQaError(j?.error || `error_${r.status}`);
      } else {
        await reload();
      }
    } catch {
      setQaError('network_error');
    } finally {
      if (lang === 'ar') setQaBusyAr(false);
      else setQaBusyEn(false);
    }
  };

  const onConfirmCancel = async () => {
    setCancelError(null);
    setCancelBusy(true);
    try {
      const r = await fetch('/api/membership/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_reason: cancelReason.trim() || null }),
      });
      const j = await r.json();
      if (!r.ok) {
        setCancelError(j?.error || `error_${r.status}`);
        setCancelBusy(false);
        return;
      }
      setCancelToast(
        isAr
          ? 'تم إلغاء العضويّة. سيستمر وصولك حتى نهاية فترة الفواتير الحاليّة.'
          : 'Membership cancelled. Access continues until the end of the current billing period.',
      );
      setCancelModalOpen(false);
      setCancelReason('');
      await reload();
    } catch {
      setCancelError('network_error');
    } finally {
      setCancelBusy(false);
    }
  };

  const onResume = async () => {
    setResumeError(null);
    setResumeBusy(true);
    try {
      const r = await fetch('/api/membership/reactivate', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) {
        setResumeError(j?.error || `error_${r.status}`);
        setResumeBusy(false);
        return;
      }
      setResumeToast(
        isAr ? 'تم استئناف عضويّتك.' : 'Your membership has been resumed.',
      );
      await reload();
    } catch {
      setResumeError('network_error');
    } finally {
      setResumeBusy(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl" dir={dir}>
      <h1
        className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-8"
        style={{ fontFamily: headingFont }}
      >
        {isAr ? 'عضويّتي' : 'My Membership'}
      </h1>

      {/* Toasts */}
      {(cancelToast || resumeToast) && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 text-sm"
        >
          {cancelToast || resumeToast}
        </div>
      )}

      {/* 1. Tier card */}
      <section className="mb-6 rounded-2xl border border-[var(--color-neutral-100)] bg-white p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-sm text-[var(--color-neutral-500)] mb-1">
              {isAr ? 'الباقة الحاليّة' : 'Current tier'}
            </p>
            <h2
              className="text-xl md:text-2xl font-bold text-[var(--text-primary)]"
              style={{ fontFamily: headingFont }}
            >
              {tierName}
            </h2>
            <p className="text-sm text-[var(--color-neutral-600)] mt-1">
              {data.status === 'active' && (isAr ? 'نشطة' : 'Active')}
              {data.status === 'past_due' && (isAr ? 'متأخّر السداد' : 'Past due')}
              {data.status === 'paused' && (isAr ? 'متوقّفة مؤقّتًا' : 'Paused')}
              {data.status === 'trialing' && (isAr ? 'تجريبيّة' : 'Trialing')}
              {data.status === 'cancelled' && (isAr ? 'ملغاة' : 'Cancelled')}
              {data.status === 'expired' && (isAr ? 'منتهية' : 'Expired')}
            </p>
          </div>
          <div className="text-right rtl:text-left">
            {isPaid && (
              <p className="text-2xl font-bold text-[var(--color-primary)]">
                {data.billing_frequency === 'annual'
                  ? formatMoneyMinor(data.tier.price_annual_cents, data.tier.currency, locale as 'ar' | 'en')
                  : formatMoneyMinor(data.tier.price_monthly_cents, data.tier.currency, locale as 'ar' | 'en')}
                <span className="text-sm font-normal text-[var(--color-neutral-500)] ms-2">
                  /{periodLabel}
                </span>
              </p>
            )}
          </div>
        </div>

        {data.cancel_at && (
          <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            {isAr
              ? `لقد ألغيت اشتراكك. سيستمر وصولك حتى ${formatDate(data.cancel_at, 'ar')}.`
              : `Your subscription is cancelled. Access continues until ${formatDate(data.cancel_at, 'en')}.`}
          </div>
        )}

        {data.status === 'past_due' && !data.cancel_at && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-900">
            {isAr
              ? 'لم نتمكّن من تحصيل قيمة التجديد. يرجى تحديث بيانات بطاقتك. وصولك مستمرٌّ مؤقّتًا.'
              : 'We couldn’t process your renewal payment. Please update your card details. Your access continues during automatic retries.'}
          </div>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {data.current_period_end && !data.cancel_at && (
            <div>
              <dt className="text-[var(--color-neutral-500)] mb-0.5">
                {isAr ? 'تاريخ التجديد القادم' : 'Next renewal'}
              </dt>
              <dd className="font-medium">{formatDate(data.current_period_end, locale as 'ar' | 'en')}</dd>
            </div>
          )}
          <div>
            <dt className="text-[var(--color-neutral-500)] mb-0.5">
              {isAr ? 'العضو منذ' : 'Member since'}
            </dt>
            <dd className="font-medium">{formatDate(data.started_at, locale as 'ar' | 'en')}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-3 mt-6">
          {!isPaid && (
            <a
              href={`/${locale}/membership/upgrade`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-white font-semibold hover:bg-[var(--color-primary-700)] min-h-[44px]"
            >
              {isAr ? 'الترقية إلى Paid-1' : 'Upgrade to Paid-1'}
            </a>
          )}
          {isPaid && data.cancel_at && (
            <button
              type="button"
              data-testid="resume-membership-button"
              onClick={onResume}
              disabled={resumeBusy}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-white font-semibold hover:bg-[var(--color-primary-700)] min-h-[44px] disabled:opacity-50"
            >
              {resumeBusy
                ? (isAr ? 'جارٍ الاستئناف…' : 'Resuming…')
                : (isAr ? 'استئناف العضويّة' : 'Resume membership')}
            </button>
          )}
          {isPaid && !data.cancel_at && (
            <button
              type="button"
              data-testid="cancel-membership-stub"
              onClick={() => {
                setCancelError(null);
                setCancelReason('');
                setCancelModalOpen(true);
              }}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--color-neutral-200)] bg-white px-5 py-2.5 text-[var(--color-neutral-700)] hover:border-[var(--color-neutral-400)] min-h-[44px]"
            >
              {isAr ? 'إلغاء العضويّة' : 'Cancel membership'}
            </button>
          )}
        </div>
        {resumeError && (
          <p className="text-sm text-rose-700 mt-3">
            {isAr ? `حدث خطأ: ${resumeError}` : `Error: ${resumeError}`}
          </p>
        )}
      </section>

      {/* Cancel modal */}
      {cancelModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCancelModalOpen(false);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 md:p-8 shadow-2xl"
            dir={dir}
          >
            <h2
              id="cancel-modal-title"
              className="text-xl font-bold mb-3 text-[var(--text-primary)]"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'تأكيد إلغاء العضويّة' : 'Cancel membership?'}
            </h2>
            <p className="text-sm text-[var(--color-neutral-700)] leading-relaxed mb-4">
              {isAr
                ? `سيستمر وصولك حتى ${formatDate(data.current_period_end, 'ar')}. يمكنك استئناف العضويّة قبل ذلك التاريخ بضغطة واحدة، دون أيّ رسوم إضافيّة.`
                : `Your access continues until ${formatDate(data.current_period_end, 'en')}. You can resume your membership before that date in one click, with no extra charge.`}
            </p>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              {isAr ? 'سبب الإلغاء (اختياري):' : 'Reason for leaving (optional):'}
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value.slice(0, 280))}
              maxLength={280}
              rows={3}
              placeholder={isAr ? 'يساعدنا فهم سببك على التحسّن.' : 'Knowing why helps us improve.'}
              className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none mb-4"
            />
            {cancelError && (
              <p className="text-sm text-rose-700 mb-3">
                {isAr ? `حدث خطأ: ${cancelError}` : `Error: ${cancelError}`}
              </p>
            )}
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                disabled={cancelBusy}
                className="rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-neutral-700)] hover:border-[var(--color-neutral-400)] min-h-[44px]"
              >
                {isAr ? 'لا، أعدني' : 'Keep my membership'}
              </button>
              <button
                type="button"
                data-testid="cancel-membership-confirm"
                onClick={onConfirmCancel}
                disabled={cancelBusy}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 min-h-[44px]"
              >
                {cancelBusy
                  ? (isAr ? 'جارٍ الإلغاء…' : 'Cancelling…')
                  : (isAr ? 'تأكيد الإلغاء' : 'Confirm cancellation')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Auto-coupon (Paid-1 only) */}
      {data.auto_coupon && (
        <section className="mb-6 rounded-2xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)]/40 p-6 md:p-8">
          <h3
            className="text-lg font-bold text-[var(--text-primary)] mb-2"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'كود الخصم الخاصّ بك' : 'Your member discount code'}
          </h3>
          <p className="text-sm text-[var(--color-neutral-600)] mb-4">
            {isAr
              ? `خصم ${data.auto_coupon.value}٪ على البرامج الكبرى المُؤهّلة. استخدمه عند الدفع.`
              : `${data.auto_coupon.value}% off eligible flagship programs. Use it at checkout.`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="font-mono text-lg font-bold text-[var(--color-primary)] bg-white border border-[var(--color-primary-100)] rounded-lg px-4 py-2 select-all">
              {data.auto_coupon.code}
            </code>
            <button
              type="button"
              onClick={onCopy}
              className="rounded-xl border border-[var(--color-primary)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] min-h-[44px]"
            >
              {copyOk ? (isAr ? 'تم النسخ ✓' : 'Copied ✓') : isAr ? 'نسخ' : 'Copy'}
            </button>
          </div>
          {data.auto_coupon.valid_to && (
            <p className="text-xs text-[var(--color-neutral-500)] mt-3">
              {isAr ? 'صالح حتى:' : 'Valid until:'}{' '}
              {formatDate(data.auto_coupon.valid_to, locale as 'ar' | 'en')}
            </p>
          )}
        </section>
      )}

      {/* 3. Entitlements list */}
      <section className="mb-6 rounded-2xl border border-[var(--color-neutral-100)] bg-white p-6 md:p-8">
        <h3
          className="text-lg font-bold text-[var(--text-primary)] mb-4"
          style={{ fontFamily: headingFont }}
        >
          {isAr ? 'ما تتضمّنه باقتك' : 'Your entitlements'}
        </h3>
        {data.features.length === 0 ? (
          <p className="text-sm text-[var(--color-neutral-500)]">
            {isAr ? '—' : 'No features available.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {data.features.map((f) => (
              <li key={f.feature_key} className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    {isAr ? f.name_ar : f.name_en}
                  </p>
                  {f.quota !== null && (
                    <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
                      {isAr ? `الحدّ: ${f.quota}` : `Quota: ${f.quota}`}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Q&A registration (Paid-1 only) */}
      {isPaid && data.features.some((f) => f.feature_key === 'live_qa_monthly') && (
        <section className="mb-6 rounded-2xl border border-[var(--color-neutral-100)] bg-white p-6 md:p-8">
          <h3
            className="text-lg font-bold text-[var(--text-primary)] mb-2"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'جلسة Q&A الشهريّة' : 'Monthly Q&A'}
          </h3>
          <p className="text-sm text-[var(--color-neutral-600)] mb-4">
            {isAr
              ? 'سجّل اهتمامك بحضور الجلسة الشهريّة باللغة التي تختارها. ستصلك التفاصيل بالبريد قبل الموعد.'
              : 'Register for the monthly Q&A in the language you prefer. Details will be emailed ahead of time.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={qaBusyAr}
              onClick={() => onQaRegister('ar')}
              className="rounded-xl border border-[var(--color-primary)] bg-white px-5 py-2.5 font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] disabled:opacity-50 min-h-[44px]"
            >
              {data.qa_registrations?.ar
                ? isAr
                  ? 'مسجَّل (عربيّ) — تحديث'
                  : 'Registered (Arabic) — refresh'
                : isAr
                  ? 'سجّلني (عربيّ)'
                  : 'Register (Arabic)'}
            </button>
            <button
              type="button"
              disabled={qaBusyEn}
              onClick={() => onQaRegister('en')}
              className="rounded-xl border border-[var(--color-primary)] bg-white px-5 py-2.5 font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] disabled:opacity-50 min-h-[44px]"
            >
              {data.qa_registrations?.en
                ? isAr
                  ? 'مسجَّل (English) — تحديث'
                  : 'Registered (English) — refresh'
                : isAr
                  ? 'سجّلني (English)'
                  : 'Register (English)'}
            </button>
          </div>
          {qaError && (
            <p className="text-sm text-red-700 mt-3">
              {isAr ? `حدث خطأ: ${qaError}` : `Error: ${qaError}`}
            </p>
          )}
        </section>
      )}

      {/* 5. Help / billing portal links */}
      <section className="text-sm text-[var(--color-neutral-500)] text-center">
        <a
          href={`/${locale}/dashboard`}
          className="text-[var(--color-primary)] hover:underline"
        >
          {isAr ? '← العودة إلى لوحة التحكّم' : '← Back to dashboard'}
        </a>
      </section>
    </main>
  );
}
