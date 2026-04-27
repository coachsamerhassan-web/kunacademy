/**
 * Wave 15 Wave 1 — snapshots.ts tests
 *
 * Pure helpers — no DB, no monkey-patching needed.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/* eslint-disable @typescript-eslint/no-var-requires */
const {
  deepEqual,
  deriveSectionKey,
  diffComposition,
  summarizeDiff,
} = require('../authoring/snapshots');

describe('Wave 15 W1 / snapshots / deepEqual', () => {
  test('primitives', () => {
    assert.equal(deepEqual(1, 1), true);
    assert.equal(deepEqual(1, 2), false);
    assert.equal(deepEqual('a', 'a'), true);
    assert.equal(deepEqual(null, null), true);
    assert.equal(deepEqual(null, undefined), false);
    assert.equal(deepEqual(true, true), true);
    assert.equal(deepEqual(NaN, NaN), true);
  });

  test('arrays', () => {
    assert.equal(deepEqual([], []), true);
    assert.equal(deepEqual([1, 2, 3], [1, 2, 3]), true);
    assert.equal(deepEqual([1, 2, 3], [1, 2]), false);
    assert.equal(deepEqual([1, 2, 3], [3, 2, 1]), false);
    assert.equal(deepEqual([{ a: 1 }], [{ a: 1 }]), true);
    assert.equal(deepEqual([{ a: 1 }], [{ a: 2 }]), false);
  });

  test('objects (key order independent)', () => {
    assert.equal(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
    assert.equal(deepEqual({ a: 1 }, { a: 1, b: 2 }), false);
    assert.equal(deepEqual({ a: { b: 1 } }, { a: { b: 1 } }), true);
    assert.equal(deepEqual({ a: { b: 1 } }, { a: { b: 2 } }), false);
  });

  test('mixed', () => {
    const a = { sections: [{ type: 'hero', items: [1, 2] }], status: 'draft' };
    const b = { status: 'draft', sections: [{ type: 'hero', items: [1, 2] }] };
    assert.equal(deepEqual(a, b), true);
  });
});

describe('Wave 15 W1 / snapshots / deriveSectionKey', () => {
  test('uses type + index + anchor_id', () => {
    assert.equal(deriveSectionKey({ type: 'mirror', anchor_id: 'a' }, 0), 'mirror-0-a');
    assert.equal(deriveSectionKey({ type: 'mirror' }, 3), 'mirror-3-');
  });

  test('handles missing type', () => {
    assert.equal(deriveSectionKey({}, 0), 'unknown-0-');
  });

  test('handles non-string anchor_id', () => {
    assert.equal(deriveSectionKey({ type: 'cta', anchor_id: 123 as any }, 1), 'cta-1-');
  });
});

describe('Wave 15 W1 / snapshots / diffComposition', () => {
  test('detects added section', () => {
    const prev = { sections: [{ type: 'hero', anchor_id: 'h' }] };
    const next = {
      sections: [{ type: 'hero', anchor_id: 'h' }, { type: 'cta', anchor_id: 'c' }],
    };
    const d = diffComposition(prev, next);
    assert.equal(d.sections.length, 1);
    assert.equal(d.sections[0].kind, 'added');
  });

  test('detects removed section', () => {
    const prev = {
      sections: [{ type: 'hero', anchor_id: 'h' }, { type: 'cta', anchor_id: 'c' }],
    };
    const next = { sections: [{ type: 'hero', anchor_id: 'h' }] };
    const d = diffComposition(prev, next);
    assert.equal(d.sections.length, 1);
    assert.equal(d.sections[0].kind, 'removed');
  });

  test('detects changed section (same key, different content)', () => {
    const prev = { sections: [{ type: 'hero', anchor_id: 'h', title: 'A' }] };
    const next = { sections: [{ type: 'hero', anchor_id: 'h', title: 'B' }] };
    const d = diffComposition(prev, next);
    assert.equal(d.sections.length, 1);
    assert.equal(d.sections[0].kind, 'changed');
  });

  test('detects top-level field deltas', () => {
    const prev = { sections: [], hero_image_url: '/a.png' };
    const next = { sections: [], hero_image_url: '/b.png' };
    const d = diffComposition(prev, next);
    assert.equal(d.sections.length, 0);
    assert.equal(d.fields.length, 1);
    assert.equal(d.fields[0].field, 'hero_image_url');
  });

  test('handles null prev (initial creation)', () => {
    const next = { sections: [{ type: 'hero', anchor_id: 'h' }] };
    const d = diffComposition(null, next);
    assert.equal(d.sections.length, 1);
    assert.equal(d.sections[0].kind, 'added');
  });

  test('summarizeDiff is human-readable', () => {
    const prev = { sections: [{ type: 'hero', anchor_id: 'h' }] };
    const next = {
      sections: [{ type: 'hero', anchor_id: 'h' }, { type: 'cta', anchor_id: 'c' }],
    };
    const d = diffComposition(prev, next);
    const s = summarizeDiff(d);
    assert.match(s, /\+1 added/);
  });

  test('summarizeDiff returns "no changes" on identity', () => {
    const a = { sections: [{ type: 'hero', anchor_id: 'h' }] };
    const d = diffComposition(a, a);
    const s = summarizeDiff(d);
    assert.equal(s, 'no changes');
  });
});
