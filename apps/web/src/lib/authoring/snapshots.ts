/**
 * Wave 15 Wave 1 — snapshots / diff helpers
 *
 * Diff-on-section-list utilities. Stable section identity comes from
 * Wave 14b's deriveSectionKey (`${type}-${index}-${anchor_id || ''}`); we
 * re-export a forked, dependency-free copy so the diff layer can run
 * server-side (lib/authoring is server-only) without pulling in the LP
 * editor's client component.
 *
 * No external deps — small inlined deepEqual instead of fast-deep-equal so
 * we don't grow apps/web/package.json for one helper. Same semantics as
 * fast-deep-equal: structural equality on plain JSON values, NaN === NaN,
 * cycle-unsafe (we never feed cyclic JSONB rows through this).
 */

// ─────────────────────────────────────────────────────────────────────────────
// deepEqual — JSON-shape structural equality
// ─────────────────────────────────────────────────────────────────────────────

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b; // catches null vs undefined etc.
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') {
    // primitives that aren't ===
    if (typeof a === 'number' && Number.isNaN(a) && Number.isNaN(b as number)) return true;
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keysA = Object.keys(ao);
  const keysB = Object.keys(bo);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section key derivation — stable identity across re-renders
// (Forked from `apps/web/src/components/admin/lp-editor/_shared.tsx`
// `deriveSectionKey`. Server-safe: no React/client-only imports.)
// ─────────────────────────────────────────────────────────────────────────────

interface MinimalSection {
  type?: unknown;
  anchor_id?: unknown;
  [k: string]: unknown;
}

export function deriveSectionKey(section: MinimalSection, index: number): string {
  const type = typeof section?.type === 'string' ? section.type : 'unknown';
  const anchor =
    typeof section?.anchor_id === 'string' && section.anchor_id ? section.anchor_id : '';
  return `${type}-${index}-${anchor}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composition-shape diff
// ─────────────────────────────────────────────────────────────────────────────

export type SectionDelta =
  | { kind: 'added'; key: string; section: MinimalSection }
  | { kind: 'removed'; key: string; section: MinimalSection }
  | {
      kind: 'changed';
      key: string;
      previous: MinimalSection;
      next: MinimalSection;
    }
  | {
      kind: 'reordered';
      key: string;
      from_index: number;
      to_index: number;
    };

export interface CompositionDiff {
  /** Section-level deltas (added/removed/changed/reordered). */
  sections: SectionDelta[];
  /** Top-level field deltas (e.g. seo_meta_json, hero_json). */
  fields: Array<{ field: string; previous: unknown; next: unknown }>;
}

/**
 * Diff two composition_json shapes (or any JSONB body that has a `sections`
 * array of objects with optional `type` + `anchor_id`). Top-level keys
 * outside `sections` are diff'd as bulk-field deltas.
 *
 * Stable identity: per-section key uses `deriveSectionKey(section, index)`.
 * Reorderings are detected when a section's key appears at a different
 * index in `next` vs `prev` AND its non-positional content is unchanged.
 *
 * Caveat: deriveSectionKey is positional (`type-index-anchor`). Two
 * sections of the same type without anchors that swap positions look like
 * "changed" rather than "reordered" because their keys also swap. For Wave
 * 1's append-only audit purposes this is acceptable; Wave 3's editor diff
 * surface will use anchor_id-first identity once anchors are mandatory.
 */
export function diffComposition(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): CompositionDiff {
  const out: CompositionDiff = { sections: [], fields: [] };

  const prevSections = arrayOf(prev?.sections);
  const nextSections = arrayOf(next?.sections);

  const prevByKey = new Map<string, { idx: number; section: MinimalSection }>();
  prevSections.forEach((s, i) => {
    prevByKey.set(deriveSectionKey(s, i), { idx: i, section: s });
  });

  const nextByKey = new Map<string, { idx: number; section: MinimalSection }>();
  nextSections.forEach((s, i) => {
    nextByKey.set(deriveSectionKey(s, i), { idx: i, section: s });
  });

  // Removed
  for (const [key, entry] of prevByKey) {
    if (!nextByKey.has(key)) {
      out.sections.push({ kind: 'removed', key, section: entry.section });
    }
  }
  // Added + changed + reordered
  for (const [key, entry] of nextByKey) {
    const prevEntry = prevByKey.get(key);
    if (!prevEntry) {
      out.sections.push({ kind: 'added', key, section: entry.section });
      continue;
    }
    const sameContent = deepEqual(prevEntry.section, entry.section);
    if (!sameContent) {
      out.sections.push({
        kind: 'changed',
        key,
        previous: prevEntry.section,
        next: entry.section,
      });
    } else if (prevEntry.idx !== entry.idx) {
      out.sections.push({
        kind: 'reordered',
        key,
        from_index: prevEntry.idx,
        to_index: entry.idx,
      });
    }
  }

  // Top-level field diff (excluding `sections`)
  const fieldKeys = new Set<string>();
  if (prev) for (const k of Object.keys(prev)) if (k !== 'sections') fieldKeys.add(k);
  if (next) for (const k of Object.keys(next)) if (k !== 'sections') fieldKeys.add(k);
  for (const k of fieldKeys) {
    const a = prev?.[k];
    const b = next?.[k];
    if (!deepEqual(a, b)) {
      out.fields.push({ field: k, previous: a, next: b });
    }
  }

  return out;
}

function arrayOf(v: unknown): MinimalSection[] {
  if (Array.isArray(v)) return v as MinimalSection[];
  return [];
}

/**
 * Compact summary string for UIs and audit display.
 * "+2 added, ~3 changed, -1 removed, 1 reorder, 2 fields"
 */
export function summarizeDiff(d: CompositionDiff): string {
  const c = { added: 0, removed: 0, changed: 0, reordered: 0 };
  for (const s of d.sections) c[s.kind] += 1;
  const parts: string[] = [];
  if (c.added) parts.push(`+${c.added} added`);
  if (c.changed) parts.push(`~${c.changed} changed`);
  if (c.removed) parts.push(`-${c.removed} removed`);
  if (c.reordered) parts.push(`${c.reordered} reorder${c.reordered === 1 ? '' : 's'}`);
  if (d.fields.length) parts.push(`${d.fields.length} field${d.fields.length === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : 'no changes';
}
