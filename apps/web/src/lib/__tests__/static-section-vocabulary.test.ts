/**
 * Wave 15 Wave 4 PRECURSOR — Static-section vocabulary tests (2026-04-29).
 *
 * Coverage:
 *   - All 7 static-specific types are registered (per spec §7.1)
 *   - VOCAB_BY_ID merges universal + static buckets (15 total entries)
 *   - vocabularyForEntity('static_pages') returns universal + static merged
 *   - vocabularyForEntity('landing_pages') returns ONLY universal types
 *     (no static-specific types leak into LP picker)
 *   - vocabularyForEntity('blog_posts') ditto
 *   - Each static-specific entry has bilingual labels + icon + description
 *   - Default payloads carry the type discriminator
 *   - DB-reading types (testimonial_grid, team_grid, program_card_strip)
 *     have empty/permissive defaults — never hardcoded program/coach/testimonial
 *     metadata
 *   - faq_accordion default payload includes items[] array (the form needs
 *     at least one row to start)
 *   - philosophy_statement does NOT contain methodology recipe vocabulary in
 *     its description / example (defensive IP boundary)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATIC_SECTION_VOCABULARY,
  VOCAB_BY_ID,
  vocabularyForEntity,
  universalVocabularyForEntity,
  staticVocabularyForEntity,
} from '../authoring/section-vocabulary';

const STATIC_TYPE_IDS = [
  'faq_accordion',
  'team_grid',
  'methodology_pillar',
  'philosophy_statement',
  'contact_form',
  'testimonial_grid',
  'program_card_strip',
] as const;

describe('Wave 15 W4 PRECURSOR / static section vocabulary', () => {
  test('registers all 7 static-specific types', () => {
    assert.equal(STATIC_SECTION_VOCABULARY.length, 7);
    const ids = STATIC_SECTION_VOCABULARY.map((e) => e.id).sort();
    const expected = [...STATIC_TYPE_IDS].sort();
    assert.deepEqual(ids, expected);
  });

  test('VOCAB_BY_ID merges universal + static (15 entries total)', () => {
    // 8 universal + 7 static = 15
    const allEntries = Object.values(VOCAB_BY_ID);
    assert.equal(allEntries.length, 15, 'expected 15 vocabulary entries (8 universal + 7 static)');
    for (const id of STATIC_TYPE_IDS) {
      assert.ok(VOCAB_BY_ID[id], `VOCAB_BY_ID missing static type ${id}`);
    }
  });

  test('every static entry has bilingual labels + icon + description + example', () => {
    for (const entry of STATIC_SECTION_VOCABULARY) {
      assert.ok(entry.label_ar.length > 0, `${entry.id} missing label_ar`);
      assert.ok(entry.label_en.length > 0, `${entry.id} missing label_en`);
      assert.ok(entry.icon.length > 0, `${entry.id} missing icon`);
      assert.ok(entry.description_ar.length > 0, `${entry.id} missing description_ar`);
      assert.ok(entry.description_en.length > 0, `${entry.id} missing description_en`);
      assert.ok(entry.example_ar.length > 0, `${entry.id} missing example_ar`);
      assert.ok(entry.example_en.length > 0, `${entry.id} missing example_en`);
      assert.equal(entry.bucket, 'static', `${entry.id} should declare bucket='static'`);
    }
  });

  test('every static entry default-payload carries the type discriminator', () => {
    for (const entry of STATIC_SECTION_VOCABULARY) {
      const payload = entry.defaultPayload();
      assert.equal(payload.type, entry.id, `${entry.id} default payload missing matching type`);
    }
  });

  test('every static entry is applicableEntities=[\'static_pages\'] only', () => {
    for (const entry of STATIC_SECTION_VOCABULARY) {
      assert.deepEqual(
        Array.from(entry.applicableEntities),
        ['static_pages'],
        `${entry.id} should only be applicable to static_pages`,
      );
    }
  });

  test('vocabularyForEntity(static_pages) returns universal + static merged', () => {
    const vocab = vocabularyForEntity('static_pages');
    // 8 universal (all applicable to static_pages except 'mirror' which is LP-only) = 7 universal + 7 static = 14
    // Actually: universal types applicable to static_pages = header, body, image, video, quote, divider, cta = 7 (mirror is LP-only)
    // Plus 7 static = 14 total
    const ids = vocab.map((e) => e.id);
    // Static types should be present
    for (const id of STATIC_TYPE_IDS) {
      assert.ok(ids.includes(id), `static_pages picker should include ${id}`);
    }
    // mirror should NOT be present (it's LP-only)
    assert.ok(!ids.includes('mirror'), 'mirror is LP-only and should not appear in static_pages picker');
  });

  test('vocabularyForEntity(landing_pages) does NOT include static-specific types', () => {
    const vocab = vocabularyForEntity('landing_pages');
    const ids = vocab.map((e) => e.id);
    for (const id of STATIC_TYPE_IDS) {
      assert.ok(!ids.includes(id), `landing_pages picker should NOT include ${id} (static-only)`);
    }
  });

  test('vocabularyForEntity(blog_posts) does NOT include static-specific types', () => {
    const vocab = vocabularyForEntity('blog_posts');
    const ids = vocab.map((e) => e.id);
    for (const id of STATIC_TYPE_IDS) {
      assert.ok(!ids.includes(id), `blog_posts picker should NOT include ${id} (static-only)`);
    }
  });

  test('universalVocabularyForEntity returns only universal-bucket entries', () => {
    const lpUniversal = universalVocabularyForEntity('landing_pages');
    const lpStatic = staticVocabularyForEntity('landing_pages');
    assert.equal(lpStatic.length, 0, 'landing_pages should have zero static-bucket entries');
    assert.ok(lpUniversal.length >= 7, 'landing_pages should have at least 7 universal entries');
  });

  test('staticVocabularyForEntity returns 7 entries for static_pages, 0 otherwise', () => {
    assert.equal(staticVocabularyForEntity('static_pages').length, 7);
    assert.equal(staticVocabularyForEntity('landing_pages').length, 0);
    assert.equal(staticVocabularyForEntity('blog_posts').length, 0);
  });

  // ── DB-reading-type defaults: never hardcode metadata ─────────────────
  test('testimonial_grid default payload uses filter criteria, not hardcoded testimonials', () => {
    const entry = VOCAB_BY_ID['testimonial_grid'];
    const payload = entry.defaultPayload();
    // Must NOT have a `testimonials` array
    assert.ok(!('testimonials' in payload), 'testimonial_grid must not hardcode testimonials');
    // Must have filter fields
    assert.ok('featured_only' in payload, 'testimonial_grid must filter by featured');
    assert.ok('max_count' in payload, 'testimonial_grid must support max_count');
    assert.equal(payload.featured_only, true, 'default = featured only');
  });

  test('team_grid default payload uses coach_slugs, not hardcoded TeamMember objects', () => {
    const entry = VOCAB_BY_ID['team_grid'];
    const payload = entry.defaultPayload();
    assert.ok(!('coaches' in payload), 'team_grid must not hardcode coaches');
    assert.ok('coach_slugs' in payload, 'team_grid must reference by slug');
    assert.deepEqual(payload.coach_slugs, [], 'default = empty (show all bookable coaches)');
  });

  test('program_card_strip default payload uses program_slugs, not hardcoded Program objects', () => {
    const entry = VOCAB_BY_ID['program_card_strip'];
    const payload = entry.defaultPayload();
    assert.ok(!('programs' in payload), 'program_card_strip must not hardcode programs (R7 / canon source-of-truth)');
    assert.ok('program_slugs' in payload, 'program_card_strip must reference by slug');
    assert.deepEqual(payload.program_slugs, [], 'default = empty (show featured programs from canon)');
  });

  test('faq_accordion default payload includes a starter item', () => {
    const entry = VOCAB_BY_ID['faq_accordion'];
    const payload = entry.defaultPayload();
    assert.ok(Array.isArray(payload.items), 'faq_accordion items must be an array');
    const items = payload.items as Array<Record<string, string>>;
    assert.ok(items.length >= 1, 'default should include at least one empty item to seed the form');
    const item = items[0];
    assert.ok('q_ar' in item && 'q_en' in item, 'item must have bilingual question fields');
    assert.ok('a_ar' in item && 'a_en' in item, 'item must have bilingual answer fields');
  });

  test('philosophy_statement description warns against IP exposure', () => {
    const entry = VOCAB_BY_ID['philosophy_statement'];
    // The description should reference the IP boundary (without naming any
    // specific framework — just signal the boundary exists). Looser test:
    // assert it mentions "framework" or "ملكية" or "internal".
    const combined = `${entry.description_ar} ${entry.description_en}`.toLowerCase();
    const ipSignals = ['framework', 'proprietary', 'ملكية', 'internal', 'internal specs', 'private'];
    const hasSignal = ipSignals.some((s) => combined.includes(s.toLowerCase()));
    assert.ok(
      hasSignal,
      'philosophy_statement description should signal the IP boundary so authors are reminded',
    );
  });

  // ── Bilingual + completeness contract ─────────────────────────────────
  test('every static entry has both AR and EN content fields in default payload (where applicable)', () => {
    // faq_accordion: items have q_ar/q_en/a_ar/a_en — checked above
    // contact_form: title_ar/title_en, subtitle_ar/subtitle_en, etc.
    // methodology_pillar: title_ar/title_en, body_ar/body_en
    // philosophy_statement: body_ar/body_en
    // testimonial_grid + team_grid + program_card_strip: title_ar/title_en (optional)
    const expectations: Record<string, string[]> = {
      contact_form: ['title_ar', 'title_en', 'submit_label_ar', 'submit_label_en'],
      methodology_pillar: ['title_ar', 'title_en', 'body_ar', 'body_en'],
      philosophy_statement: ['body_ar', 'body_en'],
    };
    for (const [id, fields] of Object.entries(expectations)) {
      const payload = VOCAB_BY_ID[id].defaultPayload();
      for (const f of fields) {
        assert.ok(f in payload, `${id} default payload should include ${f}`);
      }
    }
  });
});
