/**
 * Wave 15 Wave 3 — Inline AI invocation footer ("Ask AI").
 *
 * Per Hakawati §6.5 + §4.4:
 *   Panel footer: "Ask 🤖 ▼ [What should this say?] [→]"
 *
 * Default agent per section type:
 *   mirror/reframe/who_for/who_not_for/objections/carry_out/benefits → Hakima
 *   cta/header/group_alumni/credibility/quote → Shahira
 *   description/body → Hakawati
 *   format/faq → Nashit
 *   price → Amin
 *   image/video → Hakawati
 *   divider → (no AI)
 *   custom → user picks
 *
 * Server enforces scope per agent_tokens (Wave 2 surface).
 * Returns proposed copy; user accepts/rejects per field.
 * Acceptance writes via the Wave 2 PATCH route → content_edits audit row.
 *
 * Pending mode: shows agent's accent color pulsing with "Hakima is writing..."
 * Result: panel switches to diff view automatically (parent handles).
 */

'use client';

import { useState, useRef } from 'react';

export type AgentId =
  | 'hakima'
  | 'shahira'
  | 'hakawati'
  | 'nashit'
  | 'amin'
  | 'rafik'
  | 'sani';

// Default agent per section type.
const DEFAULT_AGENT_BY_TYPE: Record<string, AgentId> = {
  mirror: 'hakima',
  reframe: 'hakima',
  who_for: 'hakima',
  who_not_for: 'hakima',
  objections: 'hakima',
  carry_out: 'hakima',
  benefits: 'hakima',
  cta: 'shahira',
  header: 'shahira',
  group_alumni: 'shahira',
  credibility: 'shahira',
  quote: 'shahira',
  description: 'hakawati',
  body: 'hakawati',
  image: 'hakawati',
  video: 'hakawati',
  format: 'nashit',
  faq: 'nashit',
  price: 'amin',
  // custom: user picks — defaults to hakawati as the generalist
  custom: 'hakawati',
  // divider: no AI — handled below
};

const AGENT_LABEL: Record<AgentId, string> = {
  hakima: 'Hakima',
  shahira: 'Shahira',
  hakawati: 'Hakawati',
  nashit: 'Nashit',
  amin: 'Amin',
  rafik: 'Rafik',
  sani: 'Sani\'',
};

const AGENT_LABEL_AR: Record<AgentId, string> = {
  hakima: 'حكيمة',
  shahira: 'شهيرة',
  hakawati: 'حكواتي',
  nashit: 'نشيط',
  amin: 'أمين',
  rafik: 'رفيق',
  sani: 'صانع',
};

const AGENT_ACCENT: Record<AgentId, string> = {
  hakima: '#82C4E8',
  shahira: '#F47E42',
  hakawati: '#474099',
  nashit: '#2C2C2D',
  amin: '#F47E42',
  rafik: '#474099',
  sani: '#82C4E8',
};

export type AIInvocationStatus = 'idle' | 'pending' | 'result' | 'error';

export interface AIRevisionResult {
  agent: AgentId;
  fields: Record<string, string>;
  instruction: string;
}

interface AIInvocationFooterProps {
  sectionType: string;
  entityId: string;
  entityKind: 'landing_pages' | 'blog_posts' | 'static_pages';
  sectionIndex: number;
  locale: string;
  /** Called when the AI returns a revision — parent switches to diff view. */
  onRevisionReady: (result: AIRevisionResult) => void;
}

const ALL_AGENTS: AgentId[] = ['hakima', 'shahira', 'hakawati', 'nashit', 'amin'];

export function AIInvocationFooter({
  sectionType,
  entityId,
  entityKind,
  sectionIndex,
  locale,
  onRevisionReady,
}: AIInvocationFooterProps) {
  const isAr = locale === 'ar';

  // No AI for divider sections.
  if (sectionType === 'divider') return null;

  const defaultAgent = DEFAULT_AGENT_BY_TYPE[sectionType] ?? 'hakawati';
  const [selectedAgent, setSelectedAgent] = useState<AgentId>(defaultAgent);
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState<AIInvocationStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const accent = AGENT_ACCENT[selectedAgent];
  const agentNameDisplay = isAr
    ? AGENT_LABEL_AR[selectedAgent]
    : AGENT_LABEL[selectedAgent];

  async function handleSubmit() {
    if (!instruction.trim() || status === 'pending') return;
    setStatus('pending');
    setErrorMsg('');

    try {
      const res = await fetch(
        `/api/admin/${entityKind === 'landing_pages' ? 'lp' : entityKind === 'blog_posts' ? 'blog' : 'static-pages'}/${entityId}/sections/${sectionIndex}/ai-revise`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent: selectedAgent,
            instruction: instruction.trim(),
            target_locale: locale === 'ar' ? 'ar' : 'en',
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setStatus('result');
      setInstruction('');
      onRevisionReady({
        agent: selectedAgent,
        fields: data.fields ?? {},
        instruction: instruction.trim(),
      });
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div
      className="border-t border-[var(--color-neutral-200)] bg-white px-3 py-2"
      style={{ borderTop: `2px solid ${accent}22` }}
    >
      {/* Agent picker row */}
      <div className="flex items-center gap-2 mb-1.5 relative">
        <button
          type="button"
          onClick={() => setAgentPickerOpen((v) => !v)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors"
          style={{
            background: `${accent}18`,
            color: accent,
            border: `1px solid ${accent}44`,
          }}
          aria-haspopup="listbox"
          aria-expanded={agentPickerOpen}
        >
          {/* AI glyph — v1 is agent name in accent color, no custom glyph per §7.6 */}
          <span>🤖</span>
          <span>{agentNameDisplay}</span>
          <span style={{ fontSize: 10 }}>▼</span>
        </button>

        {agentPickerOpen && (
          <div
            ref={pickerRef}
            className="absolute bottom-full left-0 mb-1 bg-white border border-[var(--color-neutral-200)] rounded-lg shadow-lg z-50 min-w-[140px]"
            role="listbox"
            aria-label={isAr ? 'اختر الوكيل' : 'Choose agent'}
          >
            {ALL_AGENTS.map((agent) => (
              <button
                key={agent}
                type="button"
                role="option"
                aria-selected={agent === selectedAgent}
                className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-[var(--color-neutral-100)] flex items-center gap-2"
                style={{ color: AGENT_ACCENT[agent] }}
                onClick={() => {
                  setSelectedAgent(agent);
                  setAgentPickerOpen(false);
                  inputRef.current?.focus();
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: AGENT_ACCENT[agent],
                  }}
                />
                {isAr ? AGENT_LABEL_AR[agent] : AGENT_LABEL[agent]}
                {agent === selectedAgent && (
                  <span className="ms-auto text-[10px]">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Instruction input + submit */}
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') setAgentPickerOpen(false);
          }}
          placeholder={
            isAr
              ? `ماذا يجب أن يقول هذا القسم؟`
              : `What should this say?`
          }
          disabled={status === 'pending'}
          className="flex-1 rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] px-2.5 py-1.5 text-xs placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-60"
          dir={isAr ? 'rtl' : 'ltr'}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!instruction.trim() || status === 'pending'}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-opacity"
          style={{ background: accent }}
          title={isAr ? 'إرسال' : 'Submit'}
        >
          →
        </button>
      </div>

      {/* Status feedback */}
      {status === 'pending' && (
        <div
          className="mt-1.5 flex items-center gap-1.5 text-xs"
          style={{ color: accent }}
        >
          {/* Slow-breath pulse per Hakawati §7.4 — 1.4s loop */}
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: accent,
              animation: 'ai-pulse 1.4s ease-in-out infinite',
            }}
          />
          <style>{`
            @keyframes ai-pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.25; }
            }
          `}</style>
          {isAr
            ? `${agentNameDisplay} يكتب…`
            : `${AGENT_LABEL[selectedAgent]} is writing…`}
        </div>
      )}
      {status === 'error' && (
        <div className="mt-1.5 text-xs text-red-700">
          {isAr ? `⚠ خطأ: ${errorMsg}` : `⚠ Error: ${errorMsg}`}
          <button
            type="button"
            className="ms-2 underline"
            onClick={() => setStatus('idle')}
          >
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}
      {status === 'result' && (
        <div className="mt-1.5 text-xs" style={{ color: accent }}>
          {isAr ? '✓ مراجعة جاهزة — انظر الفرق' : '✓ Revision ready — see diff'}
        </div>
      )}
    </div>
  );
}
