'use client';

/**
 * /[locale]/admin/escalations/[assessmentId]
 *
 * Escalation detail view for mentor_manager / admin.
 *
 * Layout:
 *   LEFT pane  (40%) — Audio stream player + transcript viewer
 *   RIGHT pane (60%) — Rubric readout (read-only) + ethics gates status
 *                      + Part 4 summary + override form
 *                      + Unpause Journey button (when journey_state === 'paused')
 *                      + Record Voice Feedback widget (inline MediaRecorder)
 *                      + 2nd opinion button
 *
 * Routes consumed:
 *   GET  /api/assessments/[assessmentId]              — assessment detail
 *   GET  /api/recordings/[id]/stream                  — audio stream (reuse)
 *   GET  /api/recordings/[id]/transcript              — transcript (reuse)
 *   POST /api/admin/assessments/[assessmentId]/override
 *   POST /api/admin/assessments/[assessmentId]/request-second-opinion
 *   POST /api/admin/package-instances/[instanceId]/unpause  — M4 endpoint
 *   POST /api/assessments/[assessmentId]/voice-message      — Phase 2.6 endpoint
 *
 * M5 — Mentor-manager escalation review UI
 * M5-gap1 — Unpause Journey button
 * M5-gap2 — Inline voice feedback recorder for escalation path
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
  /** Package instance journey state — needed for unpause button (M5-gap1) */
  journey_state:  string | null;
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

type UnpauseStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

type RecorderStatus =
  | { kind: 'idle' }
  | { kind: 'recording'; startedAt: number }
  | { kind: 'recorded'; blob: Blob; durationSeconds: number; previewUrl: string }
  | { kind: 'uploading' }
  | { kind: 'done'; durationSeconds: number }
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

  // Unpause journey state (M5-gap1)
  const [unpauseStatus, setUnpauseStatus] = useState<UnpauseStatus>({ kind: 'idle' });

  // Voice recorder state (M5-gap2)
  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>({ kind: 'idle' });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed, setElapsed] = useState(0);

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

  // ── Unpause handler (M5-gap1) ──────────────────────────────────────────────

  const handleUnpause = useCallback(async () => {
    if (!detail) return;
    setUnpauseStatus({ kind: 'submitting' });
    try {
      const res = await fetch(
        `/api/admin/package-instances/${detail.package_instance_id}/unpause`,
        { method: 'POST' },
      );
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setUnpauseStatus({ kind: 'success' });
      await fetchDetail();
    } catch (err: unknown) {
      setUnpauseStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Unpause failed',
      });
    }
  }, [detail, fetchDetail]);

  // ── Voice recorder handlers (M5-gap2) ─────────────────────────────────────

  const MAX_RECORD_SECONDS = 600; // 10 minutes

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      const startedAt = Date.now();

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const previewUrl = URL.createObjectURL(blob);
        // Compute actual duration from wall time — avoids stale `elapsed` closure
        const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);
        setRecorderStatus({ kind: 'recorded', blob, durationSeconds, previewUrl });
      };

      mr.start(1000);
      setElapsed(0);
      setRecorderStatus({ kind: 'recording', startedAt });

      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(secs);
        if (secs >= MAX_RECORD_SECONDS) {
          mr.stop();
          clearInterval(timerRef.current!);
        }
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setRecorderStatus({ kind: 'error', message: msg });
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const discardRecording = useCallback(() => {
    if (recorderStatus.kind === 'recorded') URL.revokeObjectURL(recorderStatus.previewUrl);
    setRecorderStatus({ kind: 'idle' });
    setElapsed(0);
  }, [recorderStatus]);

  const uploadRecording = useCallback(async () => {
    if (recorderStatus.kind !== 'recorded') return;
    const { blob, durationSeconds, previewUrl } = recorderStatus;
    setRecorderStatus({ kind: 'uploading' });

    const formData = new FormData();
    // Field name must be 'voice' — matches POST /api/assessments/[id]/voice-message
    formData.append('voice', blob, 'voice-feedback.webm');

    try {
      const res = await fetch(`/api/assessments/${assessmentId}/voice-message`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      URL.revokeObjectURL(previewUrl);
      setRecorderStatus({ kind: 'done', durationSeconds });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setRecorderStatus({ kind: 'error', message: msg });
    }
  }, [recorderStatus, assessmentId]);

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

            {/* Unpause Journey button (M5-gap1) — visible when journey is paused */}
            {detail.journey_state === 'paused' && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
                <h2 className="text-sm font-semibold text-yellow-900 mb-2">
                  {isAr ? 'إعادة تفعيل الرحلة' : 'Unpause Journey'}
                </h2>
                <p className="text-xs text-yellow-800 mb-4">
                  {isAr
                    ? 'الرحلة موقوفة حالياً. إعادة التفعيل تنقل الطالب إلى حالة "في انتظار المحاولة الثانية" ويمكنه إعادة التسجيل.'
                    : 'Journey is currently paused. Unpausing moves the student to second_try_pending — they can re-submit.'}
                </p>

                {unpauseStatus.kind === 'success' ? (
                  <div className="rounded-md bg-green-50 border border-green-200 p-3 text-green-700 text-sm">
                    {isAr
                      ? 'تمت إعادة التفعيل. يمكن للطالب الآن إعادة التسجيل.'
                      : 'Journey unpaused. Student can now resubmit.'}
                  </div>
                ) : (
                  <>
                    {unpauseStatus.kind === 'error' && (
                      <p className="text-red-600 text-xs mb-3">{unpauseStatus.message}</p>
                    )}
                    <button
                      onClick={() => void handleUnpause()}
                      disabled={unpauseStatus.kind === 'submitting'}
                      className="min-h-[44px] w-full rounded-md bg-yellow-600 text-white text-sm font-semibold px-4 py-2 hover:bg-yellow-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {unpauseStatus.kind === 'submitting'
                        ? (isAr ? 'جارٍ إعادة التفعيل...' : 'Unpausing...')
                        : (isAr ? 'إعادة تفعيل الرحلة' : 'Unpause Journey')}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Voice Feedback Recorder (M5-gap2) — inline MediaRecorder */}
            {/* Always visible for admin/mentor_manager on this page */}
            {(() => {
              const elapsedStr = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    <h2 className="text-sm font-semibold text-amber-800">
                      {isAr ? 'تسجيل ملاحظة صوتية للطالب' : 'Record Voice Feedback for Student'}
                    </h2>
                  </div>

                  <p className="text-xs text-amber-700">
                    {isAr
                      ? 'سجّل رسالة صوتية للطالب (حد أقصى ١٠ دقائق). ستظهر مباشرةً في صفحة نتيجته.'
                      : 'Record a voice message for the student (max 10 min). Appears directly on their result page.'}
                  </p>

                  {recorderStatus.kind === 'idle' && (
                    <button
                      onClick={() => void startRecording()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors min-h-[44px]"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="8" />
                      </svg>
                      {isAr ? 'بدء التسجيل' : 'Start Recording'}
                    </button>
                  )}

                  {recorderStatus.kind === 'recording' && (
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700">
                        <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                        {isAr ? 'جارٍ التسجيل' : 'Recording'} — {elapsedStr}
                      </span>
                      <button
                        onClick={stopRecording}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors min-h-[44px]"
                      >
                        {isAr ? 'إيقاف' : 'Stop'}
                      </button>
                    </div>
                  )}

                  {recorderStatus.kind === 'recorded' && (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio controls src={recorderStatus.previewUrl} className="w-full h-9" />
                      <div className="flex gap-2">
                        <button
                          onClick={() => void uploadRecording()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors min-h-[44px]"
                        >
                          {isAr ? 'حفظ وإرسال للطالب' : 'Save & Send to Student'}
                        </button>
                        <button
                          onClick={discardRecording}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-neutral-300)] text-sm font-medium hover:border-red-400 hover:text-red-600 transition-colors min-h-[44px]"
                        >
                          {isAr ? 'حذف وإعادة التسجيل' : 'Discard & Re-record'}
                        </button>
                      </div>
                    </div>
                  )}

                  {recorderStatus.kind === 'uploading' && (
                    <div className="flex items-center gap-2 text-sm text-[var(--color-neutral-500)]">
                      <div className="h-4 w-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                      {isAr ? 'جارٍ الرفع...' : 'Uploading...'}
                    </div>
                  )}

                  {recorderStatus.kind === 'done' && (
                    <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {isAr
                        ? `تم إرسال الرسالة الصوتية (${String(Math.floor(recorderStatus.durationSeconds / 60)).padStart(2, '0')}:${String(recorderStatus.durationSeconds % 60).padStart(2, '0')})`
                        : `Voice message sent (${String(Math.floor(recorderStatus.durationSeconds / 60)).padStart(2, '0')}:${String(recorderStatus.durationSeconds % 60).padStart(2, '0')})`}
                    </div>
                  )}

                  {recorderStatus.kind === 'error' && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                      {isAr ? `خطأ: ${recorderStatus.message}` : `Error: ${recorderStatus.message}`}
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
        </div>
      </Section>
    </main>
  );
}
