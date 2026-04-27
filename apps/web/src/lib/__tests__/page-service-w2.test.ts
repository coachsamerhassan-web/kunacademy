/**
 * Wave 15 Wave 2 — page-service-w2 tests
 *
 * Tests cover:
 *   - addSection / editSection / deleteSection / reorderSections (composition_json ops)
 *   - createPage validation (per-entity required scalars)
 *   - softDeletePage (delegates to transitionStatus → archived)
 *   - listSnapshots / getSnapshotById / diffPageVersions (pagination + head)
 *   - schedulePublish (future-only timestamp + transition→review)
 *
 * Pattern matches Wave 1: node:test + tsx + Module.prototype.require monkey-patch.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

// ─────────────────────────────────────────────────────────────────────────────
// Fake DB
// ─────────────────────────────────────────────────────────────────────────────

interface PageRow {
  id: string;
  status: string;
  composition_json: any;
  hero_json: any;
  seo_meta_json: any;
  published: boolean;
  published_at: string | null;
  page_type?: string;
  title_ar?: string;
  title_en?: string;
  kind?: string;
  slug: string;
  scheduled_publish_at: string | null;
  last_edited_by: string | null;
  last_edited_by_kind: string | null;
  last_edited_by_name: string | null;
  last_edited_at: string;
  created_by_kind?: string;
  created_by_id?: string | null;
  content_ar?: string;
  content_en?: string;
  excerpt_ar?: string;
  excerpt_en?: string;
  content_ar_rich?: any;
  content_en_rich?: any;
  excerpt_ar_rich?: any;
  excerpt_en_rich?: any;
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

function seedRow(
  entity: 'landing_pages' | 'blog_posts' | 'static_pages',
  overrides: Partial<PageRow> = {},
): PageRow {
  const row: PageRow = {
    id: newId('row'),
    slug: `test-${idCounter}`,
    status: 'draft',
    composition_json: { sections: [] },
    hero_json: {},
    seo_meta_json: {},
    published: false,
    published_at: null,
    scheduled_publish_at: null,
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
  let raw =
    queryObj?.queryChunks
      ?.map((c: any) => (typeof c === 'string' ? c : c?.value ?? '?'))
      .join('') ?? '';
  if (!raw) raw = queryObj?.sql ?? '';
  if (!raw && typeof queryObj === 'string') raw = queryObj;
  raw = (raw as string).replace(/\s+/g, ' ').trim();
  const values: any[] = params ?? queryObj?.values ?? [];

  // SELECT * FROM <ent> WHERE id = $1 [LIMIT 1 | FOR UPDATE]
  let m = /^SELECT \* FROM (\w+) WHERE id = \$1(?: FOR UPDATE)?(?: LIMIT \d+)?$/i.exec(raw);
  if (m) {
    const ent = m[1];
    const rid = values[0];
    const row = tables[ent]?.find((r) => r.id === rid) ?? null;
    return { rows: row ? [row] : [] };
  }

  // INSERT INTO static_pages (...) VALUES (...) RETURNING id, slug, kind
  m = /^INSERT INTO static_pages /i.exec(raw);
  if (m) {
    const row: PageRow = {
      id: newId('row'),
      slug: values[0],
      kind: values[1],
      status: 'draft',
      composition_json: parseMaybeJSON(values[2]),
      hero_json: parseMaybeJSON(values[3]),
      seo_meta_json: parseMaybeJSON(values[4]),
      published: false,
      published_at: null,
      scheduled_publish_at: null,
      created_by_kind: values[5],
      created_by_id: values[6],
      last_edited_by: values[6],
      last_edited_by_kind: values[7],
      last_edited_by_name: values[9] ?? null,
      last_edited_at: new Date().toISOString(),
    };
    tables.static_pages.push(row);
    return { rows: [{ id: row.id, slug: row.slug, kind: row.kind }] };
  }

  // INSERT INTO landing_pages (...) VALUES (...) RETURNING id, slug
  m = /^INSERT INTO landing_pages /i.exec(raw);
  if (m) {
    const row: PageRow = {
      id: newId('row'),
      slug: values[0],
      page_type: values[1],
      status: 'draft',
      composition_json: parseMaybeJSON(values[2]),
      hero_json: parseMaybeJSON(values[3]),
      seo_meta_json: parseMaybeJSON(values[4]),
      published: false,
      published_at: null,
      scheduled_publish_at: null,
      last_edited_by_kind: values[5],
      last_edited_by_name: values[6],
      last_edited_at: new Date().toISOString(),
      last_edited_by: null,
    };
    tables.landing_pages.push(row);
    return { rows: [{ id: row.id, slug: row.slug }] };
  }

  // INSERT INTO blog_posts (...) VALUES (...) RETURNING id, slug, kind
  m = /^INSERT INTO blog_posts /i.exec(raw);
  if (m) {
    const row: PageRow = {
      id: newId('row'),
      slug: values[0],
      title_ar: values[1],
      title_en: values[2],
      kind: values[3],
      status: 'draft',
      composition_json: parseMaybeJSON(values[4]),
      hero_json: {},
      seo_meta_json: {},
      published: false,
      published_at: null,
      scheduled_publish_at: null,
      last_edited_by_kind: values[5],
      last_edited_by_name: values[6],
      last_edited_at: new Date().toISOString(),
      last_edited_by: null,
    };
    tables.blog_posts.push(row);
    return { rows: [{ id: row.id, slug: row.slug, kind: row.kind }] };
  }

  // UPDATE composition_json (Wave 2 ops)
  m = /^UPDATE (\w+) SET composition_json = \$1::jsonb, last_edited_by_kind = \$2, last_edited_by_name = \$3, last_edited_at = now\(\) WHERE id = \$4$/i.exec(raw);
  if (m) {
    const ent = m[1];
    const [comp, kind, name, rid] = values;
    const row = tables[ent]?.find((r) => r.id === rid);
    if (!row) return { rows: [] };
    row.composition_json = parseMaybeJSON(comp);
    row.last_edited_by_kind = kind;
    row.last_edited_by_name = name;
    row.last_edited_at = new Date().toISOString();
    return { rows: [] };
  }

  // UPDATE status (delegated to transitionStatus from page-service.ts)
  m = /^UPDATE (\w+) SET status = \$1, last_edited_by = \$2, last_edited_by_kind = \$3, last_edited_by_name = \$4, last_edited_at = now\(\) WHERE id = \$5$/i.exec(raw);
  if (m) {
    const ent = m[1];
    const [status, editorId, editorKind, editorName, rid] = values;
    const row = tables[ent]?.find((r) => r.id === rid);
    if (!row) return { rows: [] };
    row.status = status;
    row.last_edited_by = editorId;
    row.last_edited_by_kind = editorKind;
    row.last_edited_by_name = editorName;
    row.last_edited_at = new Date().toISOString();
    if (status === 'published') {
      row.published = true;
      row.published_at = row.published_at ?? new Date().toISOString();
    } else {
      row.published = false;
      row.published_at = null;
    }
    return { rows: [] };
  }

  // UPDATE schedule (Wave 2 schedulePublish)
  m = /^UPDATE (\w+) SET scheduled_publish_at = \$1::timestamptz, status = \$2, last_edited_by_kind = \$3, last_edited_by_name = \$4, last_edited_at = now\(\) WHERE id = \$5$/i.exec(raw);
  if (m) {
    const ent = m[1];
    const [ts, status, kind, name, rid] = values;
    const row = tables[ent]?.find((r) => r.id === rid);
    if (!row) return { rows: [] };
    row.scheduled_publish_at = ts;
    row.status = status;
    row.last_edited_by_kind = kind;
    row.last_edited_by_name = name;
    row.last_edited_at = new Date().toISOString();
    return { rows: [] };
  }

  // INSERT INTO content_page_snapshots ... RETURNING id
  m = /^INSERT INTO content_page_snapshots /i.exec(raw);
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

  // INSERT INTO content_edits
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

  // Snapshot read by id
  m = /^SELECT id, entity, entity_id, snapshot, reason(?:, taken_by_kind, taken_by_id, taken_by_name, edit_id)?, created_at FROM content_page_snapshots WHERE/i.exec(raw);
  if (m) {
    const sid = values[0] ?? '';
    const ent = values[1] ?? '';
    const eid = values[2] ?? '';
    const s = snapshots.find((x) => x.id === sid && x.entity === ent && x.entity_id === eid);
    return { rows: s ? [s] : [] };
  }

  // Snapshot list (paginated)
  m = /^SELECT id, reason, taken_by_kind, taken_by_id, taken_by_name, edit_id, created_at FROM content_page_snapshots WHERE entity = /i.exec(raw);
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
// Module monkey-patch
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

/* eslint-disable @typescript-eslint/no-var-requires */
const psw2 = require('../authoring/page-service-w2');
const {
  createPage,
  softDeletePage,
  addSection,
  editSection,
  deleteSection,
  reorderSections,
  listSnapshots,
  getSnapshotById,
  diffPageVersions,
  schedulePublish,
} = psw2;
const { PageServiceError } = require('../authoring/page-service');

// Pure-helper test for lints
const lints = require('../agent-api/lints');

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Wave 15 W2 / page-service-w2 / createPage', () => {
  beforeEach(() => resetTables());

  test('creates static_pages with default kind=static', async () => {
    const r = await createPage({
      entity: 'static_pages',
      slug: 'about-us',
      actor: { kind: 'agent', id: 'agent-1', name: 'Hakima' },
    });
    assert.equal(r.entity, 'static_pages');
    assert.equal(r.slug, 'about-us');
    assert.equal(r.kind, 'static');
    assert.equal(tables.static_pages.length, 1);
    assert.equal(tables.static_pages[0].status, 'draft');
    // Audit row
    assert.equal(edits.length, 1);
    assert.equal(edits[0].field, '__create');
    assert.equal(edits[0].editor_type, 'agent');
  });

  test('creates static_pages with explicit kind=methodology_essay', async () => {
    const r = await createPage({
      entity: 'static_pages',
      slug: 'sense-method',
      kind: 'methodology_essay',
      actor: { kind: 'agent', id: 'agent-1', name: 'Hakima' },
    });
    assert.equal(r.kind, 'methodology_essay');
  });

  test('blog_posts requires title_ar + title_en', async () => {
    let caught: any = null;
    try {
      await createPage({
        entity: 'blog_posts',
        slug: 'test',
        actor: { kind: 'agent', id: 'agent-1', name: 'Shahira' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
    assert.match(caught.message, /title_ar/);
  });

  test('landing_pages requires page_type', async () => {
    let caught: any = null;
    try {
      await createPage({
        entity: 'landing_pages',
        slug: 'test-lp',
        actor: { kind: 'human', id: 'admin', name: 'Samer' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
    assert.match(caught.message, /page_type/);
  });

  test('rejects invalid slug shape', async () => {
    let caught: any = null;
    try {
      await createPage({
        entity: 'static_pages',
        slug: 'bad slug with spaces',
        actor: { kind: 'agent', id: 'agent-1', name: 'Hakima' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });

  test('blog_posts create succeeds with both titles', async () => {
    const r = await createPage({
      entity: 'blog_posts',
      slug: 'first-post',
      scalars: { title_ar: 'مرحبا', title_en: 'Hello' },
      actor: { kind: 'agent', id: 'agent-1', name: 'Shahira' },
    });
    assert.equal(r.slug, 'first-post');
    assert.equal(r.kind, 'blog_article');
  });
});

describe('Wave 15 W2 / page-service-w2 / softDeletePage', () => {
  beforeEach(() => resetTables());

  test('archives a published row + snapshots before transition', async () => {
    const row = seedRow('landing_pages', { status: 'published' });
    await softDeletePage('landing_pages', row.id, {
      kind: 'agent',
      id: 'agent-1',
      name: 'Shahira',
    });
    assert.equal(tables.landing_pages[0].status, 'archived');
    assert.equal(tables.landing_pages[0].published, false);
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].reason, 'archive');
    assert.equal(edits.length, 1);
    assert.equal(edits[0].change_kind, 'transition_archived');
  });

  test('rejects already-archived row', async () => {
    const row = seedRow('static_pages', { status: 'archived' });
    let caught: any = null;
    try {
      await softDeletePage('static_pages', row.id, {
        kind: 'agent',
        id: 'agent-1',
        name: 'Hakima',
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
    assert.equal(caught.code, 'invalid_transition');
  });
});

describe('Wave 15 W2 / page-service-w2 / addSection', () => {
  beforeEach(() => resetTables());

  test('appends a section when index omitted', async () => {
    const row = seedRow('landing_pages', { composition_json: { sections: [{ type: 'hero' }] } });
    const r = await addSection({
      entity: 'landing_pages',
      rowId: row.id,
      section: { type: 'mirror', body_ar: 'م' },
      actor: { kind: 'agent', id: 'agent-1', name: 'Shahira' },
    });
    assert.equal(tables.landing_pages[0].composition_json.sections.length, 2);
    assert.equal(tables.landing_pages[0].composition_json.sections[1].type, 'mirror');
    assert.ok(r.diff.sections.length >= 1);
    assert.match(r.summary, /added/);
  });

  test('inserts at given index', async () => {
    const row = seedRow('landing_pages', {
      composition_json: { sections: [{ type: 'hero' }, { type: 'cta' }] },
    });
    await addSection({
      entity: 'landing_pages',
      rowId: row.id,
      section: { type: 'mirror' },
      index: 1,
      actor: { kind: 'agent', id: 'agent-1', name: 'Shahira' },
    });
    const sections = tables.landing_pages[0].composition_json.sections;
    assert.equal(sections.length, 3);
    assert.equal(sections[0].type, 'hero');
    assert.equal(sections[1].type, 'mirror');
    assert.equal(sections[2].type, 'cta');
  });

  test('rejects out-of-range index', async () => {
    const row = seedRow('static_pages', { composition_json: { sections: [{ type: 'hero' }] } });
    let caught: any = null;
    try {
      await addSection({
        entity: 'static_pages',
        rowId: row.id,
        section: { type: 'mirror' },
        index: 5,
        actor: { kind: 'agent', id: 'agent-1', name: 'Hakima' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });

  test('rejects non-object section', async () => {
    const row = seedRow('static_pages');
    let caught: any = null;
    try {
      await addSection({
        entity: 'static_pages',
        rowId: row.id,
        section: 'not-an-object' as any,
        actor: { kind: 'agent', id: 'agent-1', name: 'Hakima' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });

  test('rejects section without type', async () => {
    const row = seedRow('static_pages');
    let caught: any = null;
    try {
      await addSection({
        entity: 'static_pages',
        rowId: row.id,
        section: { body: 'no type here' } as any,
        actor: { kind: 'agent', id: 'agent-1', name: 'Hakima' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });

  test('writes audit row with field=composition_json + change_kind=rich_text_replaced', async () => {
    const row = seedRow('landing_pages');
    await addSection({
      entity: 'landing_pages',
      rowId: row.id,
      section: { type: 'mirror' },
      actor: { kind: 'agent', id: 'agent-1', name: 'Shahira' },
    });
    assert.equal(edits.length, 1);
    assert.equal(edits[0].field, 'composition_json');
    assert.equal(edits[0].change_kind, 'rich_text_replaced');
  });
});

describe('Wave 15 W2 / page-service-w2 / editSection', () => {
  beforeEach(() => resetTables());

  test('merges patch into target section', async () => {
    // No anchor change → key stays mirror-0- → diff reports "changed"
    const row = seedRow('landing_pages', {
      composition_json: { sections: [{ type: 'mirror', anchor_id: 'm1', body_ar: 'old' }] },
    });
    const r = await editSection({
      entity: 'landing_pages',
      rowId: row.id,
      index: 0,
      patch: { body_ar: 'new' },
      actor: { kind: 'agent', id: 'agent-1', name: 'Shahira' },
    });
    const sec = tables.landing_pages[0].composition_json.sections[0];
    assert.equal(sec.type, 'mirror'); // preserved
    assert.equal(sec.body_ar, 'new');
    assert.equal(sec.anchor_id, 'm1');
    assert.match(r.summary, /changed/);
  });

  test('changing anchor_id reports as added+removed (key includes anchor)', async () => {
    // Anchor change → key changes → diff reports add/remove rather than change.
    // This is intentional per Wave 1 deriveSectionKey semantics.
    const row = seedRow('landing_pages', {
      composition_json: { sections: [{ type: 'mirror', body_ar: 'old' }] },
    });
    const r = await editSection({
      entity: 'landing_pages',
      rowId: row.id,
      index: 0,
      patch: { body_ar: 'new', anchor_id: 'mirror-1' },
      actor: { kind: 'agent', id: 'agent-1', name: 'Shahira' },
    });
    assert.match(r.summary, /added/);
    assert.match(r.summary, /removed/);
  });

  test('rejects out-of-range index', async () => {
    const row = seedRow('landing_pages');
    let caught: any = null;
    try {
      await editSection({
        entity: 'landing_pages',
        rowId: row.id,
        index: 0,
        patch: {},
        actor: { kind: 'agent', id: 'agent-1', name: 'Shahira' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });
});

describe('Wave 15 W2 / page-service-w2 / deleteSection', () => {
  beforeEach(() => resetTables());

  test('splices out the target section', async () => {
    const row = seedRow('landing_pages', {
      composition_json: { sections: [{ type: 'hero' }, { type: 'mirror' }, { type: 'cta' }] },
    });
    await deleteSection({
      entity: 'landing_pages',
      rowId: row.id,
      index: 1,
      actor: { kind: 'agent', id: 'agent-1', name: 'Shahira' },
    });
    const sections = tables.landing_pages[0].composition_json.sections;
    assert.equal(sections.length, 2);
    assert.equal(sections[0].type, 'hero');
    assert.equal(sections[1].type, 'cta');
  });

  test('rejects out-of-range index', async () => {
    const row = seedRow('landing_pages');
    let caught: any = null;
    try {
      await deleteSection({
        entity: 'landing_pages',
        rowId: row.id,
        index: 99,
        actor: { kind: 'agent', id: 'agent-1', name: 'Shahira' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });
});

describe('Wave 15 W2 / page-service-w2 / reorderSections', () => {
  beforeEach(() => resetTables());

  test('applies a valid permutation', async () => {
    const row = seedRow('static_pages', {
      composition_json: {
        sections: [{ type: 'a' }, { type: 'b' }, { type: 'c' }],
      },
    });
    await reorderSections({
      entity: 'static_pages',
      rowId: row.id,
      order: [2, 0, 1],
      actor: { kind: 'agent', id: 'agent-1', name: 'Hakima' },
    });
    const sections = tables.static_pages[0].composition_json.sections;
    assert.equal(sections[0].type, 'c');
    assert.equal(sections[1].type, 'a');
    assert.equal(sections[2].type, 'b');
  });

  test('rejects wrong-length order', async () => {
    const row = seedRow('static_pages', {
      composition_json: { sections: [{ type: 'a' }, { type: 'b' }] },
    });
    let caught: any = null;
    try {
      await reorderSections({
        entity: 'static_pages',
        rowId: row.id,
        order: [0, 1, 2],
        actor: { kind: 'agent', id: 'agent-1', name: 'Hakima' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });

  test('rejects duplicate index in order', async () => {
    const row = seedRow('static_pages', {
      composition_json: { sections: [{ type: 'a' }, { type: 'b' }] },
    });
    let caught: any = null;
    try {
      await reorderSections({
        entity: 'static_pages',
        rowId: row.id,
        order: [0, 0],
        actor: { kind: 'agent', id: 'agent-1', name: 'Hakima' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });

  test('rejects out-of-range index in order', async () => {
    const row = seedRow('static_pages', {
      composition_json: { sections: [{ type: 'a' }, { type: 'b' }] },
    });
    let caught: any = null;
    try {
      await reorderSections({
        entity: 'static_pages',
        rowId: row.id,
        order: [0, 5],
        actor: { kind: 'agent', id: 'agent-1', name: 'Hakima' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });
});

describe('Wave 15 W2 / page-service-w2 / schedulePublish', () => {
  beforeEach(() => resetTables());

  // Use a UUID-shaped id since the helper now strict-validates rowId shape
  const ROW_ID_UUID = '11111111-2222-3333-4444-555555555555';

  test('sets scheduled_publish_at + transitions draft to review', async () => {
    const row = seedRow('blog_posts', { id: ROW_ID_UUID, status: 'draft' });
    void row; // assertion below
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const post = await schedulePublish({
      entity: 'blog_posts',
      rowId: ROW_ID_UUID,
      scheduled_publish_at: future,
      actor: { kind: 'agent', id: 'agent-1', name: 'Nashit' },
    });
    assert.equal(post.scheduled_publish_at, future);
    assert.equal(post.status, 'review');
    assert.ok(edits.find((e) => e.change_kind === 'transition_review'));
  });

  test('review→review noop preserves status', async () => {
    seedRow('blog_posts', { id: ROW_ID_UUID, status: 'review' });
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const post = await schedulePublish({
      entity: 'blog_posts',
      rowId: ROW_ID_UUID,
      scheduled_publish_at: future,
      actor: { kind: 'agent', id: 'agent-1', name: 'Nashit' },
    });
    assert.equal(post.scheduled_publish_at, future);
    assert.equal(post.status, 'review');
  });

  test('rejects scheduling an archived row (DeepSeek W2 catch)', async () => {
    seedRow('blog_posts', { id: ROW_ID_UUID, status: 'archived' });
    let caught: any = null;
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    try {
      await schedulePublish({
        entity: 'blog_posts',
        rowId: ROW_ID_UUID,
        scheduled_publish_at: future,
        actor: { kind: 'agent', id: 'agent-1', name: 'Nashit' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
    assert.equal(caught.code, 'invalid_transition');
  });

  test('rejects scheduling a published row', async () => {
    seedRow('blog_posts', { id: ROW_ID_UUID, status: 'published' });
    let caught: any = null;
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    try {
      await schedulePublish({
        entity: 'blog_posts',
        rowId: ROW_ID_UUID,
        scheduled_publish_at: future,
        actor: { kind: 'agent', id: 'agent-1', name: 'Nashit' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
    assert.equal(caught.code, 'invalid_transition');
  });

  test('rejects past timestamp', async () => {
    seedRow('blog_posts', { id: ROW_ID_UUID });
    let caught: any = null;
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    try {
      await schedulePublish({
        entity: 'blog_posts',
        rowId: ROW_ID_UUID,
        scheduled_publish_at: past,
        actor: { kind: 'agent', id: 'agent-1', name: 'Nashit' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });

  test('rejects timestamp <60s in the future', async () => {
    seedRow('blog_posts', { id: ROW_ID_UUID });
    let caught: any = null;
    const tooSoon = new Date(Date.now() + 30 * 1000).toISOString();
    try {
      await schedulePublish({
        entity: 'blog_posts',
        rowId: ROW_ID_UUID,
        scheduled_publish_at: tooSoon,
        actor: { kind: 'agent', id: 'agent-1', name: 'Nashit' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });

  test('rejects malformed timestamp', async () => {
    seedRow('blog_posts', { id: ROW_ID_UUID });
    let caught: any = null;
    try {
      await schedulePublish({
        entity: 'blog_posts',
        rowId: ROW_ID_UUID,
        scheduled_publish_at: 'not-a-date',
        actor: { kind: 'agent', id: 'agent-1', name: 'Nashit' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });

  test('rejects ISO timestamp without explicit timezone (no Z, no offset)', async () => {
    seedRow('blog_posts', { id: ROW_ID_UUID });
    let caught: any = null;
    try {
      await schedulePublish({
        entity: 'blog_posts',
        rowId: ROW_ID_UUID,
        scheduled_publish_at: '2026-05-01T10:00:00', // no Z / no offset
        actor: { kind: 'agent', id: 'agent-1', name: 'Nashit' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });

  test('rejects non-UUID rowId', async () => {
    let caught: any = null;
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    try {
      await schedulePublish({
        entity: 'blog_posts',
        rowId: 'not-a-uuid',
        scheduled_publish_at: future,
        actor: { kind: 'agent', id: 'agent-1', name: 'Nashit' },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });
});

describe('Wave 15 W2 / page-service-w2 / listSnapshots + getSnapshotById', () => {
  beforeEach(() => resetTables());

  test('returns empty array on no snapshots', async () => {
    const r = await listSnapshots('landing_pages', 'row-1');
    assert.deepEqual(r, []);
  });

  test('lists snapshots newest first after a publish', async () => {
    const row = seedRow('landing_pages', { status: 'review' });
    // Use the lower-level page-service.transitionStatus to publish (creates snapshot)
    const ps = require('../authoring/page-service');
    await ps.transitionStatus('landing_pages', row.id, 'published', {
      kind: 'human',
      id: 'admin',
      name: 'Samer',
    });
    const r = await listSnapshots('landing_pages', row.id);
    assert.equal(r.length, 1);
    assert.equal(r[0].reason, 'publish');
  });
});

describe('Wave 15 W2 / lints / R1 R2 R3', () => {
  test('R1: blocks beat-count phrasings', () => {
    const row = {
      composition_json: {
        sections: [{ type: 'rich_text_block', body_en: 'This is the 12 beats methodology...' }],
      },
    };
    const v = lints.lintRowBody({ entity: 'landing_pages', row });
    assert.ok(v.find((x: any) => x.rule_id.startsWith('R1.')));
  });

  test('R1: passes generic copy', () => {
    const row = {
      composition_json: {
        sections: [
          {
            type: 'rich_text_block',
            body_en: 'Coaching with care. Somatic awareness as a path to clarity.',
          },
        ],
      },
    };
    const v = lints.lintRowBody({ entity: 'landing_pages', row });
    assert.equal(v.length, 0);
  });

  test('R1: passes generic Arabic marketing copy without internal vocab', () => {
    const row = {
      hero_json: { title_ar: 'كوتشينج بالعربي. وعي حسّي. وضوح ذهني.' },
    };
    const v = lints.lintRowBody({ entity: 'landing_pages', row });
    assert.equal(v.length, 0);
  });

  test('R1: blocks Arabic beat-count phrasing', () => {
    const row = {
      hero_json: { title_ar: '8 مراحل من المنهج لتحويل حياتك' },
    };
    const v = lints.lintRowBody({ entity: 'landing_pages', row });
    assert.ok(v.find((x: any) => x.rule_id.startsWith('R1.')));
  });

  test('R3: blocks attributing Somatic Thinking to AI', () => {
    const row = {
      composition_json: {
        sections: [
          {
            type: 'rich_text_block',
            body_en: 'Somatic Thinking was developed by AI in collaboration with Samer Hassan.',
          },
        ],
      },
    };
    const v = lints.lintRowBody({ entity: 'landing_pages', row });
    assert.ok(v.find((x: any) => x.rule_id.startsWith('R3.')));
  });

  test('hasHardBlock summary helper works', () => {
    const v = [
      { rule_id: 'R1.x', severity: 'hard_block' as const, message: 'm', path: 'p', excerpt: 'e' },
    ];
    assert.equal(lints.hasHardBlock(v), true);
    assert.equal(lints.hasHardBlock([]), false);
  });

  test('TipTap doc body content is walked recursively', () => {
    const row = {
      content_en_rich: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Innocent text' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'And then 8 beats from inside the methodology' }] },
        ],
      },
    };
    const v = lints.lintRowBody({ entity: 'blog_posts', row });
    assert.ok(v.find((x: any) => x.rule_id.startsWith('R1.')));
  });
});

describe('Wave 15 W2 / page-service-w2 / diffPageVersions', () => {
  beforeEach(() => resetTables());

  test('diffs snapshot vs head', async () => {
    const row = seedRow('landing_pages', {
      status: 'review',
      composition_json: { sections: [{ type: 'hero' }] },
    });
    // Take a manual snapshot
    const ps = require('../authoring/page-service');
    const snapId = await ps.createSnapshot('landing_pages', row.id, 'manual', {
      kind: 'human',
      id: 'admin',
      name: 'Samer',
    });
    // Mutate
    tables.landing_pages[0].composition_json = {
      sections: [{ type: 'hero' }, { type: 'mirror' }],
    };
    const r = await diffPageVersions('landing_pages', row.id, snapId, 'head');
    assert.equal(r.from.kind, 'snapshot');
    assert.equal(r.to.kind, 'head');
    assert.match(r.summary, /added/);
  });

  test('rejects unknown from snapshot', async () => {
    const row = seedRow('landing_pages');
    let caught: any = null;
    try {
      await diffPageVersions('landing_pages', row.id, '00000000-0000-0000-0000-000000000000', 'head');
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof PageServiceError);
  });
});

describe('Wave 15 W2 / scopes + verb registry sanity', () => {
  test('publish_scopes wired for shahira:testimonials only', () => {
    const { AGENT_SCOPES, canDirectPublish } = require('../agent-api/scopes');
    assert.deepEqual(Array.from(AGENT_SCOPES.shahira.publishScopes), ['testimonials']);
    assert.equal(canDirectPublish('shahira', 'testimonials').allowed, true);
    assert.equal(canDirectPublish('shahira', 'landing_pages').allowed, false);
    // No other agent has direct publish anywhere
    for (const name of Object.keys(AGENT_SCOPES)) {
      if (name === 'shahira') continue;
      assert.equal(AGENT_SCOPES[name].publishScopes.size, 0, `${name} must have empty publishScopes`);
    }
  });

  test('hakima has approve_methodology_adjacent verb', () => {
    const { canInvokeVerb } = require('../agent-api/scopes');
    assert.equal(canInvokeVerb('hakima', 'approve_methodology_adjacent').allowed, true);
    assert.equal(canInvokeVerb('shahira', 'approve_methodology_adjacent').allowed, false);
  });

  test('static_pages writable by hakima/shahira/amin/nashit; not by sani/rafik/hakawati', () => {
    const { canWrite } = require('../agent-api/scopes');
    assert.equal(canWrite('hakima', 'static_pages').allowed, true);
    assert.equal(canWrite('shahira', 'static_pages').allowed, true);
    assert.equal(canWrite('amin', 'static_pages').allowed, true);
    assert.equal(canWrite('nashit', 'static_pages').allowed, true);
    assert.equal(canWrite('hakawati', 'static_pages').allowed, false);
    assert.equal(canWrite('sani', 'static_pages').allowed, false);
    assert.equal(canWrite('rafik', 'static_pages').allowed, false);
  });

  test('every agent has an actions Set (verbs)', () => {
    const { AGENT_SCOPES } = require('../agent-api/scopes');
    for (const [name, scope] of Object.entries(AGENT_SCOPES) as any) {
      assert.ok(scope.actions instanceof Set, `${name}.actions must be Set`);
    }
  });

  test('serializeScope includes verbs + publish_scopes', () => {
    const { serializeScope } = require('../agent-api/scopes');
    const s = serializeScope('shahira');
    assert.ok(Array.isArray(s.verbs));
    assert.ok(Array.isArray(s.publish_scopes));
    assert.deepEqual(s.publish_scopes, ['testimonials']);
  });
});

describe('Wave 15 W2 / entities registry', () => {
  test('static_pages registered with state-machine + composition flags', () => {
    const { ENTITIES, isStateMachineEntity } = require('../agent-api/entities');
    assert.ok(ENTITIES.static_pages, 'static_pages registered');
    assert.equal(ENTITIES.static_pages.supportsStateMachine, true);
    assert.equal(ENTITIES.static_pages.supportsComposition, true);
    assert.equal(isStateMachineEntity('static_pages'), true);
    assert.equal(isStateMachineEntity('testimonials'), false);
    assert.equal(isStateMachineEntity('programs'), false);
  });

  test('blog_posts has Wave 1 *_rich + composition_json fields', () => {
    const { ENTITIES, fieldKind } = require('../agent-api/entities');
    assert.equal(fieldKind('blog_posts', 'composition_json'), 'jsonb');
    assert.equal(fieldKind('blog_posts', 'content_ar_rich'), 'rich_text');
    assert.equal(fieldKind('blog_posts', 'kind'), 'scalar');
    assert.equal(ENTITIES.blog_posts.supportsStateMachine, true);
  });
});
