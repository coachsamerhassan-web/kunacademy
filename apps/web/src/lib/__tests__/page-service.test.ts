/**
 * Wave 15 Wave 1 — page-service tests
 *
 * Pattern: node:test + tsx + Module.prototype.require monkey-patch (per Wave
 * E.2 learned-pattern). The tests cover:
 *   - Status state machine (transitionStatus): allowed + disallowed paths
 *   - Snapshot creation on every status crossing the published boundary
 *   - Snapshot creation on archive transitions
 *   - content_edits row written for every state transition with correct change_kind
 *   - Agent publish gate: agent without publish_scopes is rejected
 *   - Agent with publish_scopes is allowed
 *   - validateTransition pure-helper edge cases
 *
 * Backfill semantics + sync trigger correctness are exercised at the DB
 * level (not here) — covered in the SQL DO $verify$ blocks of migration
 * 0066 + the Wave 1 deploy-verify SQL probes.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory fake "database" with rudimentary SQL parsing for the queries the
// service actually issues. We assert on table state after each operation.
// ─────────────────────────────────────────────────────────────────────────────

interface PageRow {
  id: string;
  status: string;
  composition_json: any;
  hero_json: any;
  seo_meta_json: any;
  published: boolean;
  published_at: string | null;
  last_edited_by: string | null;
  last_edited_by_kind: string | null;
  last_edited_by_name: string | null;
  last_edited_at: string;
}

interface SnapshotRow {
  id: string;
  entity: string;
  entity_id: string;
  snapshot: any;
  reason: string;
  taken_by_kind: string;
  taken_by_id: string | null;
  taken_by_name: string | null;
  edit_id: string | null;
  created_at: string;
}

interface EditRow {
  id: string;
  entity: string;
  entity_id: string;
  field: string;
  editor_type: string;
  editor_id: string | null;
  editor_name: string | null;
  previous_value: any;
  new_value: any;
  change_kind: string;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  edit_source: string;
  metadata: any;
  created_at: string;
}

const tables: Record<string, PageRow[]> = {
  landing_pages: [],
  blog_posts: [],
  static_pages: [],
};
const snapshots: SnapshotRow[] = [];
const edits: EditRow[] = [];
let idCounter = 0;
const newId = (prefix: string) => `${prefix}_${++idCounter}`;

function resetTables() {
  tables.landing_pages = [];
  tables.blog_posts = [];
  tables.static_pages = [];
  snapshots.length = 0;
  edits.length = 0;
  idCounter = 0;
}

function seedRow(entity: 'landing_pages' | 'blog_posts' | 'static_pages', overrides: Partial<PageRow> = {}): PageRow {
  const row: PageRow = {
    id: newId('row'),
    status: 'draft',
    composition_json: { sections: [] },
    hero_json: { hero_image_url: '/x.png' },
    seo_meta_json: { meta_title_ar: 'A', meta_title_en: 'B' },
    published: false,
    published_at: null,
    last_edited_by: null,
    last_edited_by_kind: 'human',
    last_edited_by_name: 'Seed',
    last_edited_at: new Date().toISOString(),
    ...overrides,
  };
  tables[entity].push(row);
  return row;
}

function fakeExecute(queryObj: any, params?: any[]) {
  // queryObj can come from sql.raw('...') OR sql template — we only call
  // sql.raw + sql template literals in page-service. Both expose either
  // .strings (template) or .sql (.raw), or the function itself stringifies.
  // We accept all three call shapes.
  let raw =
    queryObj?.queryChunks
      ?.map((c: any) => (typeof c === 'string' ? c : c?.value ?? ''))
      .join('') ?? '';
  if (!raw) raw = queryObj?.sql ?? '';
  if (!raw && typeof queryObj === 'string') raw = queryObj;
  if (!raw && Array.isArray(queryObj?.strings)) raw = queryObj.strings.join('?');
  raw = (raw as string).replace(/\s+/g, ' ').trim();
  const values: any[] = params ?? queryObj?.params ?? queryObj?.values ?? [];

  // Sync trigger emulation: when status is set, mirror published / published_at.
  // We do this by touching the row in updateStatus + sql.raw paths.

  // ── SELECT row ──────────────────────────────────────────────────────────
  let m = /^SELECT \* FROM (\w+) WHERE id = \$1(?: FOR UPDATE)?(?: LIMIT \d+)?$/i.exec(raw);
  if (m) {
    const [, entity] = m;
    const rid = values[0];
    const row = tables[entity]?.find((r) => r.id === rid) ?? null;
    return { rows: row ? [row] : [] };
  }

  // ── UPDATE status ───────────────────────────────────────────────────────
  m = /^UPDATE (\w+) SET status = \$1, last_edited_by = \$2, last_edited_by_kind = \$3, last_edited_by_name = \$4, last_edited_at = now\(\) WHERE id = \$5$/i.exec(
    raw,
  );
  if (m) {
    const [, entity] = m;
    const [status, editorId, editorKind, editorName, rid] = values;
    const row = tables[entity]?.find((r) => r.id === rid);
    if (!row) return { rows: [] };
    row.status = status;
    row.last_edited_by = editorId;
    row.last_edited_by_kind = editorKind;
    row.last_edited_by_name = editorName;
    row.last_edited_at = new Date().toISOString();
    // sync trigger
    if (status === 'published') {
      row.published = true;
      row.published_at = row.published_at ?? new Date().toISOString();
    } else {
      row.published = false;
      row.published_at = null;
    }
    return { rows: [] };
  }

  // ── UPDATE body restore (landing_pages / static_pages) ──────────────────
  m = /^UPDATE (landing_pages|static_pages) SET composition_json = \$1::jsonb, hero_json = \$2::jsonb, seo_meta_json = \$3::jsonb, last_edited_by = \$4, last_edited_by_kind = \$5, last_edited_by_name = \$6, last_edited_at = now\(\) WHERE id = \$7$/i.exec(
    raw,
  );
  if (m) {
    const [, entity] = m;
    const [comp, hero, seo, editorId, editorKind, editorName, rid] = values;
    const row = tables[entity]?.find((r) => r.id === rid);
    if (!row) return { rows: [] };
    row.composition_json = parseMaybeJSON(comp);
    row.hero_json = parseMaybeJSON(hero);
    row.seo_meta_json = parseMaybeJSON(seo);
    row.last_edited_by = editorId;
    row.last_edited_by_kind = editorKind;
    row.last_edited_by_name = editorName;
    row.last_edited_at = new Date().toISOString();
    return { rows: [] };
  }

  // ── INSERT content_page_snapshots ───────────────────────────────────────
  m = /^INSERT INTO content_page_snapshots \(entity, entity_id, snapshot, reason, taken_by_kind, taken_by_id, taken_by_name, edit_id\) VALUES \(\$1, \$2, \$3::jsonb, \$4, \$5, \$6, \$7, \$8\) RETURNING id$/i.exec(
    raw,
  );
  if (m) {
    const id = newId('snap');
    snapshots.push({
      id,
      entity: values[0],
      entity_id: values[1],
      snapshot: parseMaybeJSON(values[2]),
      reason: values[3],
      taken_by_kind: values[4],
      taken_by_id: values[5],
      taken_by_name: values[6],
      edit_id: values[7],
      created_at: new Date().toISOString(),
    });
    return { rows: [{ id }] };
  }

  // ── INSERT content_edits ────────────────────────────────────────────────
  m = /^INSERT INTO content_edits/i.exec(raw);
  if (m) {
    edits.push({
      id: newId('edit'),
      entity: values[0],
      entity_id: values[1],
      field: values[2],
      editor_type: values[3],
      editor_id: values[4],
      editor_name: values[5],
      previous_value: parseMaybeJSON(values[6]),
      new_value: parseMaybeJSON(values[7]),
      change_kind: values[8],
      reason: values[9],
      ip_address: values[10],
      user_agent: values[11],
      edit_source: values[12],
      metadata: parseMaybeJSON(values[13]),
      created_at: new Date().toISOString(),
    });
    return { rows: [] };
  }

  // ── Snapshot read by id ────────────────────────────────────────────────
  // Match the "SELECT id, entity, entity_id, snapshot, reason, created_at FROM content_page_snapshots WHERE id = $1 ..."
  m = /^SELECT id, entity, entity_id, snapshot, reason, created_at FROM content_page_snapshots WHERE/i.exec(raw);
  if (m) {
    const sid = values[0] ?? '';
    const ent = values[1] ?? '';
    const eid = values[2] ?? '';
    const s = snapshots.find(
      (x) => x.id === sid && x.entity === ent && x.entity_id === eid,
    );
    return { rows: s ? [s] : [] };
  }

  // ── Snapshot list (loadPageWithSnapshots) ──────────────────────────────
  m = /^SELECT id, reason, taken_by_kind, taken_by_id, taken_by_name, edit_id, created_at FROM content_page_snapshots WHERE entity = /i.exec(
    raw,
  );
  if (m) {
    const ent = values[0];
    const eid = values[1];
    const rows = snapshots
      .filter((x) => x.entity === ent && x.entity_id === eid)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { rows };
  }

  throw new Error(`fakeExecute: unhandled SQL: ${raw}`);
}

function parseMaybeJSON(v: any): any {
  if (v == null) return null;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Monkey-patch: intercept @kunacademy/db + @kunacademy/db/schema + drizzle-orm
// ─────────────────────────────────────────────────────────────────────────────

const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function patched(this: any, request: string) {
  if (request === '@kunacademy/db') {
    return {
      withAdminContext: async (fn: any) => {
        const adminDb = {
          execute: (q: any, params?: any[]) => fakeExecute(q, params),
        };
        return fn(adminDb);
      },
    };
  }
  if (request === '@kunacademy/db/schema') {
    return {
      landing_pages: { _: { name: 'landing_pages' } },
      blog_posts: { _: { name: 'blog_posts' } },
      static_pages: { _: { name: 'static_pages' } },
      content_edits: { _: { name: 'content_edits' } },
      content_page_snapshots: { _: { name: 'content_page_snapshots' } },
    };
  }
  if (request === 'drizzle-orm') {
    // sql template literal → returns a tiny shape with .queryChunks-like.
    // sql.raw → returns the same with the literal string.
    const sql: any = (strings: TemplateStringsArray, ...values: any[]) => {
      const queryChunks: any[] = [];
      strings.forEach((s, i) => {
        queryChunks.push(s);
        if (i < values.length) queryChunks.push({ value: '?' });
      });
      return { queryChunks, values };
    };
    sql.raw = (s: string) => ({ queryChunks: [s], sql: s });
    return { sql };
  }
  return originalRequire.call(this, request);
};

// ─────────────────────────────────────────────────────────────────────────────
// Now require the module under test
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-var-requires */
const ps = require('../authoring/page-service');
const {
  transitionStatus,
  createSnapshot,
  rollbackToSnapshot,
  loadPageWithSnapshots,
  validateTransition,
  PageServiceError,
} = ps;

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Wave 15 W1 / page-service / validateTransition', () => {
  test('allows draft → review', () => {
    const r = validateTransition('draft', 'review');
    assert.equal(r.allowed, true);
  });

  test('allows draft → published', () => {
    const r = validateTransition('draft', 'published');
    assert.equal(r.allowed, true);
  });

  test('allows review → published', () => {
    const r = validateTransition('review', 'published');
    assert.equal(r.allowed, true);
  });

  test('allows published → archived', () => {
    const r = validateTransition('published', 'archived');
    assert.equal(r.allowed, true);
  });

  test('allows published → review (re-edit path)', () => {
    const r = validateTransition('published', 'review');
    assert.equal(r.allowed, true);
  });

  test('allows archived → draft', () => {
    const r = validateTransition('archived', 'draft');
    assert.equal(r.allowed, true);
  });

  test('rejects archived → published', () => {
    const r = validateTransition('archived', 'published');
    assert.equal(r.allowed, false);
  });

  test('rejects archived → review', () => {
    const r = validateTransition('archived', 'review');
    assert.equal(r.allowed, false);
  });

  test('rejects same-state transition', () => {
    const r = validateTransition('draft', 'draft');
    assert.equal(r.allowed, false);
  });
});

describe('Wave 15 W1 / page-service / transitionStatus', () => {
  beforeEach(() => resetTables());

  test('human can transition draft → review (no publish_scopes needed)', async () => {
    const row = seedRow('landing_pages', { status: 'draft' });
    const post = await transitionStatus(
      'landing_pages',
      row.id,
      'review',
      { kind: 'human', id: 'admin-uuid', name: 'Samer' },
      { edit_source: 'admin_ui' },
    );
    assert.equal(post.status, 'review');
    assert.equal(post.published, false);
    // Audit row written
    assert.equal(edits.length, 1);
    assert.equal(edits[0].change_kind, 'transition_review');
    assert.equal(edits[0].field, '__status');
    assert.deepEqual(edits[0].previous_value, { status: 'draft' });
    assert.deepEqual(edits[0].new_value, { status: 'review' });
    // No snapshot yet (not crossing published boundary)
    assert.equal(snapshots.length, 0);
  });

  test('human can transition review → published; snapshot fires; audit writes transition_published', async () => {
    const row = seedRow('landing_pages', { status: 'review' });
    const post = await transitionStatus(
      'landing_pages',
      row.id,
      'published',
      { kind: 'human', id: 'admin-uuid', name: 'Samer' },
    );
    assert.equal(post.status, 'published');
    assert.equal(post.published, true);
    assert.notEqual(post.published_at, null);
    // 1 snapshot (publish), 1 audit row (transition_published)
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].reason, 'publish');
    assert.equal(snapshots[0].entity, 'landing_pages');
    assert.equal(snapshots[0].snapshot.status, 'review'); // pre-transition state
    assert.equal(edits.length, 1);
    assert.equal(edits[0].change_kind, 'transition_published');
  });

  test('archive transition snapshots + audits with transition_archived', async () => {
    const row = seedRow('static_pages', { status: 'published' });
    await transitionStatus(
      'static_pages',
      row.id,
      'archived',
      { kind: 'human', id: 'admin-uuid', name: 'Samer' },
    );
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].reason, 'archive');
    assert.equal(edits.length, 1);
    assert.equal(edits[0].change_kind, 'transition_archived');
  });

  test('agent without publish_scopes is rejected on draft → published', async () => {
    const row = seedRow('blog_posts', { status: 'draft' });
    let caught: any = null;
    try {
      await transitionStatus(
        'blog_posts',
        row.id,
        'published',
        { kind: 'agent', id: 'agent-token-uuid', name: 'Hakima' },
      );
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
    assert.equal(caught.code, 'unauthorized_publish');
    assert.equal(caught.httpStatus, 403);
    // No state change, no snapshot, no audit
    assert.equal(tables.blog_posts[0].status, 'draft');
    assert.equal(snapshots.length, 0);
    assert.equal(edits.length, 0);
  });

  test('agent WITH publish_scopes can publish that entity', async () => {
    const row = seedRow('blog_posts', { status: 'review' });
    const post = await transitionStatus(
      'blog_posts',
      row.id,
      'published',
      {
        kind: 'agent',
        id: 'agent-token-uuid',
        name: 'Shahira',
        publish_scopes: new Set(['blog_posts']),
      },
    );
    assert.equal(post.status, 'published');
    assert.equal(snapshots.length, 1);
    assert.equal(edits.length, 1);
    assert.equal(edits[0].change_kind, 'transition_published');
    assert.equal(edits[0].editor_type, 'agent');
  });

  test('agent draft → review allowed without publish_scopes', async () => {
    const row = seedRow('static_pages', { status: 'draft' });
    const post = await transitionStatus(
      'static_pages',
      row.id,
      'review',
      { kind: 'agent', id: 'agent-token-uuid', name: 'Hakima' },
    );
    assert.equal(post.status, 'review');
    assert.equal(edits.length, 1);
    assert.equal(edits[0].change_kind, 'transition_review');
  });

  test('rejects invalid transition with PageServiceError', async () => {
    const row = seedRow('static_pages', { status: 'archived' });
    let caught: any = null;
    try {
      await transitionStatus(
        'static_pages',
        row.id,
        'published',
        { kind: 'human', id: 'admin', name: 'Samer' },
      );
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
    assert.equal(caught.code, 'invalid_transition');
    assert.equal(caught.httpStatus, 422);
  });

  test('not_found returns 404 PageServiceError', async () => {
    let caught: any = null;
    try {
      await transitionStatus(
        'static_pages',
        '00000000-0000-0000-0000-000000000000',
        'review',
        { kind: 'human', id: 'admin', name: 'Samer' },
      );
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
    assert.equal(caught.code, 'not_found');
    assert.equal(caught.httpStatus, 404);
  });

  test('actor without id (when kind != system) is rejected', async () => {
    const row = seedRow('static_pages', { status: 'draft' });
    let caught: any = null;
    try {
      await transitionStatus(
        'static_pages',
        row.id,
        'review',
        { kind: 'human', id: null as any, name: null },
      );
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
    assert.equal(caught.code, 'invalid_actor');
  });

  test('system actor with NULL id is allowed (migration / cron)', async () => {
    const row = seedRow('static_pages', { status: 'draft' });
    const post = await transitionStatus(
      'static_pages',
      row.id,
      'published',
      { kind: 'system', id: null, name: null },
    );
    assert.equal(post.status, 'published');
    assert.equal(snapshots.length, 1);
    assert.equal(edits.length, 1);
    assert.equal(edits[0].editor_type, 'system');
  });
});

describe('Wave 15 W1 / page-service / createSnapshot manual checkpoint', () => {
  beforeEach(() => resetTables());

  test('manual snapshot creates row without status change', async () => {
    const row = seedRow('static_pages', { status: 'draft' });
    const sid = await createSnapshot(
      'static_pages',
      row.id,
      'manual',
      { kind: 'human', id: 'admin', name: 'Samer' },
    );
    assert.ok(typeof sid === 'string' && sid.length > 0);
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].reason, 'manual');
    // Status unchanged
    assert.equal(tables.static_pages[0].status, 'draft');
    // No edit row for a manual checkpoint (it's not a transition; the
    // service only writes content_edits on transitions / rollbacks).
    assert.equal(edits.length, 0);
  });

  test('rejects invalid snapshot reason', async () => {
    const row = seedRow('static_pages', { status: 'draft' });
    let caught: any = null;
    try {
      await createSnapshot(
        'static_pages',
        row.id,
        'bogus' as any,
        { kind: 'human', id: 'admin', name: 'Samer' },
      );
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
    assert.equal(caught.code, 'invalid_snapshot_reason');
  });
});

describe('Wave 15 W1 / page-service / rollbackToSnapshot', () => {
  beforeEach(() => resetTables());

  test('rollback restores body + writes pre_rollback snapshot + audit row', async () => {
    const row = seedRow('static_pages', {
      status: 'draft',
      composition_json: { sections: [{ type: 'mirror', anchor_id: 'a' }] },
    });
    // Take a manual snapshot
    const sid = await createSnapshot(
      'static_pages',
      row.id,
      'manual',
      { kind: 'human', id: 'admin', name: 'Samer' },
    );
    // Mutate the row
    row.composition_json = { sections: [{ type: 'mirror', anchor_id: 'b' }, { type: 'cta' }] };
    row.hero_json = { hero_image_url: '/y.png' };
    // Rollback
    const post = await rollbackToSnapshot(
      'static_pages',
      row.id,
      sid,
      { kind: 'human', id: 'admin', name: 'Samer' },
    );
    // Pre_rollback snapshot fired (so total snapshots = 2)
    assert.equal(snapshots.length, 2);
    assert.equal(snapshots.find((s) => s.reason === 'pre_rollback') != null, true);
    // Body restored
    assert.deepEqual(tables.static_pages[0].composition_json, {
      sections: [{ type: 'mirror', anchor_id: 'a' }],
    });
    // Audit row for rollback
    assert.equal(edits.length, 1);
    assert.equal(edits[0].field, '__rollback');
    assert.deepEqual(edits[0].new_value, { restored_from_snapshot_id: sid });
  });

  test('rollback to non-existent snapshot returns snapshot_not_found 404', async () => {
    const row = seedRow('static_pages', { status: 'draft' });
    let caught: any = null;
    try {
      await rollbackToSnapshot(
        'static_pages',
        row.id,
        '00000000-0000-0000-0000-000000000000',
        { kind: 'human', id: 'admin', name: 'Samer' },
      );
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
    assert.equal(caught.code, 'snapshot_not_found');
    assert.equal(caught.httpStatus, 404);
  });
});

describe('Wave 15 W1 / page-service / loadPageWithSnapshots', () => {
  beforeEach(() => resetTables());

  test('lists newest snapshot first', async () => {
    const row = seedRow('static_pages', { status: 'draft' });
    // Create 2 snapshots
    await createSnapshot('static_pages', row.id, 'manual', {
      kind: 'human',
      id: 'admin',
      name: 'Samer',
    });
    // Force a tick of the clock
    await new Promise((r) => setTimeout(r, 5));
    await createSnapshot('static_pages', row.id, 'manual', {
      kind: 'human',
      id: 'admin',
      name: 'Samer',
    });
    const { row: r, snapshots: snaps } = await loadPageWithSnapshots(
      'static_pages',
      row.id,
    );
    assert.notEqual(r, null);
    assert.equal(snaps.length, 2);
    // Newest first
    assert.ok(snaps[0].created_at >= snaps[1].created_at);
  });
});
