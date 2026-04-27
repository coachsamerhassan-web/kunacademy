/**
 * Wave 15 Wave 2 — page-service extensions for the Agent REST surface.
 *
 * Wave 1 shipped:
 *   - validateTransition / transitionStatus
 *   - createSnapshot / rollbackToSnapshot / loadPageWithSnapshots
 *   - assertEntityKnown / validateActor / loadRow / loadRowForUpdate
 *
 * Wave 2 adds (THIS file):
 *   - createPage              — INSERT row at status='draft'
 *   - softDeletePage          — flip status='archived' (audit + snapshot)
 *   - addSection              — append/insert into composition_json.sections
 *   - editSection             — patch composition_json.sections[idx]
 *   - deleteSection           — splice out composition_json.sections[idx]
 *   - reorderSections         — apply a target permutation to .sections
 *   - schedulePublish         — set scheduled_publish_at + transition→review
 *   - listSnapshots           — paginated snapshot list (separated from loadPageWithSnapshots)
 *   - getSnapshotById         — single snapshot fetch
 *   - diffPageVersions        — diff two snapshots OR one snapshot vs current
 *
 * Constraints honored:
 *   - withAdminContext owns the txn (no nested BEGIN/COMMIT).
 *   - Every mutation writes a content_edits audit row.
 *   - Section ops produce diffComposition output that callers can audit.
 *   - Section index validation is strict (must be in-bounds OR exactly
 *     equal to current length for append).
 *   - composition_json.sections shape is `Array<MinimalSection>`; if a row
 *     has no sections array we treat it as empty.
 *
 * IP rule (R1+R2) is enforced at the API edge (route handlers + transition
 * route) — section ops themselves DO NOT lint. Lints fire on
 * transition→review and transition→published only. This matches the
 * spec's "lints at transition boundary, not on every keystroke" model.
 */

import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import type { Actor, EditContext, Entity, Status } from './page-service';
import { PageServiceError, validateTransition, transitionStatus } from './page-service';
import { diffComposition, summarizeDiff, type CompositionDiff } from './snapshots';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers — duplicated from page-service.ts intentionally.
// page-service.ts keeps its non-exports private; rather than restructure
// Wave 1 to expose them, we re-implement the small surface we need here.
// Both files use the same ENTITY_TABLES whitelist + assertEntityKnown
// guard — drift between them would be a bug; tests cover both.
// ─────────────────────────────────────────────────────────────────────────────

const ENTITY_TABLE_NAMES: Record<Entity, string> = {
  landing_pages: 'landing_pages',
  blog_posts: 'blog_posts',
  static_pages: 'static_pages',
};

/**
 * Defense-in-depth whitelist guard. Mirrors page-service.ts's
 * assertEntityKnown(); duplicated here to keep the sql.raw boundary
 * tight. Any new entity must be added in BOTH files.
 */
function assertEntityKnown(entity: string): Entity {
  if (!Object.prototype.hasOwnProperty.call(ENTITY_TABLE_NAMES, entity)) {
    throw new PageServiceError(
      `Unknown entity: ${entity}`,
      'unknown_entity',
      400,
    );
  }
  return entity as Entity;
}

function rowsOf(result: any): Record<string, any>[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as Record<string, any>[];
  if (Array.isArray(result.rows)) return result.rows as Record<string, any>[];
  return [];
}

async function loadRow(
  adminDb: any,
  entity: Entity,
  rowId: string,
): Promise<Record<string, unknown> | null> {
  const safe = assertEntityKnown(entity);
  const result = await adminDb.execute(
    sql.raw(`SELECT * FROM ${safe} WHERE id = $1 LIMIT 1`),
    [rowId],
  );
  return rowsOf(result)[0] ?? null;
}

async function loadRowForUpdate(
  adminDb: any,
  entity: Entity,
  rowId: string,
): Promise<Record<string, unknown> | null> {
  const safe = assertEntityKnown(entity);
  const result = await adminDb.execute(
    sql.raw(`SELECT * FROM ${safe} WHERE id = $1 FOR UPDATE`),
    [rowId],
  );
  return rowsOf(result)[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// createPage — INSERT a fresh draft row. Returns the new id.
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePageInput {
  entity: Entity;
  slug: string;
  /** Optional kind discriminator. Required for static_pages + blog_posts. */
  kind?: string;
  /** Initial body shapes. Default `{}` for each. */
  composition_json?: Record<string, unknown>;
  hero_json?: Record<string, unknown>;
  seo_meta_json?: Record<string, unknown>;
  /** Required scalar columns per entity:
   *    - landing_pages : page_type
   *    - blog_posts    : title_ar + title_en (NOT NULL on schema) — surfaced as fields
   *    - static_pages  : kind (defaults to 'static') */
  scalars?: Record<string, unknown>;
  actor: Actor;
  ctx?: EditContext;
}

export async function createPage(input: CreatePageInput): Promise<{ id: string; slug: string; entity: Entity; kind?: string }> {
  const safeEntity = assertEntityKnown(input.entity);
  validateActor(input.actor);
  if (!input.slug || typeof input.slug !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,128}$/i.test(input.slug)) {
    throw new PageServiceError(
      `slug must match [a-z0-9][a-z0-9_-]{0,128} (got: ${input.slug})`,
      'invalid_actor',
      400,
    );
  }

  // Per-entity required-column validation
  if (safeEntity === 'static_pages' && input.kind === undefined) {
    // CHECK in DB defaults to 'static'; we still set it explicitly for audit clarity.
  }
  if (safeEntity === 'blog_posts') {
    const ttlAr = (input.scalars ?? {}).title_ar;
    const ttlEn = (input.scalars ?? {}).title_en;
    if (typeof ttlAr !== 'string' || typeof ttlEn !== 'string' || !ttlAr || !ttlEn) {
      throw new PageServiceError(
        `blog_posts.create requires non-empty scalars.title_ar + scalars.title_en`,
        'invalid_actor',
        400,
      );
    }
  }
  if (safeEntity === 'landing_pages') {
    const pt = (input.scalars ?? {}).page_type;
    if (typeof pt !== 'string' || !pt) {
      throw new PageServiceError(
        `landing_pages.create requires scalars.page_type`,
        'invalid_actor',
        400,
      );
    }
  }

  return withAdminContext(async (adminDb) => {
    // Build the INSERT column list per entity. We always include:
    //   slug, status='draft', composition_json, hero_json, seo_meta_json,
    //   created_by_kind, created_by_id, last_edited_by_kind, last_edited_by_id,
    //   last_edited_by_name. Per-entity tail varies.
    const compJson = JSON.stringify(input.composition_json ?? {});
    const heroJson = JSON.stringify(input.hero_json ?? {});
    const seoJson = JSON.stringify(input.seo_meta_json ?? {});
    const actor = input.actor;

    let result: any;

    if (safeEntity === 'static_pages') {
      const kind = input.kind ?? 'static';
      result = await adminDb.execute(
        sql.raw(`
          INSERT INTO static_pages
            (slug, kind, status, composition_json, hero_json, seo_meta_json,
             created_by_kind, created_by_id,
             last_edited_by_kind, last_edited_by_id, last_edited_by_name)
          VALUES ($1, $2, 'draft', $3::jsonb, $4::jsonb, $5::jsonb,
                  $6, $7, $8, $9, $10)
          RETURNING id, slug, kind
        `),
        [
          input.slug,
          kind,
          compJson,
          heroJson,
          seoJson,
          actor.kind,
          actor.id,
          actor.kind,
          actor.id,
          actor.name,
        ],
      );
    } else if (safeEntity === 'landing_pages') {
      const pageType = (input.scalars ?? {}).page_type as string;
      result = await adminDb.execute(
        sql.raw(`
          INSERT INTO landing_pages
            (slug, page_type, status, composition_json, hero_json, seo_meta_json,
             last_edited_by_kind, last_edited_by_name)
          VALUES ($1, $2, 'draft', $3::jsonb, $4::jsonb, $5::jsonb, $6, $7)
          RETURNING id, slug
        `),
        [
          input.slug,
          pageType,
          compJson,
          heroJson,
          seoJson,
          actor.kind,
          actor.name,
        ],
      );
    } else {
      // blog_posts
      const ttlAr = (input.scalars ?? {}).title_ar as string;
      const ttlEn = (input.scalars ?? {}).title_en as string;
      const kind = input.kind ?? 'blog_article';
      result = await adminDb.execute(
        sql.raw(`
          INSERT INTO blog_posts
            (slug, title_ar, title_en, kind, status, composition_json,
             last_edited_by_kind, last_edited_by_name)
          VALUES ($1, $2, $3, $4, 'draft', $5::jsonb, $6, $7)
          RETURNING id, slug, kind
        `),
        [
          input.slug,
          ttlAr,
          ttlEn,
          kind,
          compJson,
          actor.kind,
          actor.name,
        ],
      );
    }

    const row = rowsOf(result)[0];
    if (!row || !row.id) {
      throw new PageServiceError('insert returned no row', 'unknown_entity', 500);
    }

    // Audit
    await insertContentEditRow(adminDb, {
      entity: safeEntity,
      entity_id: row.id,
      field: '__create',
      editor_type: actor.kind,
      editor_id: actor.id,
      editor_name: actor.name,
      previous_value: null,
      new_value: { slug: input.slug, kind: input.kind ?? null },
      change_kind: 'scalar',
      reason: input.ctx?.reason ?? null,
      ip_address: input.ctx?.ip_address ?? null,
      user_agent: input.ctx?.user_agent ?? null,
      edit_source: input.ctx?.edit_source ?? (actor.kind === 'agent' ? 'agent_api' : actor.kind === 'system' ? 'system' : 'admin_ui'),
      metadata: input.ctx?.metadata ?? null,
    });

    return { id: row.id as string, slug: row.slug as string, entity: safeEntity, kind: row.kind };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// softDeletePage — transition→archived. Snapshot fires automatically.
// ─────────────────────────────────────────────────────────────────────────────

export async function softDeletePage(
  entity: Entity,
  rowId: string,
  actor: Actor,
  ctx?: EditContext,
): Promise<Record<string, unknown>> {
  // transitionStatus already snapshots on archive AND writes the audit row.
  // We just delegate to it. If the row is already archived, the
  // validateTransition() call inside throws invalid_transition (422) —
  // route surface translates to a 409 if desired.
  return transitionStatus(entity, rowId, 'archived', actor, ctx);
}

// ─────────────────────────────────────────────────────────────────────────────
// Section operations on composition_json.sections
// ─────────────────────────────────────────────────────────────────────────────

export interface MinimalSection {
  type?: string;
  anchor_id?: string;
  [k: string]: unknown;
}

interface SectionOpResult {
  /** Pre-op composition_json (for diff display). */
  previous: Record<string, unknown>;
  /** Post-op composition_json (returned to client). */
  next: Record<string, unknown>;
  /** Compact diff. */
  diff: CompositionDiff;
  /** Compact human-readable summary. */
  summary: string;
}

/** Parse + validate composition_json.sections from a row, returning a fresh
 *  array. Returns [] if missing/wrong-shaped. */
function readSections(comp: unknown): MinimalSection[] {
  if (!comp || typeof comp !== 'object') return [];
  const sections = (comp as Record<string, unknown>).sections;
  if (!Array.isArray(sections)) return [];
  return sections as MinimalSection[];
}

function buildComposition(
  prev: Record<string, unknown> | null | undefined,
  sections: MinimalSection[],
): Record<string, unknown> {
  const base = (prev && typeof prev === 'object' ? { ...prev } : {}) as Record<string, unknown>;
  base.sections = sections;
  return base;
}

export interface AddSectionInput {
  entity: Entity;
  rowId: string;
  /** New section to add. Caller is responsible for shape — service does NOT
   *  validate against a section-type registry (that lands in Wave 3). */
  section: MinimalSection;
  /** Insert position. Undefined = append. */
  index?: number;
  actor: Actor;
  ctx?: EditContext;
}

export async function addSection(input: AddSectionInput): Promise<SectionOpResult> {
  const safeEntity = assertEntityKnown(input.entity);
  validateActor(input.actor);
  if (!input.section || typeof input.section !== 'object') {
    throw new PageServiceError('section must be an object', 'invalid_actor', 400);
  }
  if (typeof input.section.type !== 'string' || !input.section.type) {
    throw new PageServiceError('section.type required (string)', 'invalid_actor', 400);
  }

  return withAdminContext(async (adminDb) => {
    const cur = await loadRowForUpdate(adminDb, safeEntity, input.rowId);
    if (!cur) {
      throw new PageServiceError(`${safeEntity} ${input.rowId} not found`, 'not_found', 404);
    }
    const prevComp = cur.composition_json as Record<string, unknown> | null;
    const sections = readSections(prevComp);
    const insertAt = input.index === undefined ? sections.length : input.index;
    if (insertAt < 0 || insertAt > sections.length) {
      throw new PageServiceError(
        `index ${insertAt} out of range (0..${sections.length})`,
        'invalid_actor',
        400,
      );
    }
    const next = [...sections.slice(0, insertAt), input.section, ...sections.slice(insertAt)];
    const nextComp = buildComposition(prevComp, next);
    await updateCompositionJson(adminDb, safeEntity, input.rowId, nextComp, input.actor);

    const diff = diffComposition(prevComp ?? {}, nextComp);
    const summary = summarizeDiff(diff);

    await insertContentEditRow(adminDb, {
      entity: safeEntity,
      entity_id: input.rowId,
      field: 'composition_json',
      editor_type: input.actor.kind,
      editor_id: input.actor.id,
      editor_name: input.actor.name,
      previous_value: prevComp ?? null,
      new_value: nextComp,
      change_kind: 'rich_text_replaced', // composition body is the analog of "rich text"
      reason: input.ctx?.reason ?? `add_section[${insertAt}] type=${input.section.type}`,
      ip_address: input.ctx?.ip_address ?? null,
      user_agent: input.ctx?.user_agent ?? null,
      edit_source: input.ctx?.edit_source ?? (input.actor.kind === 'agent' ? 'agent_api' : input.actor.kind === 'system' ? 'system' : 'admin_ui'),
      metadata: input.ctx?.metadata ?? null,
    });

    return {
      previous: prevComp ?? {},
      next: nextComp,
      diff,
      summary,
    };
  });
}

export interface EditSectionInput {
  entity: Entity;
  rowId: string;
  index: number;
  patch: MinimalSection;
  actor: Actor;
  ctx?: EditContext;
}

export async function editSection(input: EditSectionInput): Promise<SectionOpResult> {
  const safeEntity = assertEntityKnown(input.entity);
  validateActor(input.actor);
  if (!input.patch || typeof input.patch !== 'object') {
    throw new PageServiceError('patch must be an object', 'invalid_actor', 400);
  }

  return withAdminContext(async (adminDb) => {
    const cur = await loadRowForUpdate(adminDb, safeEntity, input.rowId);
    if (!cur) {
      throw new PageServiceError(`${safeEntity} ${input.rowId} not found`, 'not_found', 404);
    }
    const prevComp = cur.composition_json as Record<string, unknown> | null;
    const sections = readSections(prevComp);
    if (input.index < 0 || input.index >= sections.length) {
      throw new PageServiceError(
        `index ${input.index} out of range (0..${sections.length - 1})`,
        'invalid_actor',
        400,
      );
    }
    const cur_section = sections[input.index];
    // Spread patch over current — type stays unless caller explicitly
    // sends a new type (we honor it; section-type changes are valid edits).
    const next_section: MinimalSection = { ...cur_section, ...input.patch };
    const next = sections.slice();
    next[input.index] = next_section;
    const nextComp = buildComposition(prevComp, next);
    await updateCompositionJson(adminDb, safeEntity, input.rowId, nextComp, input.actor);

    const diff = diffComposition(prevComp ?? {}, nextComp);
    const summary = summarizeDiff(diff);

    await insertContentEditRow(adminDb, {
      entity: safeEntity,
      entity_id: input.rowId,
      field: 'composition_json',
      editor_type: input.actor.kind,
      editor_id: input.actor.id,
      editor_name: input.actor.name,
      previous_value: prevComp ?? null,
      new_value: nextComp,
      change_kind: 'rich_text_replaced',
      reason: input.ctx?.reason ?? `edit_section[${input.index}]`,
      ip_address: input.ctx?.ip_address ?? null,
      user_agent: input.ctx?.user_agent ?? null,
      edit_source: input.ctx?.edit_source ?? (input.actor.kind === 'agent' ? 'agent_api' : input.actor.kind === 'system' ? 'system' : 'admin_ui'),
      metadata: input.ctx?.metadata ?? null,
    });

    return {
      previous: prevComp ?? {},
      next: nextComp,
      diff,
      summary,
    };
  });
}

export interface DeleteSectionInput {
  entity: Entity;
  rowId: string;
  index: number;
  actor: Actor;
  ctx?: EditContext;
}

export async function deleteSection(input: DeleteSectionInput): Promise<SectionOpResult> {
  const safeEntity = assertEntityKnown(input.entity);
  validateActor(input.actor);

  return withAdminContext(async (adminDb) => {
    const cur = await loadRowForUpdate(adminDb, safeEntity, input.rowId);
    if (!cur) {
      throw new PageServiceError(`${safeEntity} ${input.rowId} not found`, 'not_found', 404);
    }
    const prevComp = cur.composition_json as Record<string, unknown> | null;
    const sections = readSections(prevComp);
    if (input.index < 0 || input.index >= sections.length) {
      throw new PageServiceError(
        `index ${input.index} out of range (0..${sections.length - 1})`,
        'invalid_actor',
        400,
      );
    }
    const removed = sections[input.index];
    const next = sections.slice(0, input.index).concat(sections.slice(input.index + 1));
    const nextComp = buildComposition(prevComp, next);
    await updateCompositionJson(adminDb, safeEntity, input.rowId, nextComp, input.actor);

    const diff = diffComposition(prevComp ?? {}, nextComp);
    const summary = summarizeDiff(diff);

    await insertContentEditRow(adminDb, {
      entity: safeEntity,
      entity_id: input.rowId,
      field: 'composition_json',
      editor_type: input.actor.kind,
      editor_id: input.actor.id,
      editor_name: input.actor.name,
      previous_value: prevComp ?? null,
      new_value: nextComp,
      change_kind: 'rich_text_replaced',
      reason: input.ctx?.reason ?? `delete_section[${input.index}] type=${removed.type ?? '?'}`,
      ip_address: input.ctx?.ip_address ?? null,
      user_agent: input.ctx?.user_agent ?? null,
      edit_source: input.ctx?.edit_source ?? (input.actor.kind === 'agent' ? 'agent_api' : input.actor.kind === 'system' ? 'system' : 'admin_ui'),
      metadata: input.ctx?.metadata ?? null,
    });

    return {
      previous: prevComp ?? {},
      next: nextComp,
      diff,
      summary,
    };
  });
}

export interface ReorderSectionsInput {
  entity: Entity;
  rowId: string;
  /** Permutation of section indices. Must have the same length as the
   *  current sections[] AND be a complete permutation. */
  order: number[];
  actor: Actor;
  ctx?: EditContext;
}

export async function reorderSections(input: ReorderSectionsInput): Promise<SectionOpResult> {
  const safeEntity = assertEntityKnown(input.entity);
  validateActor(input.actor);
  if (!Array.isArray(input.order)) {
    throw new PageServiceError('order must be an array of indices', 'invalid_actor', 400);
  }

  return withAdminContext(async (adminDb) => {
    const cur = await loadRowForUpdate(adminDb, safeEntity, input.rowId);
    if (!cur) {
      throw new PageServiceError(`${safeEntity} ${input.rowId} not found`, 'not_found', 404);
    }
    const prevComp = cur.composition_json as Record<string, unknown> | null;
    const sections = readSections(prevComp);
    if (input.order.length !== sections.length) {
      throw new PageServiceError(
        `order length ${input.order.length} ≠ sections length ${sections.length}`,
        'invalid_actor',
        400,
      );
    }
    // Permutation check — every index 0..n-1 appears exactly once
    const seen = new Set<number>();
    for (const i of input.order) {
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= sections.length) {
        throw new PageServiceError(
          `invalid index in order: ${i}`,
          'invalid_actor',
          400,
        );
      }
      if (seen.has(i)) {
        throw new PageServiceError(
          `duplicate index in order: ${i}`,
          'invalid_actor',
          400,
        );
      }
      seen.add(i);
    }

    const next = input.order.map((i) => sections[i]);
    const nextComp = buildComposition(prevComp, next);
    await updateCompositionJson(adminDb, safeEntity, input.rowId, nextComp, input.actor);

    const diff = diffComposition(prevComp ?? {}, nextComp);
    const summary = summarizeDiff(diff);

    await insertContentEditRow(adminDb, {
      entity: safeEntity,
      entity_id: input.rowId,
      field: 'composition_json',
      editor_type: input.actor.kind,
      editor_id: input.actor.id,
      editor_name: input.actor.name,
      previous_value: prevComp ?? null,
      new_value: nextComp,
      change_kind: 'rich_text_replaced',
      reason: input.ctx?.reason ?? `reorder_sections [${input.order.join(',')}]`,
      ip_address: input.ctx?.ip_address ?? null,
      user_agent: input.ctx?.user_agent ?? null,
      edit_source: input.ctx?.edit_source ?? (input.actor.kind === 'agent' ? 'agent_api' : input.actor.kind === 'system' ? 'system' : 'admin_ui'),
      metadata: input.ctx?.metadata ?? null,
    });

    return {
      previous: prevComp ?? {},
      next: nextComp,
      diff,
      summary,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot / diff helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface ListSnapshotsOptions {
  limit?: number;
  offset?: number;
}

export async function listSnapshots(
  entity: Entity,
  entityId: string,
  opts: ListSnapshotsOptions = {},
): Promise<any[]> {
  assertEntityKnown(entity);
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  return withAdminContext(async (adminDb) => {
    const result = await adminDb.execute(sql`
      SELECT id, reason, taken_by_kind, taken_by_id, taken_by_name,
             edit_id, created_at
      FROM content_page_snapshots
      WHERE entity = ${entity} AND entity_id = ${entityId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return rowsOf(result);
  });
}

export async function getSnapshotById(
  entity: Entity,
  entityId: string,
  snapshotId: string,
): Promise<{ id: string; entity: string; entity_id: string; snapshot: any; reason: string; created_at: string } | null> {
  assertEntityKnown(entity);
  return withAdminContext(async (adminDb) => {
    const result = await adminDb.execute(sql`
      SELECT id, entity, entity_id, snapshot, reason, taken_by_kind, taken_by_id, taken_by_name, edit_id, created_at
      FROM content_page_snapshots
      WHERE id = ${snapshotId} AND entity = ${entity} AND entity_id = ${entityId}
      LIMIT 1
    `);
    return (rowsOf(result)[0] as any) ?? null;
  });
}

/**
 * Diff two snapshots by id, OR a snapshot vs the current row state.
 * Pass `to: 'head'` to diff against current.
 */
export async function diffPageVersions(
  entity: Entity,
  entityId: string,
  fromSnapshotId: string,
  to: string | 'head',
): Promise<{ diff: CompositionDiff; summary: string; from: any; to: any }> {
  assertEntityKnown(entity);
  return withAdminContext(async (adminDb) => {
    const from = await getSnapshotByIdInTxn(adminDb, entity, entityId, fromSnapshotId);
    if (!from) {
      throw new PageServiceError(
        `from snapshot ${fromSnapshotId} not found`,
        'snapshot_not_found',
        404,
      );
    }

    let toBody: Record<string, unknown> | null = null;
    let toMeta: any = null;

    if (to === 'head') {
      const row = await loadRow(adminDb, entity, entityId);
      if (!row) {
        throw new PageServiceError(`${entity} ${entityId} not found`, 'not_found', 404);
      }
      toBody = (row.composition_json as Record<string, unknown> | null) ?? {};
      toMeta = {
        kind: 'head',
        status: row.status,
        updated_at: row.updated_at,
      };
    } else {
      const toSnap = await getSnapshotByIdInTxn(adminDb, entity, entityId, to);
      if (!toSnap) {
        throw new PageServiceError(
          `to snapshot ${to} not found`,
          'snapshot_not_found',
          404,
        );
      }
      toBody = (toSnap.snapshot?.composition_json as Record<string, unknown> | null) ?? {};
      toMeta = {
        kind: 'snapshot',
        snapshot_id: toSnap.id,
        reason: toSnap.reason,
        created_at: toSnap.created_at,
      };
    }

    const fromBody = (from.snapshot?.composition_json as Record<string, unknown> | null) ?? {};
    const diff = diffComposition(fromBody, toBody);
    return {
      diff,
      summary: summarizeDiff(diff),
      from: {
        kind: 'snapshot',
        snapshot_id: from.id,
        reason: from.reason,
        created_at: from.created_at,
      },
      to: toMeta,
    };
  });
}

async function getSnapshotByIdInTxn(
  adminDb: any,
  entity: Entity,
  entityId: string,
  snapshotId: string,
): Promise<any | null> {
  const result = await adminDb.execute(sql`
    SELECT id, entity, entity_id, snapshot, reason, created_at
    FROM content_page_snapshots
    WHERE id = ${snapshotId} AND entity = ${entity} AND entity_id = ${entityId}
    LIMIT 1
  `);
  return rowsOf(result)[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// schedulePublish — set scheduled_publish_at + transition→review (if from
// draft) so the publish-cron picks it up at the scheduled time.
// ─────────────────────────────────────────────────────────────────────────────

export interface SchedulePublishInput {
  entity: Entity;
  rowId: string;
  /** ISO timestamp string. Must be in the future. */
  scheduled_publish_at: string;
  actor: Actor;
  ctx?: EditContext;
}

export async function schedulePublish(input: SchedulePublishInput): Promise<Record<string, unknown>> {
  const safeEntity = assertEntityKnown(input.entity);
  validateActor(input.actor);
  const ts = new Date(input.scheduled_publish_at);
  if (Number.isNaN(ts.getTime())) {
    throw new PageServiceError(
      `invalid scheduled_publish_at: ${input.scheduled_publish_at}`,
      'invalid_actor',
      400,
    );
  }
  if (ts.getTime() <= Date.now()) {
    throw new PageServiceError(
      `scheduled_publish_at must be in the future`,
      'invalid_actor',
      400,
    );
  }

  return withAdminContext(async (adminDb) => {
    const cur = await loadRowForUpdate(adminDb, safeEntity, input.rowId);
    if (!cur) {
      throw new PageServiceError(`${safeEntity} ${input.rowId} not found`, 'not_found', 404);
    }
    const fromStatus = cur.status as Status;

    // Set scheduled_publish_at; transition to review if currently draft so
    // the cron sweeper picks it up. (Cron flips review→published when
    // scheduled_publish_at <= now() per spec D13.)
    let nextStatus: Status = fromStatus;
    if (fromStatus === 'draft' || fromStatus === 'archived') {
      const v = validateTransition(fromStatus, 'review');
      if (!v.allowed) {
        throw new PageServiceError(v.reason, 'invalid_transition', 422);
      }
      nextStatus = 'review';
    } else if (fromStatus === 'published') {
      // Re-scheduling an already-published row is a no-op for status; we
      // still update scheduled_publish_at to reflect intent.
      nextStatus = fromStatus;
    }

    await adminDb.execute(
      sql.raw(`
        UPDATE ${safeEntity}
           SET scheduled_publish_at = $1::timestamptz,
               status = $2,
               last_edited_by_kind = $3,
               last_edited_by_name = $4,
               last_edited_at = now()
         WHERE id = $5
      `),
      [
        input.scheduled_publish_at,
        nextStatus,
        input.actor.kind,
        input.actor.name,
        input.rowId,
      ],
    );

    await insertContentEditRow(adminDb, {
      entity: safeEntity,
      entity_id: input.rowId,
      field: '__schedule',
      editor_type: input.actor.kind,
      editor_id: input.actor.id,
      editor_name: input.actor.name,
      previous_value: { scheduled_publish_at: cur.scheduled_publish_at, status: fromStatus },
      new_value: { scheduled_publish_at: input.scheduled_publish_at, status: nextStatus },
      change_kind: nextStatus === 'review' ? 'transition_review' : 'scalar',
      reason: input.ctx?.reason ?? `schedule_publish_at=${input.scheduled_publish_at}`,
      ip_address: input.ctx?.ip_address ?? null,
      user_agent: input.ctx?.user_agent ?? null,
      edit_source: input.ctx?.edit_source ?? (input.actor.kind === 'agent' ? 'agent_api' : input.actor.kind === 'system' ? 'system' : 'admin_ui'),
      metadata: input.ctx?.metadata ?? null,
    });

    const post = await loadRow(adminDb, safeEntity, input.rowId);
    return post ?? {};
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal — duplicated audit insert + composition update.
// ─────────────────────────────────────────────────────────────────────────────

function validateActor(actor: Actor): void {
  if (!actor || typeof actor !== 'object') {
    throw new PageServiceError('actor required', 'invalid_actor', 400);
  }
  if (!(['human', 'agent', 'system'] as const).includes(actor.kind)) {
    throw new PageServiceError(
      `invalid actor.kind: ${(actor as any).kind}`,
      'invalid_actor',
      400,
    );
  }
  if (actor.kind !== 'system' && (actor.id == null || actor.id === '')) {
    throw new PageServiceError(
      `actor.id required when kind=${actor.kind}`,
      'invalid_actor',
      400,
    );
  }
}

async function updateCompositionJson(
  adminDb: any,
  entity: Entity,
  rowId: string,
  nextComp: Record<string, unknown>,
  actor: Actor,
): Promise<void> {
  const safe = assertEntityKnown(entity);
  await adminDb.execute(
    sql.raw(`
      UPDATE ${safe}
         SET composition_json = $1::jsonb,
             last_edited_by_kind = $2,
             last_edited_by_name = $3,
             last_edited_at = now()
       WHERE id = $4
    `),
    [
      JSON.stringify(nextComp ?? {}),
      actor.kind,
      actor.name,
      rowId,
    ],
  );
}

interface ContentEditInsertInput {
  entity: Entity;
  entity_id: string;
  field: string;
  editor_type: 'human' | 'agent' | 'system';
  editor_id: string | null;
  editor_name: string | null;
  previous_value: unknown;
  new_value: unknown;
  change_kind: 'scalar' | 'rich_text_replaced' | 'transition_review' | 'transition_approved' | 'transition_published' | 'transition_archived' | 'lint_block' | 'lint_warn';
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  edit_source: 'admin_ui' | 'agent_api' | 'system';
  metadata: Record<string, unknown> | null;
}

async function insertContentEditRow(
  adminDb: any,
  input: ContentEditInsertInput,
): Promise<void> {
  await adminDb.execute(
    sql.raw(`
      INSERT INTO content_edits
        (entity, entity_id, field,
         editor_type, editor_id, editor_name,
         previous_value, new_value,
         change_kind, reason, ip_address, user_agent,
         edit_source, metadata)
      VALUES ($1, $2, $3, $4, $5, $6,
              $7::jsonb, $8::jsonb,
              $9, $10, $11, $12,
              $13, $14::jsonb)
    `),
    [
      input.entity,
      input.entity_id,
      input.field,
      input.editor_type,
      input.editor_id,
      input.editor_name,
      JSON.stringify(input.previous_value ?? null),
      JSON.stringify(input.new_value ?? null),
      input.change_kind,
      input.reason,
      input.ip_address,
      input.user_agent,
      input.edit_source,
      input.metadata == null ? null : JSON.stringify(input.metadata),
    ],
  );
}

// Re-export PageServiceError so route handlers can import from one module.
export { PageServiceError } from './page-service';
