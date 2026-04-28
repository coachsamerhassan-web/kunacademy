/**
 * Wave 15 Wave 3 canary v2 — styling-types unit tests.
 *
 * Coverage:
 *   - aspectToCss maps presets correctly
 *   - gradientToCss emits a parseable CSS gradient
 *   - paddingToRem maps presets to rem values
 *   - KUN_COLOR_PALETTE has every required brand token
 *   - EMPTY_BACKGROUND / EMPTY_STYLING are { type: 'none' } / {} respectively
 *
 * No DOM dependencies — runnable under `node --test` via tsx.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  aspectToCss,
  gradientToCss,
  paddingToRem,
  KUN_COLOR_PALETTE,
  EMPTY_BACKGROUND,
  EMPTY_STYLING,
} from '../../components/authoring/panels/styling-types';

describe('Wave 15 W3 v2 / styling-types', () => {
  test('aspectToCss preserves "16/9" with spaces', () => {
    assert.strictEqual(aspectToCss('16/9'), '16 / 9');
    assert.strictEqual(aspectToCss('4/3'), '4 / 3');
    assert.strictEqual(aspectToCss('1/1'), '1 / 1');
    assert.strictEqual(aspectToCss('9/16'), '9 / 16');
  });

  test('aspectToCss returns undefined for free / undefined', () => {
    assert.strictEqual(aspectToCss('free'), undefined);
    assert.strictEqual(aspectToCss(undefined), undefined);
  });

  test('gradientToCss emits linear-gradient with sorted stops', () => {
    const css = gradientToCss({
      angle: 90,
      stops: [
        { color: '#FFF5E9', position: 100 },
        { color: '#F47E42', position: 0 },
      ],
    });
    assert.strictEqual(css, 'linear-gradient(90deg, #F47E42 0%, #FFF5E9 100%)');
  });

  test('gradientToCss preserves angle=0 (top-to-bottom)', () => {
    const css = gradientToCss({
      angle: 0,
      stops: [
        { color: '#000', position: 0 },
        { color: '#FFF', position: 100 },
      ],
    });
    assert.match(css, /^linear-gradient\(0deg, #000 0%, #FFF 100%\)$/);
  });

  test('paddingToRem maps presets', () => {
    assert.strictEqual(paddingToRem('none'), '0');
    assert.strictEqual(paddingToRem('small'), '1.5rem');
    assert.strictEqual(paddingToRem('medium'), '3rem');
    assert.strictEqual(paddingToRem('large'), '5rem');
    assert.strictEqual(paddingToRem(undefined), '');
  });

  test('KUN_COLOR_PALETTE contains every brand token', () => {
    const names = KUN_COLOR_PALETTE.map((c) => c.name);
    for (const required of [
      'Cosmic Latte',
      'Platinum',
      'Mandarin',
      'Charleston Green',
      'Dark Slate Blue',
      'Sky Blue',
    ]) {
      assert.ok(names.includes(required), `palette missing ${required}`);
    }
  });

  test('KUN_COLOR_PALETTE every entry is valid hex', () => {
    for (const c of KUN_COLOR_PALETTE) {
      assert.match(c.hex, /^#[0-9A-Fa-f]{6}$/, `${c.name} has invalid hex ${c.hex}`);
    }
  });

  test('EMPTY_BACKGROUND is { type: "none" } — preserves byte-identity', () => {
    assert.deepStrictEqual(EMPTY_BACKGROUND, { type: 'none' });
  });

  test('EMPTY_STYLING is empty object', () => {
    assert.deepStrictEqual(EMPTY_STYLING, {});
  });
});
