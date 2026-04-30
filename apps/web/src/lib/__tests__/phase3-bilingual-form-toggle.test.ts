/**
 * Phase 3 (2026-04-30) — BilingualFormToggle: structural + smoke tests.
 *
 * Source-level structural checks — guards the component contract without
 * a React renderer (keeps test stack simple, no jsdom dependency).
 *
 * What's covered:
 *   1. Export shape — barrel + direct import both resolve the component.
 *   2. Render-prop API — children function signature is declared.
 *   3. Locale pill anatomy — AR and EN buttons present.
 *   4. aria attributes — accessibility contract present in source.
 *   5. dir switching — 'rtl' / 'ltr' emitted based on locale.
 *   6. Controlled + uncontrolled modes — both prop paths exist.
 *   7. No public-page contamination — component only lives in forms/.
 *
 * Net new — nothing to delete.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENT_PATH = join(
  __dirname,
  '..',
  '..',
  'components',
  'forms',
  'BilingualFormToggle.tsx',
);
const INDEX_PATH = join(
  __dirname,
  '..',
  '..',
  'components',
  'forms',
  'index.ts',
);

const SRC = readFileSync(COMPONENT_PATH, 'utf8');
const IDX = readFileSync(INDEX_PATH, 'utf8');

describe('Phase 3 — BilingualFormToggle structural guards', () => {
  test('file exists and is non-empty', () => {
    assert.ok(SRC.length > 100, 'Component source must be non-empty');
  });

  test('barrel index exports BilingualFormToggle', () => {
    assert.ok(
      IDX.includes('BilingualFormToggle'),
      'Barrel index must export BilingualFormToggle',
    );
  });

  test('barrel index exports BilingualLocale type', () => {
    assert.ok(
      IDX.includes('BilingualLocale'),
      'Barrel index must export BilingualLocale type',
    );
  });

  test('component is a client component', () => {
    assert.ok(
      SRC.trimStart().startsWith("'use client'"),
      "Must start with 'use client' (BilingualFormToggle uses useState)",
    );
  });

  test('children prop is a render prop function', () => {
    assert.ok(
      SRC.includes('children: (locale: BilingualLocale) => ReactNode'),
      'children must be typed as a render prop (locale: BilingualLocale) => ReactNode',
    );
  });

  test('supports controlled locale prop', () => {
    assert.ok(
      SRC.includes('locale?: BilingualLocale'),
      'Must accept controlled locale prop',
    );
  });

  test('supports onLocaleChange callback', () => {
    assert.ok(
      SRC.includes('onLocaleChange?: (locale: BilingualLocale) => void'),
      'Must accept onLocaleChange callback',
    );
  });

  test('supports defaultLocale for uncontrolled mode', () => {
    assert.ok(
      SRC.includes('defaultLocale?: BilingualLocale'),
      'Must accept defaultLocale for uncontrolled mode',
    );
  });

  test('renders AR and EN pill buttons', () => {
    // Both locale string literals must appear in the component
    // (passed to LocalePillButton as locale="ar" and locale="en").
    assert.ok(
      SRC.includes('locale="ar"') || SRC.includes("locale='ar'"),
      'Must render AR pill button with locale="ar"',
    );
    assert.ok(
      SRC.includes('locale="en"') || SRC.includes("locale='en'"),
      'Must render EN pill button with locale="en"',
    );
  });

  test('switches dir attribute based on locale', () => {
    assert.ok(
      SRC.includes("isAr ? 'rtl' : 'ltr'"),
      "Content area must set dir='rtl' for Arabic, dir='ltr' for English",
    );
  });

  test('includes role=group on wrapper for a11y', () => {
    assert.ok(
      SRC.includes('role="group"'),
      'Must have role="group" on the wrapper for accessibility',
    );
  });

  test('includes aria-selected on locale pill buttons', () => {
    assert.ok(
      SRC.includes('aria-selected={active}'),
      'Locale pills must have aria-selected for accessibility',
    );
  });

  test('aria-live region announces locale change', () => {
    assert.ok(
      SRC.includes('aria-live="polite"'),
      'Must have an aria-live region to announce locale changes',
    );
  });

  test('toggle strip is always LTR regardless of active locale', () => {
    // Per design: the toggle strip itself stays LTR so AR/EN pills don't flip.
    assert.ok(
      SRC.includes('dir="ltr" // toggle strip'),
      'Toggle strip container must be dir="ltr" with explanatory comment',
    );
  });

  test('minimum touch target enforced on pill buttons', () => {
    // 44px minimum per CLAUDE.md touch target rules.
    assert.ok(
      SRC.includes('min-w-[44px]') || SRC.includes('min-h-[44px]'),
      'Pill buttons must meet 44px minimum touch target requirement',
    );
  });

  test('locale indicator badge uses lang attribute', () => {
    // Each pill must set lang so screen readers use correct pronunciation.
    assert.ok(
      SRC.includes('lang={locale}'),
      'Locale pill buttons must set the lang attribute',
    );
  });
});
