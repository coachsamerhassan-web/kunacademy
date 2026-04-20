'use client';

/**
 * /[locale]/admin/quizzes/new
 *
 * Create a new quiz. On success, redirects to the edit page so admin can add questions.
 *
 * Wave S9 — 2026-04-20
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import Link from 'next/link';

interface LessonOption {
  id: string;
  title_ar: string;
  title_en: string;
}

export default function NewQuizPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form state
  const [lessonId, setLessonId] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [passThreshold, setPassThreshold] = useState(70);
  const [attemptsAllowed, setAttemptsAllowed] = useState('');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    const role = (profile as { role?: string } | null)?.role;
    if (!user || (role !== 'admin' && role !== 'super_admin')) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [user, profile, authLoading, locale, router]);

  // Load lessons without quizzes
  useEffect(() => {
    if (authLoading) return;
    fetch('/api/admin/lessons?without_quiz=1')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setLessons(data.lessons ?? []);
        setLessonsLoading(false);
      })
      .catch(() => setLessonsLoading(false));
  }, [authLoading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonId || !titleAr || !titleEn) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const body = {
        lesson_id: lessonId,
        title_ar: titleAr,
        title_en: titleEn,
        description_ar: descAr || undefined,
        description_en: descEn || undefined,
        pass_threshold: passThreshold,
        attempts_allowed: attemptsAllowed ? parseInt(attemptsAllowed, 10) : null,
        time_limit_seconds: timeLimitSeconds ? parseInt(timeLimitSeconds, 10) : null,
        shuffle_questions: shuffleQuestions,
        is_published: isPublished,
      };
      const res = await fetch('/api/admin/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { quiz?: { id: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/${locale}/admin/quizzes/${data.quiz!.id}/edit`);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <Section>
        <p className="text-center py-16 text-[var(--color-neutral-500)]">
          {isAr ? 'جارٍ التحميل...' : 'Loading...'}
        </p>
      </Section>
    );
  }

  const labelCls = 'block text-sm font-medium text-[var(--color-neutral-700)] mb-1';
  const inputCls = 'w-full min-h-[44px] rounded-md border border-[var(--color-neutral-300)] bg-white px-3 py-2 text-sm text-[var(--color-neutral-800)] placeholder:text-[var(--color-neutral-400)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition';

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <Heading level={1}>{isAr ? 'اختبار جديد' : 'New Quiz'}</Heading>
          <Link
            href={`/${locale}/admin/quizzes`}
            className="text-sm text-[var(--color-primary)] hover:underline min-h-[44px] inline-flex items-center"
          >
            {isAr ? '← الاختبارات' : '← Quizzes'}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
          {/* Lesson picker */}
          <div>
            <label htmlFor="nq-lesson" className={labelCls}>
              {isAr ? 'الدرس *' : 'Lesson *'}
            </label>
            <select
              id="nq-lesson"
              required
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              className={inputCls}
              disabled={lessonsLoading}
            >
              <option value="">
                {lessonsLoading
                  ? (isAr ? 'جارٍ التحميل...' : 'Loading...')
                  : (isAr ? '— اختر درساً —' : '— Select a lesson —')}
              </option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {isAr ? l.title_ar : l.title_en}
                </option>
              ))}
            </select>
            {!lessonsLoading && lessons.length === 0 && (
              <p className="mt-1 text-xs text-[var(--color-neutral-400)]">
                {isAr ? 'جميع الدروس لديها اختبارات بالفعل' : 'All lessons already have quizzes'}
              </p>
            )}
          </div>

          {/* Title AR / EN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nq-title-ar" className={labelCls}>
                {isAr ? 'العنوان (عربي) *' : 'Title AR *'}
              </label>
              <input
                id="nq-title-ar"
                type="text"
                required
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                dir="rtl"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="nq-title-en" className={labelCls}>
                {isAr ? 'العنوان (إنجليزي) *' : 'Title EN *'}
              </label>
              <input
                id="nq-title-en"
                type="text"
                required
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                dir="ltr"
                className={inputCls}
              />
            </div>
          </div>

          {/* Description AR / EN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nq-desc-ar" className={labelCls}>
                {isAr ? 'الوصف (عربي)' : 'Description AR'}
              </label>
              <textarea
                id="nq-desc-ar"
                rows={3}
                value={descAr}
                onChange={(e) => setDescAr(e.target.value)}
                dir="rtl"
                className={inputCls + ' resize-y'}
              />
            </div>
            <div>
              <label htmlFor="nq-desc-en" className={labelCls}>
                {isAr ? 'الوصف (إنجليزي)' : 'Description EN'}
              </label>
              <textarea
                id="nq-desc-en"
                rows={3}
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                dir="ltr"
                className={inputCls + ' resize-y'}
              />
            </div>
          </div>

          {/* Numeric settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="nq-threshold" className={labelCls}>
                {isAr ? 'نسبة النجاح (%) *' : 'Pass threshold (%) *'}
              </label>
              <input
                id="nq-threshold"
                type="number"
                min={0}
                max={100}
                required
                value={passThreshold}
                onChange={(e) => setPassThreshold(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="nq-attempts" className={labelCls}>
                {isAr ? 'عدد المحاولات (فارغ = غير محدود)' : 'Attempts allowed (blank = unlimited)'}
              </label>
              <input
                id="nq-attempts"
                type="number"
                min={1}
                value={attemptsAllowed}
                onChange={(e) => setAttemptsAllowed(e.target.value)}
                placeholder={isAr ? 'غير محدود' : 'unlimited'}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="nq-timelimit" className={labelCls}>
                {isAr ? 'الحد الزمني بالثواني (فارغ = بلا حد)' : 'Time limit seconds (blank = none)'}
              </label>
              <input
                id="nq-timelimit"
                type="number"
                min={1}
                value={timeLimitSeconds}
                onChange={(e) => setTimeLimitSeconds(e.target.value)}
                placeholder={isAr ? 'بلا حد' : 'none'}
                className={inputCls}
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <span className="text-sm text-[var(--color-neutral-700)]">
                {isAr ? 'ترتيب عشوائي للأسئلة' : 'Shuffle questions'}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <span className="text-sm text-[var(--color-neutral-700)]">
                {isAr ? 'نشر فوراً' : 'Publish immediately'}
              </span>
            </label>
          </div>

          {/* Error */}
          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || lessonsLoading}
              className="min-h-[44px] px-8 py-2 rounded-md bg-[var(--color-primary)] text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                : (isAr ? 'إنشاء الاختبار' : 'Create Quiz')}
            </button>
          </div>
        </form>
      </Section>
    </main>
  );
}
