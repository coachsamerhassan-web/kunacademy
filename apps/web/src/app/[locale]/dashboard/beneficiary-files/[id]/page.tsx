'use client';

/**
 * Apprentice Beneficiary File View (read-only, full-feedback)
 *
 * Route: /[locale]/dashboard/beneficiary-files/[id]
 * Audience: the APPRENTICE who owns this file (admins can also view).
 *
 * Layout per D1-APPRENTICE-BENEFICIARY-FILES-SPEC.md §2:
 *   1. File header (alias, package, client #, first-session date, status)
 *   2. Mentor assessment summary — verdict surfaced AT TOP (§2.2)
 *   3. Mentor voice message + written feedback + rubric (§2.3)
 *   4. Sessions 1→3 accordions (default-expanded for submitted/reviewed — §2.4)
 *   5. Primary CTA footer (§7)
 *
 * Judgment calls (Samer, 2026-04-22):
 *   - Assessor-name redaction on verdict=fail: ON (API handles)
 *   - Reflection Strip (§2.5): OFF (deferred)
 *   - Voice-reply from apprentice: OFF (deferred)
 *   - Default-expanded sessions: ON
 *
 * Auth: non-owner / non-admin → 404 from API (privacy, §6.4).
 * Data source: GET /api/beneficiary-files/[id]/apprentice-view
 *
 * Sub-phase: S2-Layer-1 / Wave D1
 */

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { Button } from '@kunacademy/ui/button';
import { ChevronDown, ChevronUp, AlertCircle, Mic, FileText, CheckCircle2, XCircle, Clock, ArrowUpCircle } from 'lucide-react';

// ─── Types (mirror route.ts response) ────────────────────────────────────────

interface AwarenessCell { observation: string; evidence: string }
interface AwarenessMap {
  'حكيمة':   AwarenessCell; 'حركات':   AwarenessCell; 'تحكم':    AwarenessCell;
  'الشخصية': AwarenessCell; 'الأنا':   AwarenessCell;
}
interface NRCItem      { category: 'needs' | 'resources' | 'challenges'; item: string }
interface SelfEvalItem { criterion: string; met: boolean; note: string | null }
interface PreSessionData {
  client_goal?: string; presenting_topic?: string; previous_session_follow_up?: string;
  somatic_hypothesis?: string; intended_tools?: string[];
}
interface SessionRow {
  id: string; session_number: number; status: 'draft' | 'submitted' | 'reviewed';
  pre_session_data: PreSessionData | null;
  client_goal_in_client_words: string | null;
  client_learning_in_client_words: string | null;
  awareness_map: AwarenessMap | null;
  needs_resources_challenges: NRCItem[] | null;
  immediate_metaphor: string | null;
  developmental_metaphor: string | null;
  self_evaluation: { items: SelfEvalItem[] } | null;
  continue_stop_start: string | null;
  submitted_at: string | null; reviewed_at: string | null;
}
interface FilePayload {
  id: string; package_instance_id: string;
  client_number: number; client_alias: string | null;
  first_session_date: string | null; created_at: string; updated_at: string;
  package_name_ar: string; package_name_en: string;
  journey_state: string | null; second_try_deadline_at: string | null;
}
interface RubricRow { criterion?: string; score?: number | string; note?: string | null }
interface Assessment {
  id: string; decision: string; decided_at: string | null;
  decision_note: string | null; ethics_auto_failed: boolean;
  rubric_scores: unknown; escalated_at: string | null;
  override_reason: string | null; has_override: boolean;
  assessor_name_ar: string | null; assessor_name_en: string | null;
  recording_id: string;
}
interface VoiceMessage { id: string; duration_seconds: number | null }
interface ApprenticeViewResponse {
  file: FilePayload; sessions: SessionRow[];
  assessment: Assessment | null; voice_message: VoiceMessage | null;
}

// ─── i18n — single object, ar/en side-by-side ────────────────────────────────

const AWARENESS_PILLARS = ['حكيمة', 'حركات', 'تحكم', 'الشخصية', 'الأنا'] as const;

type S = {
  back: string; packageLabel: string; firstSessionDate: string;
  fileTitle: (alias: string | null) => string;
  status_in_progress: string; status_complete: string; status_reviewed: string; status_draft: string;
  verdictHeader: string;
  verdict_pending: string; verdict_pass: string; verdict_fail: string; verdict_escalated: string;
  pendingExplain: string; decidedAt: string; assessorLabel: string;
  ethicsGate: string; escalatedNote: string; overrideNote: string; decisionNote: string;
  voiceMessage: string; voiceDuration: (s: number) => string; noFeedback: string;
  rubricHeader: string; rubricCriterion: string; rubricScore: string; rubricNote: string;
  myRecording: string; listenToMine: string;
  sessionsHeader: string; sessionTitle: (n: number) => string;
  notYetSubmitted: string; draftContinue: string;
  section_pre: string; client_goal: string; presenting_topic: string;
  prev_followup: string; somatic_hypothesis: string; intended_tools: string;
  section_post: string; goal_client_words: string; learning_client_words: string;
  section_awareness: string; observation: string; evidence: string;
  section_nrc: string; nrc_needs: string; nrc_resources: string; nrc_challenges: string;
  immediate_metaphor: string; developmental_metaphor: string;
  section_self_eval: string; met: string; not_met: string;
  continue_stop_start: string; expand: string; collapse: string;
  ctaHeader: string; ctaContinue: string; ctaUploadNew: string;
  ctaReReadFeedback: string; ctaBackToPackage: string; ctaReviewPastSessions: string;
  pendingHint: string;
  loading: string; notFound: string; notFoundCta: string;
  emptyTitle: string; emptyBody: string; emptyCta: string;
};

const STR: Record<'ar' | 'en', S> = {
  ar: {
    back: 'عودة إلى القائمة', packageLabel: 'الحزمة', firstSessionDate: 'تاريخ الجلسة الأولى',
    fileTitle: (a) => `ملف المستفيد — ${a ?? 'عميل'}`,
    status_in_progress: 'قيد التقدم', status_complete: 'مكتمل', status_reviewed: 'تمت المراجعة', status_draft: 'مسودة',
    verdictHeader: 'ملاحظات المُقيّم',
    verdict_pending: 'في انتظار مراجعة المُقيّم', verdict_pass: 'نجح',
    verdict_fail: 'لم ينجح بعد', verdict_escalated: 'تصعيد — مراجعة إضافية',
    pendingExplain: 'سيصلك إشعار فور انتهاء المُقيّم من مراجعة ملفك. يستغرق هذا عادةً 5–7 أيام.',
    decidedAt: 'تاريخ القرار', assessorLabel: 'المُقيّم',
    ethicsGate: 'تم تفعيل بوابة الأخلاقيات — يُرجى قراءة ملاحظة المُقيّم بعناية',
    escalatedNote: 'تم تصعيد هذا الملف لمراجعة إضافية من قِبَل مدير المُقيّمين.',
    overrideNote: 'تمت مراجعة القرار من قِبَل مدير المُقيّمين',
    decisionNote: 'ملاحظة المُقيّم',
    voiceMessage: 'الرسالة الصوتية من المُقيّم',
    voiceDuration: (s) => `المدة: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
    noFeedback: 'لم يصل ردّ المُقيّم بعد — ستصلك إشعار عند توفّره.',
    rubricHeader: 'نتائج التقييم وفق المعيار', rubricCriterion: 'المعيار', rubricScore: 'الدرجة', rubricNote: 'ملاحظة',
    myRecording: 'تسجيلك المُقدَّم', listenToMine: 'استماع لتسجيلك',
    sessionsHeader: 'جلساتك الثلاث', sessionTitle: (n) => `الجلسة ${n}`,
    notYetSubmitted: 'لم تُقدَّم بعد', draftContinue: 'مسودة — تابع الكتابة في النموذج',
    section_pre: 'التحضير قبل الجلسة', client_goal: 'هدف العميل',
    presenting_topic: 'الموضوع المطروح', prev_followup: 'متابعة الجلسة السابقة',
    somatic_hypothesis: 'الفرضية الحسية', intended_tools: 'الأدوات المخططة',
    section_post: 'التأمل بعد الجلسة', goal_client_words: 'هدف العميل بكلماته',
    learning_client_words: 'تعلّم العميل بكلماته',
    section_awareness: 'خريطة الوعي — الأعمدة الخمسة', observation: 'ملاحظة', evidence: 'دليل',
    section_nrc: 'الاحتياجات / الموارد / التحديات',
    nrc_needs: 'احتياجات', nrc_resources: 'موارد', nrc_challenges: 'تحديات',
    immediate_metaphor: 'الاستعارة الآنية', developmental_metaphor: 'الاستعارة التطورية',
    section_self_eval: 'التقييم الذاتي', met: 'محقَّق', not_met: 'غير محقَّق',
    continue_stop_start: 'استمر / أوقف / ابدأ', expand: 'توسيع', collapse: 'طي',
    ctaHeader: 'الخطوة التالية',
    ctaContinue: 'تابع كتابة الجلسة التالية', ctaUploadNew: 'ارفع تسجيلاً جديداً',
    ctaReReadFeedback: 'اقرأ ملاحظات المُقيّم مجدداً',
    ctaBackToPackage: 'عُد إلى صفحة الحزمة',
    ctaReviewPastSessions: 'راجع جلساتك السابقة',
    pendingHint: 'توقّعات المراجعة: خلال 5–7 أيام',
    loading: 'جاري التحميل...',
    notFound: 'لم يتم العثور على هذا الملف، أو أنه يخصّ زميلاً آخر.',
    notFoundCta: 'عودة إلى القائمة',
    emptyTitle: 'ابدأ رحلتك مع هذا المستفيد',
    emptyBody: 'لم تُقدَّم أي جلسة بعد. اكتب تأمّل جلستك الأولى عبر نموذج ملف المستفيد — سيظهر هنا فور الحفظ، ويُتاح للمُقيّم قبل 48 ساعة من الجلسة التالية.',
    emptyCta: 'بدء الجلسة الأولى',
  },
  en: {
    back: 'Back to list', packageLabel: 'Package', firstSessionDate: 'First Session Date',
    fileTitle: (a) => `Beneficiary File — ${a ?? 'Client'}`,
    status_in_progress: 'In Progress', status_complete: 'Complete', status_reviewed: 'Reviewed', status_draft: 'Draft',
    verdictHeader: 'Assessor Feedback',
    verdict_pending: 'Awaiting assessor review', verdict_pass: 'Pass',
    verdict_fail: 'Not yet passed', verdict_escalated: 'Escalated — additional review',
    pendingExplain: "You'll be notified the moment your file is assessed. This typically takes 5–7 days.",
    decidedAt: 'Decision date', assessorLabel: 'Assessor',
    ethicsGate: 'Ethics gate triggered — please read the assessor note carefully.',
    escalatedNote: 'This file has been escalated for additional review by the mentor manager.',
    overrideNote: 'Decision reviewed by mentor manager',
    decisionNote: 'Assessor note',
    voiceMessage: 'Voice message from your assessor',
    voiceDuration: (s) => `Duration: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
    noFeedback: "Assessor hasn't responded yet — you'll get a notification when they do.",
    rubricHeader: 'Rubric Scores', rubricCriterion: 'Criterion', rubricScore: 'Score', rubricNote: 'Note',
    myRecording: 'Your submitted recording', listenToMine: 'Listen to your recording',
    sessionsHeader: 'Your three sessions', sessionTitle: (n) => `Session ${n}`,
    notYetSubmitted: 'Not yet submitted', draftContinue: 'Draft — continue in the form',
    section_pre: 'Pre-Session Prep', client_goal: "Client's Goal",
    presenting_topic: 'Presenting Topic', prev_followup: 'Previous Session Follow-up',
    somatic_hypothesis: 'Somatic Hypothesis', intended_tools: 'Planned Tools',
    section_post: 'Post-Session Reflection', goal_client_words: "Client's Goal in Their Words",
    learning_client_words: "Client's Learning in Their Words",
    section_awareness: 'Awareness Map — 5 Pillars', observation: 'Observation', evidence: 'Evidence',
    section_nrc: 'Needs / Resources / Challenges',
    nrc_needs: 'Needs', nrc_resources: 'Resources', nrc_challenges: 'Challenges',
    immediate_metaphor: 'Immediate Metaphor', developmental_metaphor: 'Developmental Metaphor',
    section_self_eval: 'Self-Evaluation', met: 'Met', not_met: 'Not met',
    continue_stop_start: 'Continue / Stop / Start', expand: 'Expand', collapse: 'Collapse',
    ctaHeader: 'Next Step',
    ctaContinue: 'Continue writing the next session', ctaUploadNew: 'Upload a new recording',
    ctaReReadFeedback: 'Re-read the assessor note',
    ctaBackToPackage: 'Back to the package page',
    ctaReviewPastSessions: 'Review your previous sessions',
    pendingHint: 'Expected review time: 5–7 days',
    loading: 'Loading...',
    notFound: "This file couldn't be found, or it belongs to another colleague.",
    notFoundCta: 'Back to list',
    emptyTitle: 'Begin your journey with this beneficiary',
    emptyBody: "No session reflections submitted yet. Write your first-session reflection in the beneficiary-file form — it will appear here the moment you save it, and will be made available to the assessor 48 hours before the next session.",
    emptyCta: 'Start Session 1',
  },
};

// ─── Small primitives ────────────────────────────────────────────────────────

function ROField({ label, value, isAr }: { label: string; value: string | null | undefined; isAr: boolean }) {
  const dir = isAr ? 'rtl' : 'ltr';
  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-[var(--color-neutral-500)] mb-1" dir={dir}>{label}</p>
      {value ? (
        <p className="text-sm text-[var(--text-primary)] bg-[var(--color-surface-dim)] rounded-lg px-3 py-2 whitespace-pre-wrap" dir={dir}>{value}</p>
      ) : (
        <p className="text-sm text-[var(--color-neutral-400)] italic" dir={dir}>—</p>
      )}
    </div>
  );
}

function SectionHeader({ label, isAr }: { label: string; isAr: boolean }) {
  return (
    <h3
      className="text-sm font-semibold text-[var(--color-primary)] mb-3 mt-5 border-b border-[var(--color-neutral-200)] pb-1"
      style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
    >{label}</h3>
  );
}

function VerdictBadge({ decision, l }: { decision: string; l: S }) {
  const config: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    pending:    { label: l.verdict_pending,   cls: 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] border-[var(--color-neutral-300)]', Icon: Clock },
    pass:       { label: l.verdict_pass,      cls: 'bg-green-50 text-green-700 border-green-300',    Icon: CheckCircle2 },
    fail:       { label: l.verdict_fail,      cls: 'bg-amber-50 text-amber-800 border-amber-300',    Icon: XCircle },
    escalated:  { label: l.verdict_escalated, cls: 'bg-orange-50 text-orange-700 border-orange-300', Icon: ArrowUpCircle },
  };
  const c = config[decision] ?? config.pending;
  const Icon = c.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${c.cls}`}>
      <Icon size={14} />{c.label}
    </span>
  );
}

// ─── Session subviews ────────────────────────────────────────────────────────

function AwarenessMapView({ map, l, isAr }: { map: AwarenessMap | null; l: S; isAr: boolean }) {
  if (!map) return <p className="text-sm text-[var(--color-neutral-400)] italic">{l.notYetSubmitted}</p>;
  const dir = isAr ? 'rtl' : 'ltr';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
      {AWARENESS_PILLARS.map((pillar) => {
        const cell = map[pillar];
        return (
          <div key={pillar} className="rounded-lg border border-[var(--color-neutral-200)] p-3" dir={dir}>
            <p className="text-xs font-semibold text-[var(--color-primary)] mb-2">{pillar}</p>
            <p className="text-xs text-[var(--color-neutral-500)] mb-0.5">{l.observation}</p>
            <p className="text-sm text-[var(--text-primary)] mb-2">{cell?.observation || '—'}</p>
            <p className="text-xs text-[var(--color-neutral-500)] mb-0.5">{l.evidence}</p>
            <p className="text-sm text-[var(--text-primary)]">{cell?.evidence || '—'}</p>
          </div>
        );
      })}
    </div>
  );
}

function NRCView({ items, l, isAr }: { items: NRCItem[] | null; l: S; isAr: boolean }) {
  if (!items || items.length === 0) return <p className="text-sm text-[var(--color-neutral-400)] italic">{l.notYetSubmitted}</p>;
  const dir = isAr ? 'rtl' : 'ltr';
  const label: Record<NRCItem['category'], string> = { needs: l.nrc_needs, resources: l.nrc_resources, challenges: l.nrc_challenges };
  const cls: Record<NRCItem['category'], string> = {
    needs: 'bg-blue-50 text-blue-700', resources: 'bg-green-50 text-green-700', challenges: 'bg-orange-50 text-orange-700',
  };
  return (
    <ul className="space-y-2 mt-2" dir={dir}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${cls[item.category]}`}>{label[item.category]}</span>
          <span className="text-[var(--text-primary)]">{item.item}</span>
        </li>
      ))}
    </ul>
  );
}

function SelfEvalView({ selfEval, l, isAr }: { selfEval: { items: SelfEvalItem[] } | null; l: S; isAr: boolean }) {
  if (!selfEval || selfEval.items.length === 0) return <p className="text-sm text-[var(--color-neutral-400)] italic">{l.notYetSubmitted}</p>;
  const dir = isAr ? 'rtl' : 'ltr';
  return (
    <ul className="divide-y divide-[var(--color-neutral-100)] mt-2" dir={dir}>
      {selfEval.items.map((item, i) => (
        <li key={i} className="py-2 flex items-start gap-3">
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${item.met ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {item.met ? l.met : l.not_met}
          </span>
          <div>
            <p className="text-sm text-[var(--text-primary)]">{item.criterion}</p>
            {item.note && <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">{item.note}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Session accordion (§2.4 default-expanded for submitted/reviewed) ────────

function SessionAccordion({
  session, sessionNumber, fileId, locale, l, isAr,
}: {
  session: SessionRow | undefined;
  sessionNumber: number; fileId: string; locale: string; l: S; isAr: boolean;
}) {
  const isShowable = session && (session.status === 'submitted' || session.status === 'reviewed');
  const [open, setOpen] = useState(!!isShowable);
  const dir = isAr ? 'rtl' : 'ltr';

  if (!session || session.status === 'draft') {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-neutral-300)] px-4 py-3 flex items-center justify-between" dir={dir}>
        <p className="text-sm text-[var(--color-neutral-500)] italic">
          {session ? l.draftContinue : `${l.sessionTitle(sessionNumber)} — ${l.notYetSubmitted}`}
        </p>
        {session && (
          <Link
            href={`/${locale}/dashboard/beneficiary-files/${fileId}/sessions/${sessionNumber}`}
            className="text-xs font-medium text-[var(--color-primary)] hover:underline"
          >{l.ctaContinue} →</Link>
        )}
      </div>
    );
  }

  const pre = session.pre_session_data;
  const submittedLabel = session.submitted_at
    ? new Date(session.submitted_at).toLocaleDateString(isAr ? 'ar-AE' : 'en-AE', { dateStyle: 'medium' })
    : null;

  return (
    <div className="rounded-lg border border-[var(--color-neutral-200)] overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--color-surface-dim)] hover:bg-[var(--color-neutral-100)] transition-colors text-left"
        dir={dir}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[var(--text-primary)]">{l.sessionTitle(sessionNumber)}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${session.status === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
            {session.status === 'reviewed' ? l.status_reviewed : l.status_in_progress}
          </span>
          {submittedLabel && <span className="text-xs text-[var(--color-neutral-400)]">{submittedLabel}</span>}
        </div>
        <span className="text-[var(--color-neutral-500)]" aria-label={open ? l.collapse : l.expand}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <SectionHeader label={l.section_pre} isAr={isAr} />
          <ROField label={l.client_goal}        value={pre?.client_goal}                isAr={isAr} />
          <ROField label={l.presenting_topic}   value={pre?.presenting_topic}           isAr={isAr} />
          <ROField label={l.prev_followup}      value={pre?.previous_session_follow_up} isAr={isAr} />
          <ROField label={l.somatic_hypothesis} value={pre?.somatic_hypothesis}         isAr={isAr} />
          {pre?.intended_tools && pre.intended_tools.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-[var(--color-neutral-500)] mb-1" dir={dir}>{l.intended_tools}</p>
              <div className="flex flex-wrap gap-2">
                {pre.intended_tools.map((tool, i) => (
                  <span key={i} className="text-xs bg-[var(--color-primary-light,#f0f4ff)] text-[var(--color-primary)] px-2 py-0.5 rounded-full">{tool}</span>
                ))}
              </div>
            </div>
          )}

          <SectionHeader label={l.section_post} isAr={isAr} />
          <ROField label={l.goal_client_words}     value={session.client_goal_in_client_words}     isAr={isAr} />
          <ROField label={l.learning_client_words} value={session.client_learning_in_client_words} isAr={isAr} />

          <SectionHeader label={l.section_awareness} isAr={isAr} />
          <AwarenessMapView map={session.awareness_map} l={l} isAr={isAr} />

          <SectionHeader label={l.section_nrc} isAr={isAr} />
          <NRCView items={session.needs_resources_challenges} l={l} isAr={isAr} />

          <SectionHeader label={l.immediate_metaphor} isAr={isAr} />
          <ROField label={l.immediate_metaphor}     value={session.immediate_metaphor}     isAr={isAr} />
          <ROField label={l.developmental_metaphor} value={session.developmental_metaphor} isAr={isAr} />

          <SectionHeader label={l.section_self_eval} isAr={isAr} />
          <SelfEvalView selfEval={session.self_evaluation} l={l} isAr={isAr} />

          <SectionHeader label={l.continue_stop_start} isAr={isAr} />
          <ROField label={l.continue_stop_start} value={session.continue_stop_start} isAr={isAr} />
        </div>
      )}
    </div>
  );
}

// ─── Rubric view — accept array-or-object shapes ─────────────────────────────

function RubricView({ scores, l, isAr }: { scores: unknown; l: S; isAr: boolean }) {
  let rows: RubricRow[] = [];
  if (Array.isArray(scores)) {
    rows = scores as RubricRow[];
  } else if (scores && typeof scores === 'object') {
    rows = Object.entries(scores as Record<string, unknown>).map(([k, v]) => {
      if (v && typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        return { criterion: k, score: obj.score as number | string | undefined, note: (obj.note as string | null | undefined) ?? null };
      }
      return { criterion: k, score: v as number | string, note: null };
    });
  }
  if (rows.length === 0) return null;
  const dir = isAr ? 'rtl' : 'ltr';
  return (
    <div className="mt-4" dir={dir}>
      <h4 className="text-xs font-semibold text-[var(--color-primary)] mb-2 flex items-center gap-1.5">
        <FileText size={14} />{l.rubricHeader}
      </h4>
      <div className="overflow-x-auto rounded-lg border border-[var(--color-neutral-200)]">
        <table className="w-full text-sm" style={{ direction: dir }}>
          <thead>
            <tr className="bg-[var(--color-surface-dim)] border-b border-[var(--color-neutral-200)]">
              <th className="px-3 py-2 text-xs font-semibold text-[var(--color-neutral-600)]" style={{ textAlign: isAr ? 'right' : 'left' }}>{l.rubricCriterion}</th>
              <th className="px-3 py-2 text-xs font-semibold text-[var(--color-neutral-600)]" style={{ textAlign: isAr ? 'right' : 'left' }}>{l.rubricScore}</th>
              <th className="px-3 py-2 text-xs font-semibold text-[var(--color-neutral-600)]" style={{ textAlign: isAr ? 'right' : 'left' }}>{l.rubricNote}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-neutral-100)]">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-[var(--text-primary)]">{r.criterion ?? '—'}</td>
                <td className="px-3 py-2 text-[var(--text-primary)] font-medium">{r.score ?? '—'}</td>
                <td className="px-3 py-2 text-[var(--color-neutral-500)]">{r.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Mentor feedback block (§2.3) — voice + verdict + note + rubric ──────────

function FeedbackBlock({
  assessment, voice, l, isAr,
}: {
  assessment: Assessment | null; voice: VoiceMessage | null; l: S; isAr: boolean;
}) {
  const dir = isAr ? 'rtl' : 'ltr';

  if (!assessment) {
    return (
      <Card className="p-5" dir={dir}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 w-9 h-9 rounded-full bg-[var(--color-neutral-100)] flex items-center justify-center">
            <Clock size={18} className="text-[var(--color-neutral-400)]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1">{l.verdictHeader}</h2>
            <p className="text-sm text-[var(--color-neutral-500)]">{l.noFeedback}</p>
          </div>
        </div>
      </Card>
    );
  }

  const assessorName = isAr ? assessment.assessor_name_ar : assessment.assessor_name_en;
  const decidedDate = assessment.decided_at
    ? new Date(assessment.decided_at).toLocaleDateString(isAr ? 'ar-AE' : 'en-AE', { dateStyle: 'long' })
    : null;

  return (
    <Card className="p-5" dir={dir}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-base font-semibold text-[var(--text-primary)] flex-1 min-w-0">{l.verdictHeader}</h2>
        <VerdictBadge decision={assessment.decision} l={l} />
      </div>

      {(decidedDate || assessorName) && (
        <div className="flex flex-wrap gap-4 mb-4 text-xs text-[var(--color-neutral-500)]">
          {decidedDate && <span><span className="font-medium">{l.decidedAt}:</span> {decidedDate}</span>}
          {assessorName && <span><span className="font-medium">{l.assessorLabel}:</span> {assessorName}</span>}
        </div>
      )}

      {assessment.decision === 'pending' && (
        <p className="text-sm text-[var(--color-neutral-500)] italic mb-3">{l.pendingExplain}</p>
      )}

      {assessment.ethics_auto_failed && (
        <div role="status" className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-4">
          <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">{l.ethicsGate}</p>
        </div>
      )}

      {assessment.decision === 'escalated' && (
        <p className="text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-4">{l.escalatedNote}</p>
      )}

      {assessment.has_override && assessment.override_reason && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-xs font-semibold text-blue-800 mb-1">{l.overrideNote}</p>
          <p className="text-sm text-blue-900 whitespace-pre-wrap">{assessment.override_reason}</p>
        </div>
      )}

      {voice && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-[var(--color-primary)] mb-2 flex items-center gap-1.5">
            <Mic size={14} />{l.voiceMessage}
          </h3>
          <audio
            controls preload="metadata"
            src={`/api/voice-messages/${voice.id}/stream`}
            className="w-full" aria-label={l.voiceMessage}
          />
          {typeof voice.duration_seconds === 'number' && (
            <p className="text-xs text-[var(--color-neutral-400)] mt-1">{l.voiceDuration(voice.duration_seconds)}</p>
          )}
        </div>
      )}

      {assessment.decision_note && (
        <div className="mb-2">
          <h3 className="text-xs font-semibold text-[var(--color-primary)] mb-2">{l.decisionNote}</h3>
          <p
            className="text-sm text-[var(--text-primary)] bg-[var(--color-surface-dim)] rounded-lg px-4 py-3 whitespace-pre-wrap leading-relaxed"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}
          >{assessment.decision_note}</p>
        </div>
      )}

      <RubricView scores={assessment.rubric_scores} l={l} isAr={isAr} />

      {assessment.recording_id && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-[var(--color-primary)] mb-2">{l.myRecording}</h3>
          <audio
            controls preload="metadata"
            src={`/api/recordings/${assessment.recording_id}/stream`}
            className="w-full" aria-label={l.listenToMine}
          />
        </div>
      )}
    </Card>
  );
}

// ─── Primary CTA (§7) ────────────────────────────────────────────────────────

function PrimaryCTA({
  data, locale, l, isAr,
}: {
  data: ApprenticeViewResponse; locale: string; l: S; isAr: boolean;
}) {
  const dir = isAr ? 'rtl' : 'ltr';
  const { file, sessions, assessment } = data;

  let primaryHref: string | null = null;
  let primaryLabel = '';
  let secondaryLabel: string | null = null;
  let secondaryHref: string | null = null;

  const nextSession = [...sessions]
    .sort((a, b) => a.session_number - b.session_number)
    .find((s) => s.status !== 'submitted' && s.status !== 'reviewed');

  if (assessment?.decision === 'fail') {
    primaryHref = `/${locale}/dashboard/packages/${file.package_instance_id}/recordings`;
    primaryLabel = l.ctaUploadNew;
    secondaryLabel = l.ctaReReadFeedback; secondaryHref = '#feedback';
  } else if (assessment?.decision === 'pass') {
    primaryHref = `/${locale}/dashboard/packages/${file.package_instance_id}`;
    primaryLabel = l.ctaBackToPackage;
  } else if (assessment?.decision === 'escalated') {
    secondaryLabel = l.ctaReviewPastSessions; secondaryHref = '#sessions';
  } else if (nextSession) {
    primaryHref = `/${locale}/dashboard/beneficiary-files/${file.id}/sessions/${nextSession.session_number}`;
    primaryLabel = l.ctaContinue;
  } else {
    secondaryLabel = l.ctaReviewPastSessions; secondaryHref = '#sessions';
  }

  return (
    <Card className="p-5 mt-6 bg-gradient-to-br from-[var(--color-primary-50,#f0f4ff)] to-transparent" dir={dir}>
      <h2 className="text-sm font-semibold text-[var(--color-primary)] mb-3">{l.ctaHeader}</h2>
      <div className="flex flex-wrap gap-3">
        {primaryHref && (
          <Link href={primaryHref}>
            <Button variant="primary" size="md">{primaryLabel}</Button>
          </Link>
        )}
        {secondaryLabel && secondaryHref && (
          <a href={secondaryHref}>
            <Button variant="ghost" size="md">{secondaryLabel}</Button>
          </a>
        )}
      </div>
      {(!assessment || assessment.decision === 'pending') && (
        <p className="text-xs text-[var(--color-neutral-500)] mt-3">{l.pendingHint}</p>
      )}
    </Card>
  );
}

// ─── File status pill — synthesised from session + assessment state ──────────

function FileStatusPill({ sessions, assessment, l }: { sessions: SessionRow[]; assessment: Assessment | null; l: S }) {
  const submittedCount = sessions.filter((s) => s.status === 'submitted' || s.status === 'reviewed').length;
  let label = l.status_draft;
  let cls = 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]';
  if (assessment?.decision === 'pass' || assessment?.decision === 'fail') {
    label = l.status_reviewed; cls = 'bg-green-100 text-green-700';
  } else if (submittedCount === 3) {
    label = l.status_complete; cls = 'bg-blue-100 text-blue-700';
  } else if (submittedCount > 0) {
    label = l.status_in_progress; cls = 'bg-amber-100 text-amber-700';
  }
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ApprenticeBeneficiaryFilePage({
  params,
}: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = use(params);
  const isAr = locale === 'ar';
  const dir  = isAr ? 'rtl' : 'ltr';
  const l    = isAr ? STR.ar : STR.en;

  const { user } = useAuth();

  const [loading,  setLoading]  = useState(true);
  const [data,     setData]     = useState<ApprenticeViewResponse | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/beneficiary-files/${id}/apprentice-view`);
    if (!res.ok) { setNotFound(true); setLoading(false); return; }
    setData(await res.json()); setLoading(false);
  }, [id]);

  useEffect(() => { if (user) void load(); }, [user, load]);

  if (loading) {
    return (
      <Section>
        <div dir={dir}>
          <Card className="py-16 flex items-center justify-center">
            <p className="text-sm text-[var(--color-neutral-400)]">{l.loading}</p>
          </Card>
        </div>
      </Section>
    );
  }

  if (notFound || !data) {
    return (
      <Section>
        <div dir={dir}>
          <Card className="py-16 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--color-neutral-100)] flex items-center justify-center">
              <AlertCircle size={24} className="text-[var(--color-neutral-400)]" />
            </div>
            <p className="text-sm text-[var(--color-neutral-500)] max-w-sm">{l.notFound}</p>
            <Link href={`/${locale}/dashboard/beneficiary-files`}>
              <Button variant="primary" size="md">{l.notFoundCta}</Button>
            </Link>
          </Card>
        </div>
      </Section>
    );
  }

  const { file, sessions, assessment, voice_message } = data;
  const hasAnySubmitted = sessions.some((s) => s.status === 'submitted' || s.status === 'reviewed');

  return (
    <Section>
      <div dir={dir}>
      <div className="mb-4">
        <Link
          href={`/${locale}/dashboard/beneficiary-files`}
          className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)] inline-flex items-center gap-1"
        >← {l.back}</Link>
      </div>

      {/* §2.1 File header */}
      <div className="mb-6" dir={dir}>
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1
            className="text-xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >{l.fileTitle(file.client_alias)}</h1>
          <FileStatusPill sessions={sessions} assessment={assessment} l={l} />
        </div>
        <p className="text-sm text-[var(--color-neutral-500)]">
          {l.packageLabel}: {isAr ? file.package_name_ar : file.package_name_en}
          {file.first_session_date && (
            <> · {l.firstSessionDate}: {new Date(file.first_session_date).toLocaleDateString(isAr ? 'ar-AE' : 'en-AE', { dateStyle: 'medium' })}</>
          )}
        </p>
      </div>

      {/* §6.1 empty state — brand-new file, nothing submitted yet */}
      {!hasAnySubmitted && !assessment ? (
        <Card className="p-8 text-center" dir={dir}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-50,#f0f4ff)] flex items-center justify-center">
              <FileText size={24} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">{l.emptyTitle}</h2>
              <p className="text-sm text-[var(--color-neutral-500)] max-w-md mx-auto">{l.emptyBody}</p>
            </div>
            <Link href={`/${locale}/dashboard/beneficiary-files/${file.id}/sessions/1`}>
              <Button variant="primary" size="md">{l.emptyCta}</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* §2.2 + §2.3 feedback block at top */}
          <div id="feedback" className="mb-6">
            <FeedbackBlock assessment={assessment} voice={voice_message} l={l} isAr={isAr} />
          </div>

          {/* §2.4 sessions 1→3 */}
          <div id="sessions" className="mb-6" dir={dir}>
            <h2
              className="text-base font-semibold text-[var(--text-primary)] mb-3"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >{l.sessionsHeader}</h2>
            <div className="space-y-3">
              {([1, 2, 3] as const).map((n) => (
                <SessionAccordion
                  key={n}
                  session={sessions.find((s) => s.session_number === n)}
                  sessionNumber={n}
                  fileId={file.id}
                  locale={locale}
                  l={l} isAr={isAr}
                />
              ))}
            </div>
          </div>

          {/* §7 primary CTA */}
          <PrimaryCTA data={data} locale={locale} l={l} isAr={isAr} />
        </>
      )}
      </div>
    </Section>
  );
}
