'use client';

import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { use, useEffect, useState } from 'react';

interface QueueItem {
  response_id: string;
  audio_url: string | null;
  audio_duration_sec: number | null;
  text_response: string | null;
  submitted_at: string;
  review_status: string | null;
  age_hours: number | null;
  exchange: {
    id: string;
    prompt_audio_url: string | null;
    prompt_transcript_ar: string | null;
    prompt_transcript_en: string | null;
    instructions_ar: string | null;
    instructions_en: string | null;
  };
  placement: {
    id: string;
    course_id: string;
    course_slug: string;
    course_title_ar: string;
    course_title_en: string;
    lesson_title_ar: string | null;
    lesson_title_en: string | null;
  };
  student: {
    id: string;
    name_ar: string | null;
    name_en: string | null;
  };
}

export default function CoachAudioReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const { user } = useAuth();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch('/api/coach/audio-review/queue')
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          setError(body.error || `HTTP ${r.status}`);
          setQueue([]);
          return;
        }
        const data = await r.json();
        setQueue(data.queue ?? []);
        setTotal(data.total_pending ?? 0);
      })
      .catch(() => {
        setError(isAr ? 'فشل تحميل قائمة المراجعة' : 'Failed to load review queue');
        setQueue([]);
      });
  }, [user, isAr]);

  return (
    <Section variant="white">
      <div dir={dir}>
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1
              className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'مراجعة إجابات الصوت' : 'Audio Response Review'}
            </h1>
            <p className="text-[var(--color-neutral-600)]">
              {isAr
                ? 'الإجابات المُرسلة من الطلاب على التمارين التي تتطلّب مراجعتك.'
                : 'Student submissions on exercises that require your review.'}
            </p>
          </div>
          {queue && total > 0 && (
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-4 py-1.5 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" aria-hidden />
              {isAr ? `${total} في الانتظار` : `${total} pending`}
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 mb-6">
            {error}
          </div>
        )}

        {queue === null && !error && (
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'جارٍ التحميل…' : 'Loading…'}
          </p>
        )}

        {queue && queue.length === 0 && !error && (
          <Card className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-primary-50)] flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[var(--color-primary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              {isAr ? 'لا توجد مراجعات في الانتظار' : 'No pending reviews'}
            </p>
            <p className="text-[var(--color-neutral-500)]">
              {isAr
                ? 'ستظهر هنا إجابات الطلاب على التمارين التي تتطلّب مراجعتك.'
                : "Student submissions awaiting your review will appear here."}
            </p>
          </Card>
        )}

        {queue && queue.length > 0 && (
          <div className="space-y-4">
            {queue.map((item) => {
              const courseTitle = isAr ? item.placement.course_title_ar : item.placement.course_title_en;
              const lessonTitle = isAr ? item.placement.lesson_title_ar : item.placement.lesson_title_en;
              const studentName = isAr ? item.student.name_ar : item.student.name_en;
              const ageLabel = (() => {
                if (item.age_hours == null) return '';
                if (item.age_hours < 1) return isAr ? 'أقل من ساعة' : '< 1 hour';
                if (item.age_hours < 24)
                  return isAr ? `منذ ${item.age_hours} ساعة` : `${item.age_hours}h ago`;
                const days = Math.floor(item.age_hours / 24);
                return isAr ? `منذ ${days} يوم` : `${days}d ago`;
              })();
              const isStale = (item.age_hours ?? 0) >= 72;

              return (
                <a
                  key={item.response_id}
                  href={`/${locale}/coach/audio-review/${item.response_id}`}
                  className="block group"
                >
                  <Card accent className="p-5 transition-all duration-200 group-hover:shadow-md">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 text-sm text-[var(--color-neutral-500)]">
                          <span className="font-medium">{courseTitle}</span>
                          {lessonTitle && (
                            <>
                              <span aria-hidden>·</span>
                              <span>{lessonTitle}</span>
                            </>
                          )}
                        </div>
                        <p className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                          {studentName || (isAr ? 'طالب' : 'Student')}
                        </p>
                        {item.text_response && (
                          <p className="text-sm text-[var(--color-neutral-600)] line-clamp-2 mt-2">
                            {item.text_response}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-3 text-xs text-[var(--color-neutral-500)]">
                          {item.audio_url && (
                            <span className="inline-flex items-center gap-1">
                              <span aria-hidden>🎙</span>
                              {item.audio_duration_sec
                                ? `${Math.floor(item.audio_duration_sec / 60)}:${String(item.audio_duration_sec % 60).padStart(2, '0')}`
                                : isAr
                                  ? 'ملف صوتي'
                                  : 'audio'}
                            </span>
                          )}
                          <span>{ageLabel}</span>
                          {isStale && (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
                              {isAr ? 'متأخّر' : 'stale'}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)] px-3 py-1 text-xs font-semibold whitespace-nowrap">
                        {isAr ? 'افتح للمراجعة' : 'Open'}
                        <svg
                          className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </Card>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}
