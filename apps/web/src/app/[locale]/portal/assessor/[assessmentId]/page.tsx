'use client';

/**
 * Assessor Workspace — /portal/assessor/[assessmentId]
 *
 * Two-pane layout:
 *   LEFT (40%)  — Audio player + transcript viewer
 *   RIGHT (60%) — Rubric form (Part 0 → Part 4 scaffold)
 *
 * Per SPEC-somatic-thinking-rubric-v1.md §5:
 *   - Audio: play/pause/seek, speed selector, keyboard shortcuts, timestamp display
 *   - Transcript: scrollable, click-to-seek (if entries have timestamps)
 *   - Rubric form: section-by-section, progress indicator, evidence field auto-focus
 *   - Auto-save note: draft persistence deferred to Phase 2.5
 *   - Voice message: deferred to Phase 2.6 (fail path only)
 *   - Submit action: deferred to Phase 2.7 (state-machine wiring)
 *
 * Sub-phase: S2-Layer-1 / 2.1 — Assessor Workspace UI
 */

import { useAuth } from '@kunacademy/auth';
import { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Section } from '@kunacademy/ui/section';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssessmentDetail {
  assessment_id: string;
  recording_id: string;
  package_instance_id: string;
  assessor_id: string;
  decision: string;
  decision_note: string | null;
  decided_at: string | null;
  assigned_at: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  duration_seconds: number | null;
  recording_status: string;
  submitted_at: string;
  student_name_en: string | null;
  student_name_ar: string | null;
  student_email: string;
}

// ─── Rubric structure (per SPEC §3) ──────────────────────────────────────────
// Rendered as a local constant for Phase 2.1; Phase 2.3 will drive this from
// the rubric_templates table fetched at runtime.

const RUBRIC_SECTIONS = [
  {
    id: 'part-0',
    labelAr: 'بيانات الجلسة',
    labelEn: 'Session Metadata',
    type: 'metadata',
  },
  {
    id: 'part-1-1',
    labelAr: 'سؤال الربط + الاتفاقية',
    labelEn: 'Connecting Question + Coaching Agreement',
    type: 'observations',
    items: [
      { id: 1,  labelAr: 'سؤال الربط',                              labelEn: 'Connecting question' },
      { id: 2,  labelAr: 'الاتفاقية: الكوتشينج',                    labelEn: 'Agreement: Coaching' },
      { id: 3,  labelAr: 'الاتفاقية: الهدف',                        labelEn: 'Agreement: Goal' },
      { id: 4,  labelAr: 'الاتفاقية: الأهمية',                      labelEn: 'Agreement: Importance' },
      { id: 5,  labelAr: 'الاتفاقية: علامات الحركة',                labelEn: 'Agreement: Signs of movement' },
      { id: 6,  labelAr: 'الاتفاقية: تحديد الاحتياج',              labelEn: 'Agreement: Identifying need' },
    ],
  },
  {
    id: 'part-1-2',
    labelAr: 'منطقة الفضول',
    labelEn: 'Curiosity Zone',
    type: 'observations',
    items: [
      { id: 7,  labelAr: 'أسئلة الفضول',                            labelEn: 'Curiosity questions' },
      { id: 8,  labelAr: 'الاستجابات اللفظية المبنية على الملاحظة', labelEn: 'Verbal responses built on observation' },
      { id: 9,  labelAr: 'الاستجابات غير اللفظية',                  labelEn: 'Non-verbal responses' },
    ],
  },
  {
    id: 'part-1-3',
    labelAr: 'التدريب الحسجسدي (اختياري)',
    labelEn: 'Somatic Training (conditional)',
    type: 'observations',
    conditional: true,
    items: [
      { id: 10, labelAr: 'المحفز',       labelEn: 'The trigger' },
      { id: 11, labelAr: 'الملاحظات',    labelEn: 'Observations' },
      { id: 12, labelAr: 'المعنى',       labelEn: 'The meaning' },
      { id: 13, labelAr: 'الربط بالهدف', labelEn: 'Connection to the goal' },
    ],
  },
  {
    id: 'part-1-4',
    labelAr: 'التشبيه الآني (اختياري)',
    labelEn: 'Immediate Metaphor (conditional)',
    type: 'observations',
    conditional: true,
    items: [
      { id: 14, labelAr: 'الاسم والوصف', labelEn: 'Name and description' },
      { id: 15, labelAr: 'التسكين',      labelEn: 'Settling' },
      { id: 16, labelAr: 'الإيجابيات',   labelEn: 'Positives' },
      { id: 17, labelAr: 'السلبيات',     labelEn: 'Negatives' },
    ],
  },
  {
    id: 'part-1-5',
    labelAr: 'التشبيه التنموي (اختياري)',
    labelEn: 'Developmental Metaphor (conditional)',
    type: 'observations',
    conditional: true,
    items: [
      { id: 18, labelAr: 'الاسم والوصف', labelEn: 'Name and description' },
      { id: 19, labelAr: 'التسكين',      labelEn: 'Settling' },
      { id: 20, labelAr: 'الإيجابيات',   labelEn: 'Positives' },
      { id: 21, labelAr: 'السلبيات',     labelEn: 'Negatives' },
    ],
  },
  {
    id: 'part-1-6',
    labelAr: 'التعلمات',
    labelEn: 'Learnings',
    type: 'observations',
    items: [
      { id: 22, labelAr: 'التعلم عن النفس',  labelEn: 'Learning about self' },
      { id: 23, labelAr: 'التعلم عن الهدف', labelEn: 'Learning about the goal' },
    ],
  },
  {
    id: 'part-1-8',
    labelAr: 'إنهاء الجلسة',
    labelEn: 'Closing the Session',
    type: 'observations',
    items: [
      { id: 24, labelAr: 'مراجعة النجاح مع المستفيد', labelEn: 'Reviewing success with the client' },
      { id: 25, labelAr: 'إنهاء الجلسة',               labelEn: 'Session ending' },
    ],
  },
  {
    id: 'part-2',
    labelAr: 'الأنماط السلوكية',
    labelEn: 'Behavioral Patterns',
    type: 'observations',
    items: [
      { id: 26, labelAr: 'مراجعة حركة الجلسة',                       labelEn: 'Session movement review' },
      { id: 27, labelAr: 'الحضور',                                    labelEn: 'Presence' },
      { id: 28, labelAr: 'مساحات الصمت والاستماع',                    labelEn: 'Silence and listening spaces' },
      { id: 29, labelAr: 'إيقاع الكوتش',                             labelEn: "Coach's rhythm" },
      { id: 30, labelAr: 'نسبة كلام الكوتش (٢٥٪–٣٠٪)',               labelEn: 'Coach speech ratio (25–30%)' },
      { id: 31, labelAr: 'استخدام اللغة النظيفة',                     labelEn: 'Use of clean language' },
      { id: 32, labelAr: 'أريحية الكوتش',                            labelEn: "Coach's ease" },
      { id: 33, labelAr: 'انعدام التوجيه',                           labelEn: 'Absence of directing' },
      { id: 34, labelAr: 'فضول تجاه الإنسان أكبر من الهدف',           labelEn: 'Curiosity toward person > goal' },
      { id: 35, labelAr: 'استخدام أسئلة مفتوحة بسيطة',               labelEn: 'Simple open questions' },
      { id: 36, labelAr: 'التقدير المسبّب',                          labelEn: 'Earned appreciation' },
    ],
  },
  {
    id: 'part-ethics',
    labelAr: 'البوابات الأخلاقية',
    labelEn: 'Ethics Gates',
    type: 'ethics',
    items: [
      { id: 'G1', labelAr: 'لا يوجد إشكالية أخلاقية',                                  labelEn: 'No ethical issue present' },
      { id: 'G2', labelAr: 'لا يوجد خلط أدوار مع الكوتشينج',                           labelEn: 'No mixing of other roles' },
      { id: 'G3', labelAr: 'لا يوجد خلط منهجيات مع التفكير الحسي',                    labelEn: 'No mixing of other methodologies' },
    ],
  },
  {
    id: 'part-4',
    labelAr: 'النتيجة النهائية',
    labelEn: 'Final Result',
    type: 'summary',
  },
];

const TOTAL_OBSERVATIONS = 36; // items 1–36

// ─── Observation form state types ─────────────────────────────────────────────

type ObservationState = 'observed' | 'not_observed' | 'not_applicable' | null;

interface ObsEntry {
  state: ObservationState;
  evidence: string;
}

type EthicsAnswer = 'agree' | 'disagree' | null;

interface FormState {
  // Part 0 metadata
  sessionDeliveryDate: string;
  sessionNumber: string;
  sessionLevel: '1' | '2' | '';
  // Part 1–2: item id → entry
  observations: Record<string | number, ObsEntry>;
  // Part 3: gate id → answer
  ethicsGates: Record<string, EthicsAnswer>;
  // Part 4 summary
  strongestCompetencies: string;
  developmentAreas: string;
  mentorGuidance: string;
  verdict: 'pass' | 'fail' | null;
}

function emptyForm(): FormState {
  const obs: Record<string | number, ObsEntry> = {};
  for (let i = 1; i <= 36; i++) {
    obs[i] = { state: null, evidence: '' };
  }
  return {
    sessionDeliveryDate: '',
    sessionNumber: '',
    sessionLevel: '',
    observations: obs,
    ethicsGates: { G1: null, G2: null, G3: null },
    strongestCompetencies: '',
    developmentAreas: '',
    mentorGuidance: '',
    verdict: null,
  };
}

// ─── Progress calculation ─────────────────────────────────────────────────────

function countAnswered(form: FormState): { observations: number; ethics: number } {
  let observations = 0;
  for (let i = 1; i <= TOTAL_OBSERVATIONS; i++) {
    if (form.observations[i]?.state !== null) observations++;
  }
  const ethics = Object.values(form.ethicsGates).filter(v => v !== null).length;
  return { observations, ethics };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Audio Player sub-component ───────────────────────────────────────────────

interface AudioPlayerProps {
  src: string | null;
  isAr: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

function AudioPlayer({ src, isAr, onTimeUpdate, audioRef }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play().catch(() => {}); }
  }, [playing, audioRef]);

  const seek = useCallback((delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + delta));
  }, [audioRef]);

  const changeSpeed = useCallback((s: number) => {
    const a = audioRef.current;
    if (a) a.playbackRate = s;
    setSpeed(s);
  }, [audioRef]);

  // Keyboard shortcuts: space=toggle, ←=−5s, →=+5s, shift+←=−15s, shift+→=+15s
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'ArrowLeft')  { e.preventDefault(); seek(e.shiftKey ? -15 : -5); }
      if (e.code === 'ArrowRight') { e.preventDefault(); seek(e.shiftKey ?  15 :  5); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, seek]);

  if (!src) {
    return (
      <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4 text-center text-sm text-[var(--color-neutral-400)]">
        {isAr ? 'لا يوجد ملف صوتي متاح للمعاينة' : 'No audio stream available for preview'}
        <p className="mt-1 text-xs">{isAr ? 'الملف محفوظ على الخادم' : 'File is stored on the server'}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
      <audio
        ref={audioRef as React.RefObject<HTMLAudioElement>}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => {
          const t = (e.target as HTMLAudioElement).currentTime;
          setCurrentTime(t);
          onTimeUpdate?.(t);
        }}
        className="hidden"
      />

      {/* Controls row */}
      <div className="flex items-center gap-3 mb-3">
        {/* Back 15s */}
        <button
          onClick={() => seek(-15)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-300)] transition-colors text-xs font-medium text-[var(--color-neutral-700)]"
          title={isAr ? 'رجوع ١٥ث' : 'Back 15s'}
        >
          −15
        </button>

        {/* Back 5s */}
        <button
          onClick={() => seek(-5)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-300)] transition-colors text-xs font-medium text-[var(--color-neutral-700)]"
          title={isAr ? 'رجوع ٥ث' : 'Back 5s'}
        >
          −5
        </button>

        {/* Play/Pause */}
        <button
          onClick={toggle}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 transition-colors shadow-sm"
          aria-label={playing ? (isAr ? 'إيقاف مؤقت' : 'Pause') : (isAr ? 'تشغيل' : 'Play')}
        >
          {playing ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Forward 5s */}
        <button
          onClick={() => seek(5)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-300)] transition-colors text-xs font-medium text-[var(--color-neutral-700)]"
          title={isAr ? 'تقديم ٥ث' : 'Forward 5s'}
        >
          +5
        </button>

        {/* Forward 15s */}
        <button
          onClick={() => seek(15)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-300)] transition-colors text-xs font-medium text-[var(--color-neutral-700)]"
          title={isAr ? 'تقديم ١٥ث' : 'Forward 15s'}
        >
          +15
        </button>

        {/* Timestamp */}
        <span className="ms-auto font-mono text-sm text-[var(--color-neutral-600)]">
          {formatTime(currentTime)} / {duration ? formatTime(duration) : '--:--'}
        </span>
      </div>

      {/* Seek bar */}
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onChange={(e) => {
          const a = audioRef.current;
          if (a) a.currentTime = Number(e.target.value);
        }}
        className="w-full h-1.5 rounded-full accent-[var(--color-primary)] cursor-pointer mb-3"
      />

      {/* Speed selector */}
      <div className="flex gap-1.5 items-center">
        <span className="text-xs text-[var(--color-neutral-500)] me-1">
          {isAr ? 'السرعة:' : 'Speed:'}
        </span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => changeSpeed(s)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              speed === s
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-300)]'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-[var(--color-neutral-400)]">
        {isAr
          ? 'مفاتيح: مسافة = تشغيل/إيقاف · ← / → = ±٥ث · Shift+← / → = ±١٥ث'
          : 'Keys: space = play/pause · ← / → = ±5s · Shift+← / → = ±15s'}
      </p>
    </div>
  );
}

// ─── Observation item row ──────────────────────────────────────────────────────

interface ObsItemProps {
  id: number;
  labelAr: string;
  labelEn: string;
  isConditional?: boolean;
  value: ObsEntry;
  isAr: boolean;
  currentAudioTime: number;
  onChange: (id: number, entry: ObsEntry) => void;
}

function ObsItem({ id, labelAr, labelEn, isConditional, value, isAr, currentAudioTime, onChange }: ObsItemProps) {
  const evidenceRef = useRef<HTMLTextAreaElement>(null);

  const handleStateChange = (state: ObservationState) => {
    const next = { ...value, state };
    onChange(id, next);
    // Auto-focus evidence when observed = true
    if (state === 'observed') {
      setTimeout(() => evidenceRef.current?.focus(), 50);
    }
  };

  const insertTimestamp = () => {
    const ts = formatTime(currentAudioTime);
    const ta = evidenceRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(start);
    const newVal = before + ts + after;
    onChange(id, { ...value, evidence: newVal });
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + ts.length, start + ts.length);
    }, 0);
  };

  const stateOptions: { val: ObservationState; labelAr: string; labelEn: string }[] = [
    { val: 'observed',        labelAr: 'لوحظ',       labelEn: 'Observed' },
    { val: 'not_observed',    labelAr: 'لم يُلاحظ',  labelEn: 'Not observed' },
    ...(isConditional ? [{ val: 'not_applicable' as ObservationState, labelAr: 'غير منطبق', labelEn: 'N/A' }] : []),
  ];

  return (
    <div className="border border-[var(--color-neutral-200)] rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="shrink-0 mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-neutral-100)] text-xs font-medium text-[var(--color-neutral-600)]">
          {id}
        </span>
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {isAr ? labelAr : labelEn}
        </span>
      </div>

      {/* State radio buttons */}
      <div className="flex flex-wrap gap-2">
        {stateOptions.map((opt) => (
          <label key={String(opt.val)} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`obs-${id}`}
              checked={value.state === opt.val}
              onChange={() => handleStateChange(opt.val)}
              className="accent-[var(--color-primary)]"
            />
            <span className={`text-xs ${value.state === opt.val ? 'font-medium text-[var(--color-primary)]' : 'text-[var(--color-neutral-600)]'}`}>
              {isAr ? opt.labelAr : opt.labelEn}
            </span>
          </label>
        ))}
      </div>

      {/* Evidence field — shown when observed */}
      {value.state === 'observed' && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--color-neutral-500)]">
              {isAr ? 'الدليل (الجملة + التوقيت MM:SS):' : 'Evidence (quote + timestamp MM:SS):'}
            </label>
            <button
              type="button"
              onClick={insertTimestamp}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-200)] text-[var(--color-neutral-600)] transition-colors"
              title={isAr ? 'إدراج التوقيت الحالي (Ctrl+T)' : 'Insert current timestamp (Ctrl+T)'}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {isAr ? 'توقيت' : 'Time'}
            </button>
          </div>
          <textarea
            ref={evidenceRef}
            value={value.evidence}
            onChange={(e) => onChange(id, { ...value, evidence: e.target.value })}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 't') {
                e.preventDefault();
                insertTimestamp();
              }
            }}
            rows={2}
            placeholder={isAr ? 'مثال: "كيف تشعر حيال هذا؟" عند 00:15، 12:30' : 'e.g. "How do you feel about this?" at 00:15, 12:30'}
            className="w-full rounded-md border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-none"
          />
        </div>
      )}
    </div>
  );
}

// ─── Ethics gate row ──────────────────────────────────────────────────────────

interface EthicsGateProps {
  id: string;
  labelAr: string;
  labelEn: string;
  isAr: boolean;
  value: EthicsAnswer;
  onChange: (id: string, val: EthicsAnswer) => void;
}

function EthicsGate({ id, labelAr, labelEn, isAr, value, onChange }: EthicsGateProps) {
  return (
    <div className={`rounded-lg border p-3 ${value === 'disagree' ? 'border-red-400 bg-red-50' : 'border-[var(--color-neutral-200)]'}`}>
      <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
        {isAr ? labelAr : labelEn}
      </p>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name={`ethics-${id}`}
            checked={value === 'agree'}
            onChange={() => onChange(id, 'agree')}
            className="accent-green-600"
          />
          <span className={`text-sm ${value === 'agree' ? 'font-medium text-green-700' : 'text-[var(--color-neutral-600)]'}`}>
            {isAr ? 'أوافق' : 'Agree'}
          </span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name={`ethics-${id}`}
            checked={value === 'disagree'}
            onChange={() => onChange(id, 'disagree')}
            className="accent-red-600"
          />
          <span className={`text-sm ${value === 'disagree' ? 'font-medium text-red-700' : 'text-[var(--color-neutral-600)]'}`}>
            {isAr ? 'لا أوافق — فشل تلقائي' : 'Disagree — auto-fail'}
          </span>
        </label>
      </div>
      {value === 'disagree' && (
        <p className="mt-2 text-xs text-red-600 font-medium">
          {isAr
            ? 'تنبيه: أي خلاف على بوابة أخلاقية يؤدي إلى فشل تلقائي للجلسة'
            : 'Warning: Disagreeing with an ethics gate triggers automatic session failure'}
        </p>
      )}
    </div>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────────

export default function AssessorWorkspacePage() {
  const { locale, assessmentId } = useParams<{ locale: string; assessmentId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [currentSection, setCurrentSection] = useState(0);
  const [audioTime, setAudioTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch assessment details
  useEffect(() => {
    if (!user || !assessmentId) return;

    fetch(`/api/assessments/${assessmentId}`)
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Failed'); });
        return r.json();
      })
      .then((data) => {
        setAssessment(data.assessment);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [user, assessmentId]);

  // Ethics auto-fail: if any gate is disagree, force verdict = fail
  const ethicsAutoFail = Object.values(form.ethicsGates).some(v => v === 'disagree');

  const updateObs = useCallback((id: number, entry: ObsEntry) => {
    setForm(prev => ({ ...prev, observations: { ...prev.observations, [id]: entry } }));
  }, []);

  const updateEthics = useCallback((id: string, val: EthicsAnswer) => {
    setForm(prev => {
      const next = { ...prev, ethicsGates: { ...prev.ethicsGates, [id]: val } };
      // If any gate disagree, force verdict = fail
      const anyDisagree = Object.values(next.ethicsGates).some(v => v === 'disagree');
      if (anyDisagree) next.verdict = 'fail';
      return next;
    });
  }, []);

  const { observations: answeredObs, ethics: answeredEthics } = countAnswered(form);
  const progressPct = Math.round((answeredObs / TOTAL_OBSERVATIONS) * 100);

  const section = RUBRIC_SECTIONS[currentSection];

  if (authLoading || loading) {
    return (
      <Section variant="white">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section variant="white">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {isAr ? `خطأ: ${error}` : `Error: ${error}`}
        </div>
        <button
          onClick={() => router.push(`/${locale}/portal/assessor`)}
          className="mt-4 text-sm text-[var(--color-primary)] hover:underline"
        >
          {isAr ? 'العودة للقائمة' : 'Back to queue'}
        </button>
      </Section>
    );
  }

  if (!assessment) return null;

  const studentName = isAr
    ? (assessment.student_name_ar || assessment.student_name_en || assessment.student_email)
    : (assessment.student_name_en || assessment.student_name_ar || assessment.student_email);

  const submittedDate = new Date(assessment.submitted_at).toLocaleDateString(
    isAr ? 'ar-SA' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );
  const assignedDate = new Date(assessment.assigned_at).toLocaleDateString(
    isAr ? 'ar-SA' : 'en-US',
    { year: 'numeric', month: 'short', day: 'numeric' },
  );

  // Audio src: stream via the session-authenticated Range endpoint (Phase 2.2).
  const audioSrc = assessment.recording_id
    ? `/api/recordings/${assessment.recording_id}/stream`
    : null;

  const isSubmitted = assessment.decision !== 'pending';

  return (
    <main dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--color-neutral-50)]">
      {/* Header bar */}
      <div className="border-b border-[var(--color-neutral-200)] bg-white sticky top-0 z-10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
          <button
            onClick={() => router.push(`/${locale}/portal/assessor`)}
            className="flex items-center gap-1.5 text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)] transition-colors min-h-[44px] px-2"
          >
            <svg className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            {isAr ? 'القائمة' : 'Queue'}
          </button>

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--text-primary)] truncate">
              {studentName}
            </div>
            <div className="text-xs text-[var(--color-neutral-500)] truncate">
              {isAr ? `أُرسل ${submittedDate} · أُسند ${assignedDate}` : `Submitted ${submittedDate} · Assigned ${assignedDate}`}
            </div>
          </div>

          {/* Progress badge */}
          <div className="flex items-center gap-2 text-sm text-[var(--color-neutral-600)] shrink-0">
            <div className="h-2 w-24 rounded-full bg-[var(--color-neutral-200)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs font-medium">{answeredObs}/{TOTAL_OBSERVATIONS}</span>
          </div>

          {isSubmitted && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              assessment.decision === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {assessment.decision === 'pass'
                ? (isAr ? 'ناجح' : 'Passed')
                : (isAr ? 'راسب' : 'Failed')}
            </span>
          )}
        </div>
      </div>

      {/* Two-pane layout */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row gap-4">

          {/* LEFT PANE — Audio + Transcript placeholder (40%) */}
          <div className="lg:w-2/5 space-y-4">
            {/* Audio player */}
            <div className="bg-white rounded-xl border border-[var(--color-neutral-200)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-4 w-4 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 19V6l12-3v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="15" r="3" />
                </svg>
                <h2 className="font-medium text-sm text-[var(--text-primary)]">
                  {isAr ? 'مشغل الصوت' : 'Audio Player'}
                </h2>
              </div>

              {/* Recording metadata */}
              <div className="mb-3 text-xs text-[var(--color-neutral-500)] space-y-0.5">
                <div>{assessment.original_filename}</div>
                <div>
                  {assessment.duration_seconds
                    ? `${Math.floor(assessment.duration_seconds / 60)} min`
                    : isAr ? 'المدة غير معروفة' : 'Duration unknown'}
                  {' · '}
                  {(assessment.file_size_bytes / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>

              <AudioPlayer
                src={audioSrc}
                isAr={isAr}
                audioRef={audioRef}
                onTimeUpdate={setAudioTime}
              />
            </div>

            {/* Transcript placeholder */}
            <div className="bg-white rounded-xl border border-[var(--color-neutral-200)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-4 w-4 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
                </svg>
                <h2 className="font-medium text-sm text-[var(--text-primary)]">
                  {isAr ? 'نص الجلسة' : 'Transcript'}
                </h2>
              </div>
              <div className="rounded-lg bg-[var(--color-neutral-50)] border border-dashed border-[var(--color-neutral-300)] p-6 text-center">
                <p className="text-xs text-[var(--color-neutral-400)]">
                  {isAr
                    ? 'نص الجلسة يُرفعه الطالب ضمن الحزمة. عرض النص سيُتاح في المرحلة ٢.٢'
                    : 'Transcript is submitted by the student with the package. Transcript viewer will be wired in Phase 2.2'}
                </p>
              </div>
            </div>

            {/* Current timestamp display */}
            <div className="bg-white rounded-xl border border-[var(--color-neutral-200)] p-3 flex items-center gap-2 text-sm">
              <svg className="h-4 w-4 text-[var(--color-neutral-400)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
              </svg>
              <span className="text-[var(--color-neutral-500)]">
                {isAr ? 'التوقيت الحالي:' : 'Current time:'}
              </span>
              <span className="font-mono font-medium text-[var(--color-primary)]">
                {formatTime(audioTime)}
              </span>
              <span className="ms-auto text-xs text-[var(--color-neutral-400)]">
                {isAr ? 'Ctrl+T لإدراج التوقيت في حقل الدليل' : 'Ctrl+T to insert into evidence field'}
              </span>
            </div>
          </div>

          {/* RIGHT PANE — Rubric form (60%) */}
          <div className="lg:w-3/5 bg-white rounded-xl border border-[var(--color-neutral-200)] flex flex-col">
            {/* Section navigation tabs */}
            <div className="border-b border-[var(--color-neutral-200)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="font-semibold text-[var(--text-primary)] text-sm">
                  {isAr ? 'نموذج التقييم' : 'Assessment Rubric'}
                </h2>
                <span className="ms-auto text-xs text-[var(--color-neutral-500)]">
                  {isAr
                    ? `${answeredObs} من ${TOTAL_OBSERVATIONS} ملاحظة · ${answeredEthics} من ٣ بوابات`
                    : `${answeredObs} of ${TOTAL_OBSERVATIONS} observations · ${answeredEthics} of 3 gates`}
                </span>
              </div>

              {/* Section jump list (horizontal scroll on mobile) */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {RUBRIC_SECTIONS.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => setCurrentSection(idx)}
                    className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      idx === currentSection
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
                    }`}
                  >
                    {isAr ? s.labelAr : s.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Section content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* Part 0 — Session Metadata */}
              {section.id === 'part-0' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                      {isAr ? 'تاريخ الجلسة' : 'Session delivery date'}
                    </label>
                    <input
                      type="date"
                      value={form.sessionDeliveryDate}
                      onChange={(e) => setForm(prev => ({ ...prev, sessionDeliveryDate: e.target.value }))}
                      className="w-full rounded-md border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                      {isAr ? 'رقم الجلسة' : 'Session number'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.sessionNumber}
                      onChange={(e) => setForm(prev => ({ ...prev, sessionNumber: e.target.value }))}
                      className="w-32 rounded-md border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      {isAr ? 'المستوى المقيَّم' : 'Level being assessed'}
                    </label>
                    <div className="flex gap-4">
                      {['1', '2'].map((lv) => (
                        <label key={lv} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="session-level"
                            checked={form.sessionLevel === lv}
                            onChange={() => setForm(prev => ({ ...prev, sessionLevel: lv as '1' | '2' }))}
                            className="accent-[var(--color-primary)]"
                          />
                          <span className="text-sm">
                            {isAr ? `المستوى ${lv}` : `Level ${lv}`}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] p-3 text-xs text-[var(--color-neutral-500)] space-y-1">
                    <div><strong>{isAr ? 'الطالب:' : 'Student:'}</strong> {studentName}</div>
                    <div><strong>{isAr ? 'البريد:' : 'Email:'}</strong> {assessment.student_email}</div>
                    <div><strong>{isAr ? 'تاريخ الإرسال:' : 'Submitted:'}</strong> {submittedDate}</div>
                    <div><strong>{isAr ? 'تاريخ الإسناد:' : 'Assigned:'}</strong> {assignedDate}</div>
                  </div>
                </div>
              )}

              {/* Observation sections (parts 1–2) */}
              {section.type === 'observations' && section.items && (
                <div className="space-y-3">
                  {section.conditional && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                      {isAr
                        ? 'هذا القسم اختياري — قيّمه فقط إذا قام الكوتش بهذه الخطوة في الجلسة. وإلا اختر "غير منطبق" لكل بند.'
                        : 'This section is conditional — only assess if the coach performed this move in the session. Otherwise mark all items as N/A.'}
                    </div>
                  )}
                  {(section.items as { id: number; labelAr: string; labelEn: string }[]).map((item) => (
                    <ObsItem
                      key={item.id}
                      id={item.id}
                      labelAr={item.labelAr}
                      labelEn={item.labelEn}
                      isConditional={section.conditional}
                      value={form.observations[item.id] || { state: null, evidence: '' }}
                      isAr={isAr}
                      currentAudioTime={audioTime}
                      onChange={updateObs}
                    />
                  ))}
                </div>
              )}

              {/* Ethics gates */}
              {section.type === 'ethics' && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
                    {isAr
                      ? 'تحذير: أي خلاف على إحدى هذه البوابات يؤدي فوراً إلى فشل تلقائي للجلسة، بغض النظر عن نتائج الأجزاء الأخرى.'
                      : 'Warning: Disagreeing with ANY of these gates triggers an automatic session failure, regardless of Parts 1–2 results.'}
                  </div>
                  {(section.items as { id: string; labelAr: string; labelEn: string }[]).map((item) => (
                    <EthicsGate
                      key={item.id}
                      id={item.id}
                      labelAr={item.labelAr}
                      labelEn={item.labelEn}
                      isAr={isAr}
                      value={form.ethicsGates[item.id]}
                      onChange={updateEthics}
                    />
                  ))}
                </div>
              )}

              {/* Part 4 — Summary */}
              {section.type === 'summary' && (
                <div className="space-y-4">
                  {/* Ethics auto-fail notice */}
                  {ethicsAutoFail && (
                    <div className="rounded-lg border border-red-400 bg-red-50 p-3 text-sm text-red-700 font-medium">
                      {isAr
                        ? 'هذه الجلسة فاشلة تلقائياً لوجود خلاف على إحدى البوابات الأخلاقية. خيار النجاح غير متاح.'
                        : 'This session is automatically failed due to an ethics gate disagreement. The pass option is disabled.'}
                    </div>
                  )}

                  {/* Verdict */}
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                      {isAr ? 'النتيجة النهائية *' : 'Final verdict *'}
                    </label>
                    <div className="flex gap-4">
                      <label className={`flex items-center gap-2 cursor-pointer ${ethicsAutoFail ? 'opacity-40 pointer-events-none' : ''}`}>
                        <input
                          type="radio"
                          name="verdict"
                          checked={form.verdict === 'pass'}
                          onChange={() => setForm(prev => ({ ...prev, verdict: 'pass' }))}
                          disabled={ethicsAutoFail}
                          className="accent-green-600"
                        />
                        <span className={`text-sm font-medium ${form.verdict === 'pass' ? 'text-green-700' : 'text-[var(--color-neutral-600)]'}`}>
                          {isAr ? 'ناجح' : 'Pass'}
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="verdict"
                          checked={form.verdict === 'fail'}
                          onChange={() => setForm(prev => ({ ...prev, verdict: 'fail' }))}
                          className="accent-red-600"
                        />
                        <span className={`text-sm font-medium ${form.verdict === 'fail' ? 'text-red-700' : 'text-[var(--color-neutral-600)]'}`}>
                          {isAr ? 'راسب' : 'Fail'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Strongest competencies */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                      {isAr ? 'أقوى ٣ كفاءات *' : '3 strongest competencies *'}
                    </label>
                    <textarea
                      rows={3}
                      value={form.strongestCompetencies}
                      onChange={(e) => setForm(prev => ({ ...prev, strongestCompetencies: e.target.value }))}
                      placeholder={isAr ? 'صِف الكفاءات التي تألّق فيها الكوتش...' : 'Describe the competencies where the coach excelled...'}
                      className="w-full rounded-md border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-none"
                    />
                  </div>

                  {/* Development areas */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                      {isAr ? '٣ كفاءات تحتاج تطوير *' : '3 competencies needing development *'}
                    </label>
                    <textarea
                      rows={3}
                      value={form.developmentAreas}
                      onChange={(e) => setForm(prev => ({ ...prev, developmentAreas: e.target.value }))}
                      placeholder={isAr ? 'صِف مجالات التطوير التي تحتاج مزيداً من التدريب...' : 'Describe areas needing further development...'}
                      className="w-full rounded-md border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-none"
                    />
                  </div>

                  {/* Mentor guidance */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                      {isAr ? 'توجيه المشرف وملاحظاته *' : "Mentor's guidance and advice *"}
                    </label>
                    <textarea
                      rows={5}
                      value={form.mentorGuidance}
                      onChange={(e) => setForm(prev => ({ ...prev, mentorGuidance: e.target.value }))}
                      placeholder={isAr ? 'اكتب ملاحظاتك ونصائحك بصدق وإشعار كامل للكوتش...' : 'Write your observations and advice with full presence for the coach...'}
                      className="w-full rounded-md border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-none"
                    />
                  </div>

                  {/* Submit placeholder — Phase 2.7 will wire this to state machine */}
                  <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4 text-center">
                    <p className="text-xs text-[var(--color-neutral-400)] mb-2">
                      {isAr
                        ? 'الحفظ التلقائي والإرسال النهائي سيُتاحان في المرحلة ٢.٥ و٢.٧'
                        : 'Auto-save and final submit will be wired in Phase 2.5 and 2.7'}
                    </p>
                    <button
                      disabled
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--color-primary)]/30 text-white text-sm font-medium cursor-not-allowed"
                    >
                      {isAr ? 'إرسال التقييم (قريباً)' : 'Submit Assessment (coming soon)'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Section prev/next navigation */}
            <div className="border-t border-[var(--color-neutral-200)] p-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentSection(prev => Math.max(0, prev - 1))}
                disabled={currentSection === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-neutral-200)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                <svg className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                {isAr ? 'السابق' : 'Previous'}
              </button>

              <span className="text-xs text-[var(--color-neutral-500)]">
                {currentSection + 1} / {RUBRIC_SECTIONS.length}
              </span>

              <button
                onClick={() => setCurrentSection(prev => Math.min(RUBRIC_SECTIONS.length - 1, prev + 1))}
                disabled={currentSection === RUBRIC_SECTIONS.length - 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                {isAr ? 'التالي' : 'Next'}
                <svg className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
