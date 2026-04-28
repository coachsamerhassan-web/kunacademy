/**
 * Wave 15 Wave 3 — Multi-agent coordination strip.
 *
 * Per Hakawati §4.5:
 *   When >1 agent has touched the page in the last 24h, top bar shows a
 *   coordination strip: "Coauthors: Hakima · Shahira · Hakawati [3 changes pending]"
 *
 *   Click expands a timeline reading from content_edits filtered by entity_id,
 *   last 24h, grouped by editor_id. Each row: agent + timestamp + section + summary.
 *
 *   Collapsed: agent avatars only.
 *
 * Query: GET /api/admin/content-edits?entity_id={id}&entity={kind}&window=24h
 * Server returns rows from content_edits filtered by entity_id, last 24h,
 * grouped by editor_id.
 *
 * DeepSeek QA note: query uses parameterised Drizzle SQL with UUID validation.
 * No raw string interpolation in the query path. The entity kind is validated
 * against the entity registry (assertEntityKnown) in the route handler.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

export type CoauthorAgent =
  | 'hakima'
  | 'shahira'
  | 'hakawati'
  | 'nashit'
  | 'amin'
  | 'rafik'
  | 'sani';

const AGENT_LABEL: Record<CoauthorAgent, string> = {
  hakima: 'Hakima',
  shahira: 'Shahira',
  hakawati: 'Hakawati',
  nashit: 'Nashit',
  amin: 'Amin',
  rafik: 'Rafik',
  sani: "Sani'",
};
const AGENT_LABEL_AR: Record<CoauthorAgent, string> = {
  hakima: 'حكيمة',
  shahira: 'شهيرة',
  hakawati: 'حكواتي',
  nashit: 'نشيط',
  amin: 'أمين',
  rafik: 'رفيق',
  sani: 'صانع',
};
const AGENT_ACCENT: Record<CoauthorAgent, string> = {
  hakima: '#82C4E8',
  shahira: '#F47E42',
  hakawati: '#474099',
  nashit: '#2C2C2D',
  amin: '#F47E42',
  rafik: '#474099',
  sani: '#82C4E8',
};

export interface ContentEditRow {
  id: string;
  editor_id: string;
  editor_type: 'human' | 'agent';
  created_at: string;
  field: string;
  change_kind: string;
  change_summary?: string | null;
  section_index?: number | null;
}

interface MultiAgentStripProps {
  entityId: string;
  entityKind: 'landing_pages' | 'blog_posts' | 'static_pages';
  locale: string;
  /** Called when user clicks a row to jump to that section. */
  onJumpToSection?: (sectionIndex: number) => void;
}

export function MultiAgentStrip({
  entityId,
  entityKind,
  locale,
  onJumpToSection,
}: MultiAgentStripProps) {
  const isAr = locale === 'ar';
  const [expanded, setExpanded] = useState(false);
  const [edits, setEdits] = useState<ContentEditRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEdits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/content-edits?entity_id=${encodeURIComponent(entityId)}&entity=${encodeURIComponent(entityKind)}&window=24h`,
        { headers: { 'Content-Type': 'application/json' } },
      );
      if (!res.ok) return;
      const data = await res.json();
      setEdits(Array.isArray(data.edits) ? data.edits : []);
    } catch {
      // Non-fatal — strip hides gracefully.
    } finally {
      setLoading(false);
    }
  }, [entityId, entityKind]);

  useEffect(() => {
    fetchEdits();
    // Refresh every 60s while the editor is open.
    const interval = setInterval(fetchEdits, 60_000);
    return () => clearInterval(interval);
  }, [fetchEdits]);

  // Group by editor_id (agent identity) — only show agent editors.
  const agentEdits = edits.filter((e) => e.editor_type === 'agent');
  const agentIds = Array.from(new Set(agentEdits.map((e) => e.editor_id))) as CoauthorAgent[];

  // Need at least 2 agents to show the strip.
  if (agentIds.length < 2) return null;

  const pendingCount = agentEdits.filter(
    (e) => e.change_kind !== 'publish' && e.change_kind !== 'accept',
  ).length;

  return (
    <div
      className="border-b border-[var(--color-neutral-200)] bg-[var(--color-surface-alt,#FFF5E9)]"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Collapsed strip */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-1.5 text-xs hover:bg-[var(--color-neutral-50)] transition-colors"
        aria-expanded={expanded}
      >
        <span className="text-[var(--color-neutral-600)] font-medium shrink-0">
          {isAr ? 'المؤلفون المشاركون:' : 'Coauthors:'}
        </span>
        <span className="flex items-center gap-1.5">
          {agentIds.slice(0, 5).map((agent) => (
            <AgentAvatar key={agent} agent={agent} isAr={isAr} />
          ))}
          {agentIds.length > 5 && (
            <span className="text-[var(--color-neutral-500)]">
              +{agentIds.length - 5}
            </span>
          )}
        </span>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold ms-1">
            {isAr
              ? `${pendingCount} تغيير معلّق`
              : `${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending`}
          </span>
        )}
        <span className="ms-auto text-[var(--color-neutral-400)] text-[10px]">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded timeline */}
      {expanded && (
        <div className="px-4 pb-3">
          {loading && (
            <div className="text-xs text-[var(--color-neutral-500)] py-2">
              {isAr ? 'جارٍ التحميل…' : 'Loading…'}
            </div>
          )}
          {!loading && agentEdits.length === 0 && (
            <div className="text-xs text-[var(--color-neutral-400)] py-2 italic">
              {isAr
                ? 'لا تعديلات من الوكلاء في آخر 24 ساعة.'
                : 'No agent edits in the last 24h.'}
            </div>
          )}
          {!loading && agentEdits.length > 0 && (
            <ol className="space-y-1.5 text-xs" role="list">
              {agentEdits.slice(0, 20).map((edit) => {
                const agent = edit.editor_id as CoauthorAgent;
                const accentColor = AGENT_ACCENT[agent] ?? '#888';
                const agentName = isAr
                  ? AGENT_LABEL_AR[agent] ?? edit.editor_id
                  : AGENT_LABEL[agent] ?? edit.editor_id;
                const isPending =
                  edit.change_kind !== 'publish' &&
                  edit.change_kind !== 'accept';

                return (
                  <li
                    key={edit.id}
                    className="flex items-start gap-2"
                    style={{ color: '#374151' }}
                  >
                    {/* Timestamp */}
                    <span
                      className="shrink-0 text-[10px] text-[var(--color-neutral-400)] w-16"
                      title={new Date(edit.created_at).toLocaleString()}
                    >
                      {formatRelativeTime(edit.created_at, isAr)}
                    </span>
                    {/* Agent dot */}
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: accentColor,
                        marginTop: 3,
                        flexShrink: 0,
                      }}
                    />
                    {/* Content */}
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold" style={{ color: accentColor }}>
                        {agentName}
                      </span>{' '}
                      {edit.change_summary ||
                        (isAr
                          ? `عدّل ${edit.field}`
                          : `edited ${edit.field}`)}
                      {edit.section_index !== null && edit.section_index !== undefined && (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="text-[var(--color-primary)] underline text-[10px]"
                            onClick={() =>
                              onJumpToSection?.(edit.section_index!)
                            }
                          >
                            {isAr
                              ? `القسم ${edit.section_index + 1}`
                              : `§${edit.section_index + 1}`}
                          </button>
                        </>
                      )}
                    </span>
                    {/* Pending badge */}
                    {isPending && (
                      <span className="shrink-0 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[9px] font-semibold">
                        {isAr ? 'معلّق' : 'pending'}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function AgentAvatar({
  agent,
  isAr,
}: {
  agent: CoauthorAgent;
  isAr: boolean;
}) {
  const accent = AGENT_ACCENT[agent] ?? '#888';
  const name = isAr ? AGENT_LABEL_AR[agent] : AGENT_LABEL[agent];
  const initials = name.slice(0, 2);
  return (
    <span
      title={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: `${accent}28`,
        color: accent,
        fontSize: 9,
        fontWeight: 700,
        border: `1px solid ${accent}60`,
        userSelect: 'none',
      }}
    >
      {initials}
    </span>
  );
}

function formatRelativeTime(iso: string, isAr: boolean): string {
  try {
    const t = new Date(iso);
    const diff = Math.max(0, Math.floor((Date.now() - t.getTime()) / 60000));
    if (diff < 1) return isAr ? 'الآن' : 'now';
    if (diff < 60) return isAr ? `${diff}د` : `${diff}m`;
    const h = Math.floor(diff / 60);
    if (h < 24) return isAr ? `${h}س` : `${h}h`;
    return isAr ? `${Math.floor(h / 24)}ي` : `${Math.floor(h / 24)}d`;
  } catch {
    return '';
  }
}
