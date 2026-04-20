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

// ── Track A: Shadow score types ────────────────────────────────────────────────

interface ShadowScoreRow {
  id: string;
  shadow_scores: RubricScores;
  agreement_notes: string | null;
  agreement_level: 'fully_agree' | 'partially_agree' | 'disagree' | null;
  submitted_at: string | null;
}

type ShadowSubmitStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; submitted_at: string }
  | { kind: 'error'; message: string };

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

type ResolveSecondOpinionStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

type UnpauseStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

type ReassignStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

interface AssessorOption {
  profile_id: string;
  name: string;
  email: string;
}

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

  // Resolve second opinion state
  const [resolveSecondOpinionStatus, setResolveSecondOpinionStatus] =
    useState<ResolveSecondOpinionStatus>({ kind: 'idle' });

  // Unpause journey state (M5-gap1)
  const [unpauseStatus, setUnpauseStatus] = useState<UnpauseStatus>({ kind: 'idle' });

  // Reassign assessor state (M5-ext)
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [availableAssessors, setAvailableAssessors] = useState<AssessorOption[]>([]);
  const [selectedAssessorId, setSelectedAssessorId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassignStatus, setReassignStatus] = useState<ReassignStatus>({ kind: 'idle' });

  // ── Track A: Shadow rubric state ──────────────────────────────────────────
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowRow, setShadowRow] = useState<ShadowScoreRow | null>(null);
  const [shadowLoading, setShadowLoading] = useState(false);
  const [shadowScores, setShadowScores] = useState<RubricScores>({});
  const [shadowAgreementLevel, setShadowAgreementLevel] =
    useState<'fully_agree' | 'partially_agree' | 'disagree' | ''>('');
  const [shadowAgreementNotes, setShadowAgreementNotes] = useState('');
  const [shadowSubmitStatus, setShadowSubmitStatus] = useState<ShadowSubmitStatus>({ kind: 'idle' });
  const shadowDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voice recorder state (M5-gap2)
  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>({ kind: 'idle' });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // ── Track A: Fetch shadow row ─────────────────────────────────────────────

  const fetchShadowRow = useCallback(async () => {
    setShadowLoading(true);
    try {
      const res = await fetch(`/api/admin/assessments/${assessmentId}/shadow-score`);
      if (!res.ok) return;
      const data = (await res.json()) as ShadowScoreRow | null;
      if (data) {
        setShadowRow(data);
        setShadowScores(data.shadow_scores ?? {});
        setShadowAgreementLevel(data.agreement_level ?? '');
        setShadowAgreementNotes(data.agreement_notes ?? '');
      }
    } catch {
      // Non-critical — shadow row absence is a valid state
    } finally {
      setShadowLoading(false);
    }
  }, [assessmentId]);

  // Load shadow row when toggle is first enabled
  useEffect(() => {
    if (shadowEnabled && !shadowRow && !shadowLoading) {
      void fetchShadowRow();
    }
  }, [shadowEnabled, shadowRow, shadowLoading, fetchShadowRow]);

  // ── Track A: Auto-save (1500ms debounce) ─────────────────────────────────

  const shadowAutoSave = useCallback(
    (scores: RubricScores, level: string, notes: string) => {
      if (shadowDebounceRef.current) clearTimeout(shadowDebounceRef.current);
      shadowDebounceRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/admin/assessments/${assessmentId}/shadow-score`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              shadow_scores:    scores,
              agreement_level:  level || undefined,
              agreement_notes:  notes || undefined,
            }),
          });
        } catch {
          // Auto-save is best-effort — no UI error for transient failures
        }
      }, 1500);
    },
    [assessmentId],
  );

  // ── Track A: Submit shadow ────────────────────────────────────────────────

  const handleShadowSubmit = useCallback(async () => {
    // Ensure latest state is saved before submitting
    if (shadowDebounceRef.current) {
      clearTimeout(shadowDebounceRef.current);
      shadowDebounceRef.current = null;
    }
    // Flush current state first
    try {
      await fetch(`/api/admin/assessments/${assessmentId}/shadow-score`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          shadow_scores:   shadowScores,
          agreement_level: shadowAgreementLevel || undefined,
          agreement_notes: shadowAgreementNotes || undefined,
        }),
      });
    } catch { /* ignore */ }

    setShadowSubmitStatus({ kind: 'submitting' });
    try {
      const res = await fetch(
        `/api/admin/assessments/${assessmentId}/shadow-score/submit`,
        { method: 'POST' },
      );
      const body = await res.json().catch(() => ({})) as { submitted_at?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setShadowSubmitStatus({ kind: 'success', submitted_at: body.submitted_at ?? new Date().toISOString() });
      await fetchShadowRow();
    } catch (err: unknown) {
      setShadowSubmitStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Submit failed',
      });
    }
  }, [assessmentId, shadowScores, shadowAgreementLevel, shadowAgreementNotes, fetchShadowRow]);

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

  // ── Resolve second opinion handler ────────────────────────────────────────

  const handleResolveSecondOpinion = useCallback(async () => {
    setResolveSecondOpinionStatus({ kind: 'submitting' });
    try {
      const res = await fetch(
        `/api/admin/assessments/${assessmentId}/resolve-second-opinion`,
        { method: 'POST' },
      );
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setResolveSecondOpinionStatus({ kind: 'success' });
      await fetchDetail();
    } catch (err: unknown) {
      setResolveSecondOpinionStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Resolve failed',
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

  // ── Reassign assessor handlers (M5-ext) ───────────────────────────────────

  const openReassignModal = useCallback(async () => {
    setShowReassignModal(true);
    setSelectedAssessorId('');
    setReassignReason('');
    setReassignStatus({ kind: 'idle' });
    try {
      const res = await fetch('/api/admin/assessors');
      if (!res.ok) return;
      const data = await res.json() as { assessors: AssessorOption[] };
      setAvailableAssessors(data.assessors ?? []);
    } catch {
      // Non-critical — dropdown will be empty; user can dismiss and retry
    }
  }, []);

  const handleReassign = useCallback(async () => {
    if (!selectedAssessorId || !reassignReason.trim()) {
      setReassignStatus({
        kind: 'error',
        message: isAr
          ? 'يرجى اختيار المُقيِّم وكتابة السبب'
          : 'Please select an assessor and provide a reason',
      });
      return;
    }
    setReassignStatus({ kind: 'submitting' });
    try {
      const res = await fetch(`/api/admin/assessments/${assessmentId}/reassign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          new_assessor_id: selectedAssessorId,
          reason:          reassignReason.trim(),
        }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setReassignStatus({ kind: 'success' });
      setShowReassignModal(false);
      await fetchDetail();
    } catch (err: unknown) {
      setReassignStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Reassignment failed',
      });
    }
  }, [assessmentId, selectedAssessorId, reassignReason, isAr, fetchDetail]);

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

        {/* ── Track A: Shadow review toggle ── */}
        <div className="mb-6 rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-surface-dim)] px-4 py-3 flex items-center gap-3">
          <button
            role="switch"
            aria-checked={shadowEnabled}
            onClick={() => setShadowEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              shadowEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-300)]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                shadowEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <div>
            <span className="text-sm font-medium text-[var(--color-neutral-900)]">
              {isAr
                ? 'المراجعة الجانبية المستقلة (Shadow Review)'
                : 'Side-by-side comparison (independent shadow review)'}
            </span>
            <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
              {isAr
                ? 'سجّل تقييمك المستقل قبل الاطلاع على رأي المُقيِّم للحد من التحيز التأكيدي'
                : 'Score independently before viewing the assessor\'s work — reduces confirmation bias'}
            </p>
          </div>
        </div>

        {/* ── Track A: Side-by-side comparison view ── */}
        {shadowEnabled && (
          <div className="mb-8">
            <div className="flex flex-col xl:flex-row gap-4">

              {/* LEFT column — Assessor's rubric (read-only) */}
              <div className="xl:w-1/2 flex flex-col gap-4">
                <div className="rounded-t-lg bg-[var(--color-neutral-100)] border border-[var(--color-neutral-200)] px-4 py-2">
                  <h3 className="text-xs font-semibold text-[var(--color-neutral-600)] uppercase tracking-wide">
                    {isAr ? 'تقييم المُقيِّم (للاطلاع فقط)' : "Assessor's Rubric (read-only)"}
                  </h3>
                </div>

                {/* Session metadata — read-only */}
                <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
                  <h4 className="text-xs font-semibold text-[var(--color-neutral-500)] mb-2 uppercase">
                    {isAr ? 'بيانات الجلسة' : 'Session Metadata'}
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {(['sessionDeliveryDate', 'sessionNumber', 'sessionLevel'] as const).map((k) => (
                      <div key={k} className="rounded bg-[var(--color-surface-dim)] p-2">
                        <div className="text-xs text-[var(--color-neutral-500)] mb-0.5">{k}</div>
                        <div className="font-medium">{String(rubric[k] ?? '—')}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ethics gates — read-only */}
                <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
                  <h4 className="text-xs font-semibold text-[var(--color-neutral-500)] mb-2 uppercase">
                    {isAr ? 'البوابات الأخلاقية' : 'Ethics Gates'}
                  </h4>
                  {(['G1', 'G2', 'G3'] as const).map((gate) => {
                    const val = ethicsGates[gate];
                    return (
                      <div key={gate} className="flex items-center gap-2 text-sm mb-1">
                        <span className="font-mono text-xs text-[var(--color-neutral-400)] w-6">{gate}</span>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                          val === 'agree' ? 'bg-green-100 text-green-700'
                          : val === 'disagree' ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-400'
                        }`}>
                          {val === 'agree' ? (isAr ? 'موافق' : 'Agree')
                            : val === 'disagree' ? (isAr ? 'غير موافق' : 'Disagree')
                            : (isAr ? 'غير محدد' : 'Unset')}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Rubric observations — read-only */}
                {Object.keys(observations).length > 0 && (
                  <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
                    <h4 className="text-xs font-semibold text-[var(--color-neutral-500)] mb-2 uppercase">
                      {isAr ? 'ملاحظات الروبريك' : 'Rubric Observations'}
                    </h4>
                    <div className="overflow-y-auto max-h-56">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--color-neutral-100)]">
                            <th className="py-1 px-2 text-start text-[var(--color-neutral-400)] w-8">#</th>
                            <th className="py-1 px-2 text-start text-[var(--color-neutral-400)]">
                              {isAr ? 'الحالة' : 'State'}
                            </th>
                            <th className="py-1 px-2 text-start text-[var(--color-neutral-400)]">
                              {isAr ? 'الدليل' : 'Evidence'}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(observations)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([id, obs]) => (
                              <tr key={id} className="border-b border-[var(--color-neutral-50)]">
                                <td className="py-1 px-2 font-mono text-[var(--color-neutral-400)]">{id}</td>
                                <td className="py-1 px-2">
                                  <span className={`rounded px-1.5 py-0.5 text-xs ${stateCls(obs.state)}`}>
                                    {observationStateLabel(obs.state, isAr)}
                                  </span>
                                </td>
                                <td className="py-1 px-2 text-[var(--color-neutral-500)] truncate max-w-[10rem]">
                                  {obs.evidence ?? '—'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Part 4 summary — read-only */}
                <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
                  <h4 className="text-xs font-semibold text-[var(--color-neutral-500)] mb-2 uppercase">
                    {isAr ? 'خلاصة المُقيِّم' : "Assessor's Summary"}
                  </h4>
                  {(['strongestCompetencies', 'developmentAreas', 'mentorGuidance'] as const).map((k) => (
                    <div key={k} className="mb-2">
                      <div className="text-xs text-[var(--color-neutral-400)] mb-1">{k}</div>
                      <div className="rounded bg-[var(--color-surface-dim)] p-2 text-xs whitespace-pre-wrap">
                        {String(rubric[k] ?? '—')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT column — Manager's shadow rubric (editable) */}
              <div className="xl:w-1/2 flex flex-col gap-4">
                <div className={`rounded-t-lg px-4 py-2 border ${
                  shadowRow?.submitted_at
                    ? 'bg-green-50 border-green-200'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {isAr ? 'تقييمك المستقل (Shadow)' : 'Your Independent Shadow Score'}
                  </h3>
                  {shadowRow?.submitted_at && (
                    <p className="text-xs text-green-700 mt-0.5">
                      {isAr ? 'تم الإرسال' : 'Submitted'} —{' '}
                      {new Date(shadowRow.submitted_at).toLocaleString(
                        isAr ? 'ar-AE' : 'en-GB',
                        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                      )}
                    </p>
                  )}
                </div>

                {shadowLoading ? (
                  <div className="rounded-lg border border-[var(--color-neutral-200)] p-6 flex items-center justify-center text-sm text-[var(--color-neutral-400)]">
                    {isAr ? 'جارٍ التحميل...' : 'Loading...'}
                  </div>
                ) : (
                  <>
                    {/* Shadow ethics gates */}
                    <div className="rounded-lg border border-blue-200 p-4">
                      <h4 className="text-xs font-semibold text-blue-600 mb-2 uppercase">
                        {isAr ? 'البوابات الأخلاقية — تقييمك' : 'Ethics Gates — Your Assessment'}
                      </h4>
                      {(['G1', 'G2', 'G3'] as const).map((gate) => {
                        const shadowEthics = (shadowScores.ethicsGates ?? {}) as Record<string, 'agree' | 'disagree' | null>;
                        const currentVal = shadowEthics[gate] ?? null;
                        const isSubmitted = !!shadowRow?.submitted_at;
                        return (
                          <div key={gate} className="flex items-center gap-3 text-sm mb-2">
                            <span className="font-mono text-xs text-[var(--color-neutral-400)] w-6">{gate}</span>
                            {(['agree', 'disagree'] as const).map((v) => (
                              <label
                                key={v}
                                className={`flex items-center gap-1.5 cursor-pointer min-h-[36px] ${isSubmitted ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <input
                                  type="radio"
                                  name={`shadow-ethics-${gate}`}
                                  value={v}
                                  checked={currentVal === v}
                                  disabled={isSubmitted}
                                  onChange={() => {
                                    if (isSubmitted) return;
                                    const updated: RubricScores = {
                                      ...shadowScores,
                                      ethicsGates: { ...(shadowScores.ethicsGates ?? {}), [gate]: v },
                                    };
                                    setShadowScores(updated);
                                    shadowAutoSave(updated, shadowAgreementLevel, shadowAgreementNotes);
                                  }}
                                  className="w-3.5 h-3.5 accent-[var(--color-primary)]"
                                />
                                <span className={`text-xs ${v === 'agree' ? 'text-green-700' : 'text-red-700'}`}>
                                  {v === 'agree' ? (isAr ? 'موافق' : 'Agree') : (isAr ? 'غير موافق' : 'Disagree')}
                                </span>
                              </label>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {/* Shadow observations */}
                    {Object.keys(observations).length > 0 && (
                      <div className="rounded-lg border border-blue-200 p-4">
                        <h4 className="text-xs font-semibold text-blue-600 mb-2 uppercase">
                          {isAr ? 'ملاحظاتك للروبريك' : 'Your Rubric Observations'}
                        </h4>
                        <div className="overflow-y-auto max-h-56">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-blue-100">
                                <th className="py-1 px-2 text-start text-blue-500 w-8">#</th>
                                <th className="py-1 px-2 text-start text-blue-500">
                                  {isAr ? 'الحالة' : 'State'}
                                </th>
                                <th className="py-1 px-2 text-start text-blue-500">
                                  {isAr ? 'ملاحظاتك' : 'Your Evidence'}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(observations)
                                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                .map(([obsId]) => {
                                  const shadowObs = (shadowScores.observations ?? {}) as Record<string, RubricObservation>;
                                  const obsVal = shadowObs[obsId] ?? { state: null, evidence: null };
                                  const isSubmitted = !!shadowRow?.submitted_at;
                                  return (
                                    <tr key={obsId} className="border-b border-blue-50">
                                      <td className="py-1 px-2 font-mono text-[var(--color-neutral-400)]">{obsId}</td>
                                      <td className="py-1 px-1">
                                        <select
                                          value={obsVal.state ?? ''}
                                          disabled={isSubmitted}
                                          onChange={(e) => {
                                            if (isSubmitted) return;
                                            const st = e.target.value as RubricObservation['state'];
                                            const updated: RubricScores = {
                                              ...shadowScores,
                                              observations: {
                                                ...(shadowScores.observations ?? {}),
                                                [obsId]: { ...obsVal, state: st || null },
                                              },
                                            };
                                            setShadowScores(updated);
                                            shadowAutoSave(updated, shadowAgreementLevel, shadowAgreementNotes);
                                          }}
                                          className={`rounded border border-blue-200 p-0.5 text-xs focus:outline-none focus:border-[var(--color-primary)] ${isSubmitted ? 'opacity-50' : ''}`}
                                        >
                                          <option value="">{isAr ? '—' : '—'}</option>
                                          <option value="observed">{isAr ? 'مُلاحَظ' : 'Observed'}</option>
                                          <option value="not_observed">{isAr ? 'غير مُلاحَظ' : 'Not Observed'}</option>
                                          <option value="not_applicable">{isAr ? 'غير قابل' : 'N/A'}</option>
                                        </select>
                                      </td>
                                      <td className="py-1 px-1">
                                        <input
                                          type="text"
                                          value={obsVal.evidence ?? ''}
                                          disabled={isSubmitted}
                                          onChange={(e) => {
                                            if (isSubmitted) return;
                                            const updated: RubricScores = {
                                              ...shadowScores,
                                              observations: {
                                                ...(shadowScores.observations ?? {}),
                                                [obsId]: { ...obsVal, evidence: e.target.value },
                                              },
                                            };
                                            setShadowScores(updated);
                                            shadowAutoSave(updated, shadowAgreementLevel, shadowAgreementNotes);
                                          }}
                                          placeholder={isAr ? 'ملاحظاتك...' : 'Notes...'}
                                          className={`w-full rounded border border-blue-200 p-0.5 text-xs focus:outline-none focus:border-[var(--color-primary)] ${isSubmitted ? 'opacity-50' : ''}`}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Agreement selector + notes */}
                    <div className="rounded-lg border border-blue-200 p-4 flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-blue-600 uppercase">
                        {isAr ? 'مستوى التوافق مع المُقيِّم' : 'Agreement Level with Assessor'}
                      </h4>
                      <div className="flex flex-wrap gap-3">
                        {([
                          ['fully_agree',    isAr ? 'موافق تماماً'    : 'Fully Agree',    'bg-green-100 text-green-700 border-green-300'],
                          ['partially_agree', isAr ? 'موافق جزئياً'   : 'Partially Agree', 'bg-yellow-100 text-yellow-700 border-yellow-300'],
                          ['disagree',        isAr ? 'غير موافق'       : 'Disagree',       'bg-red-100 text-red-700 border-red-300'],
                        ] as const).map(([val, label, cls]) => (
                          <label
                            key={val}
                            className={`flex items-center gap-2 cursor-pointer min-h-[36px] px-3 py-1.5 rounded border text-xs font-medium transition ${
                              shadowAgreementLevel === val ? cls : 'border-[var(--color-neutral-200)] text-[var(--color-neutral-600)]'
                            } ${shadowRow?.submitted_at ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
                          >
                            <input
                              type="radio"
                              name="shadow-agreement"
                              value={val}
                              checked={shadowAgreementLevel === val}
                              disabled={!!shadowRow?.submitted_at}
                              onChange={() => {
                                if (shadowRow?.submitted_at) return;
                                setShadowAgreementLevel(val);
                                shadowAutoSave(shadowScores, val, shadowAgreementNotes);
                              }}
                              className="sr-only"
                            />
                            {label}
                          </label>
                        ))}
                      </div>

                      <label className="block text-xs text-[var(--color-neutral-600)]">
                        {isAr ? 'ملاحظات التوافق (اختياري)' : 'Agreement notes (optional)'}
                      </label>
                      <textarea
                        value={shadowAgreementNotes}
                        disabled={!!shadowRow?.submitted_at}
                        onChange={(e) => {
                          if (shadowRow?.submitted_at) return;
                          setShadowAgreementNotes(e.target.value);
                          shadowAutoSave(shadowScores, shadowAgreementLevel, e.target.value);
                        }}
                        rows={3}
                        className={`w-full rounded-md border border-blue-200 p-2.5 text-xs resize-none focus:outline-none focus:border-[var(--color-primary)] ${shadowRow?.submitted_at ? 'opacity-50' : ''}`}
                        placeholder={
                          isAr
                            ? 'مثال: وافقت على معظم الملاحظات لكنني اختلفت بشأن...'
                            : 'e.g. Agreed on most observations but differed on...'
                        }
                      />

                      {/* Submit button */}
                      {!shadowRow?.submitted_at && (
                        <>
                          {shadowSubmitStatus.kind === 'error' && (
                            <p className="text-red-600 text-xs">{shadowSubmitStatus.message}</p>
                          )}
                          {shadowSubmitStatus.kind === 'success' ? (
                            <div className="rounded-md bg-green-50 border border-green-200 p-2.5 text-green-700 text-xs">
                              {isAr ? 'تم إرسال التقييم المستقل بنجاح.' : 'Shadow review submitted successfully.'}
                            </div>
                          ) : (
                            <button
                              onClick={() => void handleShadowSubmit()}
                              disabled={shadowSubmitStatus.kind === 'submitting'}
                              className="min-h-[44px] w-full rounded-md bg-blue-600 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {shadowSubmitStatus.kind === 'submitting'
                                ? (isAr ? 'جارٍ الإرسال...' : 'Submitting...')
                                : (isAr ? 'حفظ وإرسال التقييم المستقل' : 'Save & Submit Shadow Review')}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

            </div>
          </div>
        )}

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

            {/* Reassign Assessor — only available when assessment is pending */}
            {detail.decision === 'pending' && (
              <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
                <h2 className="text-sm font-semibold text-[var(--color-neutral-700)] mb-2">
                  {isAr ? 'إعادة تعيين المُقيِّم' : 'Reassign Assessor'}
                </h2>
                <p className="text-xs text-[var(--color-neutral-500)] mb-4">
                  {isAr
                    ? 'المُقيِّم الحالي: '
                    : 'Current assessor: '}
                  <strong>{detail.assessor_name ?? detail.assessor_email}</strong>
                </p>
                <button
                  onClick={() => void openReassignModal()}
                  className="min-h-[44px] px-4 py-2 rounded-md border border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-semibold hover:bg-[var(--color-primary)] hover:text-white transition"
                >
                  {isAr ? 'إعادة تعيين المُقيِّم' : 'Reassign Assessor'}
                </button>
              </div>
            )}

            {/* Second opinion panel */}
            <div className={`rounded-lg border p-4 ${
              detail.second_opinion_requested_at
                ? 'border-amber-400 bg-amber-50'
                : 'border-[var(--color-neutral-200)]'
            }`}>
              <h2 className={`text-sm font-semibold mb-2 ${
                detail.second_opinion_requested_at ? 'text-amber-900' : 'text-[var(--color-neutral-700)]'
              }`}>
                {isAr ? 'رأي ثانٍ' : 'Second Opinion'}
              </h2>

              {/* Prominent notice when second_opinion_requested_at is set */}
              {detail.second_opinion_requested_at && (
                <div className="rounded-md bg-amber-100 border border-amber-300 p-3 mb-4">
                  <p className="text-amber-900 text-sm font-medium">
                    {isAr ? 'تم طلب رأي ثانٍ في:' : 'Second opinion requested on:'}
                  </p>
                  <p className="text-amber-800 text-xs mt-0.5">
                    {new Date(detail.second_opinion_requested_at).toLocaleString(
                      isAr ? 'ar-AE' : 'en-GB',
                      { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
                    )}
                  </p>
                </div>
              )}

              {detail.second_opinion_requested_at ? (
                /* Resolve button — clears the pending flag */
                <>
                  {resolveSecondOpinionStatus.kind === 'success' ? (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-green-700 text-sm">
                      {isAr ? 'تم حل طلب الرأي الثاني.' : 'Second opinion request resolved.'}
                    </div>
                  ) : (
                    <>
                      {resolveSecondOpinionStatus.kind === 'error' && (
                        <p className="text-red-600 text-xs mb-2">{resolveSecondOpinionStatus.message}</p>
                      )}
                      <button
                        onClick={() => void handleResolveSecondOpinion()}
                        disabled={resolveSecondOpinionStatus.kind === 'submitting'}
                        className="min-h-[44px] w-full rounded-md bg-amber-700 text-white text-sm font-semibold px-4 py-2 hover:bg-amber-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {resolveSecondOpinionStatus.kind === 'submitting'
                          ? (isAr ? 'جارٍ الحل...' : 'Resolving...')
                          : (isAr ? 'حل طلب الرأي الثاني' : 'Resolve Second Opinion')}
                      </button>
                    </>
                  )}
                </>
              ) : (
                /* Request button — shown when no pending second opinion */
                <>
                  <p className="text-xs text-[var(--color-neutral-500)] mb-4">
                    {isAr
                      ? 'سيُسجَّل الطلب في قاعدة البيانات. سيتم ربط تدفق اختيار المُقيِّم الثاني لاحقاً.'
                      : 'Flags the assessment for a second opinion. Second-assessor assignment flow to be wired in a future phase.'}
                  </p>
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

      {/* ── Reassign Assessor Modal ── */}
      {showReassignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          dir={dir}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReassignModal(false);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-semibold text-[var(--color-neutral-900)] mb-4">
              {isAr ? 'إعادة تعيين المُقيِّم' : 'Reassign Assessor'}
            </h2>

            {/* Assessor dropdown */}
            <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
              {isAr ? 'اختر المُقيِّم الجديد' : 'Select new assessor'}
            </label>
            <select
              value={selectedAssessorId}
              onChange={(e) => setSelectedAssessorId(e.target.value)}
              className="w-full rounded-md border border-[var(--color-neutral-300)] p-2 text-sm mb-4 focus:outline-none focus:border-[var(--color-primary)] min-h-[44px]"
            >
              <option value="">
                {isAr ? '-- اختر مُقيِّمًا --' : '-- Choose an assessor --'}
              </option>
              {availableAssessors
                .filter((a) => a.profile_id !== detail?.assessor_id)
                .map((a) => (
                  <option key={a.profile_id} value={a.profile_id}>
                    {a.name} ({a.email})
                  </option>
                ))}
            </select>

            {/* Reason textarea */}
            <label className="block text-xs text-[var(--color-neutral-600)] mb-1">
              {isAr ? 'سبب إعادة التعيين (إلزامي)' : 'Reason for reassignment (required)'}
            </label>
            <textarea
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-[var(--color-neutral-300)] p-3 text-sm resize-none focus:outline-none focus:border-[var(--color-primary)] mb-4"
              placeholder={
                isAr
                  ? 'مثال: المُقيِّم في إجازة مرضية...'
                  : 'e.g. Assessor is on sick leave...'
              }
            />

            {/* Error */}
            {reassignStatus.kind === 'error' && (
              <p className="text-red-600 text-xs mb-3">{reassignStatus.message}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => void handleReassign()}
                disabled={
                  !selectedAssessorId ||
                  !reassignReason.trim() ||
                  reassignStatus.kind === 'submitting'
                }
                className="flex-1 min-h-[44px] rounded-md bg-[var(--color-primary)] text-white text-sm font-semibold px-4 py-2 hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {reassignStatus.kind === 'submitting'
                  ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                  : (isAr ? 'تأكيد إعادة التعيين' : 'Confirm Reassignment')}
              </button>
              <button
                onClick={() => setShowReassignModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-md border border-[var(--color-neutral-300)] text-sm text-[var(--color-neutral-700)] hover:border-[var(--color-neutral-400)] transition"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
