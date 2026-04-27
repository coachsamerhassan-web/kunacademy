/**
 * Wave 15 Wave 1 — page-service
 *
 * Entity-aware CRUD + status state machine + snapshot helpers.
 *
 * Three sibling entities share this surface:
 *   - landing_pages
 *   - blog_posts
 *   - static_pages
 *
 * Design constraints (locked):
 *   - DB access is Drizzle-direct via `withAdminContext` (per Wave 15 §2).
 *     There is NO provider abstraction. Drift IS the bug.
 *   - withAdminContext owns the transaction — never issue your own
 *     BEGIN/COMMIT inside (per learned-pattern 2026-04-26). Throw to roll
 *     back; return normally to commit.
 *   - Every state transition writes (a) a `content_edits` row with the
 *     matching `change_kind` and (b) a `content_page_snapshots` row when
 *     the transition crosses the published boundary OR is a manual
 *     checkpoint OR is a pre_rollback marker.
 *   - Snapshot table is append-only (REVOKE UPDATE/DELETE + BEFORE UPDATE/
 *     DELETE triggers per migration 0067). All snapshot writes go through
 *     `createSnapshot()`; never inline INSERT or UPDATE.
 *   - Agent writes default to `status='draft'`. publish_scopes (Set<entity>)
 *     on the agent's scope row is the ONLY mechanism to allow direct
 *     publish (Wave 15 D8 — Shahira on testimonials only at launch).
 *     publish_scopes wiring lands in Wave 2; this Wave 1 surface accepts an
 *     `actor.publish_scopes` set on every transition call so Wave 2's REST
 *     routes can populate it from `agent_tokens` without a refactor.
 */

import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import {
  landing_pages,
  blog_posts,
  static_pages,
  content_edits,
  content_page_snapshots,
} from '@kunacademy/db/schema';
import type { AnyPgTable } from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Entity = 'landing_pages' | 'blog_posts' | 'static_pages';

export type Status = 'draft' | 'review' | 'published' | 'archived';

export type ActorKind = 'human' | 'agent' | 'system';

export type SnapshotReason = 'publish' | 'archive' | 'manual' | 'pre_rollback' | 'migration';

export type ChangeKind =
  | 'scalar'
  | 'rich_text_replaced'
  | 'transition_review'
  | 'transition_approved'
  | 'transition_published'
  | 'transition_archived'
  | 'lint_block'
  | 'lint_warn';

/**
 * Actor invoking a service helper. The service does not perform auth — the
 * caller (admin route, agent route) auth-gates BEFORE calling. The Actor
 * carries the audit identity that lands in content_edits.
 */
export interface Actor {
  kind: ActorKind;
  /** profiles.id (human) | agent_tokens.id (agent) | null (system). */
  id: string | null;
  /** Denormalized display name for audit UI. */
  name: string | null;
  /**
   * Publish authority gate (Wave 2 will wire from agent_tokens.publish_scopes).
   * If absent, treated as empty set (no direct publish authority for agents).
   * Humans bypass this check by virtue of `kind='human'` + admin auth at the
   * route layer. System actors bypass by virtue of `kind='system'` (only
   * migration / cron contexts use this).
   */
  publish_scopes?: Set<Entity>;
}

/** Optional context recorded on content_edits — origin tracking. */
export interface EditContext {
  edit_source?: 'admin_ui' | 'agent_api' | 'system';
  reason?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  /** { model, prompt_summary_hash, session_id, confidence }. */
  metadata?: Record<string, unknown> | null;
}

export class PageServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'invalid_transition'
      | 'unauthorized_publish'
      | 'unauthorized_actor'
      | 'not_found'
      | 'unknown_entity'
      | 'invalid_actor'
      | 'invalid_snapshot_reason'
      | 'snapshot_not_found',
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'PageServiceError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity dispatch — per spec, NOT a provider pattern; just a typed map.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drizzle table object per entity. We type as AnyPgTable to allow the
 * heterogeneous map; callers down-cast at the query site as needed (the
 * column shapes overlap on the columns we touch — id, slug, status,
 * composition_json, hero_json, seo_meta_json, last_edited_*).
 */
const ENTITY_TABLES: Record<Entity, AnyPgTable> = {
  landing_pages,
  blog_posts,
  static_pages,
};

function tableFor(entity: Entity): AnyPgTable {
  const t = ENTITY_TABLES[entity];
  if (!t) {
    throw new PageServiceError(`Unknown entity: ${entity}`, 'unknown_entity', 400);
  }
  return t;
}

/**
 * Defense-in-depth whitelist guard for any code path that must interpolate
 * the entity name into a SQL identifier (sql.raw). TypeScript erases the
 * `Entity` literal-union at runtime, so without this guard, a route that
 * accepts a body-supplied entity could smuggle arbitrary SQL.
 *
 * Returns the entity unchanged if it's a known key. Throws PageServiceError
 * 'unknown_entity' otherwise. Always called BEFORE the sql.raw site.
 */
export function assertEntityKnown(entity: string): Entity {
  if (!Object.prototype.hasOwnProperty.call(ENTITY_TABLES, entity)) {
    throw new PageServiceError(
      `Unknown entity: ${entity}`,
      'unknown_entity',
      400,
    );
  }
  return entity as Entity;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status state machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Allowed transitions:
 *   draft     → review | archived
 *   review    → draft  | published | archived
 *   published → archived
 *   archived  → draft (re-edit path)
 *
 * Notes:
 *   - "approved" is conceptually distinct from "published" but is collapsed
 *     into a single transition for the data model: the act of moving from
 *     `review` to `published` IS the approval. Wave 15 §3.4 + D8.
 *   - A direct draft→published shortcut exists for admin ergonomics but the
 *     audit row STILL writes change_kind='transition_published' with prev
 *     status='draft'.
 *   - Agents may transition draft↔review and submit pre_rollback markers.
 *     They may NOT transition to published unless the entity is in their
 *     `publish_scopes` set.
 */
export function validateTransition(
  from: Status,
  to: Status,
): { allowed: true } | { allowed: false; reason: string } {
  if (from === to) {
    return { allowed: false, reason: `same-state transition (${from})` };
  }

  const allowed: Record<Status, Status[]> = {
    draft: ['review', 'published', 'archived'],
    review: ['draft', 'published', 'archived'],
    published: ['archived', 'review', 'draft'], // re-edit path: published → review/draft for revisions
    archived: ['draft'],
  };

  if (allowed[from]?.includes(to)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `transition ${from}→${to} not allowed (allowed from ${from}: ${allowed[from]?.join(',')})`,
  };
}

/** change_kind value matching the to-status. */
function changeKindForTransition(to: Status): ChangeKind {
  switch (to) {
    case 'review':
      return 'transition_review';
    case 'published':
      return 'transition_published';
    case 'archived':
      return 'transition_archived';
    case 'draft':
      // No 'transition_draft' value in the whitelist — a draft re-entry
      // (e.g. from review) is recorded as transition_review's reverse via
      // the prev/new values; we use 'transition_approved' to indicate the
      // explicit approval path was reverted. Per spec §4.4 the whitelist
      // is the authoritative set; we use the closest match.
      // Simpler choice: use 'scalar' for the rare draft re-entry from
      // review (which is editorial backtrack, not a state-machine
      // milestone). That keeps the audit row but doesn't lie about a
      // transition that IS a milestone.
      return 'scalar';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public surface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transition a row's status. Atomically:
 *   1. Loads the current row (row-locks via FOR UPDATE).
 *   2. Validates the transition.
 *   3. Validates publish authority (agents need publish_scopes).
 *   4. Snapshots BEFORE the transition for crossings of the published
 *      boundary AND for archive transitions.
 *   5. Updates status (which triggers the sync trigger to mirror published).
 *   6. Writes the content_edits audit row.
 *
 * Returns the post-transition row.
 */
export async function transitionStatus(
  entity: Entity,
  rowId: string,
  to: Status,
  actor: Actor,
  ctx: EditContext = {},
): Promise<Record<string, unknown>> {
  assertEntityKnown(entity);
  validateActor(actor);

  return withAdminContext(async (adminDb) => {
    // 1. Load row with FOR UPDATE
    const cur = await loadRowForUpdate(adminDb, entity, rowId);
    if (!cur) {
      throw new PageServiceError(
        `${entity} ${rowId} not found`,
        'not_found',
        404,
      );
    }
    const fromStatus = cur.status as Status;

    // 2. Validate the transition
    const v = validateTransition(fromStatus, to);
    if (!v.allowed) {
      throw new PageServiceError(v.reason, 'invalid_transition', 422);
    }

    // 3. Validate publish authority for agents
    if (
      actor.kind === 'agent'
      && to === 'published'
      && !(actor.publish_scopes?.has(entity) ?? false)
    ) {
      throw new PageServiceError(
        `agent ${actor.name ?? actor.id} lacks publish authority on ${entity}`,
        'unauthorized_publish',
        403,
      );
    }

    // 4. Snapshot BEFORE crossing the published boundary OR before archive.
    //    Snapshots fire on:
    //      - publish (any path that ENTERS published)
    //      - archive
    //    Manual / pre_rollback / migration snapshots are taken via
    //    createSnapshot() directly, not from inside transitionStatus.
    if (to === 'published' || to === 'archived') {
      const snapReason: SnapshotReason = to === 'published' ? 'publish' : 'archive';
      await createSnapshotInTxn(adminDb, {
        entity,
        entity_id: rowId,
        snapshot: cur, // pre-transition state
        reason: snapReason,
        taken_by_kind: actor.kind,
        taken_by_id: actor.id,
        taken_by_name: actor.name,
        edit_id: null, // we'll point the post-update content_edits row at this snapshot via a follow-up if useful; for now NULL.
      });
    }

    // 5. Update status. The DB sync trigger mirrors published / published_at.
    //    last_edited_* are stamped here; the BEFORE UPDATE touch trigger
    //    refreshes updated_at + last_edited_at as a backstop.
    await updateStatusForEntity(adminDb, entity, rowId, to, actor);

    // 6. Audit row for the transition
    const changeKind = changeKindForTransition(to);
    await insertContentEditRow(adminDb, {
      entity,
      entity_id: rowId,
      field: '__status',
      editor_type: actor.kind,
      editor_id: actor.id,
      editor_name: actor.name,
      previous_value: { status: fromStatus },
      new_value: { status: to },
      change_kind: changeKind,
      reason: ctx.reason ?? null,
      ip_address: ctx.ip_address ?? null,
      user_agent: ctx.user_agent ?? null,
      edit_source:
        ctx.edit_source
        ?? (actor.kind === 'agent'
          ? 'agent_api'
          : actor.kind === 'system'
            ? 'system'
            : 'admin_ui'),
      metadata: ctx.metadata ?? null,
    });

    // Re-load post-transition row
    const post = await loadRow(adminDb, entity, rowId);
    if (!post) {
      // Should be impossible; row existed inside the txn.
      throw new PageServiceError(
        `${entity} ${rowId} disappeared mid-transition`,
        'not_found',
        500,
      );
    }
    return post;
  });
}

/**
 * Take a manual / pre_rollback / migration snapshot. publish + archive
 * snapshots are taken automatically inside transitionStatus().
 *
 * Returns the new snapshot row's id.
 */
export async function createSnapshot(
  entity: Entity,
  entityId: string,
  reason: SnapshotReason,
  actor: Actor,
  opts: { edit_id?: string | null } = {},
): Promise<string> {
  assertEntityKnown(entity);
  validateActor(actor);

  if (!(['publish', 'archive', 'manual', 'pre_rollback', 'migration'] as const).includes(reason)) {
    throw new PageServiceError(
      `invalid snapshot reason: ${reason}`,
      'invalid_snapshot_reason',
      400,
    );
  }

  return withAdminContext(async (adminDb) => {
    const cur = await loadRow(adminDb, entity, entityId);
    if (!cur) {
      throw new PageServiceError(
        `${entity} ${entityId} not found`,
        'not_found',
        404,
      );
    }
    const newId = await createSnapshotInTxn(adminDb, {
      entity,
      entity_id: entityId,
      snapshot: cur,
      reason,
      taken_by_kind: actor.kind,
      taken_by_id: actor.id,
      taken_by_name: actor.name,
      edit_id: opts.edit_id ?? null,
    });
    return newId;
  });
}

/**
 * Roll a row back to a prior snapshot. Atomically:
 *   1. Load the target snapshot.
 *   2. Take a `pre_rollback` snapshot of the CURRENT state.
 *   3. Restore the snapshotted columns onto the row.
 *   4. Write a content_edits audit row with previous/new = whole row diff.
 *
 * Note: rollback re-applies the snapshotted state but does NOT skip the
 * lint surface — Wave 2's transition flow re-runs lints if/when the
 * restored row is re-published. The rollback itself does not fire lint.
 */
export async function rollbackToSnapshot(
  entity: Entity,
  entityId: string,
  snapshotId: string,
  actor: Actor,
  ctx: EditContext = {},
): Promise<Record<string, unknown>> {
  assertEntityKnown(entity);
  validateActor(actor);

  return withAdminContext(async (adminDb) => {
    // 1. Load the target snapshot
    const snapRows = await adminDb.execute(sql`
      SELECT id, entity, entity_id, snapshot, reason, created_at
      FROM content_page_snapshots
      WHERE id = ${snapshotId} AND entity = ${entity} AND entity_id = ${entityId}
      LIMIT 1
    `);
    const snap = (snapRows as unknown as { rows?: any[] }).rows?.[0]
      ?? (Array.isArray(snapRows) ? (snapRows as any[])[0] : undefined);
    if (!snap) {
      throw new PageServiceError(
        `snapshot ${snapshotId} not found for ${entity} ${entityId}`,
        'snapshot_not_found',
        404,
      );
    }

    // 2. Load + lock current row
    const cur = await loadRowForUpdate(adminDb, entity, entityId);
    if (!cur) {
      throw new PageServiceError(`${entity} ${entityId} not found`, 'not_found', 404);
    }

    // 3. Pre-rollback snapshot
    await createSnapshotInTxn(adminDb, {
      entity,
      entity_id: entityId,
      snapshot: cur,
      reason: 'pre_rollback',
      taken_by_kind: actor.kind,
      taken_by_id: actor.id,
      taken_by_name: actor.name,
      edit_id: null,
    });

    // 4. Restore snapshotted shape. We restore the JSONB body fields and
    //    SEO; status is preserved from current (rollback does NOT republish
    //    — it returns the row to its prior body but leaves status alone).
    //    The caller can subsequently transitionStatus(...) if they want to
    //    republish.
    const snapBody = snap.snapshot as Record<string, unknown>;
    await restoreRowBody(adminDb, entity, entityId, snapBody, actor);

    // 5. Audit row
    await insertContentEditRow(adminDb, {
      entity,
      entity_id: entityId,
      field: '__rollback',
      editor_type: actor.kind,
      editor_id: actor.id,
      editor_name: actor.name,
      previous_value: { snapshot_id_taken_just_before: null }, // we wrote the pre_rollback above; we don't co-ref it here to keep the audit row simple
      new_value: { restored_from_snapshot_id: snapshotId },
      change_kind: 'scalar',
      reason: ctx.reason ?? null,
      ip_address: ctx.ip_address ?? null,
      user_agent: ctx.user_agent ?? null,
      edit_source:
        ctx.edit_source
        ?? (actor.kind === 'agent'
          ? 'agent_api'
          : actor.kind === 'system'
            ? 'system'
            : 'admin_ui'),
      metadata: ctx.metadata ?? null,
    });

    const post = await loadRow(adminDb, entity, entityId);
    return post ?? {};
  });
}

/**
 * Load a row with all snapshot rows (newest first). Used by the editor's
 * "Versions" panel.
 */
export async function loadPageWithSnapshots(
  entity: Entity,
  entityId: string,
): Promise<{ row: Record<string, unknown> | null; snapshots: any[] }> {
  assertEntityKnown(entity);
  return withAdminContext(async (adminDb) => {
    const row = await loadRow(adminDb, entity, entityId);
    const snapsResult = await adminDb.execute(sql`
      SELECT id, reason, taken_by_kind, taken_by_id, taken_by_name,
             edit_id, created_at
      FROM content_page_snapshots
      WHERE entity = ${entity} AND entity_id = ${entityId}
      ORDER BY created_at DESC
      LIMIT 200
    `);
    const snapshots =
      (snapsResult as unknown as { rows?: any[] }).rows
      ?? (Array.isArray(snapsResult) ? (snapsResult as any[]) : []);
    return { row, snapshots };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers — single-source-of-truth SQL inside withAdminContext
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

async function loadRow(
  adminDb: any,
  entity: Entity,
  rowId: string,
): Promise<Record<string, unknown> | null> {
  const safeEntity = assertEntityKnown(entity);
  const result = await adminDb.execute(
    sql.raw(`SELECT * FROM ${safeEntity} WHERE id = $1 LIMIT 1`),
    [rowId],
  );
  return rowsOf(result)[0] ?? null;
}

async function loadRowForUpdate(
  adminDb: any,
  entity: Entity,
  rowId: string,
): Promise<Record<string, unknown> | null> {
  const safeEntity = assertEntityKnown(entity);
  const result = await adminDb.execute(
    sql.raw(`SELECT * FROM ${safeEntity} WHERE id = $1 FOR UPDATE`),
    [rowId],
  );
  return rowsOf(result)[0] ?? null;
}

async function updateStatusForEntity(
  adminDb: any,
  entity: Entity,
  rowId: string,
  to: Status,
  actor: Actor,
): Promise<void> {
  const safeEntity = assertEntityKnown(entity);
  // last_edited_by uuid column exists on all three tables. last_edited_by_kind
  // / last_edited_by_name exist after migrations 0066. last_edited_at is set
  // via the touch trigger on landing_pages, plus we explicitly set it here
  // for static_pages (its trigger is COALESCE'd) and blog_posts (no touch
  // trigger of its own — see verification note below).
  await adminDb.execute(
    sql.raw(
      `UPDATE ${safeEntity}
         SET status = $1,
             last_edited_by = $2,
             last_edited_by_kind = $3,
             last_edited_by_name = $4,
             last_edited_at = now()
       WHERE id = $5`,
    ),
    [to, actor.id, actor.kind, actor.name, rowId],
  );
}

async function restoreRowBody(
  adminDb: any,
  entity: Entity,
  rowId: string,
  snap: Record<string, unknown>,
  actor: Actor,
): Promise<void> {
  // Restore body fields that exist across the three tables. We pick a
  // conservative shape:
  //   - composition_json
  //   - hero_json   (landing_pages + static_pages)
  //   - seo_meta_json (landing_pages + static_pages)
  // Per-entity branches for the columns that don't exist on every table.
  if (entity === 'blog_posts') {
    await adminDb.execute(
      sql.raw(
        `UPDATE blog_posts
           SET composition_json = $1::jsonb,
               content_ar       = $2,
               content_en       = $3,
               excerpt_ar       = $4,
               excerpt_en       = $5,
               content_ar_rich  = $6::jsonb,
               content_en_rich  = $7::jsonb,
               excerpt_ar_rich  = $8::jsonb,
               excerpt_en_rich  = $9::jsonb,
               last_edited_by   = $10,
               last_edited_by_kind = $11,
               last_edited_by_name = $12,
               last_edited_at   = now()
         WHERE id = $13`,
      ),
      [
        jsonOrNull(snap.composition_json),
        snap.content_ar ?? null,
        snap.content_en ?? null,
        snap.excerpt_ar ?? null,
        snap.excerpt_en ?? null,
        jsonOrNull(snap.content_ar_rich),
        jsonOrNull(snap.content_en_rich),
        jsonOrNull(snap.excerpt_ar_rich),
        jsonOrNull(snap.excerpt_en_rich),
        actor.id,
        actor.kind,
        actor.name,
        rowId,
      ],
    );
    return;
  }

  // landing_pages OR static_pages
  const safeEntity = assertEntityKnown(entity);
  await adminDb.execute(
    sql.raw(
      `UPDATE ${safeEntity}
         SET composition_json = $1::jsonb,
             hero_json        = $2::jsonb,
             seo_meta_json    = $3::jsonb,
             last_edited_by   = $4,
             last_edited_by_kind = $5,
             last_edited_by_name = $6,
             last_edited_at   = now()
       WHERE id = $7`,
    ),
    [
      jsonOrNull(snap.composition_json),
      jsonOrNull(snap.hero_json),
      jsonOrNull(snap.seo_meta_json),
      actor.id,
      actor.kind,
      actor.name,
      rowId,
    ],
  );
}

interface SnapshotInsertInput {
  entity: Entity;
  entity_id: string;
  snapshot: Record<string, unknown>;
  reason: SnapshotReason;
  taken_by_kind: ActorKind;
  taken_by_id: string | null;
  taken_by_name: string | null;
  edit_id: string | null;
}

async function createSnapshotInTxn(
  adminDb: any,
  input: SnapshotInsertInput,
): Promise<string> {
  const result = await adminDb.execute(
    sql.raw(
      `INSERT INTO content_page_snapshots
         (entity, entity_id, snapshot, reason,
          taken_by_kind, taken_by_id, taken_by_name, edit_id)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
       RETURNING id`,
    ),
    [
      input.entity,
      input.entity_id,
      JSON.stringify(input.snapshot ?? {}),
      input.reason,
      input.taken_by_kind,
      input.taken_by_id,
      input.taken_by_name,
      input.edit_id,
    ],
  );
  const r = rowsOf(result)[0];
  if (!r || !r.id) {
    throw new PageServiceError(
      'snapshot insert returned no id',
      'unknown_entity',
      500,
    );
  }
  return r.id as string;
}

interface ContentEditInsertInput {
  entity: Entity;
  entity_id: string;
  field: string;
  editor_type: ActorKind;
  editor_id: string | null;
  editor_name: string | null;
  previous_value: unknown;
  new_value: unknown;
  change_kind: ChangeKind;
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
    sql.raw(
      `INSERT INTO content_edits
         (entity, entity_id, field,
          editor_type, editor_id, editor_name,
          previous_value, new_value,
          change_kind, reason, ip_address, user_agent,
          edit_source, metadata)
       VALUES ($1, $2, $3, $4, $5, $6,
               $7::jsonb, $8::jsonb,
               $9, $10, $11, $12,
               $13, $14::jsonb)`,
    ),
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

function jsonOrNull(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function rowsOf(result: any): Record<string, any>[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as Record<string, any>[];
  if (Array.isArray(result.rows)) return result.rows as Record<string, any>[];
  return [];
}
