'use client';

/**
 * /admin/pathfinder — Pathfinder tree editor (migration 0045, 2026-04-21)
 *
 * Samer's locked decisions (2026-04-21):
 *   - Tree versioned; clone-edit-publish workflow.
 *   - Top 3 recommendations at assessment completion.
 *   - Edits allowed only on draft versions (is_active=false). API routes
 *     return 409 if you try to edit the active version.
 *
 * The legacy responses leaderboard lives at /admin/pathfinder/responses.
 */

import { useAuth } from '@kunacademy/auth';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Save, Eye, Upload } from 'lucide-react';

interface Version {
  id: string;
  version_number: number;
  label: string;
  is_active: boolean;
  published_at: string | null;
  created_at: string;
}

interface QRow {
  id: string;
  code: string;
  question_ar: string;
  question_en: string | null;
  type: 'individual' | 'corporate';
  parent_answer_id: string | null;
  parent_answer_code: string | null;
  sort_order: number;
  is_terminal_gate: boolean;
  published: boolean;
}

interface ARow {
  id: string;
  question_id: string;
  code: string;
  text_ar: string;
  text_en: string | null;
  category_weights: Record<string, number>;
  recommended_slugs: string[];
  sort_order: number;
}

interface Outcome {
  id: string;
  program_slug: string;
  category_affinity: Record<string, number>;
  min_score: number;
  cta_label_ar: string | null;
  cta_label_en: string | null;
  cta_type: 'book_call' | 'enroll' | 'explore' | 'free_signup';
}

const CATEGORIES = ['certification', 'course', 'free', 'coaching', 'retreat', 'family', 'corporate'] as const;

export default function AdminPathfinderTreePage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [answers, setAnswers] = useState<ARow[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'tree' | 'outcomes'>('tree');
  const [msg, setMsg] = useState<string>('');

  // Guard: admin only
  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) {
      router.push('/' + locale + '/auth/login');
    }
  }, [user, profile, authLoading, locale, router]);

  const loadVersions = useCallback(async () => {
    const r = await fetch('/api/admin/pathfinder/versions');
    const j = await r.json();
    setVersions(j.versions ?? []);
    if (!currentVersionId && j.versions?.length) {
      const active = j.versions.find((v: Version) => v.is_active) ?? j.versions[0];
      setCurrentVersionId(active.id);
    }
  }, [currentVersionId]);

  const loadTree = useCallback(async (versionId: string) => {
    setLoading(true);
    const [qr, or_] = await Promise.all([
      fetch('/api/admin/pathfinder/questions?version_id=' + versionId).then((r) => r.json()),
      fetch('/api/admin/pathfinder/outcomes?version_id=' + versionId).then((r) => r.json()),
    ]);
    setQuestions(qr.questions ?? []);
    setAnswers(qr.answers ?? []);
    setOutcomes(or_.outcomes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadVersions(); }, [loadVersions]);
  useEffect(() => { if (currentVersionId) loadTree(currentVersionId); }, [currentVersionId, loadTree]);

  const currentVersion = versions.find((v) => v.id === currentVersionId) ?? null;
  const isReadOnly = currentVersion?.is_active ?? false;

  const answersByQuestion = useMemo(() => {
    const m = new Map<string, ARow[]>();
    for (const a of answers) {
      const arr = m.get(a.question_id) ?? [];
      arr.push(a);
      m.set(a.question_id, arr);
    }
    return m;
  }, [answers]);

  const selectedQuestion = selectedQuestionId ? questions.find((q) => q.id === selectedQuestionId) ?? null : null;

  async function cloneDraft() {
    if (!currentVersionId) return;
    const label = prompt(isAr ? 'اسم المسودة الجديدة:' : 'New draft label:');
    if (!label) return;
    setSaving(true);
    const r = await fetch('/api/admin/pathfinder/versions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source_version_id: currentVersionId, label }),
    });
    const j = await r.json();
    setSaving(false);
    if (j.version) {
      setMsg(isAr ? 'تم إنشاء المسودة' : 'Draft created');
      await loadVersions();
      setCurrentVersionId(j.version.id);
    } else {
      setMsg(j.error ?? 'Error');
    }
  }

  async function publishCurrent() {
    if (!currentVersionId || !currentVersion) return;
    if (currentVersion.is_active) return;
    if (!confirm(isAr
      ? 'هل أنت متأكد من نشر هذه المسودة؟ الزوار الحاليون سيكملون على النسخة السابقة.'
      : 'Publish this draft? Users mid-flow will complete on the previous version.')) return;
    setSaving(true);
    const r = await fetch('/api/admin/pathfinder/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version_id: currentVersionId }),
    });
    const j = await r.json();
    setSaving(false);
    if (j.already_active || j.target) {
      setMsg(isAr ? 'تم النشر' : 'Published');
      await loadVersions();
    } else {
      setMsg(j.error ?? 'Error');
    }
  }

  async function saveQuestion(q: QRow) {
    if (isReadOnly) return;
    setSaving(true);
    const r = await fetch('/api/admin/pathfinder/questions?id=' + q.id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question_ar: q.question_ar,
        question_en: q.question_en,
        sort_order: q.sort_order,
        is_terminal_gate: q.is_terminal_gate,
        published: q.published,
        parent_answer_id: q.parent_answer_id,
      }),
    });
    const j = await r.json();
    setSaving(false);
    if (j.question) {
      setMsg(isAr ? 'تم حفظ السؤال' : 'Question saved');
      await loadTree(currentVersionId!);
    } else {
      setMsg(j.error ?? 'Error');
    }
  }

  async function saveAnswer(a: ARow) {
    if (isReadOnly) return;
    setSaving(true);
    const r = await fetch('/api/admin/pathfinder/answers?id=' + a.id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text_ar: a.text_ar,
        text_en: a.text_en,
        category_weights: a.category_weights,
        recommended_slugs: a.recommended_slugs,
        sort_order: a.sort_order,
      }),
    });
    const j = await r.json();
    setSaving(false);
    if (j.answer) {
      setMsg(isAr ? 'تم حفظ الإجابة' : 'Answer saved');
      await loadTree(currentVersionId!);
    } else {
      setMsg(j.error ?? 'Error');
    }
  }

  async function saveOutcome(o: Outcome) {
    if (isReadOnly) return;
    setSaving(true);
    const r = await fetch('/api/admin/pathfinder/outcomes', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        version_id: currentVersionId,
        program_slug: o.program_slug,
        category_affinity: o.category_affinity,
        min_score: o.min_score,
        cta_label_ar: o.cta_label_ar,
        cta_label_en: o.cta_label_en,
        cta_type: o.cta_type,
      }),
    });
    const j = await r.json();
    setSaving(false);
    if (j.outcome) {
      setMsg(isAr ? 'تم حفظ النتيجة' : 'Outcome saved');
      await loadTree(currentVersionId!);
    } else {
      setMsg(j.error ?? 'Error');
    }
  }

  if (authLoading || loading) {
    return <Section><p className="text-center py-12">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p></Section>;
  }

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <Heading level={1}>{isAr ? 'محرّر شجرة المُرشد' : 'Pathfinder Tree Editor'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {versions.length} {isAr ? 'نسخة' : 'versions'} · {questions.length} {isAr ? 'سؤال' : 'questions'} · {answers.length} {isAr ? 'إجابة' : 'answers'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a href={'/' + locale + '/admin/pathfinder/responses'} className="text-xs text-[var(--color-primary)] hover:underline">
              {isAr ? 'عرض تقييمات العملاء' : 'View Responses'}
            </a>
            <a href={'/' + locale + '/admin'} className="text-[var(--color-primary)] text-sm hover:underline flex items-center gap-1">
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
              {isAr ? 'لوحة الإدارة' : 'Dashboard'}
            </a>
          </div>
        </div>

        {msg && (
          <div className="mb-4 px-3 py-2 rounded bg-blue-50 text-blue-900 text-xs">{msg}</div>
        )}

        {/* Version switcher + actions */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <label className="text-xs text-[var(--color-neutral-500)]">
            {isAr ? 'النسخة' : 'Version'}
          </label>
          <select
            className="px-3 py-1.5 rounded-lg border border-[var(--color-neutral-200)] text-sm"
            value={currentVersionId ?? ''}
            onChange={(e) => setCurrentVersionId(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version_number} — {v.label} {v.is_active ? (isAr ? '(نشط)' : '(ACTIVE)') : (isAr ? '(مسودة)' : '(draft)')}
              </option>
            ))}
          </select>
          <button
            onClick={cloneDraft}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-200)] flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            {isAr ? 'مسودة جديدة' : 'New Draft'}
          </button>
          {currentVersion && !currentVersion.is_active && (
            <button
              onClick={publishCurrent}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50"
            >
              <Upload className="w-3 h-3" />
              {isAr ? 'نشر' : 'Publish'}
            </button>
          )}
          {currentVersionId && (
            <a
              href={'/' + locale + '/pathfinder/assess?draft=' + currentVersionId}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-200)] flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              {isAr ? 'معاينة' : 'Preview'}
            </a>
          )}
          {isReadOnly && (
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
              {isAr ? 'النسخة النشطة للقراءة فقط — أنشئ مسودة لتعديلها' : 'Active version is read-only — create a draft to edit'}
            </span>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-4 border-b border-[var(--color-neutral-200)]">
          {(['tree', 'outcomes'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]' : 'text-[var(--color-neutral-500)]'}`}
            >
              {t === 'tree' ? (isAr ? 'الشجرة' : 'Tree') : (isAr ? 'النتائج والبرامج' : 'Outcomes')}
            </button>
          ))}
        </div>

        {tab === 'tree' && (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
            {/* Left rail — tree */}
            <div className="border border-[var(--color-neutral-200)] rounded-lg p-3 max-h-[70vh] overflow-y-auto text-sm">
              <div className="text-xs font-medium text-[var(--color-neutral-500)] mb-2">
                {isAr ? 'الأسئلة' : 'Questions'}
              </div>
              {questions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuestionId(q.id)}
                  className={`w-full text-start px-2 py-1.5 rounded text-xs mb-1 ${selectedQuestionId === q.id ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'hover:bg-[var(--color-neutral-50)]'}`}
                >
                  <span className="font-mono text-[10px] opacity-70">[{q.code}]</span>{' '}
                  <span className="opacity-50 text-[10px]">{q.type}{q.parent_answer_code ? ' ← ' + q.parent_answer_code : ' (root)'}</span>
                  <div className="truncate">{isAr ? q.question_ar : (q.question_en ?? q.question_ar)}</div>
                </button>
              ))}
            </div>

            {/* Editor pane */}
            <div className="border border-[var(--color-neutral-200)] rounded-lg p-4">
              {!selectedQuestion ? (
                <p className="text-sm text-[var(--color-neutral-400)] py-6 text-center">
                  {isAr ? 'اختر سؤالاً للتحرير' : 'Select a question to edit'}
                </p>
              ) : (
                <QuestionEditor
                  key={selectedQuestion.id}
                  question={selectedQuestion}
                  answers={answersByQuestion.get(selectedQuestion.id) ?? []}
                  allAnswers={answers}
                  readOnly={isReadOnly}
                  onSaveQ={saveQuestion}
                  onSaveA={saveAnswer}
                  isAr={isAr}
                />
              )}
            </div>
          </div>
        )}

        {tab === 'outcomes' && (
          <OutcomesEditor
            outcomes={outcomes}
            readOnly={isReadOnly}
            onSave={saveOutcome}
            isAr={isAr}
          />
        )}
      </Section>
    </main>
  );
}

function QuestionEditor(props: {
  question: QRow;
  answers: ARow[];
  allAnswers: ARow[];
  readOnly: boolean;
  onSaveQ: (q: QRow) => void;
  onSaveA: (a: ARow) => void;
  isAr: boolean;
}) {
  const { question, answers, allAnswers, readOnly, onSaveQ, onSaveA, isAr } = props;
  const [q, setQ] = useState(question);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium mb-1">{isAr ? 'الكود' : 'Code'} <span className="opacity-50 font-mono">{q.code}</span></div>
        <label className="block text-xs mb-1">{isAr ? 'السؤال (عربي)' : 'Question (AR)'}</label>
        <textarea
          className="w-full px-2 py-1.5 border rounded text-sm"
          rows={2}
          value={q.question_ar}
          disabled={readOnly}
          onChange={(e) => setQ({ ...q, question_ar: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-xs mb-1">{isAr ? 'السؤال (إنجليزي)' : 'Question (EN)'}</label>
        <textarea
          className="w-full px-2 py-1.5 border rounded text-sm"
          rows={2}
          value={q.question_en ?? ''}
          disabled={readOnly}
          onChange={(e) => setQ({ ...q, question_en: e.target.value })}
        />
      </div>
      <div className="flex gap-4 items-center flex-wrap">
        <label className="text-xs flex items-center gap-1">
          <input
            type="checkbox"
            checked={q.published}
            disabled={readOnly}
            onChange={(e) => setQ({ ...q, published: e.target.checked })}
          />
          {isAr ? 'منشور' : 'Published'}
        </label>
        <label className="text-xs flex items-center gap-1">
          <input
            type="checkbox"
            checked={q.is_terminal_gate}
            disabled={readOnly}
            onChange={(e) => setQ({ ...q, is_terminal_gate: e.target.checked })}
          />
          {isAr ? 'سؤال نهائي' : 'Terminal gate'}
        </label>
        <label className="text-xs flex items-center gap-1">
          {isAr ? 'الترتيب' : 'Sort'}
          <input
            type="number"
            className="w-16 px-1 py-0.5 border rounded text-xs"
            value={q.sort_order}
            disabled={readOnly}
            onChange={(e) => setQ({ ...q, sort_order: Number(e.target.value) })}
          />
        </label>
        <label className="text-xs flex items-center gap-1">
          {isAr ? 'الإجابة الوالدة' : 'Parent answer'}
          <select
            className="text-xs px-1 py-0.5 border rounded"
            value={q.parent_answer_id ?? ''}
            disabled={readOnly}
            onChange={(e) => setQ({ ...q, parent_answer_id: e.target.value || null })}
          >
            <option value="">(root)</option>
            {allAnswers
              .filter((a) => a.question_id !== q.id)
              .map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.text_ar.slice(0, 30)}</option>
              ))}
          </select>
        </label>
        <button
          disabled={readOnly}
          onClick={() => onSaveQ(q)}
          className="px-3 py-1 bg-[var(--color-primary)] text-white rounded text-xs flex items-center gap-1 disabled:opacity-50"
        >
          <Save className="w-3 h-3" />
          {isAr ? 'حفظ السؤال' : 'Save Question'}
        </button>
      </div>

      <div className="border-t pt-4">
        <div className="text-xs font-medium mb-2">{isAr ? 'الإجابات' : 'Answers'} ({answers.length})</div>
        <div className="space-y-3">
          {answers.map((a) => (
            <AnswerEditor key={a.id} answer={a} readOnly={readOnly} onSave={onSaveA} isAr={isAr} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AnswerEditor(props: {
  answer: ARow;
  readOnly: boolean;
  onSave: (a: ARow) => void;
  isAr: boolean;
}) {
  const [a, setA] = useState(props.answer);
  const { readOnly, onSave, isAr } = props;
  return (
    <div className="border rounded p-2 text-xs">
      <div className="flex gap-2 items-center mb-2">
        <span className="font-mono opacity-60">[{a.code}]</span>
        <input
          className="flex-1 px-1 py-0.5 border rounded"
          value={a.text_ar}
          disabled={readOnly}
          onChange={(e) => setA({ ...a, text_ar: e.target.value })}
          placeholder={isAr ? 'النص العربي' : 'Arabic text'}
        />
        <input
          className="flex-1 px-1 py-0.5 border rounded"
          value={a.text_en ?? ''}
          disabled={readOnly}
          onChange={(e) => setA({ ...a, text_en: e.target.value })}
          placeholder={isAr ? 'النص الإنجليزي' : 'English text'}
        />
      </div>
      <div className="grid grid-cols-4 md:grid-cols-7 gap-1 mb-2">
        {CATEGORIES.map((c) => (
          <label key={c} className="flex flex-col text-[10px]">
            <span className="opacity-60">{c}</span>
            <input
              type="number"
              min={0}
              max={20}
              className="px-1 py-0.5 border rounded w-full"
              value={a.category_weights[c] ?? 0}
              disabled={readOnly}
              onChange={(e) => setA({
                ...a,
                category_weights: { ...a.category_weights, [c]: Number(e.target.value) || 0 },
              })}
            />
          </label>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <label className="text-[10px] opacity-70">{isAr ? 'برامج (slug مفصولة بفاصلة)' : 'slugs (comma-sep)'}</label>
        <input
          className="flex-1 px-1 py-0.5 border rounded"
          value={a.recommended_slugs.join(',')}
          disabled={readOnly}
          onChange={(e) => setA({
            ...a,
            recommended_slugs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
          })}
        />
        <button
          disabled={readOnly}
          onClick={() => onSave(a)}
          className="px-2 py-0.5 bg-[var(--color-primary)] text-white rounded text-[11px] disabled:opacity-50"
        >
          {isAr ? 'حفظ' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function OutcomesEditor(props: {
  outcomes: Outcome[];
  readOnly: boolean;
  onSave: (o: Outcome) => void;
  isAr: boolean;
}) {
  const { outcomes, readOnly, onSave, isAr } = props;
  return (
    <div className="space-y-3">
      {outcomes.map((o) => <OutcomeRow key={o.id} outcome={o} readOnly={readOnly} onSave={onSave} isAr={isAr} />)}
      {outcomes.length === 0 && (
        <p className="text-sm text-[var(--color-neutral-400)] py-6 text-center">
          {isAr ? 'لا توجد نتائج' : 'No outcomes'}
        </p>
      )}
    </div>
  );
}

function OutcomeRow(props: { outcome: Outcome; readOnly: boolean; onSave: (o: Outcome) => void; isAr: boolean }) {
  const [o, setO] = useState(props.outcome);
  const { readOnly, onSave, isAr } = props;
  return (
    <div className="border rounded p-3 text-xs">
      <div className="flex gap-2 items-center mb-2 flex-wrap">
        <span className="font-mono font-medium">{o.program_slug}</span>
        <select
          className="text-xs px-1 py-0.5 border rounded"
          value={o.cta_type}
          disabled={readOnly}
          onChange={(e) => setO({ ...o, cta_type: e.target.value as Outcome['cta_type'] })}
        >
          <option value="book_call">book_call</option>
          <option value="enroll">enroll</option>
          <option value="explore">explore</option>
          <option value="free_signup">free_signup</option>
        </select>
        <input
          className="px-1 py-0.5 border rounded flex-1 min-w-[120px]"
          value={o.cta_label_ar ?? ''}
          disabled={readOnly}
          onChange={(e) => setO({ ...o, cta_label_ar: e.target.value })}
          placeholder="CTA (AR)"
        />
        <input
          className="px-1 py-0.5 border rounded flex-1 min-w-[120px]"
          value={o.cta_label_en ?? ''}
          disabled={readOnly}
          onChange={(e) => setO({ ...o, cta_label_en: e.target.value })}
          placeholder="CTA (EN)"
        />
      </div>
      <div className="grid grid-cols-4 md:grid-cols-7 gap-1 mb-2">
        {CATEGORIES.map((c) => (
          <label key={c} className="flex flex-col text-[10px]">
            <span className="opacity-60">{c}</span>
            <input
              type="number"
              step="0.1"
              min={0}
              max={2}
              className="px-1 py-0.5 border rounded w-full"
              value={o.category_affinity[c] ?? 0}
              disabled={readOnly}
              onChange={(e) => setO({
                ...o,
                category_affinity: { ...o.category_affinity, [c]: Number(e.target.value) || 0 },
              })}
            />
          </label>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <label className="text-[10px]">min_score
          <input type="number" className="ms-1 px-1 py-0.5 border rounded w-16" value={o.min_score} disabled={readOnly} onChange={(e) => setO({ ...o, min_score: Number(e.target.value) || 0 })} />
        </label>
        <button
          disabled={readOnly}
          onClick={() => onSave(o)}
          className="ms-auto px-2 py-0.5 bg-[var(--color-primary)] text-white rounded text-[11px] disabled:opacity-50"
        >
          {isAr ? 'حفظ' : 'Save'}
        </button>
      </div>
    </div>
  );
}
