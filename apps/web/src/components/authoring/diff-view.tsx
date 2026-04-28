/**
 * Wave 15 Wave 3 — Diff view for agent revisions.
 *
 * Per Hakawati §4.2:
 *   - Reads from content_edits.previous_value / new_value
 *   - Inline diff in side panel (per D6/U5 decision: inline diff keeps reading flow)
 *   - Side-by-side in Compare modal for full-page review
 *   - Granular per-field accept/reject buttons
 *   - Each toggle commits a per-field DB row update via PATCH route
 *
 * Diff library: uses `diff` npm package (small, well-tested) for word-level diff.
 * Per dispatch: no heavy diff library.
 *
 * XSS note: all diff output is rendered as text nodes via React (dangerouslySetInnerHTML
 * is NOT used). The diff library operates on plain text; we render each change part
 * as a <span> with appropriate styling. Safe.
 */

'use client';

import { useMemo, useState } from 'react';
import { diffWords } from 'diff';
import type { AgentId } from './ai-invocation-footer';

const AGENT_LABEL: Record<AgentId, string> = {
  hakima: 'Hakima',
  shahira: 'Shahira',
  hakawati: 'Hakawati',
  nashit: 'Nashit',
  amin: 'Amin',
  rafik: 'Rafik',
  sani: "Sani'",
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

export interface FieldDiff {
  field: string;
  label: string;
  previousValue: string;
  newValue: string;
  accepted?: boolean; // undefined = undecided, true = accepted, false = rejected
}

interface DiffViewProps {
  agent: AgentId;
  revisedAt: string | null;
  fields: FieldDiff[];
  locale: string;
  /** Called with updated field states after per-field accept/reject. */
  onFieldDecision: (field: string, accepted: boolean) => void;
  /** Accept all fields at once. */
  onAcceptAll: () => void;
  /** Reject all fields at once. */
  onRejectAll: () => void;
  /** "Edit before accepting" — loads agent version into form. */
  onEditBeforeAccepting?: () => void;
}

export function DiffView({
  agent,
  revisedAt,
  fields,
  locale,
  onFieldDecision,
  onAcceptAll,
  onRejectAll,
  onEditBeforeAccepting,
}: DiffViewProps) {
  const isAr = locale === 'ar';
  const accent = AGENT_ACCENT[agent];
  const agentName = isAr ? AGENT_LABEL_AR[agent] : AGENT_LABEL[agent];

  const changedFieldCount = fields.filter(
    (f) => f.previousValue !== f.newValue,
  ).length;

  const formattedTime = revisedAt
    ? formatRelativeTime(revisedAt, isAr)
    : null;

  const allDecided = fields.every((f) => f.accepted !== undefined);
  const anyAccepted = fields.some((f) => f.accepted === true);
  const anyRejected = fields.some((f) => f.accepted === false);

  return (
    <div className="flex flex-col gap-0" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div
        className="px-3 py-2.5 text-xs font-medium"
        style={{
          background: `${accent}12`,
          borderBottom: `1px solid ${accent}30`,
          color: accent,
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span>
            {isAr
              ? `${agentName} راجع ${formattedTime ? `· ${formattedTime}` : ''} · ${changedFieldCount} ${changedFieldCount === 1 ? 'حقل تغيّر' : 'حقول تغيّرت'}`
              : `${agentName} revised ${formattedTime ? `· ${formattedTime}` : ''} · ${changedFieldCount} field${changedFieldCount !== 1 ? 's' : ''} changed`}
          </span>
          {allDecided && (
            <span className="text-[10px] text-[var(--color-neutral-500)]">
              {isAr ? '✓ تمت المراجعة' : '✓ All reviewed'}
            </span>
          )}
        </div>
      </div>

      {/* Per-field diffs */}
      <div className="divide-y divide-[var(--color-neutral-100)]">
        {fields.map((f) => (
          <FieldDiffRow
            key={f.field}
            diff={f}
            accent={accent}
            isAr={isAr}
            onDecision={(accepted) => onFieldDecision(f.field, accepted)}
          />
        ))}
      </div>

      {/* Sticky footer — Accept all / Reject all / Edit before accepting */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-white border-t border-[var(--color-neutral-200)] sticky bottom-0 flex-wrap"
      >
        <button
          type="button"
          onClick={onAcceptAll}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: '#10b981' }}
        >
          {isAr ? 'قبول الكل' : 'Accept all'}
        </button>
        <button
          type="button"
          onClick={onRejectAll}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
        >
          {isAr ? 'رفض الكل' : 'Reject all'}
        </button>
        {onEditBeforeAccepting && (
          <button
            type="button"
            onClick={onEditBeforeAccepting}
            className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-xs text-[var(--color-neutral-700)] hover:border-[var(--color-primary)]"
          >
            {isAr ? 'تحرير قبل القبول' : 'Edit before accepting'}
          </button>
        )}
        {(anyAccepted || anyRejected) && !allDecided && (
          <span className="text-[11px] text-[var(--color-neutral-500)] ms-auto">
            {isAr
              ? `${fields.filter((f) => f.accepted !== undefined).length}/${fields.length} راجعت`
              : `${fields.filter((f) => f.accepted !== undefined).length}/${fields.length} reviewed`}
          </span>
        )}
      </div>
    </div>
  );
}

// ── FieldDiffRow — per-field inline diff with accept/reject ─────────────

function FieldDiffRow({
  diff,
  accent,
  isAr,
  onDecision,
}: {
  diff: FieldDiff;
  accent: string;
  isAr: boolean;
  onDecision: (accepted: boolean) => void;
}) {
  const hasChange = diff.previousValue !== diff.newValue;

  // Word-level diff using the `diff` package.
  // Renders text only — no innerHTML, no XSS risk.
  const parts = useMemo(
    () => diffWords(diff.previousValue ?? '', diff.newValue ?? ''),
    [diff.previousValue, diff.newValue],
  );

  return (
    <div className="px-3 py-2.5 text-xs">
      {/* Field label + decision buttons */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-semibold text-[var(--color-neutral-700)] uppercase tracking-wide text-[10px]">
          {diff.label}
        </span>
        {hasChange && (
          <div className="flex items-center gap-1">
            {diff.accepted === true && (
              <span className="text-[10px] text-emerald-700 font-medium">
                {isAr ? '✓ مقبول' : '✓ Accepted'}
              </span>
            )}
            {diff.accepted === false && (
              <span className="text-[10px] text-red-700 font-medium">
                {isAr ? '✕ مرفوض' : '✕ Rejected'}
              </span>
            )}
            {diff.accepted === undefined && (
              <>
                <button
                  type="button"
                  onClick={() => onDecision(true)}
                  className="rounded px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                >
                  {isAr ? 'قبول' : 'Accept'}
                </button>
                <button
                  type="button"
                  onClick={() => onDecision(false)}
                  className="rounded px-2 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-50 border border-red-200"
                >
                  {isAr ? 'رفض' : 'Reject'}
                </button>
              </>
            )}
          </div>
        )}
        {!hasChange && (
          <span className="text-[10px] text-[var(--color-neutral-400)]">
            {isAr ? 'لا تغيير' : 'Unchanged'}
          </span>
        )}
      </div>

      {/* Inline diff rendering — text nodes only, no innerHTML */}
      {hasChange ? (
        <p
          className="text-[var(--color-neutral-700)] leading-relaxed"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {parts.map((part, i) => {
            if (part.removed) {
              return (
                <span
                  key={i}
                  style={{
                    textDecoration: 'line-through',
                    color: '#dc2626',
                    background: 'rgba(220,38,38,0.06)',
                    borderRadius: 2,
                    padding: '0 1px',
                  }}
                >
                  {part.value}
                </span>
              );
            }
            if (part.added) {
              return (
                <span
                  key={i}
                  style={{
                    textDecoration: 'underline',
                    color: '#059669',
                    background: 'rgba(5,150,105,0.06)',
                    borderRadius: 2,
                    padding: '0 1px',
                  }}
                >
                  {part.value}
                </span>
              );
            }
            return <span key={i}>{part.value}</span>;
          })}
        </p>
      ) : (
        <p className="text-[var(--color-neutral-500)] italic">
          {diff.newValue || (isAr ? '— فارغ —' : '— empty —')}
        </p>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string, isAr: boolean): string {
  try {
    const t = new Date(iso);
    const diff = Math.max(0, Math.floor((Date.now() - t.getTime()) / 60000));
    if (diff < 1) return isAr ? 'الآن' : 'just now';
    if (diff < 60) return isAr ? `قبل ${diff} د` : `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return isAr ? `قبل ${h} س` : `${h}h ago`;
    const d = Math.floor(h / 24);
    return isAr ? `قبل ${d} يوم` : `${d}d ago`;
  } catch {
    return iso;
  }
}

// ── useDiffState — helper hook to manage field decision state ─────────────

export interface DiffState {
  fields: FieldDiff[];
  acceptField: (field: string) => void;
  rejectField: (field: string) => void;
  acceptAll: () => void;
  rejectAll: () => void;
}

export function useDiffState(initialFields: FieldDiff[]): DiffState {
  const [fields, setFields] = useState<FieldDiff[]>(initialFields);

  const acceptField = (field: string) =>
    setFields((prev) =>
      prev.map((f) => (f.field === field ? { ...f, accepted: true } : f)),
    );

  const rejectField = (field: string) =>
    setFields((prev) =>
      prev.map((f) => (f.field === field ? { ...f, accepted: false } : f)),
    );

  const acceptAll = () =>
    setFields((prev) => prev.map((f) => ({ ...f, accepted: true })));

  const rejectAll = () =>
    setFields((prev) => prev.map((f) => ({ ...f, accepted: false })));

  return { fields, acceptField, rejectField, acceptAll, rejectAll };
}
