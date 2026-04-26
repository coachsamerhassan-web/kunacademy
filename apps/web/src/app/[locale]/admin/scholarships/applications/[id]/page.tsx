'use client';

import { use, useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';

/**
 * /[locale]/admin/scholarships/applications/[id] — Wave E.5 admin detail.
 *
 * Shows full application_json (all fields, bilingual labels), status
 * transition controls, audit-log timeline.
 *
 * Allocation/disbursement transitions are E.6 (this page surfaces them as
 * read-only "next wave" affordances when status reaches 'approved').
 */

interface ApplicationDetail {
  id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  preferred_language: 'ar' | 'en';
  program_family: string;
  program_slug: string;
  scholarship_tier: 'partial' | 'full';
  status: string;
  source: string;
  application_json: {
    financial_context?: {
      description?: string;
      income_bucket?: string;
      dependents?: string;
    };
    readiness_signals?: {
      motivation?: string;
      prior_efforts?: string;
      available_for_duration?: boolean;
    };
    what_you_will_give?: string;
    endorsement?: { name?: string; email?: string };
  };
  rejection_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  audit_events: Array<{
    id: string;
    admin_id: string | null;
    admin_name: string | null;
    event_type: string;
    before_status: string | null;
    after_status: string | null;
    note: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
}

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  pending: { ar: 'في الانتظار', en: 'Pending' },
  in_review: { ar: 'قيد المراجعة', en: 'In review' },
  info_requested: { ar: 'بانتظار توضيح', en: 'Info requested' },
  approved: { ar: 'موافَق عليها', en: 'Approved' },
  allocated: { ar: 'تمّ التخصيص', en: 'Allocated' },
  disbursed: { ar: 'تمّ الصرف', en: 'Disbursed' },
  rejected: { ar: 'مرفوضة', en: 'Declined' },
  waitlisted: { ar: 'قائمة الانتظار', en: 'Waitlisted' },
  withdrawn: { ar: 'مسحوبة', en: 'Withdrawn' },
};

const INCOME_LABELS: Record<string, { ar: string; en: string }> = {
  under_500: { ar: 'أقل من 500', en: 'Under 500' },
  '500_1500': { ar: '500 إلى 1500', en: '500 to 1500' },
  '1500_3000': { ar: '1500 إلى 3000', en: '1500 to 3000' },
  over_3000: { ar: 'أكثر من 3000', en: 'Over 3000' },
};

const ACTION_BUTTONS: Array<{
  target: string;
  ar: string;
  en: string;
  tone: 'primary' | 'success' | 'warn' | 'danger' | 'neutral';
}> = [
  { target: 'in_review', ar: 'بدء المراجعة', en: 'Begin review', tone: 'primary' },
  { target: 'info_requested', ar: 'طلب توضيح', en: 'Request info', tone: 'neutral' },
  { target: 'approved', ar: 'موافقة', en: 'Approve', tone: 'success' },
  { target: 'waitlisted', ar: 'قائمة الانتظار', en: 'Waitlist', tone: 'warn' },
  { target: 'rejected', ar: 'رفض', en: 'Decline', tone: 'danger' },
];

export default function AdminApplicationDetail({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [transitioning, setTransitioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string>('');

  // E.6 — disburse action state
  const [disbursing, setDisbursing] = useState(false);
  const [disburseError, setDisburseError] = useState<string | null>(null);
  const [disbursePending, setDisbursePending] = useState<boolean>(false);
  const [disburseSuccess, setDisburseSuccess] = useState<boolean>(false);

  function refresh(): Promise<void> {
    return fetch(`/api/admin/scholarships/applications/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? 'unauthorized'
              : res.status === 403
                ? 'forbidden'
                : res.status === 404
                  ? 'not-found'
                  : 'read-failed',
          );
        }
        return (await res.json()) as { application: ApplicationDetail };
      })
      .then((data) => {
        setDetail(data.application);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message || 'read-failed');
        setLoading(false);
      });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function statusLabel(s: string): string {
    return STATUS_LABELS[s] ? (isAr ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en) : s;
  }

  async function applyTransition(target: string) {
    setActionError(null);
    setTransitioning(true);
    try {
      const res = await fetch(`/api/admin/scholarships/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_status: target,
          note: actionNote.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 422 && data.error === 'illegal_transition') {
          setActionError(isAr ? 'انتقال غير مسموح به.' : 'Transition not allowed.');
        } else if (res.status === 401) {
          setActionError(isAr ? 'لم يتم تسجيل الدخول.' : 'Not signed in.');
        } else if (res.status === 403) {
          setActionError(isAr ? 'لا توجد صلاحية.' : 'Forbidden.');
        } else {
          setActionError(isAr ? 'تعذّر تطبيق الإجراء.' : 'Could not apply the action.');
        }
        setTransitioning(false);
        return;
      }
      setActionNote('');
      setPendingAction(null);
      await refresh();
      setTransitioning(false);
    } catch {
      setActionError(isAr ? 'تعذّر الاتصال.' : 'Connection failed.');
      setTransitioning(false);
    }
  }

  async function performDisburse() {
    setDisburseError(null);
    setDisbursing(true);
    try {
      const res = await fetch(`/api/admin/scholarships/applications/${id}/disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const code = data.error || 'unknown';
        const map: Record<string, { ar: string; en: string }> = {
          'invalid_application_status': {
            ar: 'حالة الطلب غير ملائمة للصرف.',
            en: 'Application is not in allocated state.',
          },
          'already_disbursed': {
            ar: 'تمّ الصرف مسبقاً.',
            en: 'Already disbursed.',
          },
          'token_already_active': {
            ar: 'يوجد رمز نشط مسبقاً لهذه المنحة.',
            en: 'An active token already exists for this scholarship.',
          },
          'scholarship-not-found': {
            ar: 'لم يتم العثور على المنحة.',
            en: 'Scholarship not found.',
          },
        };
        if (map[code]) {
          setDisburseError(isAr ? map[code]!.ar : map[code]!.en);
        } else if (res.status === 401) {
          setDisburseError(isAr ? 'لم يتم تسجيل الدخول.' : 'Not signed in.');
        } else if (res.status === 403) {
          setDisburseError(isAr ? 'لا توجد صلاحية.' : 'Forbidden.');
        } else {
          setDisburseError(isAr ? 'تعذّر الصرف.' : 'Could not disburse.');
        }
        setDisbursing(false);
        return;
      }
      setDisburseSuccess(true);
      setDisbursing(false);
      await refresh();
    } catch {
      setDisburseError(isAr ? 'تعذّر الاتصال.' : 'Connection failed.');
      setDisbursing(false);
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
  if (error || !detail) {
    return (
      <Section variant="white">
        <div dir={dir} className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {error === 'not-found'
            ? isAr ? 'لم يتم العثور على الطلب.' : 'Application not found.'
            : error === 'unauthorized'
              ? isAr ? 'يرجى تسجيل الدخول.' : 'Please sign in.'
              : error === 'forbidden'
                ? isAr ? 'لا تملك صلاحية الوصول.' : 'You do not have access.'
                : isAr ? 'تعذّر تحميل الطلب.' : 'Could not load the application.'}
        </div>
      </Section>
    );
  }

  const aj = detail.application_json;

  return (
    <Section variant="white">
      <div dir={dir} className="space-y-6">
        {/* Header */}
        <div>
          <a
            href={`/${locale}/admin/scholarships/applications`}
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            {isAr ? '← العودة إلى القائمة' : '← Back to list'}
          </a>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
            {detail.applicant_name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-neutral-600)]">
            <span dir="ltr">{detail.applicant_email}</span>
            {detail.applicant_phone && (
              <>
                <span>·</span>
                <span dir="ltr">{detail.applicant_phone}</span>
              </>
            )}
            <span>·</span>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)]">
              {statusLabel(detail.status)}
            </span>
            {detail.source === 'manual_entry' && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                {isAr ? 'إدخال يدوي' : 'Manual entry'}
              </span>
            )}
          </div>
        </div>

        {/* Two-column layout: details + actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Program */}
            <div className="rounded-xl border border-[var(--color-neutral-100)] p-5 bg-white">
              <h2 className="text-base font-semibold mb-3">
                {isAr ? 'البرنامج المطلوب' : 'Requested program'}
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <dt className="text-[var(--color-neutral-500)]">
                  {isAr ? 'العائلة' : 'Family'}
                </dt>
                <dd className="font-medium uppercase">{detail.program_family}</dd>
                <dt className="text-[var(--color-neutral-500)]">
                  {isAr ? 'البرنامج' : 'Program slug'}
                </dt>
                <dd className="font-medium" dir="ltr">{detail.program_slug}</dd>
                <dt className="text-[var(--color-neutral-500)]">
                  {isAr ? 'النوع' : 'Tier'}
                </dt>
                <dd className="font-medium">
                  {detail.scholarship_tier === 'partial'
                    ? isAr ? 'جزئيّة' : 'Partial'
                    : isAr ? 'كاملة' : 'Full'}
                </dd>
                <dt className="text-[var(--color-neutral-500)]">
                  {isAr ? 'لغة التواصل' : 'Preferred language'}
                </dt>
                <dd className="font-medium">{detail.preferred_language.toUpperCase()}</dd>
              </dl>
            </div>

            {/* Financial context */}
            <div className="rounded-xl border border-[var(--color-neutral-100)] p-5 bg-white">
              <h2 className="text-base font-semibold mb-3">
                {isAr ? 'السياق الماليّ' : 'Financial context'}
              </h2>
              {aj.financial_context?.description ? (
                <p className="text-sm text-[var(--color-neutral-800)] whitespace-pre-wrap leading-relaxed mb-3">
                  {aj.financial_context.description}
                </p>
              ) : (
                <p className="text-sm italic text-[var(--color-neutral-400)] mb-3">
                  {isAr ? 'لم يقدّم وصفاً.' : 'No description provided.'}
                </p>
              )}
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <dt className="text-[var(--color-neutral-500)]">
                  {isAr ? 'فئة الدخل' : 'Income bucket'}
                </dt>
                <dd className="font-medium">
                  {aj.financial_context?.income_bucket
                    ? isAr
                      ? INCOME_LABELS[aj.financial_context.income_bucket]?.ar ?? aj.financial_context.income_bucket
                      : INCOME_LABELS[aj.financial_context.income_bucket]?.en ?? aj.financial_context.income_bucket
                    : '—'}
                </dd>
                <dt className="text-[var(--color-neutral-500)]">
                  {isAr ? 'المعالون' : 'Dependents'}
                </dt>
                <dd className="font-medium">
                  {aj.financial_context?.dependents ?? '—'}
                </dd>
              </dl>
            </div>

            {/* Readiness */}
            <div className="rounded-xl border border-[var(--color-neutral-100)] p-5 bg-white">
              <h2 className="text-base font-semibold mb-3">
                {isAr ? 'الاستعداد للرحلة' : 'Readiness signals'}
              </h2>
              {aj.readiness_signals?.motivation && (
                <div className="mb-4">
                  <h3 className="text-xs uppercase tracking-wide text-[var(--color-neutral-500)] mb-1">
                    {isAr ? 'الدافع الحالي' : 'Current motivation'}
                  </h3>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {aj.readiness_signals.motivation}
                  </p>
                </div>
              )}
              {aj.readiness_signals?.prior_efforts && (
                <div className="mb-4">
                  <h3 className="text-xs uppercase tracking-wide text-[var(--color-neutral-500)] mb-1">
                    {isAr ? 'محاولات سابقة' : 'Prior efforts'}
                  </h3>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {aj.readiness_signals.prior_efforts}
                  </p>
                </div>
              )}
              <div className="text-sm">
                <span className="text-[var(--color-neutral-500)]">
                  {isAr ? 'متاح للمدّة الكاملة:' : 'Available for full duration:'}
                </span>{' '}
                <span className="font-medium">
                  {aj.readiness_signals?.available_for_duration === true
                    ? isAr ? 'نعم' : 'Yes'
                    : aj.readiness_signals?.available_for_duration === false
                      ? isAr ? 'لا' : 'No'
                      : '—'}
                </span>
              </div>
            </div>

            {/* What you will give */}
            <div className="rounded-xl border border-[var(--color-neutral-100)] p-5 bg-white">
              <h2 className="text-base font-semibold mb-3">
                {isAr ? 'ما سيقدّمه المتقدّم' : 'What the applicant will give'}
              </h2>
              {aj.what_you_will_give ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {aj.what_you_will_give}
                </p>
              ) : (
                <p className="text-sm italic text-[var(--color-neutral-400)]">
                  {isAr ? 'لم يقدّم رداً.' : 'No response provided.'}
                </p>
              )}
            </div>

            {/* Endorsement */}
            {(aj.endorsement?.name || aj.endorsement?.email) && (
              <div className="rounded-xl border border-[var(--color-neutral-100)] p-5 bg-white">
                <h2 className="text-base font-semibold mb-3">
                  {isAr ? 'التزكية' : 'Endorsement'}
                </h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <dt className="text-[var(--color-neutral-500)]">
                    {isAr ? 'الاسم' : 'Name'}
                  </dt>
                  <dd className="font-medium">{aj.endorsement?.name ?? '—'}</dd>
                  <dt className="text-[var(--color-neutral-500)]">
                    {isAr ? 'البريد' : 'Email'}
                  </dt>
                  <dd className="font-medium" dir="ltr">{aj.endorsement?.email ?? '—'}</dd>
                </dl>
              </div>
            )}

            {/* Audit log */}
            <div className="rounded-xl border border-[var(--color-neutral-100)] p-5 bg-white">
              <h2 className="text-base font-semibold mb-3">
                {isAr ? 'سجل الأحداث' : 'Audit log'}
              </h2>
              <ol className="space-y-3 text-sm">
                {detail.audit_events.length === 0 && (
                  <li className="italic text-[var(--color-neutral-400)]">
                    {isAr ? 'لا توجد أحداث.' : 'No events.'}
                  </li>
                )}
                {detail.audit_events.map((e) => {
                  const dt = new Date(e.created_at);
                  return (
                    <li key={e.id} className="border-l-2 border-[var(--color-primary)]/30 pl-3">
                      <div className="text-xs text-[var(--color-neutral-500)]">
                        {dt.toLocaleString(isAr ? 'ar-AE' : 'en-US')}
                      </div>
                      <div className="font-medium text-[var(--color-neutral-800)]">
                        {e.event_type}
                        {e.before_status && e.after_status && (
                          <span className="text-[var(--color-neutral-500)] font-normal">
                            {' '}({e.before_status} → {e.after_status})
                          </span>
                        )}
                      </div>
                      {e.admin_name && (
                        <div className="text-xs text-[var(--color-neutral-500)]">
                          {isAr ? 'بواسطة' : 'by'} {e.admin_name}
                        </div>
                      )}
                      {e.note && (
                        <div className="mt-1 text-xs italic text-[var(--color-neutral-700)] whitespace-pre-wrap">
                          {e.note}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* Right column: Action panel */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-[var(--color-neutral-100)] p-5 bg-white">
              <h2 className="text-base font-semibold mb-3">
                {isAr ? 'الإجراءات' : 'Actions'}
              </h2>
              <p className="text-xs text-[var(--color-neutral-500)] mb-3">
                {isAr
                  ? 'الإجراء يُسجَّل في السجل الزمنيّ ويُرسل إيميلاً تلقائياً (للموافقة، الرفض، قائمة الانتظار).'
                  : 'Each action is logged and triggers a bilingual email (for approve / decline / waitlist).'}
              </p>

              {/* Note input — used by all transitions */}
              <label htmlFor="action-note" className="block text-xs text-[var(--color-neutral-600)] mb-1">
                {isAr ? 'ملاحظة داخليّة (اختياريّة)' : 'Internal note (optional)'}
              </label>
              <textarea
                id="action-note"
                rows={3}
                maxLength={2000}
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 text-sm mb-3"
                placeholder={
                  isAr
                    ? 'تظهر في السجل، لا تُرسل للمتقدّم.'
                    : 'Visible in the audit log; never shown to the applicant.'
                }
              />

              {actionError && (
                <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-800">
                  {actionError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                {ACTION_BUTTONS.map((b) => {
                  const enabled = !transitioning;
                  const tone = b.tone;
                  const cls =
                    tone === 'success'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : tone === 'danger'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : tone === 'warn'
                          ? 'bg-orange-500 hover:bg-orange-600 text-white'
                          : tone === 'primary'
                            ? 'bg-[var(--color-primary)] hover:opacity-90 text-white'
                            : 'border border-[var(--color-neutral-300)] hover:border-[var(--color-primary)] text-[var(--color-neutral-700)]';
                  const isPending = pendingAction === b.target;
                  return (
                    <button
                      key={b.target}
                      type="button"
                      disabled={!enabled}
                      onClick={() => {
                        if (isPending) {
                          applyTransition(b.target);
                        } else {
                          setPendingAction(b.target);
                        }
                      }}
                      className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${cls}`}
                    >
                      {transitioning && isPending
                        ? isAr ? 'جارٍ الحفظ...' : 'Saving...'
                        : isPending
                          ? isAr ? 'تأكيد: ' + b.ar : 'Confirm: ' + b.en
                          : isAr ? b.ar : b.en}
                    </button>
                  );
                })}
              </div>

              {pendingAction && (
                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="mt-2 w-full rounded-lg px-4 py-2 text-xs text-[var(--color-neutral-500)] hover:underline"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              )}

              {/* E.6 — Allocation CTA (status='approved' only) */}
              {detail.status === 'approved' && (
                <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)]">
                  <a
                    href={`/${locale}/admin/scholarships/applications/${id}/allocate`}
                    className="block w-full rounded-lg bg-[var(--color-primary)] hover:opacity-90 text-white px-4 py-2 text-sm font-medium text-center transition"
                  >
                    {isAr ? 'تخصيص التبرّعات' : 'Allocate donations'}
                  </a>
                  <p className="mt-2 text-xs text-[var(--color-neutral-500)]">
                    {isAr
                      ? 'اختر التبرّعات المتاحة لتغطية تكلفة البرنامج.'
                      : 'Select available donations to cover the program cost.'}
                  </p>
                </div>
              )}

              {/* E.6 — Disburse CTA (status='allocated' only) */}
              {detail.status === 'allocated' && (
                <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)]">
                  {disburseSuccess ? (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                      {isAr
                        ? '✓ تمّ الصرف. أُرسل البريد للمتقدّم مع رابط التسجيل.'
                        : '✓ Disbursed. Enrollment email sent to the applicant.'}
                    </div>
                  ) : (
                    <>
                      {disburseError && (
                        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-800">
                          {disburseError}
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={disbursing}
                        onClick={() => {
                          if (disbursePending) {
                            performDisburse();
                          } else {
                            setDisbursePending(true);
                          }
                        }}
                        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition"
                      >
                        {disbursing
                          ? isAr ? 'جارٍ الصرف...' : 'Disbursing...'
                          : disbursePending
                            ? isAr ? 'تأكيد: صرف' : 'Confirm: Disburse'
                            : isAr ? 'تأشير كمصروفة' : 'Mark as Disbursed'}
                      </button>
                      {disbursePending && (
                        <button
                          type="button"
                          onClick={() => setDisbursePending(false)}
                          className="mt-2 w-full rounded-lg px-4 py-2 text-xs text-[var(--color-neutral-500)] hover:underline"
                        >
                          {isAr ? 'إلغاء' : 'Cancel'}
                        </button>
                      )}
                      <p className="mt-2 text-xs text-[var(--color-neutral-500)]">
                        {isAr
                          ? 'يُولَّد رمز استفادة فريد ويُرسَل للمتقدّم. صلاحيّته 30 يوماً.'
                          : 'A unique scholarship token is issued and emailed to the applicant. Valid for 30 days.'}
                      </p>
                    </>
                  )}
                </div>
              )}

              {detail.status === 'disbursed' && (
                <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)]">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                    {isAr
                      ? '✓ تمّ الصرف. الرمز نشط حتّى استخدامه أو انتهاء صلاحيّته.'
                      : '✓ Disbursed. Token is active until used or expired.'}
                  </div>
                </div>
              )}
            </div>

            {/* Metadata card */}
            <div className="rounded-xl border border-[var(--color-neutral-100)] p-5 bg-white">
              <h2 className="text-base font-semibold mb-2">
                {isAr ? 'البيانات الفنيّة' : 'Metadata'}
              </h2>
              <dl className="text-xs space-y-1 text-[var(--color-neutral-600)]">
                <div className="flex justify-between gap-2">
                  <dt>{isAr ? 'تاريخ الإنشاء' : 'Created'}</dt>
                  <dd dir="ltr">
                    {new Date(detail.created_at).toLocaleString(isAr ? 'ar-AE' : 'en-US')}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{isAr ? 'آخر تحديث' : 'Updated'}</dt>
                  <dd dir="ltr">
                    {new Date(detail.updated_at).toLocaleString(isAr ? 'ar-AE' : 'en-US')}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{isAr ? 'المصدر' : 'Source'}</dt>
                  <dd>{detail.source}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{isAr ? 'المعرّف' : 'ID'}</dt>
                  <dd dir="ltr" className="font-mono text-[10px]">{detail.id}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </Section>
  );
}
