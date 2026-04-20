'use client';

/**
 * /[locale]/portal/bookings/[id]/rate
 *
 * Client-side rating page for a completed coaching session.
 * Deep-linked from the rating-request email.
 *
 * States:
 *   loading     → spinner while fetching booking + existing rating
 *   unauthenticated → sign-in prompt
 *   not_completed   → session not marked completed yet
 *   already_rated   → shows existing rating (read-only)
 *   form        → 5-star selector + feedback + privacy toggle
 *   success     → thank-you screen
 *   error       → generic error state
 *
 * Wave S9 — 2026-04-20
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookingInfo {
  id: string;
  coach_name: string;
  session_date: string;
  session_completed_at: string | null;
  existing_rating: ExistingRating | null;
}

interface ExistingRating {
  id: string;
  rating: number;
  review_text: string | null;
  privacy: string;
  rated_at: string;
}

type PageState = 'loading' | 'unauthenticated' | 'not_completed' | 'already_rated' | 'form' | 'success' | 'error';

// ── Star selector component ───────────────────────────────────────────────────

function StarSelector({
  value,
  onChange,
  isAr,
}: {
  value: number;
  onChange: (v: number) => void;
  isAr: boolean;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div
      role="radiogroup"
      aria-label={isAr ? 'اختر تقييمك' : 'Select your rating'}
      className="flex gap-2 justify-center my-6"
      dir="ltr"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value);
        return (
          <button
            key={star}
            role="radio"
            aria-checked={value === star}
            aria-label={isAr ? `${star} نجوم` : `${star} star${star !== 1 ? 's' : ''}`}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className={`text-4xl transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded min-w-[44px] min-h-[44px] flex items-center justify-center ${
              filled ? 'text-amber-400' : 'text-[var(--color-neutral-300)]'
            }`}
          >
            {filled ? '★' : '☆'}
          </button>
        );
      })}
    </div>
  );
}

// ── Star display (read-only) ──────────────────────────────────────────────────

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-1 justify-center my-4" dir="ltr">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`text-3xl ${s <= value ? 'text-amber-400' : 'text-[var(--color-neutral-300)]'}`}>
          {s <= value ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RatingPage() {
  const { locale, id: bookingId } = useParams<{ locale: string; id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [state, setState] = useState<PageState>('loading');
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Fetch booking + rating status ─────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState('unauthenticated');
      return;
    }

    fetch(`/api/bookings/${bookingId}/rating-status`)
      .then((r) => r.json())
      .then((data: { booking?: BookingInfo; error?: string }) => {
        if (data.error || !data.booking) {
          setState('error');
          return;
        }
        const b = data.booking;
        setBookingInfo(b);

        if (!b.session_completed_at) {
          setState('not_completed');
        } else if (b.existing_rating) {
          setState('already_rated');
        } else {
          setState('form');
        }
      })
      .catch(() => setState('error'));
  }, [authLoading, user, bookingId]);

  // ── Submit handler ────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/bookings/${bookingId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, feedback: feedback.trim() || undefined, privacy }),
      });

      if (res.status === 201) {
        setState('success');
      } else if (res.status === 409) {
        setState('already_rated');
      } else {
        const data = await res.json();
        setSubmitError(data.error ?? (isAr ? 'حدث خطأ' : 'An error occurred'));
      }
    } catch {
      setSubmitError(isAr ? 'تعذّر الإرسال. حاول مجدداً.' : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Format date ───────────────────────────────────────────────────────────
  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(isAr ? 'ar-AE' : 'en-AE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <Section variant="white">
        <div className="text-center py-20">
          <div className="h-8 w-8 mx-auto border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </Section>
    );
  }

  if (state === 'unauthenticated') {
    return (
      <Section variant="white">
        <div className="text-center py-16 max-w-sm mx-auto">
          <p className="text-[var(--color-neutral-500)] mb-4">
            {isAr ? 'يرجى تسجيل الدخول لتقييم جلستك.' : 'Please sign in to rate your session.'}
          </p>
          <a
            href={`/${locale}/auth/login?redirect=/${locale}/portal/bookings/${bookingId}/rate`}
            className="inline-block bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg font-medium hover:bg-[var(--color-primary-600)] transition-colors min-h-[44px]"
          >
            {isAr ? 'تسجيل الدخول' : 'Sign in'}
          </a>
        </div>
      </Section>
    );
  }

  if (state === 'not_completed') {
    return (
      <Section variant="white">
        <div className="text-center py-16 max-w-sm mx-auto">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <Heading level={2} className="mb-2">{isAr ? 'الجلسة لم تُكتمل بعد' : 'Session not completed yet'}</Heading>
          <p className="text-[var(--color-neutral-500)] text-sm">
            {isAr
              ? 'سيتم تفعيل التقييم بمجرد تأكيد المدرب اكتمال الجلسة.'
              : 'The rating form will be available once the coach marks the session as completed.'}
          </p>
        </div>
      </Section>
    );
  }

  if (state === 'already_rated' && bookingInfo?.existing_rating) {
    const r = bookingInfo.existing_rating;
    return (
      <Section variant="white">
        <div className="max-w-md mx-auto py-10 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <Heading level={2} className="mb-1">
            {isAr ? 'شكراً على تقييمك!' : 'Thank you for your rating!'}
          </Heading>
          <p className="text-sm text-[var(--color-neutral-500)] mb-4">
            {isAr ? 'لقد قيّمت هذه الجلسة بالفعل.' : 'You have already rated this session.'}
          </p>
          <StarDisplay value={r.rating} />
          {r.review_text && (
            <p className="text-sm text-[var(--color-neutral-600)] bg-[var(--color-neutral-50)] rounded-xl p-4 mt-4 text-start" dir={isAr ? 'rtl' : 'ltr'}>
              {r.review_text}
            </p>
          )}
          <p className="text-xs text-[var(--color-neutral-400)] mt-4">
            {isAr ? 'تقييم' : 'Rated'} {formatDate(r.rated_at)}
          </p>
        </div>
      </Section>
    );
  }

  if (state === 'success') {
    return (
      <Section variant="white">
        <div className="max-w-md mx-auto py-10 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <Heading level={2} className="mb-2">
            {isAr ? 'شكراً على تقييمك!' : 'Thank you for your rating!'}
          </Heading>
          <p className="text-[var(--color-neutral-500)] text-sm mb-6">
            {isAr
              ? 'تقييمك يساعدنا على تحسين تجربة الكوتشينج للجميع.'
              : 'Your feedback helps us improve the coaching experience for everyone.'}
          </p>
          <a
            href={`/${locale}/portal/bookings`}
            className="inline-block bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg font-medium hover:bg-[var(--color-primary-600)] transition-colors min-h-[44px]"
          >
            {isAr ? 'العودة إلى حجوزاتي' : 'Back to my bookings'}
          </a>
        </div>
      </Section>
    );
  }

  if (state === 'error') {
    return (
      <Section variant="white">
        <div className="text-center py-16">
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'تعذّر تحميل الصفحة. حاول مجدداً.' : 'Could not load the page. Please try again.'}
          </p>
        </div>
      </Section>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────────
  const coachName = bookingInfo?.coach_name ?? '';
  const sessionDate = bookingInfo?.session_date ? formatDate(bookingInfo.session_date) : '';

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        <div className="max-w-lg mx-auto py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <Heading level={1} className="mb-2">
              {isAr ? 'كيف كانت جلستك؟' : 'How was your session?'}
            </Heading>
            {coachName && (
              <p className="text-[var(--color-neutral-600)]">
                {isAr ? `مع ${coachName}` : `with ${coachName}`}
                {sessionDate && (
                  <span className="block text-sm text-[var(--color-neutral-400)] mt-1">{sessionDate}</span>
                )}
              </p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Star selector */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] text-center mb-2">
                {isAr ? 'تقييمك *' : 'Your rating *'}
              </label>
              <StarSelector value={rating} onChange={setRating} isAr={isAr} />
              {rating > 0 && (
                <p className="text-center text-sm text-[var(--color-neutral-500)]">
                  {isAr
                    ? ['', 'سيء', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'][rating]
                    : ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
                </p>
              )}
            </div>

            {/* Feedback textarea */}
            <div>
              <label
                htmlFor="feedback"
                className="block text-sm font-medium text-[var(--text-primary)] mb-1"
              >
                {isAr ? 'تعليقك (اختياري)' : 'Your feedback (optional)'}
              </label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder={isAr
                  ? 'شاركنا تجربتك مع هذه الجلسة...'
                  : 'Share your experience with this session...'}
                className="w-full rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--color-neutral-400)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
              />
              <p className="text-xs text-[var(--color-neutral-400)] mt-1 text-end">
                {feedback.length}/2000
              </p>
            </div>

            {/* Privacy toggle */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)]">
              <button
                type="button"
                role="switch"
                aria-checked={privacy === 'public'}
                onClick={() => setPrivacy(p => p === 'public' ? 'private' : 'public')}
                className={`relative mt-0.5 shrink-0 h-6 w-11 rounded-full transition-colors min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                  privacy === 'public' ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-300)]'
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform shadow ${
                    privacy === 'public' ? (isAr ? 'right-1' : 'translate-x-5 left-1') : (isAr ? 'right-5' : 'left-1')
                  }`}
                />
              </button>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {privacy === 'public'
                    ? (isAr ? 'تقييم عام' : 'Public rating')
                    : (isAr ? 'تقييم خاص' : 'Private rating')}
                </p>
                <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
                  {privacy === 'public'
                    ? (isAr ? 'قد يظهر تقييمك في صفحة المدرب العامة.' : 'Your rating may appear on the coach\'s public profile.')
                    : (isAr ? 'تقييمك لن يظهر للعموم.' : 'Your rating will not be visible publicly.')}
                </p>
              </div>
            </div>

            {/* Error */}
            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
                {submitError}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={rating === 0 || submitting}
              className="w-full bg-[var(--color-primary)] text-white py-3 rounded-xl font-medium text-sm hover:bg-[var(--color-primary-600)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
            >
              {submitting
                ? (isAr ? 'جاري الإرسال...' : 'Submitting...')
                : (isAr ? 'إرسال التقييم' : 'Submit Rating')}
            </button>

          </form>
        </div>
      </Section>
    </main>
  );
}
