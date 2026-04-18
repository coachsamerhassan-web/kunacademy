'use client';

/**
 * Beneficiary File Session Form
 *
 * Student-facing form for pre/post reflection on a single coaching session
 * with a volunteer client. Corresponds to the physical "Beneficiary File"
 * workbook (ملف المستفيد).
 *
 * Source: SPEC-mentoring-package-template.md §6.1 + §6.2
 * Sub-phase: S2-Layer-1 / 1.3
 *
 * Bilingual: AR (primary, RTL) + EN
 * Component library: @kunacademy/ui (Card, Section, Button)
 * Auth: useAuth() from @kunacademy/auth
 */

import { use, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { Button } from '@kunacademy/ui/button';

// ─── Types mirroring SPEC §6.1 JSONB shapes ──────────────────────────────────

interface AwarenessMapCell {
  observation: string;
  evidence:    string;
}

interface AwarenessMap {
  'حكيمة':   AwarenessMapCell;
  'حركات':   AwarenessMapCell;
  'تحكم':    AwarenessMapCell;
  'الشخصية': AwarenessMapCell;
  'الأنا':   AwarenessMapCell;
}

interface NeedsResourcesChallengesItem {
  category: 'needs' | 'resources' | 'challenges';
  item:     string;
}

interface SelfEvaluationItem {
  criterion: string;
  met:       boolean;
  note:      string | null;
}

interface PreSessionData {
  client_goal:                string;
  presenting_topic:           string;
  previous_session_follow_up: string;
  somatic_hypothesis:         string;
  intended_tools:             string[];
}

interface SessionFormData {
  // Pre-session (pages 3-4)
  pre_session_data: PreSessionData;

  // Post-session (pages 5-11)
  client_goal_in_client_words:     string;
  client_learning_in_client_words: string;
  awareness_map:                   AwarenessMap;
  needs_resources_challenges:      NeedsResourcesChallengesItem[];
  immediate_metaphor:              string;
  developmental_metaphor:          string;
  self_evaluation:                 { items: SelfEvaluationItem[] };
  continue_stop_start:             string;
}

interface SessionResponse {
  id:                             string;
  beneficiary_file_id:            string;
  session_number:                 number;
  status:                         'draft' | 'submitted' | 'reviewed';
  pre_session_data:               PreSessionData | null;
  client_goal_in_client_words:     string | null;
  client_learning_in_client_words: string | null;
  awareness_map:                   AwarenessMap | null;
  needs_resources_challenges:      NeedsResourcesChallengesItem[] | null;
  immediate_metaphor:              string | null;
  developmental_metaphor:          string | null;
  self_evaluation:                 { items: SelfEvaluationItem[] } | null;
  continue_stop_start:             string | null;
  submitted_at:                    string | null;
  reviewed_at:                     string | null;
}

// ─── Default shapes ────────────────────────────────────────────────────────────

const AWARENESS_PILLARS = ['حكيمة', 'حركات', 'تحكم', 'الشخصية', 'الأنا'] as const;
type AwarenessPillar = typeof AWARENESS_PILLARS[number];

function defaultAwarenessMap(): AwarenessMap {
  return {
    'حكيمة':   { observation: '', evidence: '' },
    'حركات':   { observation: '', evidence: '' },
    'تحكم':    { observation: '', evidence: '' },
    'الشخصية': { observation: '', evidence: '' },
    'الأنا':   { observation: '', evidence: '' },
  };
}

function defaultFormData(): SessionFormData {
  return {
    pre_session_data: {
      client_goal:                '',
      presenting_topic:           '',
      previous_session_follow_up: '',
      somatic_hypothesis:         '',
      intended_tools:             [],
    },
    client_goal_in_client_words:     '',
    client_learning_in_client_words: '',
    awareness_map:                   defaultAwarenessMap(),
    needs_resources_challenges:      [],
    immediate_metaphor:              '',
    developmental_metaphor:          '',
    self_evaluation:                 { items: [] },
    continue_stop_start:             '',
  };
}

function mergeSessionIntoForm(
  session: SessionResponse,
  defaults: SessionFormData,
): SessionFormData {
  return {
    pre_session_data: session.pre_session_data ?? defaults.pre_session_data,
    client_goal_in_client_words:
      session.client_goal_in_client_words     ?? defaults.client_goal_in_client_words,
    client_learning_in_client_words:
      session.client_learning_in_client_words ?? defaults.client_learning_in_client_words,
    awareness_map:
      session.awareness_map ?? defaults.awareness_map,
    needs_resources_challenges:
      session.needs_resources_challenges ?? defaults.needs_resources_challenges,
    immediate_metaphor:
      session.immediate_metaphor ?? defaults.immediate_metaphor,
    developmental_metaphor:
      session.developmental_metaphor ?? defaults.developmental_metaphor,
    self_evaluation:
      session.self_evaluation ?? defaults.self_evaluation,
    continue_stop_start:
      session.continue_stop_start ?? defaults.continue_stop_start,
  };
}

// ─── i18n strings (inline — no separate messages file in this sub-phase) ──────

const t = {
  ar: {
    pageTitle:               (n: number) => `ملف المستفيد — الجلسة ${n}`,
    status_draft:            'مسودة',
    status_submitted:        'مقدَّمة للمراجعة',
    status_reviewed:         'تمت المراجعة',
    section_pre:             'التحضير للجلسة (الصفحات 3-4)',
    client_goal:             'هدف العميل',
    presenting_topic:        'الموضوع المطروح في الجلسة',
    prev_followup:           'متابعة الجلسة السابقة',
    somatic_hypothesis:      'الفرضية الحسية قبل الجلسة',
    intended_tools:          'الأدوات المنوي استخدامها (افصل بفاصلة)',
    section_post:            'تأمل ما بعد الجلسة (الصفحات 5-11)',
    goal_client_words:       'هدف العميل بكلماته',
    learning_client_words:   'تعلّم العميل بكلماته',
    section_awareness:       'خريطة الوعي — الأعمدة الخمسة',
    observation:             'ملاحظة',
    evidence:                'دليل',
    section_needs:           'الاحتياجات / الموارد / التحديات',
    add_item:                'إضافة عنصر',
    category_needs:          'احتياجات',
    category_resources:      'موارد',
    category_challenges:     'تحديات',
    item_text:               'النص',
    immediate_metaphor:      'الاستعارة الآنية',
    developmental_metaphor:  'الاستعارة التطورية',
    section_self_eval:       'التقييم الذاتي',
    continue_stop_start:     'ماذا أستمر / أوقف / أبدأ؟ (الصفحة 11)',
    save_draft:              'حفظ كمسودة',
    submit:                  'تقديم للمراجعة',
    saving:                  'جاري الحفظ...',
    submitting:              'جاري التقديم...',
    saved:                   'تم الحفظ',
    submitted:               'تم التقديم',
    reviewed_notice:         'هذه الجلسة تمت مراجعتها من قِبَل المنتور. لا يمكن تعديلها.',
    error_load:              'تعذّر تحميل بيانات الجلسة. أعد المحاولة.',
    error_save:              'تعذّر الحفظ. أعد المحاولة.',
    loading:                 'جاري التحميل...',
    back:                    'رجوع',
  },
  en: {
    pageTitle:               (n: number) => `Beneficiary File — Session ${n}`,
    status_draft:            'Draft',
    status_submitted:        'Submitted for review',
    status_reviewed:         'Reviewed by mentor',
    section_pre:             'Pre-Session Prep (Pages 3–4)',
    client_goal:             "Client's Goal",
    presenting_topic:        'Presenting Topic',
    prev_followup:           'Previous Session Follow-up',
    somatic_hypothesis:      'Somatic Hypothesis Before Session',
    intended_tools:          'Intended Tools (comma-separated)',
    section_post:            'Post-Session Reflection (Pages 5–11)',
    goal_client_words:       "Client's Goal in Their Own Words",
    learning_client_words:   "Client's Learning in Their Own Words",
    section_awareness:       'Awareness Map — 5 Pillars',
    observation:             'Observation',
    evidence:                'Evidence',
    section_needs:           'Needs / Resources / Challenges',
    add_item:                'Add item',
    category_needs:          'Needs',
    category_resources:      'Resources',
    category_challenges:     'Challenges',
    item_text:               'Text',
    immediate_metaphor:      'Immediate Metaphor',
    developmental_metaphor:  'Developmental Metaphor',
    section_self_eval:       'Self-Evaluation',
    continue_stop_start:     'Continue / Stop / Start? (Page 11)',
    save_draft:              'Save Draft',
    submit:                  'Submit for Review',
    saving:                  'Saving...',
    submitting:              'Submitting...',
    saved:                   'Saved',
    submitted:               'Submitted',
    reviewed_notice:         'This session has been reviewed by your mentor. It cannot be edited.',
    error_load:              'Failed to load session data. Please try again.',
    error_save:              'Failed to save. Please try again.',
    loading:                 'Loading...',
    back:                    'Back',
  },
};

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function SectionHeader({ label, isAr }: { label: string; isAr: boolean }) {
  return (
    <h2
      className="text-base font-semibold text-[var(--color-primary)] mb-4 mt-6 border-b border-[var(--color-neutral-200)] pb-2"
      style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
    >
      {label}
    </h2>
  );
}

function FieldLabel({ label, isAr }: { label: string; isAr: boolean }) {
  return (
    <label
      className="block text-sm font-medium text-[var(--text-primary)] mb-1"
      style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : undefined }}
    >
      {label}
    </label>
  );
}

function TextArea({
  value,
  onChange,
  disabled,
  rows = 3,
  dir,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <textarea
      className="w-full rounded-lg border border-[var(--color-neutral-200)] bg-white px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-[var(--color-surface-dim)] disabled:cursor-not-allowed resize-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={rows}
      dir={dir}
    />
  );
}

function TextInput({
  value,
  onChange,
  disabled,
  dir,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <input
      type="text"
      className="w-full rounded-lg border border-[var(--color-neutral-200)] bg-white px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-[var(--color-surface-dim)] disabled:cursor-not-allowed"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      dir={dir}
    />
  );
}

function StatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const labels = isAr ? t.ar : t.en;
  const map: Record<string, { label: string; cls: string }> = {
    draft:     { label: labels.status_draft,     cls: 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]' },
    submitted: { label: labels.status_submitted, cls: 'bg-blue-100 text-blue-700' },
    reviewed:  { label: labels.status_reviewed,  cls: 'bg-green-100 text-green-700' },
  };
  const { label, cls } = map[status] ?? map.draft;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function BeneficiaryFileSessionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; sessionNumber: string }>;
}) {
  const { locale, id, sessionNumber } = use(params);
  const isAr = locale === 'ar';
  const dir  = isAr ? 'rtl' : 'ltr';
  const l    = isAr ? t.ar : t.en;
  const sessionNum = parseInt(sessionNumber, 10);

  const { user } = useAuth();

  const [formData, setFormData]   = useState<SessionFormData>(defaultFormData());
  const [status, setStatus]       = useState<'draft' | 'submitted' | 'reviewed'>('draft');
  const [loading, setLoading]     = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError]         = useState<string | null>(null);

  const isReadOnly = status === 'reviewed';

  // ── Load existing session data ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    fetch(`/api/beneficiary-files/${id}/sessions/${sessionNumber}`)
      .then(async (res) => {
        if (res.status === 404) {
          // Session doesn't exist yet — blank form
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error('load failed');
        const data: { session: SessionResponse } = await res.json();
        const { session } = data;
        setStatus(session.status);
        setFormData(mergeSessionIntoForm(session, defaultFormData()));
        setLoading(false);
      })
      .catch(() => {
        setError(l.error_load);
        setLoading(false);
      });
  }, [user, id, sessionNumber, l.error_load]);

  // ── Save draft ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(
    async (submitForm = false) => {
      if (isReadOnly) return;

      setSaveState(submitForm ? 'saving' : 'saving');
      setError(null);

      const payload = {
        ...formData,
        ...(submitForm ? { submit: true } : {}),
      };

      const res = await fetch(`/api/beneficiary-files/${id}/sessions/${sessionNumber}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        setSaveState('error');
        setError(l.error_save);
        return;
      }

      const data: { session: SessionResponse } = await res.json();
      setStatus(data.session.status);
      setSaveState('saved');

      setTimeout(() => setSaveState('idle'), 2500);
    },
    [formData, id, sessionNumber, isReadOnly, l.error_save],
  );

  // ── Pre-session helpers ────────────────────────────────────────────────────
  function updatePreField(field: keyof PreSessionData, value: string | string[]) {
    setFormData((prev) => ({
      ...prev,
      pre_session_data: { ...prev.pre_session_data, [field]: value },
    }));
  }

  // ── Awareness map helpers ──────────────────────────────────────────────────
  function updateAwarenessCell(
    pillar: AwarenessPillar,
    field: 'observation' | 'evidence',
    value: string,
  ) {
    setFormData((prev) => ({
      ...prev,
      awareness_map: {
        ...prev.awareness_map,
        [pillar]: { ...prev.awareness_map[pillar], [field]: value },
      },
    }));
  }

  // ── Needs/Resources/Challenges helpers ─────────────────────────────────────
  function addNRCItem(category: NeedsResourcesChallengesItem['category']) {
    setFormData((prev) => ({
      ...prev,
      needs_resources_challenges: [
        ...prev.needs_resources_challenges,
        { category, item: '' },
      ],
    }));
  }

  function updateNRCItem(index: number, item: string) {
    setFormData((prev) => {
      const updated = [...prev.needs_resources_challenges];
      updated[index] = { ...updated[index], item };
      return { ...prev, needs_resources_challenges: updated };
    });
  }

  function removeNRCItem(index: number) {
    setFormData((prev) => ({
      ...prev,
      needs_resources_challenges: prev.needs_resources_challenges.filter((_, i) => i !== index),
    }));
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!user) return null;

  if (loading) {
    return (
      <Section variant="white">
        <p className="text-sm text-[var(--color-neutral-500)]">{l.loading}</p>
      </Section>
    );
  }

  return (
    <Section variant="white" dir={dir}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <a
            href={`/${locale}/dashboard`}
            className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1 mb-2"
          >
            {isAr ? '← ' : ''}{l.back}{!isAr ? ' →' : ''}
          </a>
          <h1
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {l.pageTitle(sessionNum)}
          </h1>
        </div>
        <StatusBadge status={status} isAr={isAr} />
      </div>

      {/* Reviewed notice */}
      {isReadOnly && (
        <Card className="mb-6 bg-green-50 border border-green-200 p-4">
          <p className="text-sm text-green-700" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : undefined }}>
            {l.reviewed_notice}
          </p>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="mb-6 bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      {/* ── PRE-SESSION SECTION ──────────────────────────────────────────── */}
      <Card accent className="p-5 mb-4">
        <SectionHeader label={l.section_pre} isAr={isAr} />

        <div className="space-y-4">
          <div>
            <FieldLabel label={l.client_goal} isAr={isAr} />
            <TextArea
              value={formData.pre_session_data.client_goal}
              onChange={(v) => updatePreField('client_goal', v)}
              disabled={isReadOnly}
              dir={dir}
            />
          </div>

          <div>
            <FieldLabel label={l.presenting_topic} isAr={isAr} />
            <TextArea
              value={formData.pre_session_data.presenting_topic}
              onChange={(v) => updatePreField('presenting_topic', v)}
              disabled={isReadOnly}
              dir={dir}
            />
          </div>

          <div>
            <FieldLabel label={l.prev_followup} isAr={isAr} />
            <TextArea
              value={formData.pre_session_data.previous_session_follow_up}
              onChange={(v) => updatePreField('previous_session_follow_up', v)}
              disabled={isReadOnly}
              dir={dir}
            />
          </div>

          <div>
            <FieldLabel label={l.somatic_hypothesis} isAr={isAr} />
            <TextArea
              value={formData.pre_session_data.somatic_hypothesis}
              onChange={(v) => updatePreField('somatic_hypothesis', v)}
              disabled={isReadOnly}
              dir={dir}
              rows={2}
            />
          </div>

          <div>
            <FieldLabel label={l.intended_tools} isAr={isAr} />
            <TextInput
              value={formData.pre_session_data.intended_tools.join(', ')}
              onChange={(v) => updatePreField('intended_tools', v.split(',').map((s) => s.trim()).filter(Boolean))}
              disabled={isReadOnly}
              dir={dir}
            />
          </div>
        </div>
      </Card>

      {/* ── POST-SESSION SECTION ─────────────────────────────────────────── */}
      <Card accent className="p-5 mb-4">
        <SectionHeader label={l.section_post} isAr={isAr} />

        <div className="space-y-4">
          <div>
            <FieldLabel label={l.goal_client_words} isAr={isAr} />
            <TextArea
              value={formData.client_goal_in_client_words}
              onChange={(v) => setFormData((p) => ({ ...p, client_goal_in_client_words: v }))}
              disabled={isReadOnly}
              dir={dir}
            />
          </div>

          <div>
            <FieldLabel label={l.learning_client_words} isAr={isAr} />
            <TextArea
              value={formData.client_learning_in_client_words}
              onChange={(v) => setFormData((p) => ({ ...p, client_learning_in_client_words: v }))}
              disabled={isReadOnly}
              dir={dir}
            />
          </div>
        </div>
      </Card>

      {/* ── AWARENESS MAP ────────────────────────────────────────────────── */}
      <Card accent className="p-5 mb-4">
        <SectionHeader label={l.section_awareness} isAr={isAr} />

        <div className="space-y-5">
          {AWARENESS_PILLARS.map((pillar) => (
            <div key={pillar} className="rounded-lg border border-[var(--color-neutral-200)] p-4 bg-[var(--color-surface-dim)]">
              <p
                className="text-sm font-semibold text-[var(--color-primary)] mb-3"
                style={{ fontFamily: 'var(--font-arabic-heading)' }}
              >
                {pillar}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <FieldLabel label={l.observation} isAr={isAr} />
                  <TextArea
                    value={formData.awareness_map[pillar]?.observation ?? ''}
                    onChange={(v) => updateAwarenessCell(pillar, 'observation', v)}
                    disabled={isReadOnly}
                    dir={dir}
                    rows={2}
                  />
                </div>
                <div>
                  <FieldLabel label={l.evidence} isAr={isAr} />
                  <TextArea
                    value={formData.awareness_map[pillar]?.evidence ?? ''}
                    onChange={(v) => updateAwarenessCell(pillar, 'evidence', v)}
                    disabled={isReadOnly}
                    dir={dir}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── NEEDS / RESOURCES / CHALLENGES ───────────────────────────────── */}
      <Card accent className="p-5 mb-4">
        <SectionHeader label={l.section_needs} isAr={isAr} />

        <div className="space-y-2 mb-4">
          {formData.needs_resources_challenges.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                  item.category === 'needs'
                    ? 'bg-blue-100 text-blue-700'
                    : item.category === 'resources'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700'
                }`}
              >
                {item.category === 'needs' ? l.category_needs
                  : item.category === 'resources' ? l.category_resources
                  : l.category_challenges}
              </span>
              <input
                type="text"
                className="flex-1 rounded-lg border border-[var(--color-neutral-200)] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-[var(--color-surface-dim)] disabled:cursor-not-allowed"
                value={item.item}
                onChange={(e) => updateNRCItem(i, e.target.value)}
                disabled={isReadOnly}
                dir={dir}
                placeholder={l.item_text}
              />
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => removeNRCItem(i)}
                  className="text-[var(--color-neutral-400)] hover:text-red-500 transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Remove"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {!isReadOnly && (
          <div className="flex flex-wrap gap-2">
            {(['needs', 'resources', 'challenges'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => addNRCItem(cat)}
                className="px-3 py-1.5 rounded-lg border border-[var(--color-neutral-200)] text-xs font-medium text-[var(--text-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-all min-h-[44px]"
              >
                + {cat === 'needs' ? l.category_needs : cat === 'resources' ? l.category_resources : l.category_challenges}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* ── METAPHORS ─────────────────────────────────────────────────────── */}
      <Card accent className="p-5 mb-4">
        <div className="space-y-4">
          <div>
            <FieldLabel label={l.immediate_metaphor} isAr={isAr} />
            <TextInput
              value={formData.immediate_metaphor}
              onChange={(v) => setFormData((p) => ({ ...p, immediate_metaphor: v }))}
              disabled={isReadOnly}
              dir={dir}
            />
          </div>
          <div>
            <FieldLabel label={l.developmental_metaphor} isAr={isAr} />
            <TextInput
              value={formData.developmental_metaphor}
              onChange={(v) => setFormData((p) => ({ ...p, developmental_metaphor: v }))}
              disabled={isReadOnly}
              dir={dir}
            />
          </div>
        </div>
      </Card>

      {/* ── CONTINUE / STOP / START ──────────────────────────────────────── */}
      <Card accent className="p-5 mb-6">
        <FieldLabel label={l.continue_stop_start} isAr={isAr} />
        <TextArea
          value={formData.continue_stop_start}
          onChange={(v) => setFormData((p) => ({ ...p, continue_stop_start: v }))}
          disabled={isReadOnly}
          dir={dir}
          rows={4}
        />
      </Card>

      {/* ── ACTION BUTTONS ────────────────────────────────────────────────── */}
      {!isReadOnly && (
        <div
          className="flex flex-wrap gap-3 justify-end sticky bottom-6"
          style={{ direction: dir }}
        >
          {saveState === 'error' && (
            <p className="text-sm text-red-600 self-center">{l.error_save}</p>
          )}
          {saveState === 'saved' && (
            <p className="text-sm text-green-600 self-center">{l.saved}</p>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={saveState === 'saving'}
          >
            {saveState === 'saving' ? l.saving : l.save_draft}
          </Button>

          {status !== 'submitted' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={saveState === 'saving'}
            >
              {saveState === 'saving' ? l.submitting : l.submit}
            </Button>
          )}
        </div>
      )}
    </Section>
  );
}
