/**
 * Wave 15 Wave 3 canary v2 — Section descriptions registry tests (Issue 7).
 *
 * Coverage:
 *   - Every LP type id has both AR + EN labels + descriptions
 *   - Universal section vocabulary entries have AR + EN descriptions
 *   - All description strings are non-empty
 *   - No description leaks methodology recipe IP language (defensive: no
 *     known recipe-keywords appear)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNIVERSAL_SECTION_VOCABULARY,
  LP_TYPE_DESCRIPTIONS,
} from '../authoring/section-vocabulary';

const LP_TYPES = [
  'mirror',
  'reframe',
  'description',
  'benefits',
  'carry_out',
  'who_for',
  'who_not_for',
  'format',
  'price',
  'group_alumni',
  'credibility',
  'objections',
  'faq',
  'cta',
  'custom',
] as const;

describe('Wave 15 W3 v2 / LP_TYPE_DESCRIPTIONS', () => {
  test('every LP type has an entry', () => {
    for (const t of LP_TYPES) {
      const d = LP_TYPE_DESCRIPTIONS[t];
      assert.ok(d, `LP type ${t} missing description entry`);
    }
  });

  test('every entry has AR + EN labels + descriptions', () => {
    for (const t of LP_TYPES) {
      const d = LP_TYPE_DESCRIPTIONS[t];
      assert.ok(d.label_ar.length > 0, `${t} label_ar empty`);
      assert.ok(d.label_en.length > 0, `${t} label_en empty`);
      assert.ok(d.description_ar.length > 0, `${t} description_ar empty`);
      assert.ok(d.description_en.length > 0, `${t} description_en empty`);
    }
  });

  test('every entry has an icon glyph', () => {
    for (const t of LP_TYPES) {
      const d = LP_TYPE_DESCRIPTIONS[t];
      assert.ok(d.icon.length > 0, `${t} icon empty`);
    }
  });

  test('IP defensive: no description contains "beat 1" or "step 1" recipe-style language', () => {
    const recipeKeywords = ['beat 1', 'beat 2', 'step 1', 'step 2', 'phase 1', 'phase 2'];
    for (const t of LP_TYPES) {
      const d = LP_TYPE_DESCRIPTIONS[t];
      const all = `${d.description_ar} ${d.description_en}`.toLowerCase();
      for (const k of recipeKeywords) {
        assert.ok(
          !all.includes(k),
          `${t} description contains recipe-style keyword "${k}"`,
        );
      }
    }
  });
});

describe('Wave 15 W3 v2 / UNIVERSAL_SECTION_VOCABULARY descriptions', () => {
  test('every universal entry has AR + EN descriptions', () => {
    for (const e of UNIVERSAL_SECTION_VOCABULARY) {
      assert.ok(e.description_ar.length > 0, `universal ${e.id} description_ar empty`);
      assert.ok(e.description_en.length > 0, `universal ${e.id} description_en empty`);
    }
  });

  test('AR descriptions contain Arabic characters', () => {
    const arabicRangeRe = /[؀-ۿ]/;
    for (const e of UNIVERSAL_SECTION_VOCABULARY) {
      assert.match(
        e.description_ar,
        arabicRangeRe,
        `universal ${e.id} AR description has no Arabic characters`,
      );
    }
  });
});
