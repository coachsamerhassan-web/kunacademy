'use client';

import { use, useEffect, useState, useMemo } from 'react';
import { Section } from '@kunacademy/ui/section';

/**
 * /[locale]/admin/scholarships/applications/[id]/allocate — Wave E.6 admin
 * allocation matcher.
 *
 * Renders:
 *   - Application summary (program preference, applicant name)
 *   - Available donations table with anonymized donor labels (Donor #N)
 *   - Multi-select with running total + program full-price progress meter
 *   - "Allocate" CTA — enabled only when sum matches canon program full price
 *     in the donation native currency (server re-validates; UI is hint only)
 *
 * Donor names are NEVER displayed — only "Donor #N" sequence labels per
 * spec §9.3 dignity boundary.
 *
 * Methodology / scoring detail is FORBIDDEN in any UI strings — pre-commit
 * lint enforces.
 */

interface ApplicationSummary {
  id: string;
  applicant_name: string;
  applicant_email: string;
  preferred_language: 'ar' | 'en';
  program_family: string;
  program_slug: string;
  scholarship_tier: 'partial' | 'full';
  status: string;
}

interface AvailableDonation {
  id: string;
  donor_anonymized: string;
  amount_cents: number;
  currency: string;
  designation_preference: string;
  received_at: string;
}

function formatMoney(cents: number, currency: string): string {
  const major = (cents / 100).toFixed(2);
  return `${currency} ${major}`;
}

export default function AllocationMatcherPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const [application, setApplication] = useState<ApplicationSummary | null>(null);
  const [donations, setDonations] = useState<AvailableDonation[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Filter currency derived from the first selected donation (or any if none).
  const filterCurrency = useMemo(() => {
    if (selected.size === 0) return null;
    const first = donations.find((d) => selected.has(d.id));
    return first?.currency ?? null;
  }, [selected, donations]);

  // Sum of selected donations (in their shared currency).
  const sumCents = useMemo(() => {
    let total = 0;
    for (const d of donations) {
      if (selected.has(d.id)) total += d.amount_cents;
    }
    return total;
  }, [selected, donations]);

  // Resolve canon full price for the program in the selected currency.
  const [canonPriceCents, setCanonPriceCents] = useState<number | null>(null);
  const [canonCurrency, setCanonCurrency] = useState<string | null>(null);

  // Initial load: application + donations
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [appRes, donRes] = await Promise.all([
          fetch(`/api/admin/scholarships/applications/${id}`),
          fetch(`/api/admin/scholarships/donations-available`),
        ]);
        if (!appRes.ok) {
          throw new Error(appRes.status === 404 ? 'not-found' : 'read-failed');
        }
        if (!donRes.ok) {
          throw new Error('read-failed');
        }
        const appData = (await appRes.json()) as { application: ApplicationSummary };
        const donData = (await donRes.json()) as { donations: AvailableDonation[] };
        if (cancelled) return;
        setApplication(appData.application);
        setDonations(donData.donations);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message || 'read-failed');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Resolve canon program price when application + filterCurrency change
  useEffect(() => {
    if (!application) return;
    // Pick currency: filterCurrency (if any donation selected) OR default AED.
    const cur = filterCurrency ?? 'AED';
    let cancelled = false;
    (async () => {
      try {
        const url = new URL('/api/admin/scholarships/programs', window.location.origin);
        url.searchParams.set('slug', application.program_slug);
        url.searchParams.set('currency', cur);
        const res = await fetch(url.toString());
        if (!res.ok) {
          if (!cancelled) {
            setCanonPriceCents(null);
            setCanonCurrency(cur);
          }
          return;
        }
        const data = (await res.json()) as { price_cents?: number; currency?: string };
        if (cancelled) return;
        setCanonPriceCents(typeof data.price_cents === 'number' ? data.price_cents : null);
        setCanonCurrency(data.currency ?? cur);
      } catch {
        if (cancelled) return;
        setCanonPriceCents(null);
        setCanonCurrency(cur);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [application, filterCurrency]);

  function toggleDonation(d: AvailableDonation) {
    const next = new Set(selected);
    if (next.has(d.id)) {
      next.delete(d.id);
    } else {
      // If first selection sets the currency, all subsequent must match.
      // We allow toggling but the server re-validates currency consistency.
      next.add(d.id);
    }
    setSelected(next);
  }

  async function submitAllocation() {
    if (selected.size === 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/scholarships/applications/${id}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donation_ids: Array.from(selected),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        const code = data.error || 'unknown';
        setSubmitError(humanizeError(code, isAr));
        setSubmitting(false);
        return;
      }
      setSubmitSuccess(true);
      // Redirect back to detail
      setTimeout(() => {
        window.location.href = `/${locale}/admin/scholarships/applications/${id}`;
      }, 1500);
    } catch {
      setSubmitError(isAr ? 'تعذّر الاتصال.' : 'Connection failed.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Section variant="white">
        <div dir={dir} className="text-sm text-[var(--color-neutral-600)]">
          {isAr ? 'جارٍ التحميل...' : 'Loading...'}
        </div>
      </Section>
    );
  }
  if (error || !application) {
    return (
      <Section variant="white">
        <div dir={dir} className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {error === 'not-found'
            ? isAr ? 'لم يتم العثور على الطلب.' : 'Application not found.'
            : isAr ? 'تعذّر تحميل البيانات.' : 'Could not load data.'}
        </div>
      </Section>
    );
  }

  if (application.status !== 'approved') {
    return (
      <Section variant="white">
        <div dir={dir} className="space-y-4">
          <a
            href={`/${locale}/admin/scholarships/applications/${id}`}
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            {isAr ? '← العودة' : '← Back'}
          </a>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            {isAr
              ? `لا يمكن التخصيص. الحالة الحاليّة: ${application.status}. التخصيص يتطلّب الحالة "approved".`
              : `Cannot allocate. Current status: ${application.status}. Allocation requires status='approved'.`}
          </div>
        </div>
      </Section>
    );
  }

  // Filter the visible donation list to those matching filterCurrency (if set).
  const visibleDonations = filterCurrency
    ? donations.filter((d) => d.currency === filterCurrency || selected.has(d.id))
    : donations;

  const sumMatches =
    canonPriceCents !== null
    && filterCurrency !== null
    && canonCurrency === filterCurrency
    && sumCents === canonPriceCents;

  const sumDelta =
    canonPriceCents !== null && filterCurrency !== null
      ? canonPriceCents - sumCents
      : null;

  return (
    <Section variant="white">
      <div dir={dir} className="space-y-6">
        {/* Header */}
        <div>
          <a
            href={`/${locale}/admin/scholarships/applications/${id}`}
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            {isAr ? '← العودة إلى تفاصيل الطلب' : '← Back to application'}
          </a>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
            {isAr ? 'تخصيص التبرّعات' : 'Allocate donations'}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
            {application.applicant_name} ·{' '}
            <span dir="ltr">{application.program_slug}</span>
            {' · '}
            {application.scholarship_tier === 'full'
              ? isAr ? 'منحة كاملة' : 'full scholarship'
              : isAr ? 'منحة جزئيّة' : 'partial scholarship'}
          </p>
        </div>

        {submitSuccess && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
            {isAr
              ? 'تمّ التخصيص. جارٍ إعادة التوجيه...'
              : 'Allocation complete. Redirecting...'}
          </div>
        )}

        {/* Two-column layout: donations table + summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-[var(--color-neutral-100)] bg-white">
              <div className="px-5 py-4 border-b border-[var(--color-neutral-100)]">
                <h2 className="text-base font-semibold">
                  {isAr ? 'التبرّعات المتاحة' : 'Available donations'}
                </h2>
                <p className="text-xs text-[var(--color-neutral-500)] mt-1">
                  {isAr
                    ? 'تظهر التبرّعات بحالة "received" غير المخصّصة. أسماء المانحين مخفيّة.'
                    : 'Showing un-allocated donations with status "received". Donor names are hidden.'}
                </p>
                {filterCurrency && (
                  <p className="text-xs text-[var(--color-neutral-600)] mt-2">
                    {isAr
                      ? `يتمّ تصفية التبرّعات بعملة: ${filterCurrency}`
                      : `Filtering by currency: ${filterCurrency}`}
                  </p>
                )}
              </div>
              {visibleDonations.length === 0 ? (
                <div className="p-8 text-center text-sm text-[var(--color-neutral-500)]">
                  {isAr
                    ? 'لا توجد تبرّعات متاحة حالياً.'
                    : 'No donations available right now.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-neutral-100)] text-xs uppercase tracking-wide text-[var(--color-neutral-500)]">
                        <th className="px-3 py-2 text-start"></th>
                        <th className="px-3 py-2 text-start">
                          {isAr ? 'المانح' : 'Donor'}
                        </th>
                        <th className="px-3 py-2 text-start">
                          {isAr ? 'المبلغ' : 'Amount'}
                        </th>
                        <th className="px-3 py-2 text-start">
                          {isAr ? 'التفضيل' : 'Designation'}
                        </th>
                        <th className="px-3 py-2 text-start">
                          {isAr ? 'تاريخ الاستلام' : 'Received'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleDonations.map((d) => {
                        const isSelected = selected.has(d.id);
                        return (
                          <tr
                            key={d.id}
                            className={
                              `border-b border-[var(--color-neutral-100)] last:border-b-0 cursor-pointer hover:bg-[var(--color-neutral-50)] ${
                                isSelected ? 'bg-[var(--color-neutral-50)]' : ''
                              }`
                            }
                            onClick={() => toggleDonation(d)}
                          >
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleDonation(d)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4"
                              />
                            </td>
                            <td className="px-3 py-3 font-medium" dir="ltr">
                              {d.donor_anonymized}
                            </td>
                            <td className="px-3 py-3 font-mono" dir="ltr">
                              {formatMoney(d.amount_cents, d.currency)}
                            </td>
                            <td className="px-3 py-3">
                              <span className="rounded-full px-2 py-0.5 text-xs uppercase bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]">
                                {d.designation_preference}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-xs text-[var(--color-neutral-500)]" dir="ltr">
                              {new Date(d.received_at).toLocaleDateString(
                                isAr ? 'ar-AE' : 'en-US',
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Summary card */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-[var(--color-neutral-100)] p-5 bg-white">
              <h2 className="text-base font-semibold mb-3">
                {isAr ? 'ملخّص التخصيص' : 'Allocation summary'}
              </h2>
              <dl className="text-sm space-y-2">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-neutral-500)]">
                    {isAr ? 'عدد التبرّعات المختارة' : 'Selected donations'}
                  </dt>
                  <dd className="font-medium">{selected.size}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-neutral-500)]">
                    {isAr ? 'المجموع' : 'Total selected'}
                  </dt>
                  <dd className="font-mono" dir="ltr">
                    {filterCurrency
                      ? formatMoney(sumCents, filterCurrency)
                      : '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-neutral-500)]">
                    {isAr ? 'سعر البرنامج الكامل' : 'Program full price'}
                  </dt>
                  <dd className="font-mono" dir="ltr">
                    {canonPriceCents !== null && canonCurrency
                      ? formatMoney(canonPriceCents, canonCurrency)
                      : '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-neutral-500)]">
                    {isAr ? 'الفارق' : 'Delta'}
                  </dt>
                  <dd
                    className={`font-mono ${
                      sumMatches
                        ? 'text-emerald-700'
                        : sumDelta !== null && sumDelta < 0
                          ? 'text-red-700'
                          : 'text-amber-700'
                    }`}
                    dir="ltr"
                  >
                    {sumDelta !== null && filterCurrency
                      ? sumDelta === 0
                        ? '0'
                        : sumDelta > 0
                          ? `-${formatMoney(sumDelta, filterCurrency)}`
                          : `+${formatMoney(Math.abs(sumDelta), filterCurrency)}`
                      : '—'}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)]">
                {sumMatches ? (
                  <p className="text-xs text-emerald-700 mb-3">
                    {isAr
                      ? '✓ المجموع يطابق سعر البرنامج. يمكنك التخصيص.'
                      : '✓ Total matches program price. Ready to allocate.'}
                  </p>
                ) : sumDelta !== null && sumDelta > 0 ? (
                  <p className="text-xs text-amber-700 mb-3">
                    {isAr
                      ? `يتبقّى ${formatMoney(sumDelta, filterCurrency!)} لإكمال السعر.`
                      : `${formatMoney(sumDelta, filterCurrency!)} short of program price.`}
                  </p>
                ) : sumDelta !== null && sumDelta < 0 ? (
                  <p className="text-xs text-red-700 mb-3">
                    {isAr
                      ? `يتجاوز السعر بـ ${formatMoney(Math.abs(sumDelta), filterCurrency!)}.`
                      : `Exceeds price by ${formatMoney(Math.abs(sumDelta), filterCurrency!)}.`}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--color-neutral-500)] mb-3">
                    {isAr
                      ? 'اختر التبرّعات لرؤية الإجمالي.'
                      : 'Select donations to see the total.'}
                  </p>
                )}

                {submitError && (
                  <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-800">
                    {submitError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!sumMatches || submitting || submitSuccess}
                  onClick={() => submitAllocation()}
                  className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 text-sm font-medium transition"
                >
                  {submitting
                    ? isAr ? 'جارٍ الحفظ...' : 'Saving...'
                    : isAr ? 'تخصيص' : 'Allocate'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-neutral-100)] p-5 bg-white">
              <h2 className="text-base font-semibold mb-2">
                {isAr ? 'ملاحظة' : 'Note'}
              </h2>
              <p className="text-xs text-[var(--color-neutral-500)] leading-relaxed">
                {isAr
                  ? 'يتمّ التحقّق من المبلغ والعملة على الخادم قبل الحفظ. أيّ تغيير في حالة التبرّعات أثناء الجلسة يُلغي التخصيص.'
                  : 'Amount + currency are server-validated before commit. Any change in donation status during the session aborts the allocation.'}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </Section>
  );
}

function humanizeError(code: string, isAr: boolean): string {
  const map: Record<string, { ar: string; en: string }> = {
    invalid_application_status: {
      ar: 'حالة الطلب غير ملائمة للتخصيص.',
      en: 'Application status is not eligible for allocation.',
    },
    donation_already_allocated: {
      ar: 'تمّ تخصيص أحد التبرّعات بالفعل من قبل مدير آخر.',
      en: 'One of the donations was already allocated by another admin.',
    },
    donation_not_received: {
      ar: 'أحد التبرّعات لم يصل بعد.',
      en: 'A donation has not been received yet.',
    },
    currency_mismatch: {
      ar: 'العملات غير متطابقة بين التبرّعات.',
      en: 'Donations span multiple currencies.',
    },
    amount_mismatch: {
      ar: 'المجموع لا يطابق سعر البرنامج. أعد الحساب.',
      en: 'Selected total does not match program full price.',
    },
    program_no_price: {
      ar: 'لا يوجد سعر للبرنامج بهذه العملة.',
      en: 'No canon price for the program in this currency.',
    },
    program_not_scholarship_eligible: {
      ar: 'البرنامج غير مؤهّل للمنح.',
      en: 'Program is not scholarship-eligible.',
    },
  };
  if (map[code]) return isAr ? map[code]!.ar : map[code]!.en;
  return isAr ? 'تعذّر التخصيص. جرّب مجدّداً.' : 'Could not allocate. Try again.';
}
