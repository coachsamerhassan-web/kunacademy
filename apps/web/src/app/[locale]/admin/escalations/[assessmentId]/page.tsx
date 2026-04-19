'use client';

/**
 * /[locale]/admin/escalations/[assessmentId]
 *
 * Escalation detail view for mentor_manager / admin.
 *
 * Layout:
 *   LEFT pane  (40%) — Audio stream player + transcript viewer
 *   RIGHT pane (60%) — Rubric readout (read-only) + ethics gates status
 *                      + Part 4 summary + override form + 2nd opinion button
 *                      + link to fail-feedback voice recorder
 *
 * Routes consumed:
 *   GET  /api/assessments/[assessmentId]              — assessment detail
 *   GET  /api/recordings/[id]/stream                  — audio stream (reuse)
 *   GET  /api/recordings/[id]/transcript              — transcript (reuse)
 *   POST /api/admin/assessments/[assessmentId]/override
 *   POST /api/admin/assessments/[assessmentId]/request-second-opinion
 *
 * M5 — Mentor-manager escalation review UI
 */

import { useAuth } from '@kunacademy/auth';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RubricObservation {
  state: 'observed' | 'not_observed' | 'not_applicable' | null;
  evidence?: string | null;
}

interface RubricScores {
  sessionDeliveryDate?: string;
  sessionNumber?: string | number;
  sessionLevel?: string | number;
  observations?: Record<string, RubricObservation>;
  ethicsGates?: Record<string, 'agree' | 'disagree' | null>;
  strongestCompetencies?: string;
  developmentAreas?: string;
  mentorGuidance?: string;
  verdict?: string;
  ethics_auto_failed?: boolean;
  [key: string]: unknown;
}

interface AssessmentDetail {
  assessment_id:  string;
  recording_id:   string;
  package_instance_id: string;
  assessor_id:    string;
  decision:       string;
  decision_note:  string | null;
  decided_at:     string | null;
  assigned_at:    string;
  escalated_at:   string | null;
  ethics_auto_failed: boolean;
  rubric_scores:  RubricScores | null;
  second_opinion_requested_at: string | null;
  override_reason: string | null;
  override_by:    string | null;
  original_filename: string;
  mime_type:      string;
  duration_seconds: number | null;
  student_name:   string | null;
  student_email:  string;
  assessor_name:  string | null;
  assessor_email: string;
}

type OverrideStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; new_decision: string }
  | { kind: 'error'; message: string };

type SecondOpinionStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

// ── Helpers ────────────────────────────────────────────────────────────────────

function observationStateLabel(state: string | null | undefined, isAr: boolean): string {
  if (!state) return isAr ? 'غير محدد' : 'Unset';
  const map: Record<string, { ar: string; en: string }> = {
    observed:       { ar: 'مُلاحَظ',       en: 'Observed'       },
    not_observed:   { ar: 'غير مُلاحَظ',   en: 'Not Observed'   },
    not_applicable: { ar: 'غير قابل',      en: 'Not Applicable' },
  };
  return isAr ? (map[state]?.ar ?? state) : (map[state]?.en ?? state);
}

function stateCls(state: string | null | undefined): string {
  if (state === 'observed')       return 'text-green-700 bg-green-50';
  if (state === 'not_observed')   return 'text-red-700   bg-red-50';
  if (state === 'not_applicable') return 'text-gray-500  bg-gray-50';
  return 'text-gray-400 bg-gray-50';
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function EscalationDetailPage() {
  const { locale, assessmentId } = useParams<{ locale: string; assessmentId: string }>();
  const isAr = locale === 'ar';
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [detail, setDetail]   = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  // Override form state
  const [newDecision, setNewDecision] = useState<'pass' | 'fail' | ''>('');
  const [reason, setReason]     = useState('');
  const [overrideStatus, setOverrideStatus] = useState<OverrideStatus>({ kind: 'idle' });

  // Second opinion state
  const [secondOpinionStatus, setSecondOpinionStatus] =
    useState<SecondOpinionStatus>({ kind: 'idle' });

  // ── Auth guard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authLoading) {
      const role = (user as { role?: string } | null)?.role;
      const allowed = role === 'admin' || role === 'super_admin' || role === 'mentor_manager';
      if (!user || !allowed) {
        router.replace(`/${locale}/dashboard`);
      }
    }
  }, [user, authLoading, locale, router]);

  // ── Fetch assessment detail ────────────────────────────────────────────────

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setDetail(data);
    } catch (err: unknown) {
      setFetchErr(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ── Override handler ───────────────────────────────────────────────────────

  const handleOverride = useCallback(async () => {
    if (!newDecision) return;
    if (!reason.trim()) {
      setOverrideStatus({ kind: 'error', message: isAr ? 'السبب مطلوب' : 'Reason is required' });
      return;
    }
    setOverrideStatus({ kind: 'submitting' });
    try {
      const res = await fetch(`/api/admin/assessments/${assessmentId}/override`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ new_decision: newDecision, reason: reason.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setOverrideStatus({ kind: 'success', new_decision: body.new_decision });
      // Refresh to show updated decision
      await fetchDetail();
    } catch (err: unknown) {
      setOverrideStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Override failed',
      });
    }
  }, [assessmentId, newDecision, reason, isAr, fetchDetail]);

  // ── Second opinion handler ─────────────────────────────────────────────────

  const handleSecondOpinion = useCallback(async () => {
    setSecondOpinionStatus({ kind: 'submitting' });
    try {
      const res = await fetch(
        `/api/admin/assessments/${assessmentId}/request-second-opinion`,
        { method: 'POST' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setSecondOpinionStatus({ kind: 'success' });
      await fetchDetail();
    } catch (err: unknown) {
      setSecondOpinionStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Request failed',
      });
    }
  }, [assessmentId, fetchDetail]);

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading || authLoading) {
    return (
      <Section variant="white">
        <p className="text-center text-[var(--color-neutral-500)] py-16">
          {isAr ? 'جارٍ التحميل...' : 'Loading...'}
        </p>
      </Section>
    );
  }

  if (fetchErr || !detail) {
    return (
      <Section variant="white">
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          {fetchErr ?? (isAr ? 'لم يُعثَر على التقييم' : 'Assessment not found')}
        </div>
      </Section>
    );
  }

  const rubric = detail.rubric_scores ?? {};
  const observations = rubric.observations ?? {};
  const ethicsGates  = rubric.ethicsGates ?? {};
  const dir = isAr ? 'rtl' : 'ltr';

  // Audio stream URL (reuses existing recordings stream route)
  const audioSrc = `/api/recordings/${detail.recording_id}/stream`;
  const transcriptUrl = `/api/recordings/${detail.recording_id}/transcript`;

  return (
    <main dir={dir}>
      <Section variant="white">
        {/* ── Back link ── */}
        <button
          onClick={() => router.push(`/${locale}/admin/escalations`)}
          className="flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline mb-6 min-h-[44px]"
        >
          {isAr ? '→ العودة للقائمة' : '← Back to list'}
        </button>

        <Heading level={1} className="mb-2">
          {isAr ? 'تفاصيل التقييم' : 'Assessment Detail'}
        </Heading>

        {/* ── Meta strip ── */}
        <div className="flex flex-wrap gap-4 text-sm text-[var(--color-neutral-600)] mb-8 border-b border-[var(--color-neutral-100)] pb-4">
          <span>
            <strong>{isAr ? 'الطالب: ' : 'Student: '}</strong>
            {detail.student_name ?? detail.student_email}
          </span>
          <span>
            <strong>{isAr ? 'المُقيِّم: ' : 'Assessor: '}</strong>
            {detail.assessor_name ?? detail.assessor_email}
          </span>
          <span>
            <strong>{isAr ? 'القرار الحالي: ' : 'Current decision: '}</strong>
            <span
              className={`font-semibold ${
                detail.decision === 'pass'
                  ? 'text-green-700'
                  : detail.decision === 'fail'
                  ? 'text-red-700'
                  : 'text-yellow-700'
              }`}
            >
              {detail.decision}
            </span>
          </span>
          {detail.ethics_auto_failed && (
            <span className="inline-block rounded px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium">
              {isAr ? 'فشل أخلاقي تلقائي' : 'Ethics Auto-Failed'}
            </span>
          )}
          {detail.escalated_at && (
            <span className="inline-block rounded px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium">
              {isAr ? 'مُصعَّد' : 'Escalated'}
            </span>
          )}
          {detail.second_opinion_requested_at && (
            <span className="inline-block rounded px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium">
              {isAr ? 'رأي ثانٍ مطلوب' : '2nd Opinion Requested'}
            </span>
          )}
        </div>

        {/* ── Two-pane layout ── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* LEFT — Audio + Transcript */}
          <div className="lg:w-2/5 flex flex-col gap-4">

            {/* Audio player */}
            <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
              <h2 className="text-sm font-semibold text-[var(--color-neutral-700)] mb-3">
                {isAr ? 'التسجيل الصوتي' : 'Audio Recording'}
              </h2>
              <p className="text-xs text-[var(--color-neutral-500)] mb-2 truncate">
                {detail.original_filename}
              </p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                ref={audioRef}
                controls
                className="w-full"
                src={audioSrc}
                preload="metadata"
              />
              <div className="flex gap-2 mt-2">
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      if (audioRef.current) audioRef.current.playbackRate = rate;
                    }}
                    className="min-h-[36px] px-2 py-1 text-xs rounded border border-[var(--color-neutral-200)] hover:border-[var(--color-primary)] transition"
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Transcript viewer */}
            <div className="rounded-lg border border-[var(--color-neutral-200)] p-4 flex-1">
              <h2 className="text-sm font-semibold text-[var(--color-neutral-700)] mb-3">
                {isAr ? 'النص المكتوب' : 'Transcript'}
              </h2>
              <iframe
                src={transcriptUrl}
                className="w-full h-64 lg:h-80 rounded border border-[var(--color-neutral-100)]"
                title={isAr ? 'النص' : 'Transcript'}
              />
            </div>
          </div>

          {/* RIGHT — Rubric readout + override */}
          <div className="lg:w-3/5 flex flex-col gap-6">

            {/* Part 0 — Session metadata */}
            <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
              <h2 className="text-sm font-semibold text-[var(--color-neutral-700)] mb-3">
                {isAr ? 'الجزء 0 — بيانات الجلسة' : 'Part 0 — Session Metadata'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {[
                  { key: 'sessionDeliveryDate', labelAr: 'تاريخ الجلسة', labelEn: 'Session Date' },
                  { key: 'sessionNumber',       labelAr: 'رقم الجلسة',   labelEn: 'Session #'    },
                  { key: 'sessionLevel',        labelAr: 'مستوى الجلسة', labelEn: 'Session Level' },
                ].map(({ key, labelAr, labelEn }) => (
                  <div key={key} className="bg-[var(--color-surface-dim)] rounded p-2">
                    <div className="text-xs text-[var(--color-neutral-500)] mb-0.5">
                      {isAr ? labelAr : labelEn}
                    </div>
                    <div className="font-medium text-[var(--color-neutral-900)]">
                      {String(rubric[key] ?? '—')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ethics gates */}
            <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
              <h2 className="text-sm font-semibold text-[var(--color-neutral-700)] mb-3">
                {isAr ? 'الجزء 3 — البوابات الأخلاقية' : 'Part 3 — Ethics Gates'}
              </h2>
              <div className="flex flex-col gap-2">
                {(['G1', 'G2', 'G3'] as const).map((gate) => {
                  const val = ethicsGates[gate];
                  return (
                    <div key={gate} className="flex items-center gap-3 text-sm">
                      <span className="font-mono text-xs text-[var(--color-neutral-500)] w-6">{gate}</span>
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                          val === 'agree'
                            ? 'bg-green-100 text-green-700'
                            : val === 'disagree'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {val === 'agree'
                          ? (isAr ? 'موافق'        : 'Agree')
                          : val === 'disagree'
                          ? (isAr ? 'غير موافق'    : 'Disagree')
                          : (isAr ? 'غير محدد'     : 'Unset')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rubric observations — compact read-only */}
            {Object.keys(observations).length > 0 && (
              <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
                <h2 className="text-sm font-semibold text-[var(--color-neutral-700)] mb-3">
                  {isAr ? 'الجزء 1–2 — ملاحظات الروبريك' : 'Parts 1–2 — Rubric Observations'}
                </h2>
                <div className="overflow-y-auto max-h-64">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--color-neutral-100)]">
                        <th className="py-1.5 px-2 text-start text-[var(--color-neutral-500)] font-medium w-10">
                          {isAr ? 'رقم' : '#'}
                        </th>
                        <th className="py-1.5 px-2 text-start text-[var(--color-neutral-500)] font-medium">
                          {isAr ? 'الحالة' : 'State'}
                        </th>
                        <th className="py-1.5 px-2 text-start text-[var(--color-neutral-500)] font-medium">
                          {isAr ? 'الدليل' : 'Evidence'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(observations)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([id, obs]) => (
                          <tr key={id} className="border-b border-[var(--color-neutral-50)]">
                            <td className="py-1 px-2 font-mono text-[var(--color-neutral-500)]">{id}</td>
                            <td className="py-1 px-2">
                              <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${stateCls(obs.state)}`}>
                                {observationStateLabel(obs.state, isAr)}
                              </span>
                            </td>
                            <td className="py-1 px-2 text-[var(--color-neutral-600)] truncate max-w-[12rem]">
                              {obs.evidence ?? '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Part 4 summary */}
            <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
              <h2 className="text-sm font-semibold text-[var(--color-neutral-700)] mb-3">
                {isAr ? 'الجزء 4 — خلاصة المُقيِّم' : "Part 4 — Assessor's Summary"}
              </h2>
              {[
                { key: 'strongestCompetencies', labelAr: 'أقوى الكفاءات',   labelEn: 'Strongest Competencies' },
                { key: 'developmentAreas',      labelAr: 'مجالات التطوير',  labelEn: 'Development Areas'      },
                { key: 'mentorGuidance',        labelAr: 'توجيه المشرف',    labelEn: "Mentor's Guidance"       },
              ].map(({ key, labelAr, labelEn }) => (
                <div key={key} className="mb-3">
                  <div className="text-xs text-[var(--color-neutral-500)] mb-1">
                    {isAr ? labelAr : labelEn}
                  </div>
                  <div className="rounded bg-[var(--color-surface-dim)] p-3 text-sm text-[var(--color-neutral-800)] whitespace-pre-wrap">
                    {String(rubric[key] ?? '—')}
                  </div>
                </div>
              ))}
            </div>

            {/* Override form */}
            <div className="rounded-lg border-2 border-[var(--color-primary)] p-4">
              <h2 className="text-sm font-semibold text-[var(--color-neutral-900)] mb-4">
                {isAr ? 'تجاوز قرار المُقيِّم' : 'Override Assessor Decision'}
              </h2>

              {overrideStatus.kind === 'success' ? (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-green-700 text-sm">
                  {isAr
                    ? `تم تغيير القرار إلى: ${overrideStatus.new_decision}`
                    : `Decision changed to: ${overrideStatus.new_decision}`}
                </div>
              ) : (
                <>
                  <div className="flex gap-4 mb-4">
                    {(['pass', 'fail'] as const).map((d) => (
                      <label
                        key={d}
                        className="flex items-center gap-2 cursor-pointer min-h-[44px]"
                      >
                        <input
                          type="radio"
                          name="new_decision"
                          value={d}
                          checked={newDecision === d}
                          onChange={() => setNewDecision(d)}
                          className="w-4 h-4 accent-[var(--color-primary)]"
                        />
                        <span
                          className={`text-sm font-medium ${
                            d === 'pass' ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {d === 'pass'
                            ? (isAr ? 'ناجح' : 'Pass')
                            : (isAr ? 'راسب' : 'Fail')}
                        </span>
                      </label>
                    ))}
                  </div>

                  <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
                    {isAr ? 'سبب التجاوز (إلزامي)' : 'Override reason (required)'}
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-[var(--color-neutral-300)] p-3 text-sm resize-none focus:outline-none focus:border-[var(--color-primary)] mb-4"
                    placeholder={
                      isAr
                        ? 'اشرح سبب تغيير القرار...'
                        : 'Explain why you are changing the decision...'
                    }
                  />

                  {overrideStatus.kind === 'error' && (
                    <p className="text-red-600 text-xs mb-3">{overrideStatus.message}</p>
                  )}

                  <button
                    onClick={handleOverride}
                    disabled={!newDecision || !reason.trim() || overrideStatus.kind === 'submitting'}
                    className="min-h-[44px] w-full rounded-md bg-[var(--color-primary)] text-white text-sm font-semibold px-4 py-2 hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {overrideStatus.kind === 'submitting'
                      ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                      : (isAr ? 'تأكيد التجاوز' : 'Confirm Override')}
                  </button>
                </>
              )}
            </div>

            {/* Second opinion stub */}
            <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
              <h2 className="text-sm font-semibold text-[var(--color-neutral-700)] mb-2">
                {isAr ? 'طلب رأي ثانٍ' : 'Request Second Opinion'}
              </h2>
              <p className="text-xs text-[var(--color-neutral-500)] mb-4">
                {isAr
                  ? 'سيُسجَّل الطلب في قاعدة البيانات. سيتم ربط تدفق اختيار المُقيِّم الثاني لاحقاً.'
                  : 'Flags the assessment for a second opinion. Second-assessor assignment flow to be wired in a future phase.'}
              </p>

              {detail.second_opinion_requested_at ? (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-blue-700 text-xs">
                  {isAr
                    ? `تم الطلب في: ${new Date(detail.second_opinion_requested_at).toLocaleString('ar-AE')}`
                    : `Requested at: ${new Date(detail.second_opinion_requested_at).toLocaleString('en-GB')}`}
                </div>
              ) : (
                <>
                  {secondOpinionStatus.kind === 'success' ? (
                    <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-blue-700 text-xs">
                      {isAr ? 'تم تسجيل الطلب.' : 'Request recorded.'}
                    </div>
                  ) : (
                    <>
                      {secondOpinionStatus.kind === 'error' && (
                        <p className="text-red-600 text-xs mb-2">{secondOpinionStatus.message}</p>
                      )}
                      <button
                        onClick={handleSecondOpinion}
                        disabled={secondOpinionStatus.kind === 'submitting'}
                        className="min-h-[44px] w-full rounded-md border border-[var(--color-neutral-300)] text-sm text-[var(--color-neutral-700)] px-4 py-2 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {secondOpinionStatus.kind === 'submitting'
                          ? (isAr ? 'جارٍ التسجيل...' : 'Recording...')
                          : (isAr ? 'طلب رأي ثانٍ' : 'Request Second Opinion')}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Fail feedback link (voice recorder) */}
            {(detail.decision === 'fail' || newDecision === 'fail' || overrideStatus.kind === 'success' && overrideStatus.new_decision === 'fail') && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <h2 className="text-sm font-semibold text-orange-800 mb-2">
                  {isAr ? 'ملاحظات الرسوب — رسالة صوتية' : 'Fail Feedback — Voice Message'}
                </h2>
                <p className="text-xs text-orange-700 mb-3">
                  {isAr
                    ? 'الطالب رسب. يمكنك تسجيل رسالة صوتية من مساحة المُقيِّم.'
                    : 'The student has failed. Record a voice feedback message from the assessor workspace.'}
                </p>
                <a
                  href={`/${locale}/portal/assessor/${assessmentId}`}
                  className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-md bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition"
                >
                  {isAr ? 'فتح مساحة المُقيِّم ← تسجيل ملاحظة صوتية' : 'Open Assessor Workspace → Record Voice Note'}
                </a>
              </div>
            )}

          </div>
        </div>
      </Section>
    </main>
  );
}
