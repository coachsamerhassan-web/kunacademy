/**
 * Wave 15 Wave 3 — section vocabulary registry tests.
 *
 * Coverage:
 *   - 8 universal types are registered
 *   - vocabularyForEntity filters by applicable entities
 *   - Default payload always includes the type discriminator
 *   - sectionLabel resolves from registry first, falls back to raw type
 *   - LP_SECTION_TYPES_ORDERED includes all 15 carry-forward LP types
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNIVERSAL_SECTION_VOCABULARY,
  VOCAB_BY_ID,
  vocabularyForEntity,
  LP_SECTION_TYPES_ORDERED,
  sectionLabel,
} from '../authoring/section-vocabulary';

describe('Wave 15 W3 / section vocabulary', () => {
  test('registers all 8 universal types', () => {
    assert.equal(UNIVERSAL_SECTION_VOCABULARY.length, 8);
    const ids = UNIVERSAL_SECTION_VOCABULARY.map((e) => e.id).sort();
    assert.deepEqual(ids, ['body', 'cta', 'divider', 'header', 'image', 'mirror', 'quote', 'video']);
  });

  test('VOCAB_BY_ID is a complete index', () => {
    for (const entry of UNIVERSAL_SECTION_VOCABULARY) {
      assert.equal(VOCAB_BY_ID[entry.id], entry, `expected entry for ${entry.id}`);
    }
  });

  test('every entry has bilingual labels + icon + description', () => {
    for (const entry of UNIVERSAL_SECTION_VOCABULARY) {
      assert.ok(entry.label_ar.length > 0, `${entry.id} missing label_ar`);
      assert.ok(entry.label_en.length > 0, `${entry.id} missing label_en`);
      assert.ok(entry.icon.length > 0, `${entry.id} missing icon`);
      assert.ok(entry.description_ar.length > 0, `${entry.id} missing description_ar`);
      assert.ok(entry.description_en.length > 0, `${entry.id} missing description_en`);
    }
  });

  test('every entry default-payload carries the type discriminator', () => {
    for (const entry of UNIVERSAL_SECTION_VOCABULARY) {
      const payload = entry.defaultPayload();
      assert.equal(payload.type, entry.id, `${entry.id} default payload missing matching type`);
    }
  });

  test('vocabularyForEntity filters out non-applicable types', () => {
    // mirror is LP-only; should be in landing_pages but not blog_posts.
    const lpVocab = vocabularyForEntity('landing_pages');
    const blogVocab = vocabularyForEntity('blog_posts');
    const lpHasMirror = lpVocab.find((e) => e.id === 'mirror');
    const blogHasMirror = blogVocab.find((e) => e.id === 'mirror');
    assert.ok(lpHasMirror, 'landing_pages must include mirror');
    assert.equal(blogHasMirror, undefined, 'blog_posts must NOT include mirror');
  });

  test('sectionLabel returns entry label for universal types', () => {
    assert.equal(sectionLabel('header', false), 'Header');
    assert.equal(sectionLabel('header', true), 'عنوان');
  });

  test('sectionLabel falls back to raw type for unknown entries', () => {
    assert.equal(sectionLabel('uncatalogued_type', false), 'uncatalogued_type');
  });

  test('LP_SECTION_TYPES_ORDERED ships all 15 LP carry-forward types', () => {
    assert.equal(LP_SECTION_TYPES_ORDERED.length, 15);
    const expected = new Set([
      'mirror', 'reframe', 'description', 'benefits', 'carry_out',
      'who_for', 'who_not_for', 'format', 'price', 'group_alumni',
      'credibility', 'objections', 'faq', 'cta', 'custom',
    ]);
    for (const t of LP_SECTION_TYPES_ORDERED) {
      assert.ok(expected.has(t), `unexpected LP type ${t}`);
      expected.delete(t);
    }
    assert.equal(expected.size, 0, `missing LP types: ${[...expected].join(',')}`);
  });

  test('image type default payload has alt text fields (R10 compliance scaffolding)', () => {
    const image = VOCAB_BY_ID['image'];
    const payload = image.defaultPayload();
    assert.ok('alt_ar' in payload, 'image must include alt_ar slot');
    assert.ok('alt_en' in payload, 'image must include alt_en slot');
  });

  test('video type default payload has embed_url field (R11 allowlist target)', () => {
    const video = VOCAB_BY_ID['video'];
    const payload = video.defaultPayload();
    assert.ok('embed_url' in payload, 'video must include embed_url slot');
  });
});
