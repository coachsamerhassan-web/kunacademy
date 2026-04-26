'use client';

/**
 * ScholarshipApplicationForm — public scholarship application form.
 *
 * Wave E.5 (2026-04-26).
 *
 * Sections:
 *   1. Identity & contact (name, email, phone optional)
 *   2. Program preference (single-select from canon scholarship-eligible)
 *   3. Scholarship tier (partial / full)
 *   4. Financial context (open-text + bucketed income + dependents)
 *   5. Readiness signals (open-text + availability)
 *   6. What you will give (open-text — reciprocity)
 *   7. Endorsement (optional name + email)
 *   8. Submit → POST /api/scholarships/apply
 *
 * Dignity-framing:
 *   - All form prompts use spec §4.3 step 5 dignity-clean wording.
 *   - NO scoring revealed. NO methodology in any label.
 *   - Income buckets are framed contextually ("for context, not scoring").
 *
 * Honeypot: hidden `hp_company` input. Bots fill it; humans don't see it.
 *
 * Bilingual: all labels carry AR + EN via `isAr`. Latin numerals inside Arabic
 * paragraphs wrap with <bdi dir="ltr"> to prevent BiDi reordering.
 */

import { useState, type FormEvent } from 'react';
import { Button } from '@kunacademy/ui';

interface EligibleProgram {
  slug: string;
  family: string;
  title_ar: string;
  title_en: string;
}

interface FormProps {
  locale: 'ar' | 'en';
  programs: EligibleProgram[];
}

type IncomeBucket = 'under_500' | '500_1500' | '1500_3000' | 'over_3000';
type Tier = 'partial' | 'full';

const MAX_OPEN_TEXT = 4000;

/** Form errors keyed for translation. */
type ErrorKey =
  | 'invalid-name'
  | 'invalid-email'
  | 'invalid-phone'
  | 'invalid-program'
  | 'invalid-tier'
  | 'missing-context'
  | 'submit-failed'
  | 'rate-limited'
  | 'cross-origin-forbidden'
  | 'duplicate-today'
  | 'network-error';

export function ScholarshipApplicationForm({ locale, programs }: FormProps) {
  const isAr = locale === 'ar';

  // Identity
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Program selection
  const [selectedSlug, setSelectedSlug] = useState<string>(programs[0]?.slug ?? '');
  const [tier, setTier] = useState<Tier>('partial');

  // Financial context
  const [financialDescription, setFinancialDescription] = useState('');
  const [incomeBucket, setIncomeBucket] = useState<IncomeBucket | ''>('');
  const [dependents, setDependents] = useState('');

  // Readiness
  const [motivation, setMotivation] = useState('');
  const [priorEfforts, setPriorEfforts] = useState('');
  const [available, setAvailable] = useState<'' | 'yes' | 'no'>('');

  // Reciprocity
  const [whatYouWillGive, setWhatYouWillGive] = useState('');

  // Endorsement (optional)
  const [endorsementName, setEndorsementName] = useState('');
  const [endorsementEmail, setEndorsementEmail] = useState('');

  // Honeypot — hidden field; bots fill it, humans don't.
  const [hpCompany, setHpCompany] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [deduped, setDeduped] = useState(false);

  // Selected program object (used to derive program_family from canon, not user)
  const selectedProgram = programs.find((p) => p.slug === selectedSlug);

  function validateBeforeSubmit(): ErrorKey | null {
    if (!name.trim() || name.trim().length > 200) return 'invalid-name';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'invalid-email';
    if (phone.trim() && !/^[\d+\-()\s]+$/.test(phone.trim())) return 'invalid-phone';
    if (!selectedProgram) return 'invalid-program';
    if (tier !== 'partial' && tier !== 'full') return 'invalid-tier';
    // Must have at least one of: financial description, motivation, OR what-you-will-give
    if (
      !financialDescription.trim() &&
      !motivation.trim() &&
      !whatYouWillGive.trim()
    ) {
      return 'missing-context';
    }
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorKey(null);

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setErrorKey(validationError);
      return;
    }
    if (!selectedProgram) return; // type guard

    setSubmitting(true);
    const payload = {
      hp_company: hpCompany,
      applicant_name: name.trim(),
      applicant_email: email.trim(),
      applicant_phone: phone.trim() || null,
      preferred_language: locale,
      program_family: selectedProgram.family,
      program_slug: selectedProgram.slug,
      scholarship_tier: tier,
      application_json: {
        financial_context: {
          ...(financialDescription.trim()
            ? { description: financialDescription.trim().slice(0, MAX_OPEN_TEXT) }
            : {}),
          ...(incomeBucket ? { income_bucket: incomeBucket } : {}),
          ...(dependents.trim() ? { dependents: dependents.trim().slice(0, 500) } : {}),
        },
        readiness_signals: {
          ...(motivation.trim()
            ? { motivation: motivation.trim().slice(0, MAX_OPEN_TEXT) }
            : {}),
          ...(priorEfforts.trim()
            ? { prior_efforts: priorEfforts.trim().slice(0, MAX_OPEN_TEXT) }
            : {}),
          ...(available ? { available_for_duration: available === 'yes' } : {}),
        },
        ...(whatYouWillGive.trim()
          ? { what_you_will_give: whatYouWillGive.trim().slice(0, MAX_OPEN_TEXT) }
          : {}),
        ...(endorsementName.trim() || endorsementEmail.trim()
          ? {
              endorsement: {
                ...(endorsementName.trim() ? { name: endorsementName.trim() } : {}),
                ...(endorsementEmail.trim() ? { email: endorsementEmail.trim() } : {}),
              },
            }
          : {}),
      },
    };

    try {
      const res = await fetch('/api/scholarships/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        if (res.status === 429) {
          setErrorKey('rate-limited');
        } else if (res.status === 403) {
          setErrorKey('cross-origin-forbidden');
        } else {
          setErrorKey('submit-failed');
        }
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as { ok?: boolean; deduped?: boolean; honeypot?: boolean };
      if (data.honeypot) {
        // Bot path — silently render success state without revealing detection.
        setSubmitted(true);
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      setDeduped(Boolean(data.deduped));
      setSubmitting(false);
    } catch {
      setErrorKey('network-error');
      setSubmitting(false);
    }
  }

  // ─── Error messages ─────────────────────────────────────────────────
  const errorMessage: Record<ErrorKey, { ar: string; en: string }> = {
    'invalid-name': {
      ar: 'يرجى إدخال اسم صحيح.',
      en: 'Please enter a valid name.',
    },
    'invalid-email': {
      ar: 'البريد الإلكتروني غير صالح.',
      en: 'Email is not valid.',
    },
    'invalid-phone': {
      ar: 'رقم الهاتف غير صالح.',
      en: 'Phone number is not valid.',
    },
    'invalid-program': {
      ar: 'يرجى اختيار برنامج.',
      en: 'Please choose a program.',
    },
    'invalid-tier': {
      ar: 'يرجى اختيار نوع المنحة.',
      en: 'Please choose a scholarship type.',
    },
    'missing-context': {
      ar: 'يرجى مشاركة شيء واحد على الأقل عن سياقك أو استعدادك للعمل.',
      en: 'Please share at least one detail about your context or readiness.',
    },
    'submit-failed': {
      ar: 'تعذّر إرسال الطلب. يرجى المحاولة لاحقاً.',
      en: 'Could not submit the application. Please try again shortly.',
    },
    'rate-limited': {
      ar: 'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة بعد ساعة.',
      en: 'You have reached the submission limit. Please try again in an hour.',
    },
    'cross-origin-forbidden': {
      ar: 'الطلب غير مسموح به.',
      en: 'Request not allowed.',
    },
    'duplicate-today': {
      ar: 'لقد استلمنا طلباً منك اليوم بالفعل.',
      en: 'We already received an application from you today.',
    },
    'network-error': {
      ar: 'تعذّر الاتصال بالخادم.',
      en: 'Could not reach the server.',
    },
  };

  // ─── Submitted state ────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-8 text-center">
        <h2 className="text-xl md:text-2xl font-bold text-[var(--color-neutral-900)] mb-3">
          {isAr
            ? deduped
              ? 'استلمنا طلبك سابقاً اليوم'
              : 'استلمنا طلبك'
            : deduped
              ? 'We already received your application today'
              : 'We received your application'}
        </h2>
        <p className="text-base text-[var(--color-neutral-700)] leading-relaxed mb-4">
          {isAr
            ? deduped
              ? 'إن أردت تعديل المعلومات، اكتب إلينا على البريد المسجّل وسنقوم بالمراجعة.'
              : 'سنقوم بمراجعة طلبك خلال الأسابيع القادمة، وسنتواصل معك عبر البريد الإلكتروني.'
            : deduped
              ? 'If you would like to update your information, please write to us at the registered email.'
              : 'We will review your application in the coming weeks and reach out via email.'}
        </p>
        <p className="text-sm text-[var(--color-neutral-500)]">
          {isAr ? 'شكراً على ثقتك.' : 'Thank you for trusting us.'}
        </p>
      </div>
    );
  }

  // ─── Form ───────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-8" data-testid="scholarship-apply-form">
      {/* Honeypot — hidden from real users */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          height: 0,
          width: 0,
          overflow: 'hidden',
        }}
      >
        <label htmlFor="hp_company">Company</label>
        <input
          id="hp_company"
          name="hp_company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={hpCompany}
          onChange={(e) => setHpCompany(e.target.value)}
        />
      </div>

      {/* ── 1. Identity ─────────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-[var(--color-neutral-800)] mb-3">
          {isAr ? 'البيانات الشخصية' : 'Personal information'}
        </legend>
        <div>
          <label htmlFor="applicant-name" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr ? 'الاسم الكامل' : 'Full name'}
          </label>
          <input
            id="applicant-name"
            type="text"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base min-h-[44px] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="applicant-email" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr ? 'البريد الإلكتروني' : 'Email'}
          </label>
          <input
            id="applicant-email"
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            dir="ltr"
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base min-h-[44px] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="applicant-phone" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr ? 'رقم الهاتف (اختياريّ)' : 'Phone (optional)'}
          </label>
          <input
            id="applicant-phone"
            type="tel"
            maxLength={32}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            dir="ltr"
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base min-h-[44px] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </fieldset>

      {/* ── 2. Program preference ──────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-[var(--color-neutral-800)] mb-3">
          {isAr ? 'البرنامج المرغوب' : 'Program of interest'}
        </legend>
        <div>
          <label htmlFor="program-slug" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr ? 'البرنامج' : 'Program'}
          </label>
          <select
            id="program-slug"
            required
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base min-h-[44px] focus:border-[var(--color-primary)] focus:outline-none"
          >
            {programs.map((p) => (
              <option key={p.slug} value={p.slug}>
                {isAr ? p.title_ar : p.title_en}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr ? 'نوع المنحة' : 'Scholarship type'}
          </label>
          <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['partial', 'full'] as const).map((t) => {
              const selected = tier === t;
              return (
                <label
                  key={t}
                  className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition min-h-[44px] ${
                    selected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                      : 'border-[var(--color-neutral-200)] hover:border-[var(--color-primary)]/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={t}
                    checked={selected}
                    onChange={() => setTier(t)}
                    className="mt-1 accent-[var(--color-primary)]"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-base">
                      {isAr
                        ? t === 'partial' ? 'جزئيّة' : 'كاملة'
                        : t === 'partial' ? 'Partial' : 'Full'}
                    </div>
                    <p className="text-xs text-[var(--color-neutral-500)] mt-1">
                      {isAr
                        ? t === 'partial'
                          ? 'تغطية لجزء من رسوم البرنامج.'
                          : 'تغطية كاملة لرسوم البرنامج.'
                        : t === 'partial'
                          ? 'Covers a portion of program tuition.'
                          : 'Covers full program tuition.'}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </fieldset>

      {/* ── 3. Financial context ──────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-[var(--color-neutral-800)] mb-3">
          {isAr ? 'السياق الماليّ' : 'Financial context'}
        </legend>
        <p className="text-sm text-[var(--color-neutral-600)]">
          {isAr
            ? 'هذه المعلومات لفهم سياقك، لا للتقييم. لا يُطلب منك إثبات أي شيء.'
            : 'This information is for context, not scoring. We do not require you to prove anything.'}
        </p>
        <div>
          <label htmlFor="fin-desc" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr
              ? 'صف وضعك الماليّ الحاليّ بكلماتك.'
              : 'Please describe your current financial situation in your own words.'}
          </label>
          <textarea
            id="fin-desc"
            rows={5}
            maxLength={MAX_OPEN_TEXT}
            value={financialDescription}
            onChange={(e) => setFinancialDescription(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="income-bucket" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr
              ? 'الفئة التقريبيّة للدخل الشهريّ (بما يعادل الدولار الأمريكيّ)'
              : 'Approximate monthly income range (USD-equivalent)'}
          </label>
          <select
            id="income-bucket"
            value={incomeBucket}
            onChange={(e) => setIncomeBucket(e.target.value as IncomeBucket | '')}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base min-h-[44px] focus:border-[var(--color-primary)] focus:outline-none"
          >
            <option value="">{isAr ? 'تفضّل عدم الإفصاح' : 'Prefer not to say'}</option>
            <option value="under_500">{isAr ? 'أقل من 500' : 'Under 500'}</option>
            <option value="500_1500">{isAr ? '500 إلى 1500' : '500 to 1500'}</option>
            <option value="1500_3000">{isAr ? '1500 إلى 3000' : '1500 to 3000'}</option>
            <option value="over_3000">{isAr ? 'أكثر من 3000' : 'Over 3000'}</option>
          </select>
        </div>
        <div>
          <label htmlFor="dependents" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr
              ? 'هل تُعيل آخرين حالياً؟ (اختياريّ)'
              : 'Are you currently supporting dependents? (optional)'}
          </label>
          <input
            id="dependents"
            type="text"
            maxLength={500}
            value={dependents}
            onChange={(e) => setDependents(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base min-h-[44px] focus:border-[var(--color-primary)] focus:outline-none"
            placeholder={isAr ? 'مثلاً: نعم، أُعيل والديّ' : 'e.g., Yes, I support my parents'}
          />
        </div>
      </fieldset>

      {/* ── 4. Readiness signals ──────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-[var(--color-neutral-800)] mb-3">
          {isAr ? 'الاستعداد للرحلة' : 'Readiness for the journey'}
        </legend>
        <div>
          <label htmlFor="motivation" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr
              ? 'ما الذي يجذبك إلى هذا العمل الآن؟'
              : 'What draws you to this work right now?'}
          </label>
          <textarea
            id="motivation"
            rows={5}
            maxLength={MAX_OPEN_TEXT}
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="prior-efforts" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr
              ? 'ماذا حاولت سابقاً للنموّ في هذا الجانب؟'
              : 'What have you tried before to grow in this area?'}
          </label>
          <textarea
            id="prior-efforts"
            rows={4}
            maxLength={MAX_OPEN_TEXT}
            value={priorEfforts}
            onChange={(e) => setPriorEfforts(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr
              ? 'هل ستتمكّن من الالتزام بكامل مدة البرنامج؟'
              : 'Will you be available for the full duration of the program?'}
          </label>
          <div className="flex flex-wrap gap-3" role="radiogroup">
            {(['yes', 'no'] as const).map((v) => {
              const selected = available === v;
              return (
                <label
                  key={v}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 cursor-pointer transition min-h-[44px] ${
                    selected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                      : 'border-[var(--color-neutral-200)] hover:border-[var(--color-primary)]/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="available"
                    value={v}
                    checked={selected}
                    onChange={() => setAvailable(v)}
                    className="accent-[var(--color-primary)]"
                  />
                  <span className="text-sm">
                    {isAr ? (v === 'yes' ? 'نعم' : 'لا') : v === 'yes' ? 'Yes' : 'No'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </fieldset>

      {/* ── 5. What you will give (reciprocity) ──────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-[var(--color-neutral-800)] mb-3">
          {isAr ? 'ما ستقدّمه أنت' : 'What you will give'}
        </legend>
        <div>
          <label htmlFor="what-you-give" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr
              ? 'كيف ستُساهم في المقابل إذا حصلت على المنحة؟'
              : 'How would you contribute back if you receive this scholarship?'}
          </label>
          <textarea
            id="what-you-give"
            rows={4}
            maxLength={MAX_OPEN_TEXT}
            value={whatYouWillGive}
            onChange={(e) => setWhatYouWillGive(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base focus:border-[var(--color-primary)] focus:outline-none"
            placeholder={
              isAr
                ? 'مثلاً: مشاركة تجربتي بعد التخرج، التزام كامل بالحضور والتطبيق...'
                : 'e.g., Share my story after graduation, commit fully to attendance and practice...'
            }
          />
        </div>
      </fieldset>

      {/* ── 6. Endorsement (optional) ────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-[var(--color-neutral-800)] mb-3">
          {isAr ? 'تزكية (اختياريّة)' : 'Endorsement (optional)'}
        </legend>
        <p className="text-sm text-[var(--color-neutral-600)]">
          {isAr
            ? 'إن أردت ذكر شخص يستطيع الإجابة عن استعدادك (كوتش سابق، خرّيج، عضو مجتمع).'
            : 'If you would like to mention someone who can speak to your readiness (a previous coach, graduate, or community member).'}
        </p>
        <div>
          <label htmlFor="endorsement-name" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr ? 'الاسم' : 'Name'}
          </label>
          <input
            id="endorsement-name"
            type="text"
            maxLength={200}
            value={endorsementName}
            onChange={(e) => setEndorsementName(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base min-h-[44px] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="endorsement-email" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
            {isAr ? 'البريد الإلكترونيّ' : 'Email'}
          </label>
          <input
            id="endorsement-email"
            type="email"
            maxLength={254}
            value={endorsementEmail}
            onChange={(e) => setEndorsementEmail(e.target.value)}
            dir="ltr"
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base min-h-[44px] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </fieldset>

      {/* ── Errors ────────────────────────────────────────────────── */}
      {errorKey && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300"
        >
          {isAr ? errorMessage[errorKey].ar : errorMessage[errorKey].en}
        </div>
      )}

      {/* ── Submit ──────────────────────────────────────────────────── */}
      <div>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
          {submitting
            ? isAr
              ? 'جارٍ الإرسال...'
              : 'Submitting...'
            : isAr
              ? 'إرسال الطلب'
              : 'Submit application'}
        </Button>
        <p className="text-xs text-[var(--color-neutral-500)] mt-3 text-center">
          {isAr
            ? 'سنرسل تأكيداً إلى البريد الذي أدخلته.'
            : 'We will send a confirmation to the email you entered.'}
        </p>
      </div>
    </form>
  );
}
