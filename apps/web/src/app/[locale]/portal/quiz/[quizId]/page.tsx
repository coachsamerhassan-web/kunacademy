'use client';

/**
 * /[locale]/portal/quiz/[quizId] — Student Quiz Player
 *
 * Three states:
 *   A — Pre-start: quiz metadata, past attempts, Start / Resume / No-attempts-remaining
 *   B — In-attempt: all questions on one page, optional countdown timer, submit
 *   C — Post-submit: score, pass/fail badge, per-question answer review
 *
 * Auth: any authenticated user. Enrollment enforced by API (403 → friendly state).
 * Layout: matches /coach/ratings — client component, useAuth(), plain Tailwind.
 * Bilingual via dir={isAr ? 'rtl' : 'ltr'}.
 *
 * Wave S9 — 2026-04-20
 */

import { useState, useEffect, useRef, use, useCallback } from 'react';
import { useAuth } from '@kunacademy/auth';

// ── Types ──────────────────────────────────────────────────────────────────────

interface QuizOption {
  id: string;
  option_ar: string;
  option_en: string;
  sort_order: number;
}

interface QuizQuestion {
  id: string;
  type: 'single' | 'multi' | 'true_false' | 'short_answer';
  prompt_ar: string;
  prompt_en: string;
  points: number;
  sort_order: number;
  options: QuizOption[];
}

interface QuizMeta {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
  pass_threshold: number;
  attempts_allowed: number | null;
  time_limit_seconds: number | null;
  shuffle_questions: boolean;
  is_published: boolean;
  lesson_id: string | null;
  attempts_used: number;
}

interface AttemptSummary {
  id: string;
  started_at: string;
  submitted_at: string | null;
  score_pct: number | null;
  passed: boolean | null;
  max_points: number | null;
  score_points: number | null;
}

interface ReviewItem {
  question_id: string;
  points_awarded: number;
  correct_option_ids: string[];
}

interface SubmitResult {
  attempt: {
    id: string;
    score_pct: number | null;
    score_points: number | null;
    max_points: number | null;
    passed: boolean | null;
    submitted_at: string;
    answers_jsonb: Array<{
      question_id: string;
      selected_option_ids?: string[];
      points_awarded: number;
    }> | null;
  };
  review: ReviewItem[];
}

type AppState = 'loading' | 'error' | 'not_enrolled' | 'pre_start' | 'in_attempt' | 'post_submit';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function QuizPlayerPage({
  params,
}: {
  params: Promise<{ locale: string; quizId: string }>;
}) {
  const { locale, quizId } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();

  // ── state ──
  const [appState, setAppState] = useState<AppState>('loading');
  const [quiz, setQuiz] = useState<QuizMeta | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [pastAttempts, setPastAttempts] = useState<AttemptSummary[]>([]);
  const [inProgressAttemptId, setInProgressAttemptId] = useState<string | null>(null);

  // In-attempt state
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [attemptStartedAt, setAttemptStartedAt] = useState<string | null>(null);
  // answers[questionId] = Set of selected option ids
  const [answers, setAnswers] = useState<Record<string, Set<string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Post-submit state
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const [errorMsg, setErrorMsg] = useState<string>('');

  // ── load quiz data ──
  const loadQuiz = useCallback(async () => {
    if (!user) return;
    setAppState('loading');

    try {
      const [quizRes, attemptsRes] = await Promise.all([
        fetch(`/api/lms/quiz/${quizId}`),
        fetch(`/api/lms/quiz/${quizId}/attempts?pageSize=10`),
      ]);

      if (quizRes.status === 403) {
        setAppState('not_enrolled');
        return;
      }
      if (!quizRes.ok) {
        setErrorMsg(isAr ? 'تعذّر تحميل الاختبار' : 'Failed to load quiz');
        setAppState('error');
        return;
      }

      const quizData = await quizRes.json();
      setQuiz(quizData.quiz);
      // filter out any short_answer that leaked
      setQuestions((quizData.questions as QuizQuestion[]).filter((q) => q.type !== 'short_answer'));

      let attempts: AttemptSummary[] = [];
      if (attemptsRes.ok) {
        const attData = await attemptsRes.json();
        attempts = attData.attempts ?? [];
      }
      setPastAttempts(attempts);

      // check for in-progress attempt
      const inProgress = attempts.find((a) => !a.submitted_at);
      if (inProgress) {
        setInProgressAttemptId(inProgress.id);
      }

      setAppState('pre_start');
    } catch {
      setErrorMsg(isAr ? 'خطأ في الاتصال' : 'Connection error');
      setAppState('error');
    }
  }, [user, quizId, isAr]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  // ── timer countdown ──
  useEffect(() => {
    if (appState !== 'in_attempt' || !quiz?.time_limit_seconds || !attemptStartedAt) return;

    const elapsed = Math.floor((Date.now() - new Date(attemptStartedAt).getTime()) / 1000);
    const remaining = quiz.time_limit_seconds - elapsed;
    setTimeLeft(Math.max(0, remaining));

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // auto-submit on expiry
          doSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState, quiz?.time_limit_seconds, attemptStartedAt]);

  // ── start attempt ──
  const handleStart = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/lms/quiz/${quizId}/attempts`, { method: 'POST' });

      if (res.status === 409) {
        // already in progress — reload to get the attempt id
        await loadQuiz();
        setSubmitting(false);
        return;
      }
      if (res.status === 403) {
        const body = await res.json();
        if (body.error === 'attempt_limit_reached') {
          await loadQuiz();
          setSubmitting(false);
          return;
        }
        setAppState('not_enrolled');
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        setSubmitError(isAr ? 'تعذّر بدء الاختبار' : 'Failed to start attempt');
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      setCurrentAttemptId(data.attempt.id);
      setAttemptStartedAt(data.attempt.started_at);
      setAnswers({});
      setSubmitResult(null);
      setAppState('in_attempt');
    } catch {
      setSubmitError(isAr ? 'خطأ في الاتصال' : 'Connection error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── resume in-progress attempt ──
  const handleResume = () => {
    if (!inProgressAttemptId) return;
    setCurrentAttemptId(inProgressAttemptId);
    // Use now as started_at proxy for timer (conservative — timer may run extra)
    setAttemptStartedAt(
      pastAttempts.find((a) => a.id === inProgressAttemptId)?.started_at ?? new Date().toISOString()
    );
    setAnswers({});
    setSubmitResult(null);
    setAppState('in_attempt');
  };

  // ── toggle answer ──
  const toggleAnswer = (questionId: string, optionId: string, isSingle: boolean) => {
    setAnswers((prev) => {
      const current = new Set(prev[questionId] ?? []);
      if (isSingle) {
        return { ...prev, [questionId]: new Set([optionId]) };
      }
      if (current.has(optionId)) {
        current.delete(optionId);
      } else {
        current.add(optionId);
      }
      return { ...prev, [questionId]: current };
    });
  };

  // ── submit ──
  const doSubmit = useCallback(
    async (autoSubmit = false) => {
      if (!currentAttemptId) return;
      if (submitting && !autoSubmit) return;
      setSubmitting(true);
      setSubmitError(null);
      if (timerRef.current) clearInterval(timerRef.current);

      const payload = {
        answers: questions.map((q) => ({
          question_id: q.id,
          selected_option_ids: Array.from(answers[q.id] ?? []),
        })),
      };

      try {
        const res = await fetch(
          `/api/lms/quiz/${quizId}/attempts/${currentAttemptId}/submit`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        if (res.status === 408) {
          setSubmitError(isAr ? 'انتهى وقت الاختبار' : 'Time limit exceeded');
          setSubmitting(false);
          return;
        }
        if (!res.ok) {
          setSubmitError(isAr ? 'تعذّر تسليم الاختبار' : 'Failed to submit quiz');
          setSubmitting(false);
          return;
        }

        const data: SubmitResult = await res.json();
        setSubmitResult(data);
        setAppState('post_submit');
      } catch {
        setSubmitError(isAr ? 'خطأ في الاتصال' : 'Connection error');
      } finally {
        setSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentAttemptId, questions, answers, quizId, isAr, submitting]
  );

  const handleSubmit = () => doSubmit(false);

  // ── guard: not logged in ──
  if (!user && appState !== 'loading') {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <p className="text-[var(--text-primary)]">
          {isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first'}
        </p>
      </div>
    );
  }

  // ── loading ──
  if (appState === 'loading') {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── error ──
  if (appState === 'error') {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="text-center space-y-3">
          <p className="text-red-600 font-medium">{errorMsg}</p>
          <button
            onClick={loadQuiz}
            className="inline-flex items-center px-4 py-2 rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] text-sm hover:bg-[var(--color-primary-50)] transition-colors"
          >
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  // ── not enrolled ──
  if (appState === 'not_enrolled') {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="text-center space-y-4 max-w-sm px-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-primary-50)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {isAr ? 'غير مسجَّل في هذه الدورة' : 'Not enrolled in this course'}
          </h2>
          <p className="text-sm text-[var(--color-neutral-500)]">
            {isAr
              ? 'يجب التسجيل في الدورة أولاً للوصول إلى الاختبار'
              : 'You need to be enrolled in the course to access this quiz'}
          </p>
          <a
            href={`/${locale}/programs`}
            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:bg-[var(--color-accent-500)] transition-colors"
          >
            {isAr ? 'تصفّح البرامج' : 'Browse Programs'}
          </a>
        </div>
      </div>
    );
  }

  // ── shared page shell ──
  const quizTitle = quiz ? (isAr ? quiz.title_ar : quiz.title_en) : '';
  const quizDescription = quiz ? (isAr ? quiz.description_ar : quiz.description_en) : null;

  // ── STATE A: Pre-start ──────────────────────────────────────────────────────
  if (appState === 'pre_start' && quiz) {
    const submittedAttempts = pastAttempts.filter((a) => a.submitted_at);
    const attemptsExhausted =
      quiz.attempts_allowed !== null && submittedAttempts.length >= quiz.attempts_allowed;
    const bestAttempt = submittedAttempts.reduce<AttemptSummary | null>((best, a) => {
      if (best === null) return a;
      return (a.score_pct ?? 0) > (best.score_pct ?? 0) ? a : best;
    }, null);

    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--color-background)] py-10 px-4">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{quizTitle}</h1>
            {quizDescription && (
              <p className="text-[var(--color-neutral-600)] text-sm leading-relaxed">{quizDescription}</p>
            )}
          </div>

          {/* Metadata card */}
          <div className="rounded-2xl bg-white border border-[var(--color-neutral-100)] p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
              {isAr ? 'تفاصيل الاختبار' : 'Quiz Details'}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetaBadge
                label={isAr ? 'درجة النجاح' : 'Pass score'}
                value={`${quiz.pass_threshold}%`}
                icon="🎯"
              />
              <MetaBadge
                label={isAr ? 'المحاولات المسموحة' : 'Attempts allowed'}
                value={quiz.attempts_allowed === null ? (isAr ? 'غير محدود' : 'Unlimited') : String(quiz.attempts_allowed)}
                icon="🔄"
              />
              {quiz.time_limit_seconds !== null && (
                <MetaBadge
                  label={isAr ? 'الوقت المتاح' : 'Time limit'}
                  value={formatSeconds(quiz.time_limit_seconds)}
                  icon="⏱"
                />
              )}
              <MetaBadge
                label={isAr ? 'عدد الأسئلة' : 'Questions'}
                value={String(questions.length)}
                icon="📝"
              />
              {submittedAttempts.length > 0 && (
                <MetaBadge
                  label={isAr ? 'المحاولات المستخدمة' : 'Attempts used'}
                  value={String(submittedAttempts.length)}
                  icon="✅"
                />
              )}
              {bestAttempt && (
                <MetaBadge
                  label={isAr ? 'أفضل نتيجة' : 'Best score'}
                  value={`${bestAttempt.score_pct ?? 0}%`}
                  icon={bestAttempt.passed ? '🏆' : '📊'}
                />
              )}
            </div>
          </div>

          {/* Past attempts */}
          {submittedAttempts.length > 0 && (
            <div className="rounded-2xl bg-white border border-[var(--color-neutral-100)] p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                {isAr ? 'المحاولات السابقة' : 'Past Attempts'}
              </h2>
              <div className="divide-y divide-[var(--color-neutral-100)]">
                {submittedAttempts.slice(0, 5).map((attempt, idx) => (
                  <div key={attempt.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-[var(--color-neutral-500)]">
                      {isAr ? `محاولة ${idx + 1}` : `Attempt ${idx + 1}`}
                      {attempt.submitted_at && (
                        <span className="ltr:ml-2 rtl:mr-2 text-xs text-[var(--color-neutral-400)]">
                          {formatDate(attempt.submitted_at, locale)}
                        </span>
                      )}
                    </span>
                    <span className={`font-semibold ${attempt.passed ? 'text-green-600' : 'text-red-500'}`}>
                      {attempt.score_pct ?? 0}%
                      <span className={`ltr:ml-1.5 rtl:mr-1.5 text-xs px-1.5 py-0.5 rounded-full ${attempt.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {attempt.passed
                          ? (isAr ? 'ناجح' : 'Pass')
                          : (isAr ? 'راسب' : 'Fail')}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action */}
          <div className="space-y-3">
            {attemptsExhausted ? (
              <div className="rounded-2xl bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] p-5 text-center space-y-2">
                <p className="font-semibold text-[var(--text-primary)]">
                  {isAr ? 'لا محاولات متبقية' : 'No attempts remaining'}
                </p>
                <p className="text-sm text-[var(--color-neutral-500)]">
                  {isAr
                    ? 'لقد استخدمت جميع محاولاتك المسموح بها لهذا الاختبار'
                    : 'You have used all allowed attempts for this quiz'}
                </p>
              </div>
            ) : inProgressAttemptId ? (
              <button
                onClick={handleResume}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-[var(--color-accent)] text-white font-semibold text-base hover:bg-[var(--color-accent-500)] hover:scale-[1.01] transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                {isAr ? 'استكمال الاختبار' : 'Resume Attempt'}
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-[var(--color-accent)] text-white font-semibold text-base hover:bg-[var(--color-accent-500)] hover:scale-[1.01] transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                )}
                {submitting
                  ? (isAr ? 'جارٍ...' : 'Starting...')
                  : (submittedAttempts.length > 0 ? (isAr ? 'إعادة الاختبار' : 'Retry Quiz') : (isAr ? 'بدء الاختبار' : 'Start Quiz'))}
              </button>
            )}
            {submitError && (
              <p className="text-center text-red-600 text-sm">{submitError}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── STATE B: In-attempt ─────────────────────────────────────────────────────
  if (appState === 'in_attempt' && quiz) {
    const totalPoints = questions.reduce((s, q) => s + q.points, 0);

    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--color-background)] py-8 px-4">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Top bar: title + timer */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{quizTitle}</h1>
              <p className="text-sm text-[var(--color-neutral-500)] mt-0.5">
                {questions.length} {isAr ? 'سؤال' : 'questions'} · {totalPoints} {isAr ? 'نقطة' : 'points'}
              </p>
            </div>
            {timeLeft !== null && (
              <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold border-2 ${
                timeLeft < 60
                  ? 'bg-red-50 border-red-300 text-red-600'
                  : timeLeft < 300
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-[var(--color-primary-50)] border-[var(--color-primary)] text-[var(--color-primary)]'
              }`}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" d="M12 6v6l4 2" />
                </svg>
                {formatSeconds(timeLeft)}
              </div>
            )}
          </div>

          {/* Questions */}
          <div className="space-y-6">
            {questions.map((q, qIdx) => {
              const isSingle = q.type === 'single' || q.type === 'true_false';
              const selected = answers[q.id] ?? new Set<string>();

              return (
                <div
                  key={q.id}
                  className="rounded-2xl bg-white border border-[var(--color-neutral-100)] p-5 shadow-sm space-y-4"
                >
                  {/* Question header */}
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)] text-xs font-bold flex items-center justify-center mt-0.5">
                      {qIdx + 1}
                    </span>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-[var(--text-primary)] leading-snug">
                        {isAr ? q.prompt_ar : q.prompt_en}
                      </p>
                      <p className="text-xs text-[var(--color-neutral-400)]">
                        {isSingle
                          ? (isAr ? 'اختر إجابة واحدة' : 'Choose one answer')
                          : (isAr ? 'اختر كل الإجابات الصحيحة' : 'Select all that apply')}
                        {q.points > 1 && ` · ${q.points} ${isAr ? 'نقاط' : 'pts'}`}
                      </p>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const isSelected = selected.has(opt.id);
                      const optText = isAr ? opt.option_ar : opt.option_en;

                      return (
                        <label
                          key={opt.id}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]'
                              : 'border-[var(--color-neutral-100)] hover:border-[var(--color-primary-200)] hover:bg-[var(--color-primary-50)]/30'
                          }`}
                        >
                          <input
                            type={isSingle ? 'radio' : 'checkbox'}
                            name={isSingle ? `q_${q.id}` : undefined}
                            checked={isSelected}
                            onChange={() => toggleAnswer(q.id, opt.id, isSingle)}
                            className="accent-[var(--color-primary)] w-4 h-4 shrink-0"
                          />
                          <span className="text-sm text-[var(--text-primary)]">{optText}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit */}
          <div className="space-y-3 pb-8">
            {submitError && (
              <p className="text-center text-red-600 text-sm">{submitError}</p>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 min-h-[52px] rounded-xl bg-[var(--color-accent)] text-white font-bold text-base hover:bg-[var(--color-accent-500)] hover:scale-[1.01] transition-all disabled:opacity-50"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {submitting ? (isAr ? 'جارٍ التسليم...' : 'Submitting...') : (isAr ? 'تسليم الاختبار' : 'Submit Quiz')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STATE C: Post-submit ────────────────────────────────────────────────────
  if (appState === 'post_submit' && submitResult && quiz) {
    const { attempt, review } = submitResult;
    const scorePct = attempt.score_pct ?? 0;
    const passed = attempt.passed ?? false;
    const scorePoints = attempt.score_points ?? 0;
    const maxPoints = attempt.max_points ?? 0;

    // Build fast lookup maps
    const reviewMap: Record<string, ReviewItem> = {};
    for (const r of review) reviewMap[r.question_id] = r;

    const answersMap: Record<string, string[]> = {};
    for (const a of attempt.answers_jsonb ?? []) {
      answersMap[a.question_id] = a.selected_option_ids ?? [];
    }

    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--color-background)] py-8 px-4">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Score card */}
          <div className={`rounded-2xl p-6 text-center space-y-3 ${
            passed
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200'
              : 'bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200'
          }`}>
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${
              passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {passed ? '✓' : '✗'}
              {passed ? (isAr ? 'ناجح' : 'Passed') : (isAr ? 'لم تنجح' : 'Not passed')}
            </div>
            <div className="text-5xl font-black text-[var(--text-primary)]">{scorePct}%</div>
            <p className="text-sm text-[var(--color-neutral-500)]">
              {scorePoints} / {maxPoints} {isAr ? 'نقطة' : 'points'}
              {' · '}
              {isAr ? 'درجة النجاح' : 'Pass score'}: {quiz.pass_threshold}%
            </p>
          </div>

          {/* Answer review */}
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {isAr ? 'مراجعة الإجابات' : 'Answer Review'}
          </h2>

          <div className="space-y-4">
            {questions.map((q, qIdx) => {
              const rev = reviewMap[q.id];
              const selected = new Set(answersMap[q.id] ?? []);
              const correct = new Set(rev?.correct_option_ids ?? []);
              const gotIt = (rev?.points_awarded ?? 0) > 0;
              const qText = isAr ? q.prompt_ar : q.prompt_en;

              return (
                <div
                  key={q.id}
                  className={`rounded-2xl border-2 p-5 space-y-3 ${
                    gotIt
                      ? 'border-green-200 bg-green-50/50'
                      : 'border-red-200 bg-red-50/30'
                  }`}
                >
                  {/* Question */}
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center mt-0.5 ${
                      gotIt ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {qIdx + 1}
                    </span>
                    <p className="font-medium text-[var(--text-primary)] leading-snug flex-1">{qText}</p>
                  </div>

                  {/* Options with correctness overlay */}
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const isSelected = selected.has(opt.id);
                      const isCorrect = correct.has(opt.id);
                      const optText = isAr ? opt.option_ar : opt.option_en;

                      let optStyle = 'border-[var(--color-neutral-100)] bg-white';
                      if (isCorrect && isSelected) {
                        optStyle = 'border-green-400 bg-green-50'; // correct + chosen
                      } else if (isCorrect && !isSelected) {
                        optStyle = 'border-green-300 bg-green-50/60'; // correct but missed
                      } else if (!isCorrect && isSelected) {
                        optStyle = 'border-red-400 bg-red-50'; // wrong choice
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 ${optStyle}`}
                        >
                          <span className="w-4 h-4 shrink-0 flex items-center justify-center text-sm">
                            {isCorrect ? '✓' : isSelected ? '✗' : ''}
                          </span>
                          <span className="text-sm text-[var(--text-primary)]">{optText}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {(() => {
                    // explanation fields come from questions array (API returns them)
                    const fullQ = q as QuizQuestion & { explanation_ar?: string | null; explanation_en?: string | null };
                    const explanation = isAr ? fullQ.explanation_ar : fullQ.explanation_en;
                    return explanation ? (
                      <div className="mt-1 px-3 py-2.5 rounded-lg bg-[var(--color-primary-50)] border border-[var(--color-primary-100)]">
                        <p className="text-xs font-semibold text-[var(--color-primary)] mb-0.5">
                          {isAr ? 'الشرح' : 'Explanation'}
                        </p>
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{explanation}</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Points */}
                  <p className="text-xs text-[var(--color-neutral-400)] text-end">
                    {rev?.points_awarded ?? 0} / {q.points} {isAr ? 'نقطة' : 'pts'}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Back to quiz / try again */}
          <div className="flex flex-col sm:flex-row gap-3 pb-10">
            <button
              onClick={() => {
                setSubmitResult(null);
                setCurrentAttemptId(null);
                setAttemptStartedAt(null);
                loadQuiz();
              }}
              className="flex-1 flex items-center justify-center gap-2 min-h-[48px] rounded-xl border-2 border-[var(--color-primary)] text-[var(--color-primary)] font-semibold text-sm hover:bg-[var(--color-primary-50)] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              {isAr ? 'العودة للاختبار' : 'Back to Quiz'}
            </button>
            {quiz.lesson_id && (
              <a
                href={`/${locale}/dashboard`}
                className="flex-1 flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-[var(--color-primary)] text-white font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                {isAr ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── MetaBadge sub-component ────────────────────────────────────────────────────

function MetaBadge({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex flex-col items-start gap-0.5 p-3 rounded-xl bg-[var(--color-neutral-50)] border border-[var(--color-neutral-100)]">
      <span className="text-base leading-none">{icon}</span>
      <span className="text-xs text-[var(--color-neutral-500)]">{label}</span>
      <span className="text-sm font-bold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
