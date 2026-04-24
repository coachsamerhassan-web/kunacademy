'use client';

import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { Button } from '@kunacademy/ui/button';
import { use, useEffect, useState } from 'react';

interface ResponseDetail {
  response_id: string;
  audio_url: string | null;
  audio_duration_sec: number | null;
  text_response: string | null;
  coach_comment: string | null;
  coach_commented_at: string | null;
  review_status: string | null;
  submitted_at: string;
  exchange_id: string;
  prompt_audio_url: string | null;
  prompt_transcript_ar: string | null;
  prompt_transcript_en: string | null;
  instructions_ar: string | null;
  instructions_en: string | null;
  requires_review: boolean;
  placement_id: string;
  course_id: string;
  course_slug: string;
  course_title_ar: string;
  course_title_en: string;
  lesson_title_ar: string | null;
  lesson_title_en: string | null;
  student_id: string;
  student_name_ar: string | null;
  student_name_en: string | null;
}

export default function CoachAudioReviewDetailPage({
  params,
}: {
  params: Promise<{ locale: string; responseId: string }>;
}) {
  const { locale, responseId } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const { user } = useAuth();
  const [data, setData] = useState<ResponseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState<'approved' | 'needs_rework' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ review_status: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/coach/audio-review/${responseId}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          setError(body.error || `HTTP ${r.status}`);
          return;
        }
        const body = await r.json();
        setData(body.response);
        setComment(body.response.coach_comment ?? '');
      })
      .catch(() => {
        setError(isAr ? 'فشل تحميل المراجعة' : 'Failed to load review');
      });
  }, [user, responseId, isAr]);

  const submitReview = async (review_status: 'approved' | 'needs_rework') => {
    if (comment.trim().length === 0) {
      setSubmitError(isAr ? 'التعليق مطلوب' : 'Comment is required');
      return;
    }
    setSubmitting(review_status);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/coach/audio-review/${responseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach_comment: comment.trim(), review_status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.error || `HTTP ${res.status}`);
        setSubmitting(null);
        return;
      }
      const body = await res.json();
      setSubmitted({ review_status: body.response.review_status });
      setSubmitting(null);
    } catch {
      setSubmitError(isAr ? 'فشل الإرسال' : 'Submission failed');
      setSubmitting(null);
    }
  };

  if (error) {
    return (
      <Section variant="white">
        <div dir={dir} className="max-w-3xl mx-auto">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="font-semibold mb-2">{isAr ? 'خطأ' : 'Error'}</p>
            <p>{error}</p>
            <a
              href={`/${locale}/coach/audio-review`}
              className="inline-block mt-4 text-[var(--color-primary)] hover:underline"
            >
              {isAr ? '← عودة إلى القائمة' : '← Back to queue'}
            </a>
          </div>
        </div>
      </Section>
    );
  }

  if (!data) {
    return (
      <Section variant="white">
        <div dir={dir}>
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'جارٍ التحميل…' : 'Loading…'}
          </p>
        </div>
      </Section>
    );
  }

  const courseTitle = isAr ? data.course_title_ar : data.course_title_en;
  const lessonTitle = isAr ? data.lesson_title_ar : data.lesson_title_en;
  const studentName = isAr ? data.student_name_ar : data.student_name_en;
  // Prompt rendering: instructions (text label the coach wrote) +
  // transcript (transcription of the recorded audio). Show the instructions
  // if present; otherwise fall back to the transcript.
  const instructions = isAr ? data.instructions_ar : data.instructions_en;
  const transcript = isAr ? data.prompt_transcript_ar : data.prompt_transcript_en;
  const promptText = instructions || transcript || null;

  return (
    <Section variant="white">
      <div dir={dir} className="max-w-3xl mx-auto space-y-6">
        {/* Breadcrumb back */}
        <a
          href={`/${locale}/coach/audio-review`}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)]"
        >
          <svg
            className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {isAr ? 'عودة إلى قائمة المراجعة' : 'Back to review queue'}
        </a>

        {/* Header */}
        <header>
          <div className="text-sm text-[var(--color-neutral-500)] mb-1">
            {courseTitle}
            {lessonTitle ? ` · ${lessonTitle}` : ''}
          </div>
          <h1
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? `مراجعة إجابة ${studentName ?? 'طالب'}` : `Review submission from ${studentName ?? 'student'}`}
          </h1>
        </header>

        {/* Prompt (what the student was asked) */}
        {(promptText || data.prompt_audio_url) && (
          <Card className="p-5 bg-[var(--color-primary-50)] border-[var(--color-primary-100)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)] mb-2">
              {isAr ? 'السؤال / المُوجِّه' : 'Prompt'}
            </p>
            {promptText && (
              <p className="text-[var(--color-neutral-800)] leading-relaxed mb-3">
                {promptText}
              </p>
            )}
            {data.prompt_audio_url && (
              <audio
                controls
                src={data.prompt_audio_url}
                className="w-full mt-2"
                preload="metadata"
              >
                {isAr
                  ? 'متصفّحك لا يدعم تشغيل الصوت.'
                  : 'Your browser does not support audio playback.'}
              </audio>
            )}
          </Card>
        )}

        {/* Student's answer */}
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)] mb-2">
            {isAr ? 'إجابة الطالب' : "Student's response"}
          </p>
          {data.audio_url && (
            <audio
              controls
              src={data.audio_url}
              className="w-full mb-3"
              preload="metadata"
            >
              {isAr
                ? 'متصفّحك لا يدعم تشغيل الصوت.'
                : 'Your browser does not support audio playback.'}
            </audio>
          )}
          {data.text_response && (
            <p className="text-[var(--color-neutral-700)] leading-relaxed whitespace-pre-wrap">
              {data.text_response}
            </p>
          )}
          <p className="text-xs text-[var(--color-neutral-400)] mt-3">
            {isAr ? 'أُرسلت في: ' : 'Submitted: '}
            {new Date(data.submitted_at).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
          </p>
        </Card>

        {/* Review form (or post-submit success) */}
        {submitted ? (
          <Card
            className={`p-6 ${
              submitted.review_status === 'approved'
                ? 'bg-green-50 border-green-200'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden>
                {submitted.review_status === 'approved' ? '✓' : '↻'}
              </span>
              <div>
                <p className="font-semibold text-[var(--text-primary)] mb-1">
                  {submitted.review_status === 'approved'
                    ? isAr
                      ? 'تمّت الموافقة'
                      : 'Approved'
                    : isAr
                      ? 'طُلبت مراجعة ثانية'
                      : 'Rework requested'}
                </p>
                <p className="text-sm text-[var(--color-neutral-600)]">
                  {isAr
                    ? 'تمّ إرسال تعليقك للطالب.'
                    : 'Your comment has been sent to the student.'}
                </p>
                <a
                  href={`/${locale}/coach/audio-review`}
                  className="inline-block mt-4 text-[var(--color-primary)] hover:underline text-sm font-medium"
                >
                  {isAr ? '← مراجعة أخرى' : '← Review another'}
                </a>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)] mb-3">
              {isAr ? 'تعليقك' : 'Your comment'}
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder={
                isAr
                  ? 'اكتب تعليقك للطالب هنا… (حتى 4000 حرف)'
                  : 'Write your feedback for the student here… (up to 4000 chars)'
              }
              className="w-full rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-3 text-[var(--color-neutral-800)] leading-relaxed focus:border-[var(--color-primary)] focus:outline-none resize-y"
              dir="auto"
            />
            <p className="text-xs text-[var(--color-neutral-400)] mt-1 text-end">
              {comment.length} / 4000
            </p>

            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm mt-3">
                {submitError}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={() => submitReview('approved')}
                disabled={submitting !== null || comment.trim().length === 0}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {submitting === 'approved'
                  ? isAr
                    ? 'جارٍ الإرسال…'
                    : 'Submitting…'
                  : isAr
                    ? '✓ قبول الإجابة'
                    : '✓ Approve'}
              </Button>
              <Button
                onClick={() => submitReview('needs_rework')}
                disabled={submitting !== null || comment.trim().length === 0}
                variant="secondary"
              >
                {submitting === 'needs_rework'
                  ? isAr
                    ? 'جارٍ الإرسال…'
                    : 'Submitting…'
                  : isAr
                    ? '↻ طلب إعادة'
                    : '↻ Request rework'}
              </Button>
            </div>
            <p className="text-xs text-[var(--color-neutral-500)] mt-3">
              {isAr
                ? 'سيتلقّى الطالب تعليقك فور إرساله.'
                : 'The student sees your comment immediately after submission.'}
            </p>
          </Card>
        )}
      </div>
    </Section>
  );
}
