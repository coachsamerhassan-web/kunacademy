'use client';

import { use, useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Button } from '@kunacademy/ui';

/**
 * /[locale]/admin/scholarships/applications/new — Wave E.5 admin manual-entry.
 *
 * For admins to record applications that arrived via external channels
 * (in-person referrals, email, scanned letters, etc.) per decision B5.
 *
 * Same shape as the public form + admin-only fields:
 *   - admin_note (REQUIRED): why this manual entry exists
 *   - source_referrer (optional): label like "in-person at workshop"
 *
 * Skips the public-form rate-limit / honeypot.
 * Skips public-confirmation email (admin already has applicant on internal channel).
 *
 * The created application has metadata.source='manual_entry' so:
 *   - Same-day public-form unique index does NOT apply (admins can record
 *     multiple historical applications for the same email/date).
 *   - Transparency dashboard rolls them into totals seamlessly (per E.4).
 */

interface EligibleProgram {
  slug: string;
  family: string;
  title_ar: string;
  title_en: string;
}

type Tier = 'partial' | 'full';
type IncomeBucket = 'under_500' | '500_1500' | '1500_3000' | 'over_3000';

export default function AdminApplicationNew({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const [programs, setPrograms] = useState<EligibleProgram[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);

  // Identity
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredLang, setPreferredLang] = useState<'ar' | 'en'>('ar');

  // Program
  const [slug, setSlug] = useState('');
  const [tier, setTier] = useState<Tier>('partial');

  // Application content
  const [financialDescription, setFinancialDescription] = useState('');
  const [incomeBucket, setIncomeBucket] = useState<IncomeBucket | ''>('');
  const [dependents, setDependents] = useState('');
  const [motivation, setMotivation] = useState('');
  const [priorEfforts, setPriorEfforts] = useState('');
  const [available, setAvailable] = useState<'' | 'yes' | 'no'>('');
  const [whatYouWillGive, setWhatYouWillGive] = useState('');

  // Admin-only
  const [adminNote, setAdminNote] = useState('');
  const [sourceReferrer, setSourceReferrer] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/scholarships/applications')
      .then(async (res) => {
        if (!res.ok) throw new Error('list-failed');
        // we just need any response here to confirm auth; programs come from
        // a separate fetch below.
      })
      .catch(() => {
        // ignore — auth issues will surface on submit
      });
    // Fetch program list via the public-page endpoint? We don't have a public
    // listing API. For admin manual-entry we mirror the canon list by calling
    // the /api/admin/scholarships/applications list endpoint with a tiny
    // probe — but that doesn't return programs. Simpler: hit the public
    // transparency-eligible-programs endpoint? We don't have one.
    //
    // Pragmatic approach: ship a small admin-only programs endpoint inline
    // here by calling the list-programs API surface, OR re-use the
    // SCHOLARSHIP_PROGRAMS shape from canon by hitting /api/admin/programs?
    // For E.5 we keep it simple and call a dedicated GET on the apply
    // endpoint passing a special probe header. To avoid building yet
    // another endpoint, we'll hit the GET on /api/admin/scholarships/applications
    // to confirm auth, and load programs from the public API surface
    // (which doesn't exist yet either). Fix: load programs from a dedicated
    // admin endpoint we add inline below.
    setLoadingPrograms(false);
    // Fall back: load programs from the JSON endpoint we add: /api/admin/scholarships/programs
    fetch('/api/admin/scholarships/programs')
      .then(async (r) => {
        if (!r.ok) return;
        const data = (await r.json()) as { programs: EligibleProgram[] };
        setPrograms(data.programs ?? []);
        if (data.programs && data.programs.length > 0) {
          setSlug(data.programs[0].slug);
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  function selectedProgram(): EligibleProgram | undefined {
    return programs.find((p) => p.slug === slug);
  }

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError(isAr ? 'الاسم مطلوب.' : 'Name is required.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(isAr ? 'البريد غير صالح.' : 'Invalid email.');
      return;
    }
    const sp = selectedProgram();
    if (!sp) {
      setError(isAr ? 'يجب اختيار برنامج.' : 'Select a program.');
      return;
    }
    if (!adminNote.trim()) {
      setError(
        isAr
          ? 'الملاحظة الإداريّة مطلوبة لتسجيل الإدخال اليدوي.'
          : 'Admin note is required for manual entry.',
      );
      return;
    }
    // Must have at least one substantive field
    if (
      !financialDescription.trim() &&
      !motivation.trim() &&
      !whatYouWillGive.trim()
    ) {
      setError(
        isAr
          ? 'يرجى إدخال تفصيل واحد على الأقل (السياق الماليّ، الدافع، أو ما يقدّمه).'
          : 'Please include at least one detail (financial context, motivation, or what they will give).',
      );
      return;
    }

    setSubmitting(true);
    const payload = {
      applicant_name: name.trim(),
      applicant_email: email.trim(),
      applicant_phone: phone.trim() || null,
      preferred_language: preferredLang,
      program_family: sp.family,
      program_slug: sp.slug,
      scholarship_tier: tier,
      application_json: {
        financial_context: {
          ...(financialDescription.trim() ? { description: financialDescription.trim() } : {}),
          ...(incomeBucket ? { income_bucket: incomeBucket } : {}),
          ...(dependents.trim() ? { dependents: dependents.trim() } : {}),
        },
        readiness_signals: {
          ...(motivation.trim() ? { motivation: motivation.trim() } : {}),
          ...(priorEfforts.trim() ? { prior_efforts: priorEfforts.trim() } : {}),
          ...(available ? { available_for_duration: available === 'yes' } : {}),
        },
        ...(whatYouWillGive.trim() ? { what_you_will_give: whatYouWillGive.trim() } : {}),
      },
      admin_note: adminNote.trim(),
      source_referrer: sourceReferrer.trim() || null,
    };

    try {
      const res = await fetch('/api/admin/scholarships/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          isAr
            ? `تعذّر الحفظ. (${data.error ?? 'خطأ غير معروف'})`
            : `Could not save. (${data.error ?? 'unknown error'})`,
        );
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as { ok?: boolean; application_id?: string };
      setCreatedId(data.application_id ?? null);
      setSubmitting(false);
    } catch {
      setError(isAr ? 'تعذّر الاتصال.' : 'Connection failed.');
      setSubmitting(false);
    }
  }

  if (createdId) {
    return (
      <Section variant="white">
        <div dir={dir} className="max-w-2xl space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <h1 className="text-xl font-bold text-emerald-900 mb-2">
              {isAr ? 'تمّ التسجيل' : 'Application recorded'}
            </h1>
            <p className="text-sm text-emerald-800 mb-4">
              {isAr
                ? 'تمّ إنشاء الطلب. يمكنك الانتقال إلى صفحة التفصيل للمتابعة.'
                : 'The application has been created. Open the detail page to continue.'}
            </p>
            <div className="flex gap-2">
              <a
                href={`/${locale}/admin/scholarships/applications/${createdId}`}
                className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                {isAr ? 'فتح التفصيل' : 'Open detail'}
              </a>
              <a
                href={`/${locale}/admin/scholarships/applications`}
                className="inline-flex items-center justify-center rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm font-medium hover:border-[var(--color-primary)]"
              >
                {isAr ? 'العودة للقائمة' : 'Back to list'}
              </a>
            </div>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section variant="white">
      <div dir={dir} className="max-w-2xl space-y-6">
        <div>
          <a
            href={`/${locale}/admin/scholarships/applications`}
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            {isAr ? '← العودة إلى القائمة' : '← Back to list'}
          </a>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
            {isAr ? 'إدخال يدوي لطلب منحة' : 'Manual scholarship application entry'}
          </h1>
          <p className="text-sm text-[var(--color-neutral-600)] mt-1">
            {isAr
              ? 'لتسجيل طلب وصلكم عبر قناة خارجية (إيميل، اجتماع، ورشة، إحالة شخصية).'
              : 'For applications that arrived via an external channel (email, meeting, workshop, in-person referral).'}
          </p>
        </div>

        {loadingPrograms && (
          <div className="rounded-xl bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] p-4 text-sm">
            {isAr ? 'جارٍ تحميل البرامج...' : 'Loading programs...'}
          </div>
        )}

        {programs.length > 0 && (
          <div className="space-y-6">
            {/* Identity */}
            <fieldset className="space-y-4">
              <legend className="text-base font-semibold mb-2">
                {isAr ? 'بيانات المتقدّم' : 'Applicant info'}
              </legend>
              <div>
                <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'الاسم' : 'Name'} *
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'البريد' : 'Email'} *
                </label>
                <input
                  type="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'الهاتف (اختياريّ)' : 'Phone (optional)'}
                </label>
                <input
                  type="tel"
                  maxLength={32}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'لغة المراسلة' : 'Preferred language'}
                </label>
                <select
                  value={preferredLang}
                  onChange={(e) => setPreferredLang(e.target.value as 'ar' | 'en')}
                  className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                >
                  <option value="ar">العربيّة</option>
                  <option value="en">English</option>
                </select>
              </div>
            </fieldset>

            {/* Program */}
            <fieldset className="space-y-4">
              <legend className="text-base font-semibold mb-2">
                {isAr ? 'البرنامج' : 'Program'}
              </legend>
              <div>
                <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'البرنامج المطلوب' : 'Program'} *
                </label>
                <select
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                >
                  {programs.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {isAr ? p.title_ar : p.title_en} ({p.slug})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'النوع' : 'Tier'} *
                </label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value as Tier)}
                  className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                >
                  <option value="partial">{isAr ? 'جزئيّة' : 'Partial'}</option>
                  <option value="full">{isAr ? 'كاملة' : 'Full'}</option>
                </select>
              </div>
            </fieldset>

            {/* Content */}
            <fieldset className="space-y-4">
              <legend className="text-base font-semibold mb-2">
                {isAr ? 'محتوى الطلب' : 'Application content'}
              </legend>
              <div>
                <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'السياق الماليّ' : 'Financial context (description)'}
                </label>
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={financialDescription}
                  onChange={(e) => setFinancialDescription(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                    {isAr ? 'فئة الدخل' : 'Income bucket'}
                  </label>
                  <select
                    value={incomeBucket}
                    onChange={(e) => setIncomeBucket(e.target.value as IncomeBucket | '')}
                    className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                  >
                    <option value="">—</option>
                    <option value="under_500">{isAr ? 'أقل من 500' : 'Under 500'}</option>
                    <option value="500_1500">500–1500</option>
                    <option value="1500_3000">1500–3000</option>
                    <option value="over_3000">{isAr ? 'أكثر من 3000' : 'Over 3000'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                    {isAr ? 'المعالون' : 'Dependents'}
                  </label>
                  <input
                    type="text"
                    maxLength={500}
                    value={dependents}
                    onChange={(e) => setDependents(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'الدافع' : 'Motivation'}
                </label>
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'محاولات سابقة' : 'Prior efforts'}
                </label>
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={priorEfforts}
                  onChange={(e) => setPriorEfforts(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'الالتزام بكامل المدّة' : 'Available for duration'}
                </label>
                <select
                  value={available}
                  onChange={(e) => setAvailable(e.target.value as '' | 'yes' | 'no')}
                  className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                >
                  <option value="">—</option>
                  <option value="yes">{isAr ? 'نعم' : 'Yes'}</option>
                  <option value="no">{isAr ? 'لا' : 'No'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'ما سيقدّمه المتقدّم' : 'What applicant will give'}
                </label>
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={whatYouWillGive}
                  onChange={(e) => setWhatYouWillGive(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm"
                />
              </div>
            </fieldset>

            {/* Admin-only */}
            <fieldset className="space-y-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
              <legend className="text-base font-semibold mb-2 px-2 bg-amber-50 rounded">
                {isAr ? 'حقول إداريّة' : 'Admin-only fields'}
              </legend>
              <div>
                <label className="block text-xs text-amber-900 mb-1">
                  {isAr ? 'ملاحظة إداريّة' : 'Admin note'} *
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full rounded-lg border border-amber-300 px-4 py-2 text-sm bg-white"
                  placeholder={
                    isAr
                      ? 'سبب الإدخال اليدوي (طلب وصل عبر إيميل، إحالة شخصية...).'
                      : 'Reason for manual entry (came via email, in-person referral...).'
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-amber-900 mb-1">
                  {isAr ? 'مصدر/مرجع (اختياريّ)' : 'Source / referrer (optional)'}
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={sourceReferrer}
                  onChange={(e) => setSourceReferrer(e.target.value)}
                  className="w-full rounded-lg border border-amber-300 px-4 py-2 text-sm bg-white"
                  placeholder={
                    isAr ? 'مثلاً: ورشة دبيّ 2026' : 'e.g., Dubai workshop 2026'
                  }
                />
              </div>
            </fieldset>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting
                ? isAr ? 'جارٍ الحفظ...' : 'Saving...'
                : isAr ? 'حفظ الإدخال' : 'Save manual entry'}
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}
