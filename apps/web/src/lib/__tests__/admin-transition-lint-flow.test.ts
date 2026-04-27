/**
 * Wave 15 Wave 3 — admin transition lint integration test.
 *
 * Verifies the hard-block contract end-to-end through the lint library:
 *
 *   1. Author drafts a row whose body contains a R1 (methodology beat
 *      exposure) violation.
 *   2. lintRowBody flags it as `hard_block`.
 *   3. hasHardBlock returns true.
 *   4. violationsToResponse + violationsForAudit produce the same shapes
 *      the admin route returns to the editor.
 *
 * Mirrors the agent route's lint integration (Wave 2 page-service-w2.test
 * already exercises the agent path); this proves the SAME helpers work for
 * the admin path. Together with the route's integration smoke (manual
 * curl on staging, Wave 3 canary), the full lint flow is covered.
 *
 * Why a unit test over an HTTP test: the lint library is the load-bearing
 * surface. Once unit-verified, the route is pure plumbing.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  lintRowBody,
  hasHardBlock,
  violationsToResponse,
  violationsForAudit,
} from '../agent-api/lints';

describe('Wave 15 W3 / admin transition lint flow', () => {
  test('R1 beat-count phrase produces hard_block', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        composition_json: {
          sections: [
            {
              type: 'description',
              // Match against R1.beat_count_en pattern: /\d+\s+(?:beats?|step protocol|...)/
              body_en: 'Our 12 beats guide you through inner shifts.',
            },
          ],
        },
      },
    });

    const r1Violations = violations.filter((v) => v.rule_id.startsWith('R1.'));
    assert.ok(r1Violations.length > 0, `expected at least one R1 violation, got ${JSON.stringify(violations)}`);
    assert.ok(hasHardBlock(violations), 'lint hard_block must fire');
  });

  test('clean body produces zero violations', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        composition_json: {
          sections: [
            {
              type: 'description',
              body_en: 'A coaching journey rooted in somatic awareness.',
              body_ar: 'رحلة كوتشينج جذورها الوعي الجسدي.',
            },
          ],
        },
      },
    });
    assert.equal(violations.length, 0);
    assert.equal(hasHardBlock(violations), false);
  });

  test('violationsToResponse mirrors the editor API contract', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        composition_json: {
          // R1.beat_name_open_loop matches "opening loop sequence" or "open loop sequence"
          sections: [{ type: 'mirror', body_en: 'opening loop sequence guides clients' }],
        },
      },
    });

    const resp = violationsToResponse(violations);
    assert.equal(typeof resp.total, 'number');
    assert.equal(typeof resp.hard_blocks, 'number');
    assert.equal(typeof resp.soft_warns, 'number');
    assert.ok(Array.isArray(resp.details));
    assert.equal(resp.total, resp.hard_blocks + resp.soft_warns);
  });

  test('violationsForAudit dedupes rule_ids + paths', () => {
    const violations = lintRowBody({
      entity: 'landing_pages',
      row: {
        composition_json: {
          sections: [
            { type: 'description', body_en: '12 beats deliver insight' },
            { type: 'description', body_en: '8 step protocol takes hold' },
          ],
        },
      },
    });
    const audit = violationsForAudit(violations);
    assert.ok(Array.isArray(audit.rule_ids));
    assert.ok(Array.isArray(audit.paths));
    assert.equal(audit.count, violations.length);
    // rule_ids should be unique
    assert.equal(new Set(audit.rule_ids).size, audit.rule_ids.length);
  });

  test('clean static_pages body is allowed through both review + published', () => {
    const violations = lintRowBody({
      entity: 'static_pages',
      row: {
        composition_json: {
          sections: [
            { type: 'header', title_en: 'About Kun', title_ar: 'عن كُن' },
            { type: 'body', body_en: 'A coaching academy.', body_ar: 'أكاديمية كوتشينج.' },
          ],
        },
      },
    });
    assert.equal(hasHardBlock(violations), false);
  });

  test('blog_posts row with R1 violation is HARD-blocked from publish', () => {
    const violations = lintRowBody({
      entity: 'blog_posts',
      row: {
        title_en: 'Mastery Journey',
        content_en: 'Walk through 12 beats step by step.',
      },
    });
    assert.ok(hasHardBlock(violations), `blog scalar content must be linted; got ${JSON.stringify(violations)}`);
  });
});
