/**
 * Wave 15 Wave 3 post-canary — R11 lint coverage on background.image.src
 *
 * Per Item 10: R11.bg_image_unsafe_protocol blocks javascript:, data:,
 * vbscript:, ftp: schemes in background.image.src fields. Legitimate
 * http(s):// CDN URLs pass freely (not restricted to the embed allowlist
 * since background images are not embeds).
 *
 * Also tests that the existing R11 pattern does not regress on the
 * standard composition_json walkJsonb path.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { lintRowBody, hasHardBlock } from '../agent-api/lints.js';

describe('Wave 15 W3 post-canary / R11 background image lint', () => {
  test('R11: javascript: in background.image.src → HARD BLOCK', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        title_ar: 'صفحة',
        composition_json: {
          sections: [
            {
              type: 'header',
              title_ar: 'مرحبًا',
              background: {
                image: { src: 'javascript:alert(1)' },
              },
            },
          ],
        },
      },
    });
    assert.ok(hasHardBlock(violations), 'should hard-block on javascript: scheme');
    assert.ok(
      violations.some((v) => v.rule_id === 'R11.bg_image_unsafe_protocol'),
      'should flag R11.bg_image_unsafe_protocol',
    );
    assert.ok(
      violations.some((v) =>
        v.path.includes('background.image.src'),
      ),
      'violation path should reference background.image.src',
    );
  });

  test('R11: data: in background.image.src → HARD BLOCK', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        composition_json: {
          sections: [
            {
              type: 'mirror',
              background: {
                image: { src: 'data:image/png;base64,iVBORw0KGgo=' },
              },
            },
          ],
        },
      },
    });
    assert.ok(hasHardBlock(violations), 'data: scheme should hard-block');
    assert.ok(
      violations.some((v) => v.rule_id === 'R11.bg_image_unsafe_protocol'),
    );
  });

  test('R11: ftp: in background.image.src → HARD BLOCK', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        composition_json: {
          sections: [
            {
              type: 'body',
              background: {
                image: { src: 'ftp://evil.example.com/img.png' },
              },
            },
          ],
        },
      },
    });
    assert.ok(hasHardBlock(violations), 'ftp: scheme should hard-block');
  });

  test('R11: vbscript: in background.image.src → HARD BLOCK', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        composition_json: {
          sections: [
            {
              type: 'cta',
              background: {
                image: { src: 'vbscript:msgbox("XSS")' },
              },
            },
          ],
        },
      },
    });
    assert.ok(hasHardBlock(violations), 'vbscript: scheme should hard-block');
  });

  test('R11: https:// CDN URL in background.image.src → PASSES (not blocked)', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        composition_json: {
          sections: [
            {
              type: 'mirror',
              background: {
                image: {
                  src: 'https://kuncoaching.me/images/hero-bg.jpg',
                },
              },
            },
          ],
        },
      },
    });
    const r11Violations = violations.filter((v) =>
      v.rule_id === 'R11.bg_image_unsafe_protocol',
    );
    assert.equal(r11Violations.length, 0, 'https:// CDN URL should not be blocked by R11');
    assert.ok(!hasHardBlock(violations), 'no hard-block for valid https:// URL');
  });

  test('R11: relative URL in background.image.src → PASSES', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        composition_json: {
          sections: [
            {
              type: 'header',
              background: {
                image: { src: '/images/bg.png' },
              },
            },
          ],
        },
      },
    });
    const r11Violations = violations.filter((v) =>
      v.rule_id === 'R11.bg_image_unsafe_protocol',
    );
    assert.equal(r11Violations.length, 0, 'relative URL should not be blocked');
  });

  test('R11: no background field → no violation', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        composition_json: {
          sections: [
            {
              type: 'mirror',
              title_ar: 'مرحبًا',
            },
          ],
        },
      },
    });
    const r11Violations = violations.filter((v) =>
      v.rule_id === 'R11.bg_image_unsafe_protocol',
    );
    assert.equal(r11Violations.length, 0, 'no background field → no R11 violation');
  });

  test('R11: section.src unsafe protocol → HARD BLOCK', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        composition_json: {
          sections: [
            {
              type: 'video',
              src: 'javascript:void(0)',
            },
          ],
        },
      },
    });
    assert.ok(hasHardBlock(violations), 'javascript: in section.src should hard-block');
    assert.ok(
      violations.some((v) => v.path.includes('.src')),
      'violation path should reference .src',
    );
  });

  test('R11: multi-section page — only the unsafe section is flagged', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        composition_json: {
          sections: [
            {
              type: 'header',
              background: { image: { src: 'https://safe.cdn/img.jpg' } },
            },
            {
              type: 'mirror',
              background: { image: { src: 'javascript:evil()' } },
            },
            {
              type: 'cta',
              background: { image: { src: 'https://other.cdn/img.jpg' } },
            },
          ],
        },
      },
    });
    const r11Violations = violations.filter((v) =>
      v.rule_id === 'R11.bg_image_unsafe_protocol',
    );
    assert.equal(r11Violations.length, 1, 'only one section should be flagged');
    assert.ok(
      r11Violations[0]?.path.includes('sections[1]'),
      'violation should be in sections[1]',
    );
  });
});
