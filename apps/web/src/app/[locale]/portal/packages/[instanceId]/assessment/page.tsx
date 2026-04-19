'use client';

/**
 * Student Assessment Result Page
 * /[locale]/portal/packages/[instanceId]/assessment
 *
 * Shows the student the outcome of their most recent completed rubric assessment:
 *   - PENDING:  in-progress message with expected SLA window
 *   - PASS:     green verdict + Part 4 summary (strongest competencies,
 *               development areas, mentor guidance) + next-steps hint
 *   - FAIL:     amber/red verdict + Part 4 summary + ethics_auto_failed banner
 *               + voice message player (if recorded) + retry deadline
 *
 * Auth: session required. Only the student who owns the instance + admins can view.
 *       Assessors are explicitly excluded (handled by API layer).
 *
 * Voice message: HTML5 <audio controls> with src pointing to
 *   /api/voice-messages/[voiceMessageId]/stream (Phase 2.6 streaming endpoint).
 *
 * Bilingual: Arabic (RTL) + English. Mobile-first layout.
 *
 * Sub-phase: S2-Layer-1 / 2.8 — Student Result Page
 */

import { useAuth } from '@kunacademy/auth';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssessmentResult {
  instance: {
    journey_state: string;
    second_try_deadline_at: string | null;
    expires_at: string;
  };
  assessment: {
    id: string;
    decision: 'pass' | 'fail' | 'pending';
    decided_at: string | null;
    ethics_auto_failed: boolean;
    decision_note: string | null;
    strongest_competencies: string | null;
    development_areas: string | null;
    mentor_guidance: string | null;
  } | null;
  voice_message: {
    id: string;
    duration_seconds: number | null;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(isoString: string, locale: string): string {
  return new Date(isoString).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Voice message player ──────────────────────────────────────────────────────

interface VoicePlayerProps {
  voiceMessageId: string;
  durationSeconds: number | null;
  isAr: boolean;
}

function VoiceMessagePlayer({ voiceMessageId, durationSeconds, isAr }: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const streamUrl = `/api/voice-messages/${voiceMessageId}/stream`;

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play().catch(() => {/* autoplay blocked — user interaction required */});
    }
  }

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="mb-3 text-sm font-medium text-amber-800">
        {isAr
          ? 'رسالة صوتية من مرشدك / Voice message from your mentor'
          : 'Voice message from your mentor / رسالة صوتية من مرشدك'}
      </p>

      {/* Native audio element — accessible, browser-native controls as fallback */}
      <audio
        ref={audioRef}
        src={streamUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          const dur = audioRef.current?.duration;
          if (dur && Number.isFinite(dur)) setDuration(dur);
        }}
        className="sr-only"
        aria-label={isAr ? 'رسالة صوتية من المرشد' : 'Voice message from mentor'}
      />

      {/* Custom player UI */}
      <div className="flex items-center gap-3">
        {/* Play / Pause button — 44px touch target */}
        <button
          onClick={togglePlay}
          aria-label={playing ? (isAr ? 'إيقاف' : 'Pause') : (isAr ? 'تشغيل' : 'Play')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition-transform"
        >
          {playing ? (
            /* Pause icon */
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
            </svg>
          ) : (
            /* Play icon */
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Progress + time */}
        <div className="flex-1 min-w-0">
          <div className="relative h-2 rounded-full bg-amber-200">
            <div
              className="absolute inset-y-0 start-0 rounded-full bg-amber-600 transition-all"
              style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-amber-700">
            <span>{formatTime(currentTime)}</span>
            {duration > 0 && <span>{formatTime(duration)}</span>}
            {duration === 0 && durationSeconds && (
              <span>{formatDuration(durationSeconds)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Native fallback controls for accessibility */}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-amber-600 hover:underline">
          {isAr ? 'مشغّل بديل' : 'Alternative player'}
        </summary>
        <audio controls src={streamUrl} className="mt-2 w-full" preload="none" />
      </details>
    </div>
  );
}

// ── Part 4 summary block ──────────────────────────────────────────────────────

interface Part4SummaryProps {
  strongestCompetencies: string | null;
  developmentAreas: string | null;
  mentorGuidance: string | null;
  isAr: boolean;
}

function Part4Summary({ strongestCompetencies, developmentAreas, mentorGuidance, isAr }: Part4SummaryProps) {
  return (
    <div className="space-y-4">
      {strongestCompetencies && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
            {isAr ? 'أقوى 3 كفاءات' : '3 Strongest Competencies'}
          </h3>
          <p className="text-sm text-[var(--color-neutral-700)] whitespace-pre-wrap leading-relaxed">
            {strongestCompetencies}
          </p>
        </div>
      )}

      {developmentAreas && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
            {isAr ? '3 مجالات للتطوير' : '3 Areas for Development'}
          </h3>
          <p className="text-sm text-[var(--color-neutral-700)] whitespace-pre-wrap leading-relaxed">
            {developmentAreas}
          </p>
        </div>
      )}

      {mentorGuidance && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
            {isAr ? 'إرشادات المرشد' : 'Mentor Guidance'}
          </h3>
          <p className="text-sm text-[var(--color-neutral-700)] whitespace-pre-wrap leading-relaxed">
            {mentorGuidance}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StudentAssessmentResultPage() {
  const { locale, instanceId } = useParams<{ locale: string; instanceId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [data, setData] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!instanceId || typeof instanceId !== 'string') return;
    if (!user) return;

    fetch(`/api/packages/${instanceId}/assessment-result`)
      .then((r) => {
        if (!r.ok) {
          return r.json().then((d: { error?: string }) => {
            throw new Error(d.error ?? 'Failed to load assessment result');
          });
        }
        return r.json() as Promise<AssessmentResult>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [user, instanceId]);

  // ── Loading states ──────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <Section variant="white">
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </Section>
    );
  }

  if (!user) {
    return (
      <Section variant="white">
        <div className="text-center py-16">
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'يرجى تسجيل الدخول' : 'Please sign in to view your assessment result.'}
          </p>
          <a
            href={`/${locale}/auth/login?redirect=/${locale}/portal/packages/${instanceId}/assessment`}
            className="mt-3 inline-block text-[var(--color-primary)] font-medium hover:underline"
          >
            {isAr ? 'تسجيل الدخول' : 'Sign in'}
          </a>
        </div>
      </Section>
    );
  }

  if (loading) {
    return (
      <Section variant="white">
        <div className="mx-auto max-w-2xl space-y-4 animate-pulse">
          <div className="h-8 w-1/2 rounded-lg bg-[var(--color-neutral-100)]" />
          <div className="h-32 rounded-xl bg-[var(--color-neutral-100)]" />
          <div className="h-24 rounded-xl bg-[var(--color-neutral-100)]" />
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section variant="white">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {isAr ? `خطأ: ${error}` : `Error: ${error}`}
        </div>
      </Section>
    );
  }

  if (!data) return null;

  const { assessment, voice_message: voiceMessage, instance } = data;

  // ── PAUSED — journey paused after 2nd consecutive fail ───────────────────────
  if (instance.journey_state === 'paused') {
    return (
      <main dir={isAr ? 'rtl' : 'ltr'}>
        <Section variant="white">
          <div className="mx-auto max-w-2xl space-y-6">
            <Heading level={1}>
              {isAr ? 'نتيجة التقييم' : 'Assessment Result'}
            </Heading>

            {/* Paused banner — purple/slate */}
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-100">
                  <svg className="h-6 w-6 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M10 15V9M14 15V9" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-purple-900 text-lg">
                    {isAr ? 'رحلتك متوقفة مؤقتاً' : 'Your Journey is Paused'}
                  </p>
                  <p className="text-sm text-purple-700">
                    {isAr
                      ? 'تم إيقاف رحلتك بعد محاولتَي تقييم غير ناجحتَين'
                      : 'Your journey was paused following two unsuccessful assessment attempts'}
                  </p>
                </div>
              </div>
            </div>

            {/* Explanation */}
            <div className="rounded-xl border border-[var(--color-neutral-200)] bg-white p-5 space-y-3">
              <h2 className="font-semibold text-[var(--text-primary)]">
                {isAr ? 'ما الذي يعني هذا؟' : 'What does this mean?'}
              </h2>
              <p className="text-sm text-[var(--color-neutral-700)] leading-relaxed">
                {isAr
                  ? 'بعد مراجعة جلستَيك التدريبيتَين، قرر فريق التقييم إيقاف رحلتك مؤقتاً. هذا ليس قراراً نهائياً — بل هو فرصة للتوقف والتطور قبل الاستمرار.'
                  : 'After reviewing your two coaching sessions, the assessment team has paused your journey. This is not a final decision — it is an opportunity to reflect and grow before continuing.'}
              </p>
              <p className="text-sm text-[var(--color-neutral-700)] leading-relaxed">
                {isAr
                  ? 'لا يمكنك رفع تسجيل جديد في هذه المرحلة. يرجى التواصل مع مرشدك أو فريق أكاديمية كُن للمتابعة وتحديد الخطوات التالية.'
                  : 'You cannot upload a new recording at this stage. Please reach out to your mentor or the Kun Academy team to discuss your next steps.'}
              </p>
            </div>

            {/* Contact / next steps */}
            <div className="rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-5 space-y-2">
              <h2 className="font-semibold text-[var(--text-primary)]">
                {isAr ? 'الخطوات التالية' : 'Next Steps'}
              </h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-[var(--color-neutral-700)]">
                <li>
                  {isAr
                    ? 'راجع ملاحظات المقيِّم في تقاريرك السابقة'
                    : "Review your assessor's feedback from previous reports"}
                </li>
                <li>
                  {isAr
                    ? 'تواصل مع مرشدك لجدولة جلسة تحضيرية'
                    : 'Contact your mentor to schedule a preparation session'}
                </li>
                <li>
                  {isAr
                    ? 'تواصل مع فريق أكاديمية كُن عبر: support@kunacademy.com'
                    : 'Reach the Kun Academy team at: support@kunacademy.com'}
                </li>
              </ul>
            </div>

            {/* Back to portal */}
            <div className="pt-2">
              <button
                onClick={() => router.push(`/${locale}/portal`)}
                className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--text-primary)] transition-colors"
              >
                {isAr ? '← العودة إلى لوحة التحكم' : '← Back to Dashboard'}
              </button>
            </div>
          </div>
        </Section>
      </main>
    );
  }

  // ── PENDING — no completed assessment yet ────────────────────────────────────
  if (!assessment || !assessment.decided_at) {
    // Estimate SLA: 10 business days from when the instance entered under_assessment.
    // We don't have the exact submission date here, so we show a generic message.
    return (
      <main dir={isAr ? 'rtl' : 'ltr'}>
        <Section variant="white">
          <div className="mx-auto max-w-2xl">
            <Heading level={1}>
              {isAr ? 'نتيجة التقييم' : 'Assessment Result'}
            </Heading>

            <div className="mt-6 rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-6 text-center">
              {/* Spinner icon */}
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-neutral-100)]">
                <svg className="h-7 w-7 animate-spin text-[var(--color-neutral-400)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </div>

              <p className="font-semibold text-[var(--text-primary)]">
                {isAr
                  ? 'تقييمك قيد المراجعة'
                  : 'Your assessment is in progress'}
              </p>
              <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
                {isAr
                  ? 'يعمل مرشدك على مراجعة جلستك. سيصلك إشعار عند صدور النتيجة. المدة المتوقعة: 10 أيام عمل.'
                  : 'Your mentor is reviewing your session. You will receive a notification when the result is ready. Expected within 10 business days.'}
              </p>

              {instance.expires_at && (
                <p className="mt-3 text-xs text-[var(--color-neutral-400)]">
                  {isAr
                    ? `الباقة تنتهي: ${formatDate(instance.expires_at, locale)}`
                    : `Package expires: ${formatDate(instance.expires_at, locale)}`}
                </p>
              )}
            </div>
          </div>
        </Section>
      </main>
    );
  }

  // ── PASS ─────────────────────────────────────────────────────────────────────
  if (assessment.decision === 'pass') {
    return (
      <main dir={isAr ? 'rtl' : 'ltr'}>
        <Section variant="white">
          <div className="mx-auto max-w-2xl space-y-6">
            <Heading level={1}>
              {isAr ? 'نتيجة التقييم' : 'Assessment Result'}
            </Heading>

            {/* Verdict banner — green */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-green-800 text-lg">
                    {isAr ? 'اجتزت التقييم بنجاح' : 'Assessment Passed'}
                  </p>
                  <p className="text-sm text-green-700">
                    {isAr
                      ? `صدرت النتيجة في ${formatDate(assessment.decided_at, locale)}`
                      : `Result issued ${formatDate(assessment.decided_at, locale)}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Part 4 summary */}
            {(assessment.strongest_competencies || assessment.development_areas || assessment.mentor_guidance) && (
              <div className="rounded-xl border border-[var(--color-neutral-200)] bg-white p-5 space-y-5">
                <h2 className="font-semibold text-[var(--text-primary)]">
                  {isAr ? 'تقرير المرشد' : 'Mentor Report'}
                </h2>
                <Part4Summary
                  strongestCompetencies={assessment.strongest_competencies}
                  developmentAreas={assessment.development_areas}
                  mentorGuidance={assessment.mentor_guidance}
                  isAr={isAr}
                />
              </div>
            )}

            {/* Next steps */}
            <div className="rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-5">
              <h2 className="font-semibold text-[var(--text-primary)] mb-2">
                {isAr ? 'ما التالي؟' : "What's Next?"}
              </h2>
              <p className="text-sm text-[var(--color-neutral-700)]">
                {isAr
                  ? 'تهانينا! لقد أكملت بنجاح مرحلة التقييم. تحقق من لوحة تحكمك للاطلاع على الخطوات التالية في رحلتك.'
                  : 'Congratulations! You have successfully completed the assessment stage. Check your dashboard for the next milestones in your journey.'}
              </p>
              <button
                onClick={() => router.push(`/${locale}/portal`)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)] transition-colors min-h-[44px]"
              >
                {isAr ? 'العودة إلى لوحة التحكم' : 'Back to Dashboard'}
              </button>
            </div>
          </div>
        </Section>
      </main>
    );
  }

  // ── FAIL ─────────────────────────────────────────────────────────────────────
  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        <div className="mx-auto max-w-2xl space-y-6">
          <Heading level={1}>
            {isAr ? 'نتيجة التقييم' : 'Assessment Result'}
          </Heading>

          {/* Verdict banner — amber/red */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-amber-800 text-lg">
                  {isAr ? 'لم تجتز التقييم' : 'Assessment Not Passed'}
                </p>
                <p className="text-sm text-amber-700">
                  {isAr
                    ? `صدرت النتيجة في ${formatDate(assessment.decided_at, locale)}`
                    : `Result issued ${formatDate(assessment.decided_at, locale)}`}
                </p>
              </div>
            </div>
          </div>

          {/* Ethics auto-fail notice */}
          {assessment.ethics_auto_failed && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">
                {isAr
                  ? 'تنبيه: تم رصد إشكالية أخلاقية أو مهنية في الجلسة. هذا يؤدي تلقائيًا إلى عدم الاجتياز بصرف النظر عن باقي النتائج.'
                  : 'Notice: An ethical or professional issue was identified in the session. This results in an automatic fail regardless of other scores.'}
              </p>
            </div>
          )}

          {/* Part 4 summary */}
          {(assessment.strongest_competencies || assessment.development_areas || assessment.mentor_guidance) && (
            <div className="rounded-xl border border-[var(--color-neutral-200)] bg-white p-5 space-y-5">
              <h2 className="font-semibold text-[var(--text-primary)]">
                {isAr ? 'تقرير المرشد' : 'Mentor Report'}
              </h2>
              <Part4Summary
                strongestCompetencies={assessment.strongest_competencies}
                developmentAreas={assessment.development_areas}
                mentorGuidance={assessment.mentor_guidance}
                isAr={isAr}
              />
            </div>
          )}

          {/* Voice message player (if recorded) */}
          {voiceMessage && (
            <VoiceMessagePlayer
              voiceMessageId={voiceMessage.id}
              durationSeconds={voiceMessage.duration_seconds}
              isAr={isAr}
            />
          )}

          {/* Second-try deadline */}
          {instance.second_try_deadline_at && (
            <div className="rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-5">
              <h2 className="font-semibold text-[var(--text-primary)] mb-2">
                {isAr ? 'المحاولة الثانية' : 'Second Attempt'}
              </h2>
              <p className="text-sm text-[var(--color-neutral-700)]">
                {isAr
                  ? `يمكنك إعادة التسجيل وتقديم جلسة جديدة. آخر موعد للإرسال: `
                  : `You may re-record and submit a new session. Resubmission deadline: `}
                <span className="font-semibold text-[var(--text-primary)]">
                  {formatDate(instance.second_try_deadline_at, locale)}
                </span>
              </p>
              <button
                onClick={() => router.push(`/${locale}/portal/packages/${instanceId}`)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-200 transition-colors min-h-[44px]"
              >
                {isAr ? 'الذهاب إلى صفحة الباقة وإعادة الإرسال' : 'Go to package page to resubmit'}
              </button>
            </div>
          )}

          {/* Back to portal */}
          <div className="pt-2">
            <button
              onClick={() => router.push(`/${locale}/portal`)}
              className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--text-primary)] transition-colors"
            >
              {isAr ? '← العودة إلى لوحة التحكم' : '← Back to Dashboard'}
            </button>
          </div>
        </div>
      </Section>
    </main>
  );
}
