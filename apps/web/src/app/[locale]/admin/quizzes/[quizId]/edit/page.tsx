'use client';

/**
 * /[locale]/admin/quizzes/[quizId]/edit
 *
 * Two sections:
 *   A. Settings — PATCH /api/admin/quizzes/[quizId]
 *   B. Questions — list, add, edit (inline), delete
 *
 * 409 "quiz_has_attempts_cannot_edit_content" is shown as a non-blocking warning banner
 * on the questions section; settings can still be saved.
 *
 * Wave S9 — 2026-04-20
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────────

interface QuizData {
  id: string;
  lesson_id: string | null;
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
  pass_threshold: number;
  attempts_allowed: number | null;
  time_limit_seconds: number | null;
  shuffle_questions: boolean;
  is_published: boolean;
}

interface QuizOption {
  id: string;
  option_ar: string;
  option_en: string;
  is_correct: boolean;
  sort_order: number;
}

interface QuizQuestion {
  id: string;
  type: string;
  prompt_ar: string;
  prompt_en: string;
  explanation_ar: string | null;
  explanation_en: string | null;
  points: number;
  sort_order: number;
  options: QuizOption[];
}

interface NewOptionDraft {
  option_ar: string;
  option_en: string;
  is_correct: boolean;
}

const VALID_TYPES = ['single', 'multi', 'true_false', 'short_answer'] as const;
type QuestionType = typeof VALID_TYPES[number];

// ── Helpers ────────────────────────────────────────────────────────────────────

function TypePill({ type }: { type: string }) {
  const colors: Record<string, string> = {
    single: 'bg-blue-100 text-blue-700',
    multi: 'bg-purple-100 text-purple-700',
    true_false: 'bg-amber-100 text-amber-700',
    short_answer: 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]',
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${colors[type] ?? colors.short_answer}`}>
      {type}
    </span>
  );
}

function emptyOptionDraft(): NewOptionDraft {
  return { option_ar: '', option_en: '', is_correct: false };
}

// ── Edit Question Form ─────────────────────────────────────────────────────────

interface EditQuestionFormProps {
  question: QuizQuestion;
  isAr: boolean;
  quizId: string;
  hasAttempts: boolean;
  onSaved: (updated: QuizQuestion) => void;
  onCancel: () => void;
}

function EditQuestionForm({ question, isAr, quizId, hasAttempts, onSaved, onCancel }: EditQuestionFormProps) {
  const [type, setType] = useState<QuestionType>(question.type as QuestionType);
  const [promptAr, setPromptAr] = useState(question.prompt_ar);
  const [promptEn, setPromptEn] = useState(question.prompt_en);
  const [explanationAr, setExplanationAr] = useState(question.explanation_ar ?? '');
  const [explanationEn, setExplanationEn] = useState(question.explanation_en ?? '');
  const [points, setPoints] = useState(question.points);
  const [options, setOptions] = useState<NewOptionDraft[]>(
    question.options.length > 0
      ? question.options.map((o) => ({ option_ar: o.option_ar, option_en: o.option_en, is_correct: o.is_correct }))
      : [emptyOptionDraft()]
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const inputCls = 'w-full min-h-[40px] rounded-md border border-[var(--color-neutral-300)] bg-white px-3 py-2 text-sm text-[var(--color-neutral-800)] placeholder:text-[var(--color-neutral-400)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition';

  async function handleSave() {
    if (!promptAr || !promptEn) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body = {
        type,
        prompt_ar: promptAr,
        prompt_en: promptEn,
        explanation_ar: explanationAr || undefined,
        explanation_en: explanationEn || undefined,
        points,
        options: type !== 'short_answer' ? options.map((o, i) => ({ ...o, sort_order: i })) : [],
      };
      const res = await fetch(`/api/admin/questions/${question.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { question?: QuizQuestion; options?: QuizOption[]; error?: string };
      if (!res.ok) {
        if (res.status === 409) throw new Error(isAr ? 'لا يمكن التعديل — توجد محاولات مُقدَّمة' : 'Cannot edit — quiz has submitted attempts');
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onSaved({ ...(data.question!), options: data.options ?? [] });
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--color-primary)] bg-[var(--color-surface-low)] p-4 space-y-4">
      {hasAttempts && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {isAr ? 'تحذير: توجد محاولات مُقدَّمة — التعديل محظور' : 'Warning: submitted attempts exist — edits will be blocked'}
        </div>
      )}

      {/* Type */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">{isAr ? 'النوع' : 'Type'}</label>
          <select value={type} onChange={(e) => setType(e.target.value as QuestionType)} className={inputCls}>
            {VALID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">{isAr ? 'النقاط' : 'Points'}</label>
          <input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} className={inputCls} />
        </div>
      </div>

      {/* Prompt */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">{isAr ? 'السؤال (عربي)' : 'Prompt AR'}</label>
          <textarea rows={2} value={promptAr} onChange={(e) => setPromptAr(e.target.value)} dir="rtl" className={inputCls + ' resize-y'} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">{isAr ? 'السؤال (إنجليزي)' : 'Prompt EN'}</label>
          <textarea rows={2} value={promptEn} onChange={(e) => setPromptEn(e.target.value)} dir="ltr" className={inputCls + ' resize-y'} />
        </div>
      </div>

      {/* Explanation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">{isAr ? 'الشرح (عربي)' : 'Explanation AR'}</label>
          <textarea rows={2} value={explanationAr} onChange={(e) => setExplanationAr(e.target.value)} dir="rtl" className={inputCls + ' resize-y'} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">{isAr ? 'الشرح (إنجليزي)' : 'Explanation EN'}</label>
          <textarea rows={2} value={explanationEn} onChange={(e) => setExplanationEn(e.target.value)} dir="ltr" className={inputCls + ' resize-y'} />
        </div>
      </div>

      {/* Options */}
      {type !== 'short_answer' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--color-neutral-500)]">
              {isAr ? 'الخيارات' : 'Options'}
            </span>
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, emptyOptionDraft()])}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {isAr ? '+ إضافة خيار' : '+ Add option'}
            </button>
          </div>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border border-[var(--color-neutral-200)] p-2">
                <input
                  type="checkbox"
                  checked={opt.is_correct}
                  onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, is_correct: e.target.checked } : o))}
                  className="mt-2 w-4 h-4 rounded border-[var(--color-neutral-300)] text-green-600 focus:ring-green-500"
                  title={isAr ? 'صحيح' : 'Correct'}
                />
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={opt.option_ar}
                    onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, option_ar: e.target.value } : o))}
                    placeholder={isAr ? 'الخيار (عربي)' : 'Option AR'}
                    dir="rtl"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={opt.option_en}
                    onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, option_en: e.target.value } : o))}
                    placeholder={isAr ? 'الخيار (إنجليزي)' : 'Option EN'}
                    dir="ltr"
                    className={inputCls}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                  className="mt-1 text-red-400 hover:text-red-600 text-xs px-1"
                  aria-label={isAr ? 'حذف الخيار' : 'Remove option'}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {saveError && (
        <p className="text-xs text-red-600">{saveError}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="min-h-[40px] px-5 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save changes')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[40px] px-4 py-2 rounded-md border border-[var(--color-neutral-300)] text-sm text-[var(--color-neutral-600)] hover:border-[var(--color-neutral-400)] transition"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

// ── Add Question Form ──────────────────────────────────────────────────────────

interface AddQuestionFormProps {
  isAr: boolean;
  quizId: string;
  hasAttempts: boolean;
  nextSortOrder: number;
  onAdded: (q: QuizQuestion) => void;
}

function AddQuestionForm({ isAr, quizId, hasAttempts, nextSortOrder, onAdded }: AddQuestionFormProps) {
  const [type, setType] = useState<QuestionType>('single');
  const [promptAr, setPromptAr] = useState('');
  const [promptEn, setPromptEn] = useState('');
  const [explanationAr, setExplanationAr] = useState('');
  const [explanationEn, setExplanationEn] = useState('');
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState<NewOptionDraft[]>([emptyOptionDraft(), emptyOptionDraft()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const inputCls = 'w-full min-h-[40px] rounded-md border border-[var(--color-neutral-300)] bg-white px-3 py-2 text-sm text-[var(--color-neutral-800)] placeholder:text-[var(--color-neutral-400)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition';

  async function handleAdd() {
    if (!promptAr || !promptEn) {
      setSaveError(isAr ? 'نص السؤال مطلوب بالعربية والإنجليزية' : 'Prompt AR and EN are required');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const body = {
        type,
        prompt_ar: promptAr,
        prompt_en: promptEn,
        explanation_ar: explanationAr || undefined,
        explanation_en: explanationEn || undefined,
        points,
        sort_order: nextSortOrder,
        options: type !== 'short_answer' ? options.map((o, i) => ({ ...o, sort_order: i })) : [],
      };
      const res = await fetch(`/api/admin/quizzes/${quizId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { question?: QuizQuestion; options?: QuizOption[]; error?: string };
      if (!res.ok) {
        if (res.status === 409) throw new Error(isAr ? 'لا يمكن الإضافة — توجد محاولات مُقدَّمة' : 'Cannot add — quiz has submitted attempts');
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onAdded({ ...(data.question!), options: data.options ?? [] });
      // Reset
      setPromptAr('');
      setPromptEn('');
      setExplanationAr('');
      setExplanationEn('');
      setPoints(1);
      setType('single');
      setOptions([emptyOptionDraft(), emptyOptionDraft()]);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-surface-dim)] p-4 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--color-neutral-700)]">
        {isAr ? 'إضافة سؤال جديد' : 'Add new question'}
      </h3>

      {hasAttempts && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {isAr ? 'تحذير: توجد محاولات مُقدَّمة — لا يمكن إضافة أسئلة' : 'Warning: submitted attempts exist — cannot add questions'}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">{isAr ? 'النوع' : 'Type'}</label>
          <select value={type} onChange={(e) => setType(e.target.value as QuestionType)} className={inputCls}>
            {VALID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">{isAr ? 'النقاط' : 'Points'}</label>
          <input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">{isAr ? 'السؤال (عربي) *' : 'Prompt AR *'}</label>
          <textarea rows={2} value={promptAr} onChange={(e) => setPromptAr(e.target.value)} dir="rtl" className={inputCls + ' resize-y'} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">{isAr ? 'السؤال (إنجليزي) *' : 'Prompt EN *'}</label>
          <textarea rows={2} value={promptEn} onChange={(e) => setPromptEn(e.target.value)} dir="ltr" className={inputCls + ' resize-y'} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">{isAr ? 'الشرح (عربي)' : 'Explanation AR'}</label>
          <textarea rows={2} value={explanationAr} onChange={(e) => setExplanationAr(e.target.value)} dir="rtl" className={inputCls + ' resize-y'} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-neutral-500)] mb-1">{isAr ? 'الشرح (إنجليزي)' : 'Explanation EN'}</label>
          <textarea rows={2} value={explanationEn} onChange={(e) => setExplanationEn(e.target.value)} dir="ltr" className={inputCls + ' resize-y'} />
        </div>
      </div>

      {type !== 'short_answer' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--color-neutral-500)]">{isAr ? 'الخيارات' : 'Options'}</span>
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, emptyOptionDraft()])}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {isAr ? '+ إضافة خيار' : '+ Add option'}
            </button>
          </div>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border border-[var(--color-neutral-200)] bg-white p-2">
                <input
                  type="checkbox"
                  checked={opt.is_correct}
                  onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, is_correct: e.target.checked } : o))}
                  className="mt-2 w-4 h-4 rounded border-[var(--color-neutral-300)] text-green-600 focus:ring-green-500"
                  title={isAr ? 'صحيح' : 'Correct'}
                />
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={opt.option_ar}
                    onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, option_ar: e.target.value } : o))}
                    placeholder={isAr ? 'الخيار (عربي)' : 'Option AR'}
                    dir="rtl"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={opt.option_en}
                    onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, option_en: e.target.value } : o))}
                    placeholder={isAr ? 'الخيار (إنجليزي)' : 'Option EN'}
                    dir="ltr"
                    className={inputCls}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                  className="mt-1 text-red-400 hover:text-red-600 text-xs px-1"
                  aria-label={isAr ? 'حذف الخيار' : 'Remove option'}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {saveError && <p className="text-xs text-red-600">{saveError}</p>}

      <button
        type="button"
        onClick={handleAdd}
        disabled={saving || hasAttempts}
        className="min-h-[44px] px-6 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (isAr ? 'جارٍ الإضافة...' : 'Adding...') : (isAr ? 'إضافة السؤال' : 'Add question')}
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EditQuizPage() {
  const { locale, quizId } = useParams<{ locale: string; quizId: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  // Quiz settings state
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [quizLoading, setQuizLoading] = useState(true);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Settings form state
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [passThreshold, setPassThreshold] = useState(70);
  const [attemptsAllowed, setAttemptsAllowed] = useState('');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsHasAttempts, setSettingsHasAttempts] = useState(false);

  // Questions state
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [hasAttempts, setHasAttempts] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [deleteQuestionError, setDeleteQuestionError] = useState<{ id: string; msg: string } | null>(null);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    const role = (profile as { role?: string } | null)?.role;
    if (!user || (role !== 'admin' && role !== 'super_admin')) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [user, profile, authLoading, locale, router]);

  // Fetch quiz settings
  const fetchQuiz = useCallback(async () => {
    setQuizLoading(true);
    setQuizError(null);
    try {
      // Use the list endpoint and filter — or we can do a GET on the quizId
      // Since there's no single-quiz GET, we pull the full list and filter
      const res = await fetch('/api/admin/quizzes');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { quizzes: (QuizData & { question_count: number })[] };
      const found = data.quizzes.find((q) => q.id === quizId);
      if (!found) throw new Error(isAr ? 'الاختبار غير موجود' : 'Quiz not found');
      setQuiz(found);
      setTitleAr(found.title_ar);
      setTitleEn(found.title_en);
      setDescAr(found.description_ar ?? '');
      setDescEn(found.description_en ?? '');
      setPassThreshold(found.pass_threshold);
      setAttemptsAllowed(found.attempts_allowed != null ? String(found.attempts_allowed) : '');
      setTimeLimitSeconds(found.time_limit_seconds != null ? String(found.time_limit_seconds) : '');
      setShuffleQuestions(found.shuffle_questions);
      setIsPublished(found.is_published);
    } catch (err: unknown) {
      setQuizError(err instanceof Error ? err.message : String(err));
    } finally {
      setQuizLoading(false);
    }
  }, [quizId, isAr]);

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    try {
      // There's no dedicated list-questions endpoint yet — we'll hit the questions via the quizId
      // Actually there's no GET /api/admin/quizzes/[quizId]/questions, so we use the quiz attempt
      // check approach: attempt to hit PATCH on a non-existent resource would be wrong.
      // Instead, rely on our quizzes GET which returns question_count but not question detail.
      // We need a dedicated questions list. Check if one exists...
      const res = await fetch(`/api/admin/quizzes/${quizId}/questions`);
      if (!res.ok) {
        // endpoint may not exist — fallback to empty
        setQuestions([]);
        setQuestionsLoading(false);
        return;
      }
      const data = await res.json() as { questions?: QuizQuestion[]; has_submitted_attempts?: boolean };
      setQuestions(data.questions ?? []);
      setHasAttempts(data.has_submitted_attempts ?? false);
    } catch {
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    if (!authLoading) {
      fetchQuiz();
      fetchQuestions();
    }
  }, [authLoading, fetchQuiz, fetchQuestions]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsSuccess(false);
    setSettingsHasAttempts(false);
    try {
      const body = {
        title_ar: titleAr,
        title_en: titleEn,
        description_ar: descAr || null,
        description_en: descEn || null,
        pass_threshold: passThreshold,
        attempts_allowed: attemptsAllowed ? parseInt(attemptsAllowed, 10) : null,
        time_limit_seconds: timeLimitSeconds ? parseInt(timeLimitSeconds, 10) : null,
        shuffle_questions: shuffleQuestions,
        is_published: isPublished,
      };
      const res = await fetch(`/api/admin/quizzes/${quizId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { quiz?: QuizData; error?: string };
      if (!res.ok) {
        if (res.status === 409) {
          setSettingsHasAttempts(true);
          throw new Error(
            isAr
              ? 'لا يمكن تعديل الإعدادات — توجد محاولات مُقدَّمة'
              : 'Cannot edit settings — quiz has submitted attempts'
          );
        }
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setQuiz(data.quiz!);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: unknown) {
      setSettingsError(err instanceof Error ? err.message : String(err));
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleDeleteQuestion(q: QuizQuestion) {
    if (!confirm(isAr ? `حذف السؤال "${q.prompt_ar}"؟` : `Delete question "${q.prompt_en}"?`)) return;
    setDeletingQuestionId(q.id);
    setDeleteQuestionError(null);
    try {
      const res = await fetch(`/api/admin/questions/${q.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        if (res.status === 409) throw new Error(isAr ? 'لا يمكن الحذف — توجد محاولات مُقدَّمة' : 'Cannot delete — quiz has submitted attempts');
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setQuestions((prev) => prev.filter((qq) => qq.id !== q.id));
    } catch (err: unknown) {
      setDeleteQuestionError({ id: q.id, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeletingQuestionId(null);
    }
  }

  if (authLoading || quizLoading) {
    return (
      <Section>
        <p className="text-center py-16 text-[var(--color-neutral-500)]">
          {isAr ? 'جارٍ التحميل...' : 'Loading...'}
        </p>
      </Section>
    );
  }

  if (quizError) {
    return (
      <Section>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
          {quizError}
        </div>
      </Section>
    );
  }

  const inputCls = 'w-full min-h-[44px] rounded-md border border-[var(--color-neutral-300)] bg-white px-3 py-2 text-sm text-[var(--color-neutral-800)] placeholder:text-[var(--color-neutral-400)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition';
  const labelCls = 'block text-sm font-medium text-[var(--color-neutral-700)] mb-1';

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
          <Heading level={1}>
            {isAr ? (quiz?.title_ar ?? 'تعديل الاختبار') : (quiz?.title_en ?? 'Edit Quiz')}
          </Heading>
          <Link
            href={`/${locale}/admin/quizzes`}
            className="text-sm text-[var(--color-primary)] hover:underline min-h-[44px] inline-flex items-center"
          >
            {isAr ? '← الاختبارات' : '← Quizzes'}
          </Link>
        </div>

        {/* ─── Section A: Settings ─────────────────────────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-base font-semibold text-[var(--color-neutral-700)] mb-4 border-b border-[var(--color-neutral-200)] pb-2">
            {isAr ? 'أ. إعدادات الاختبار' : 'A. Quiz Settings'}
          </h2>

          {settingsHasAttempts && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {isAr
                ? 'تحذير: هذا الاختبار لديه محاولات مُقدَّمة. بعض التعديلات قد تكون محظورة.'
                : 'Warning: This quiz has submitted attempts. Some edits may be blocked.'}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="eq-title-ar" className={labelCls}>{isAr ? 'العنوان (عربي) *' : 'Title AR *'}</label>
                <input id="eq-title-ar" type="text" required value={titleAr} onChange={(e) => setTitleAr(e.target.value)} dir="rtl" className={inputCls} />
              </div>
              <div>
                <label htmlFor="eq-title-en" className={labelCls}>{isAr ? 'العنوان (إنجليزي) *' : 'Title EN *'}</label>
                <input id="eq-title-en" type="text" required value={titleEn} onChange={(e) => setTitleEn(e.target.value)} dir="ltr" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="eq-desc-ar" className={labelCls}>{isAr ? 'الوصف (عربي)' : 'Description AR'}</label>
                <textarea id="eq-desc-ar" rows={3} value={descAr} onChange={(e) => setDescAr(e.target.value)} dir="rtl" className={inputCls + ' resize-y'} />
              </div>
              <div>
                <label htmlFor="eq-desc-en" className={labelCls}>{isAr ? 'الوصف (إنجليزي)' : 'Description EN'}</label>
                <textarea id="eq-desc-en" rows={3} value={descEn} onChange={(e) => setDescEn(e.target.value)} dir="ltr" className={inputCls + ' resize-y'} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="eq-threshold" className={labelCls}>{isAr ? 'نسبة النجاح (%) *' : 'Pass threshold (%) *'}</label>
                <input id="eq-threshold" type="number" min={0} max={100} required value={passThreshold} onChange={(e) => setPassThreshold(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label htmlFor="eq-attempts" className={labelCls}>{isAr ? 'المحاولات (فارغ = غير محدود)' : 'Attempts (blank = unlimited)'}</label>
                <input id="eq-attempts" type="number" min={1} value={attemptsAllowed} onChange={(e) => setAttemptsAllowed(e.target.value)} placeholder={isAr ? 'غير محدود' : 'unlimited'} className={inputCls} />
              </div>
              <div>
                <label htmlFor="eq-timelimit" className={labelCls}>{isAr ? 'الوقت بالثواني (فارغ = بلا حد)' : 'Time (s) (blank = none)'}</label>
                <input id="eq-timelimit" type="number" min={1} value={timeLimitSeconds} onChange={(e) => setTimeLimitSeconds(e.target.value)} placeholder={isAr ? 'بلا حد' : 'none'} className={inputCls} />
              </div>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                <span className="text-sm text-[var(--color-neutral-700)]">{isAr ? 'ترتيب عشوائي' : 'Shuffle questions'}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                <span className="text-sm text-[var(--color-neutral-700)]">{isAr ? 'منشور' : 'Published'}</span>
              </label>
            </div>

            {settingsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{settingsError}</div>
            )}
            {settingsSuccess && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {isAr ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully'}
              </div>
            )}

            <button
              type="submit"
              disabled={settingsSaving}
              className="min-h-[44px] px-8 py-2 rounded-md bg-[var(--color-primary)] text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {settingsSaving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ الإعدادات' : 'Save settings')}
            </button>
          </form>
        </div>

        {/* ─── Section B: Questions ────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-[var(--color-neutral-700)] mb-4 border-b border-[var(--color-neutral-200)] pb-2">
            {isAr ? 'ب. الأسئلة' : 'B. Questions'}
            {questions.length > 0 && (
              <span className="ms-2 text-sm font-normal text-[var(--color-neutral-400)]">
                ({questions.length})
              </span>
            )}
          </h2>

          {hasAttempts && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {isAr
                ? 'هذا الاختبار لديه محاولات مُقدَّمة — لا يمكن تعديل الأسئلة أو حذفها أو إضافة جديدة.'
                : 'This quiz has submitted attempts — questions cannot be edited, deleted, or added.'}
            </div>
          )}

          {questionsLoading ? (
            <p className="text-sm text-[var(--color-neutral-400)] py-4">{isAr ? 'جارٍ تحميل الأسئلة...' : 'Loading questions...'}</p>
          ) : questions.length === 0 ? (
            <p className="text-sm text-[var(--color-neutral-400)] py-4">{isAr ? 'لا توجد أسئلة بعد' : 'No questions yet'}</p>
          ) : (
            <div className="space-y-3 mb-6">
              {questions.map((q, idx) => (
                <div key={q.id} className="rounded-lg border border-[var(--color-neutral-200)] p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-[var(--color-neutral-400)]">#{idx + 1}</span>
                        <TypePill type={q.type} />
                        <span className="text-xs text-[var(--color-neutral-500)]">
                          {q.points} {isAr ? 'نقطة' : q.points === 1 ? 'pt' : 'pts'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[var(--color-neutral-800)]">
                        {isAr ? q.prompt_ar : q.prompt_en}
                      </p>
                      <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
                        {isAr ? q.prompt_en : q.prompt_ar}
                      </p>

                      {/* Options list (admin shows is_correct) */}
                      {q.options.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {q.options.map((opt) => (
                            <li key={opt.id} className="flex items-center gap-2 text-xs">
                              <span className={`inline-block w-3 h-3 rounded-sm flex-shrink-0 ${opt.is_correct ? 'bg-green-500' : 'bg-[var(--color-neutral-200)]'}`} />
                              <span className={opt.is_correct ? 'text-green-700 font-medium' : 'text-[var(--color-neutral-600)]'}>
                                {isAr ? opt.option_ar : opt.option_en}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        disabled={hasAttempts}
                        onClick={() => setEditingQuestionId((prev) => prev === q.id ? null : q.id)}
                        className="min-h-[36px] px-3 py-1 rounded-md border border-[var(--color-primary)] text-[var(--color-primary)] text-xs font-semibold hover:bg-[var(--color-primary)] hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {editingQuestionId === q.id ? (isAr ? 'إغلاق' : 'Close') : (isAr ? 'تعديل' : 'Edit')}
                      </button>
                      <button
                        type="button"
                        disabled={hasAttempts || deletingQuestionId === q.id}
                        onClick={() => handleDeleteQuestion(q)}
                        className="min-h-[36px] px-3 py-1 rounded-md border border-red-400 text-red-600 text-xs font-semibold hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {deletingQuestionId === q.id ? '...' : (isAr ? 'حذف' : 'Delete')}
                      </button>
                    </div>
                  </div>

                  {deleteQuestionError?.id === q.id && (
                    <p className="mt-2 text-xs text-red-600">{deleteQuestionError.msg}</p>
                  )}

                  {editingQuestionId === q.id && (
                    <EditQuestionForm
                      question={q}
                      isAr={isAr}
                      quizId={quizId}
                      hasAttempts={hasAttempts}
                      onSaved={(updated) => {
                        setQuestions((prev) => prev.map((qq) => qq.id === updated.id ? updated : qq));
                        setEditingQuestionId(null);
                      }}
                      onCancel={() => setEditingQuestionId(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add question form */}
          <AddQuestionForm
            isAr={isAr}
            quizId={quizId}
            hasAttempts={hasAttempts}
            nextSortOrder={questions.length}
            onAdded={(q) => setQuestions((prev) => [...prev, q])}
          />
        </div>
      </Section>
    </main>
  );
}
