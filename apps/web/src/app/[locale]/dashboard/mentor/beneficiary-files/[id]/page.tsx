'use client';

/**
 * Mentor Beneficiary File View (read-only)
 *
 * Assigned mentor's view of a student's Beneficiary File.
 * Shows all 3 sessions as collapsible accordions.
 * If two clients exist for the same package_instance, renders them
 * side-by-side (per SPEC §6.2).
 *
 * Access is gated by the 48-hour rule (SPEC §6.2):
 *   - If the API returns 403 with locked_until, renders a countdown.
 *   - If 200, renders the full file.
 *
 * Route: /[locale]/dashboard/mentor/beneficiary-files/[id]
 * The [id] is the beneficiary_file id for client 1; the sibling file
 * (client 2) is resolved server-side by the mentor-view endpoint and
 * passed via ?sibling_id= query param.
 *
 * Source: SPEC-mentoring-package-template.md §6.2
 * Sub-phase: S2-Layer-1 / 1.6
 *
 * Bilingual: AR (RTL) + EN. Inline i18n (no separate messages file —
 * matches the pattern in the student session form for this sub-phase).
 * Component library: @kunacademy/ui (Card, Section, Button)
 * Auth: useAuth() from @kunacademy/auth
 */

import { use, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { Button } from '@kunacademy/ui/button';
import { ChevronDown, ChevronUp, Lock, Clock } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface NRCItem {
  category: 'needs' | 'resources' | 'challenges';
  item:     string;
}

interface SelfEvalItem {
  criterion: string;
  met:       boolean;
  note:      string | null;
}

interface PreSessionData {
  client_goal?:                string;
  presenting_topic?:           string;
  previous_session_follow_up?: string;
  somatic_hypothesis?:         string;
  intended_tools?:             string[];
}

interface SessionRow {
  id:                              string;
  session_number:                  number;
  status:                          'draft' | 'submitted' | 'reviewed';
  pre_session_data:                PreSessionData | null;
  client_goal_in_client_words:     string | null;
  client_learning_in_client_words: string | null;
  awareness_map:                   AwarenessMap | null;
  needs_resources_challenges:      NRCItem[] | null;
  immediate_metaphor:              string | null;
  developmental_metaphor:          string | null;
  self_evaluation:                 { items: SelfEvalItem[] } | null;
  continue_stop_start:             string | null;
  submitted_at:                    string | null;
  reviewed_at:                     string | null;
}

interface FilePayload {
  id:                  string;
  package_instance_id: string;
  client_number:       number;
  client_alias:        string | null;
  first_session_date:  string | null;
  package_name_ar:     string;
  package_name_en:     string;
}

interface MentorViewResponse {
  file:     FilePayload;
  sessions: SessionRow[];
}

interface LockedResponse {
  error:        string;
  locked_until: string; // ISO
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const AWARENESS_PILLARS = ['حكيمة', 'حركات', 'تحكم', 'الشخصية', 'الأنا'] as const;
type AwarenessPillar = typeof AWARENESS_PILLARS[number];

const t = {
  ar: {
    pageTitle:             (alias: string | null) => `ملف المستفيد — ${alias ?? 'عميل'}`,
    packageLabel:          'الحزمة',
    clientLabel:           'العميل',
    clientAlias:           (alias: string | null) => alias ?? '(بدون اسم مستعار)',
    firstSessionDate:      'تاريخ الجلسة الأولى',
    sessionTitle:          (n: number) => `الجلسة ${n}`,
    notYetSubmitted:       'لم يُقدَّم بعد',
    status_draft:          'مسودة',
    status_submitted:      'مقدَّمة',
    status_reviewed:       'تمت المراجعة',
    section_pre:           'التحضير قبل الجلسة',
    client_goal:           'هدف العميل',
    presenting_topic:      'الموضوع المطروح',
    prev_followup:         'متابعة الجلسة السابقة',
    somatic_hypothesis:    'الفرضية الحسية',
    intended_tools:        'الأدوات المخططة',
    section_post:          'التأمل بعد الجلسة',
    goal_client_words:     'هدف العميل بكلماته',
    learning_client_words: 'تعلّم العميل بكلماته',
    section_awareness:     'خريطة الوعي — الأعمدة الخمسة',
    observation:           'ملاحظة',
    evidence:              'دليل',
    section_nrc:           'الاحتياجات / الموارد / التحديات',
    immediate_metaphor:    'الاستعارة الآنية',
    developmental_metaphor:'الاستعارة التطورية',
    section_self_eval:     'التقييم الذاتي',
    criterion:             'المعيار',
    met:                   'محقَّق',
    not_met:               'غير محقَّق',
    note:                  'ملاحظة',
    continue_stop_start:   'استمر / أوقف / ابدأ',
    locked_title:          'المواد غير متاحة بعد',
    locked_body:           'ستُتاح مواد التحضير قبل 48 ساعة من موعد الجلسة.',
    locked_until:          'تُفتح في:',
    loading:               'جاري التحميل...',
    error_load:            'تعذّر تحميل ملف المستفيد.',
    back:                  'رجوع',
    client_1:              'العميل الأول',
    client_2:              'العميل الثاني',
    nrc_needs:             'احتياجات',
    nrc_resources:         'موارد',
    nrc_challenges:        'تحديات',
    expand:                'توسيع',
    collapse:              'طي',
  },
  en: {
    pageTitle:             (alias: string | null) => `Beneficiary File — ${alias ?? 'Client'}`,
    packageLabel:          'Package',
    clientLabel:           'Client',
    clientAlias:           (alias: string | null) => alias ?? '(No alias provided)',
    firstSessionDate:      'First Session Date',
    sessionTitle:          (n: number) => `Session ${n}`,
    notYetSubmitted:       'Not yet submitted',
    status_draft:          'Draft',
    status_submitted:      'Submitted',
    status_reviewed:       'Reviewed',
    section_pre:           'Pre-Session Prep',
    client_goal:           "Client's Goal",
    presenting_topic:      'Presenting Topic',
    prev_followup:         'Previous Session Follow-up',
    somatic_hypothesis:    'Somatic Hypothesis',
    intended_tools:        'Planned Tools',
    section_post:          'Post-Session Reflection',
    goal_client_words:     "Client's Goal in Their Words",
    learning_client_words: "Client's Learning in Their Words",
    section_awareness:     'Awareness Map — 5 Pillars',
    observation:           'Observation',
    evidence:              'Evidence',
    section_nrc:           'Needs / Resources / Challenges',
    immediate_metaphor:    'Immediate Metaphor',
    developmental_metaphor:'Developmental Metaphor',
    section_self_eval:     'Self-Evaluation',
    criterion:             'Criterion',
    met:                   'Met',
    not_met:               'Not met',
    note:                  'Note',
    continue_stop_start:   'Continue / Stop / Start',
    locked_title:          'Materials Not Yet Available',
    locked_body:           'Prep materials become available 48 hours before the session.',
    locked_until:          'Unlocks at:',
    loading:               'Loading...',
    error_load:            'Failed to load beneficiary file.',
    back:                  'Back',
    client_1:              'Client 1',
    client_2:              'Client 2',
    nrc_needs:             'Needs',
    nrc_resources:         'Resources',
    nrc_challenges:        'Challenges',
    expand:                'Expand',
    collapse:              'Collapse',
  },
} as const;

// Use a wider interface so both t.ar and t.en satisfy it without literal-type conflicts.
interface Strings {
  pageTitle:             (alias: string | null) => string;
  packageLabel:          string;
  clientLabel:           string;
  clientAlias:           (alias: string | null) => string;
  firstSessionDate:      string;
  sessionTitle:          (n: number) => string;
  notYetSubmitted:       string;
  status_draft:          string;
  status_submitted:      string;
  status_reviewed:       string;
  section_pre:           string;
  client_goal:           string;
  presenting_topic:      string;
  prev_followup:         string;
  somatic_hypothesis:    string;
  intended_tools:        string;
  section_post:          string;
  goal_client_words:     string;
  learning_client_words: string;
  section_awareness:     string;
  observation:           string;
  evidence:              string;
  section_nrc:           string;
  immediate_metaphor:    string;
  developmental_metaphor:string;
  section_self_eval:     string;
  criterion:             string;
  met:                   string;
  not_met:               string;
  note:                  string;
  continue_stop_start:   string;
  locked_title:          string;
  locked_body:           string;
  locked_until:          string;
  loading:               string;
  error_load:            string;
  back:                  string;
  client_1:              string;
  client_2:              string;
  nrc_needs:             string;
  nrc_resources:         string;
  nrc_challenges:        string;
  expand:                string;
  collapse:              string;
}

// ─── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(targetIso: string | null): string {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!targetIso) return;
    const target = Date.parse(targetIso);

    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) { setDisplay('00:00:00'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setDisplay(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [targetIso]);

  return display;
}

// ─── Read-only field components ────────────────────────────────────────────────

function ROField({ label, value, isAr }: { label: string; value: string | null | undefined; isAr: boolean }) {
  const dir = isAr ? 'rtl' : 'ltr';
  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-[var(--color-neutral-500)] mb-1" dir={dir}>
        {label}
      </p>
      {value ? (
        <p className="text-sm text-[var(--text-primary)] bg-[var(--color-surface-dim)] rounded-lg px-3 py-2 whitespace-pre-wrap" dir={dir}>
          {value}
        </p>
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
    >
      {label}
    </h3>
  );
}

function StatusBadge({ status, l }: { status: string; l: Strings }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:     { label: l.status_draft,     cls: 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]' },
    submitted: { label: l.status_submitted, cls: 'bg-blue-100 text-blue-700' },
    reviewed:  { label: l.status_reviewed,  cls: 'bg-green-100 text-green-700' },
  };
  const { label, cls } = map[status] ?? map.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Awareness Map (read-only) ─────────────────────────────────────────────────

function AwarenessMapView({ map, l, isAr }: { map: AwarenessMap | null; l: Strings; isAr: boolean }) {
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

// ─── NRC Table (read-only) ─────────────────────────────────────────────────────

function NRCView({ items, l, isAr }: { items: NRCItem[] | null; l: Strings; isAr: boolean }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-[var(--color-neutral-400)] italic">{l.notYetSubmitted}</p>;
  }
  const dir = isAr ? 'rtl' : 'ltr';
  const catLabel: Record<NRCItem['category'], string> = {
    needs:      l.nrc_needs,
    resources:  l.nrc_resources,
    challenges: l.nrc_challenges,
  };
  const catCls: Record<NRCItem['category'], string> = {
    needs:      'bg-blue-50 text-blue-700',
    resources:  'bg-green-50 text-green-700',
    challenges: 'bg-orange-50 text-orange-700',
  };

  return (
    <ul className="space-y-2 mt-2" dir={dir}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${catCls[item.category]}`}>
            {catLabel[item.category]}
          </span>
          <span className="text-[var(--text-primary)]">{item.item}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Self-evaluation (read-only) ───────────────────────────────────────────────

function SelfEvalView({ eval_: selfEval, l, isAr }: { eval_: { items: SelfEvalItem[] } | null; l: Strings; isAr: boolean }) {
  if (!selfEval || selfEval.items.length === 0) {
    return <p className="text-sm text-[var(--color-neutral-400)] italic">{l.notYetSubmitted}</p>;
  }
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
            {item.note && (
              <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">{item.note}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Single session accordion ──────────────────────────────────────────────────

function SessionAccordion({ session, l, isAr }: { session: SessionRow | undefined; sessionNumber: number; l: Strings; isAr: boolean }) {
  const [open, setOpen] = useState(session?.status === 'submitted' || session?.status === 'reviewed');
  const dir = isAr ? 'rtl' : 'ltr';

  if (!session || session.status === 'draft') {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-neutral-300)] px-4 py-3">
        <p className="text-sm text-[var(--color-neutral-400)] italic" dir={dir}>
          {l.notYetSubmitted}
        </p>
      </div>
    );
  }

  const pre = session.pre_session_data;

  return (
    <div className="rounded-lg border border-[var(--color-neutral-200)] overflow-hidden">
      {/* Accordion header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--color-surface-dim)] hover:bg-[var(--color-neutral-100)] transition-colors text-left"
        dir={dir}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={session.status} l={l} />
          {session.submitted_at && (
            <span className="text-xs text-[var(--color-neutral-400)]">
              {new Date(session.submitted_at).toLocaleDateString(isAr ? 'ar-AE' : 'en-AE', { dateStyle: 'medium' })}
            </span>
          )}
        </div>
        <span className="text-[var(--color-neutral-500)]" aria-label={open ? l.collapse : l.expand}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* Pre-session */}
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
                  <span key={i} className="text-xs bg-[var(--color-primary-light,#f0f4ff)] text-[var(--color-primary)] px-2 py-0.5 rounded-full">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Post-session */}
          <SectionHeader label={l.section_post} isAr={isAr} />
          <ROField label={l.goal_client_words}     value={session.client_goal_in_client_words}     isAr={isAr} />
          <ROField label={l.learning_client_words} value={session.client_learning_in_client_words} isAr={isAr} />

          {/* Awareness Map */}
          <SectionHeader label={l.section_awareness} isAr={isAr} />
          <AwarenessMapView map={session.awareness_map} l={l} isAr={isAr} />

          {/* NRC */}
          <SectionHeader label={l.section_nrc} isAr={isAr} />
          <NRCView items={session.needs_resources_challenges} l={l} isAr={isAr} />

          {/* Metaphors */}
          <SectionHeader label={l.immediate_metaphor} isAr={isAr} />
          <ROField label={l.immediate_metaphor}     value={session.immediate_metaphor}     isAr={isAr} />
          <ROField label={l.developmental_metaphor} value={session.developmental_metaphor} isAr={isAr} />

          {/* Self-eval */}
          <SectionHeader label={l.section_self_eval} isAr={isAr} />
          <SelfEvalView eval_={session.self_evaluation} l={l} isAr={isAr} />

          {/* Continue / Stop / Start */}
          <SectionHeader label={l.continue_stop_start} isAr={isAr} />
          <ROField label={l.continue_stop_start} value={session.continue_stop_start} isAr={isAr} />
        </div>
      )}
    </div>
  );
}

// ─── Single client column ──────────────────────────────────────────────────────

function ClientColumn({
  file,
  sessions,
  l,
  isAr,
}: {
  file:     FilePayload;
  sessions: SessionRow[];
  l:        Strings;
  isAr:     boolean;
}) {
  const dir = isAr ? 'rtl' : 'ltr';

  return (
    <div className="flex-1 min-w-0" dir={dir}>
      {/* Client header */}
      <div className="mb-4 p-3 rounded-lg bg-[var(--color-surface-dim)] border border-[var(--color-neutral-200)]">
        <p className="text-xs text-[var(--color-neutral-500)]">{l.clientLabel}</p>
        <p className="text-base font-semibold text-[var(--text-primary)]">
          {l.clientAlias(file.client_alias)}
        </p>
        {file.first_session_date && (
          <p className="text-xs text-[var(--color-neutral-400)] mt-1">
            {l.firstSessionDate}: {file.first_session_date}
          </p>
        )}
      </div>

      {/* Sessions 1–3 */}
      <div className="space-y-3">
        {([1, 2, 3] as const).map((n) => {
          const session = sessions.find((s) => s.session_number === n);
          return (
            <div key={n}>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
                {l.sessionTitle(n)}
              </p>
              <SessionAccordion
                session={session}
                sessionNumber={n}
                l={l}
                isAr={isAr}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Locked state ─────────────────────────────────────────────────────────────

function LockedState({
  lockedUntil,
  l,
  isAr,
}: {
  lockedUntil: string;
  l:           Strings;
  isAr:        boolean;
}) {
  const countdown = useCountdown(lockedUntil);
  const dir = isAr ? 'rtl' : 'ltr';

  return (
    <Card className="flex flex-col items-center justify-center py-16 text-center gap-4" dir={dir}>
      <div className="w-14 h-14 rounded-full bg-[var(--color-neutral-100)] flex items-center justify-center">
        <Lock size={24} className="text-[var(--color-neutral-400)]" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{l.locked_title}</h2>
      <p className="text-sm text-[var(--color-neutral-500)] max-w-xs">{l.locked_body}</p>
      <div className="flex items-center gap-2 text-[var(--color-primary)]">
        <Clock size={16} />
        <span className="text-sm font-medium">{l.locked_until}</span>
        <span className="text-lg font-mono font-semibold tabular-nums">{countdown}</span>
      </div>
    </Card>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function MentorBeneficiaryFilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = use(params);
  const isAr = locale === 'ar';
  const dir  = isAr ? 'rtl' : 'ltr';
  const l    = isAr ? t.ar : t.en;

  const { user } = useAuth();

  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);

  // Primary file (client_number = this [id])
  const [primaryFile,     setPrimaryFile]     = useState<FilePayload | null>(null);
  const [primarySessions, setPrimarySessions] = useState<SessionRow[]>([]);

  // Sibling file (client_number = other client, loaded via ?sibling_id=)
  const [siblingFile,     setSiblingFile]     = useState<FilePayload | null>(null);
  const [siblingSessions, setSiblingSessions] = useState<SessionRow[]>([]);

  // Read optional sibling_id + next_session_at from search params
  // (In a real render the page URL would carry these; we read from window.location)
  const [siblingId,      setSiblingId]      = useState<string | null>(null);
  const [nextSessionAt,  setNextSessionAt]  = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      setSiblingId(sp.get('sibling_id'));
      setNextSessionAt(sp.get('next_session_at'));
    }
  }, []);

  const fetchFile = useCallback(async (fileId: string, nsa: string | null): Promise<{ file: FilePayload; sessions: SessionRow[] } | { lockedUntil: string } | null> => {
    const url = `/api/beneficiary-files/${fileId}/mentor-view${nsa ? `?next_session_at=${encodeURIComponent(nsa)}` : ''}`;
    const res = await fetch(url);

    if (res.status === 403) {
      const body: LockedResponse = await res.json();
      if (body.locked_until) return { lockedUntil: body.locked_until };
      return null;
    }
    if (!res.ok) return null;

    const data: MentorViewResponse = await res.json();
    return { file: data.file, sessions: data.sessions };
  }, []);

  useEffect(() => {
    if (!user) return;
    // Wait until search params are parsed
    if (typeof siblingId === 'undefined') return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // Primary file
      const primary = await fetchFile(id, nextSessionAt);
      if (cancelled) return;

      if (!primary) {
        setError(l.error_load);
        setLoading(false);
        return;
      }

      if ('lockedUntil' in primary) {
        setLockedUntil(primary.lockedUntil);
        setLoading(false);
        return;
      }

      setPrimaryFile(primary.file);
      setPrimarySessions(primary.sessions);

      // Sibling file (if provided)
      if (siblingId) {
        const sibling = await fetchFile(siblingId, nextSessionAt);
        if (cancelled) return;

        if (sibling && !('lockedUntil' in sibling)) {
          setSiblingFile(sibling.file);
          setSiblingSessions(sibling.sessions);
        }
      }

      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, [user, id, siblingId, nextSessionAt, fetchFile, l.error_load]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Section>
      {/* Back nav */}
      <div className="mb-4" dir={dir}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => history.back()}
          className="text-[var(--color-neutral-500)]"
        >
          {l.back}
        </Button>
      </div>

      {loading && (
        <Card className="py-16 flex items-center justify-center">
          <p className="text-sm text-[var(--color-neutral-400)]">{l.loading}</p>
        </Card>
      )}

      {!loading && error && (
        <Card className="py-12 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {!loading && lockedUntil && (
        <LockedState lockedUntil={lockedUntil} l={l} isAr={isAr} />
      )}

      {!loading && !error && !lockedUntil && primaryFile && (
        <>
          {/* Page header */}
          <div className="mb-6" dir={dir}>
            <h1
              className="text-xl font-bold text-[var(--text-primary)] mb-1"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {l.pageTitle(primaryFile.client_alias)}
            </h1>
            <p className="text-sm text-[var(--color-neutral-500)]">
              {l.packageLabel}: {isAr ? primaryFile.package_name_ar : primaryFile.package_name_en}
            </p>
          </div>

          {/* Side-by-side or single column */}
          {siblingFile ? (
            <div className="flex flex-col md:flex-row gap-6">
              {/* Client 1 — put lower client_number first */}
              {[
                { file: primaryFile,  sessions: primarySessions,  label: l.client_1 },
                { file: siblingFile,  sessions: siblingSessions,   label: l.client_2 },
              ]
                .sort((a, b) => a.file.client_number - b.file.client_number)
                .map(({ file, sessions, label }) => (
                  <div key={file.id} className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3" dir={dir}>
                      {label}
                    </p>
                    <ClientColumn file={file} sessions={sessions} l={l} isAr={isAr} />
                  </div>
                ))}
            </div>
          ) : (
            <ClientColumn file={primaryFile} sessions={primarySessions} l={l} isAr={isAr} />
          )}
        </>
      )}
    </Section>
  );
}
