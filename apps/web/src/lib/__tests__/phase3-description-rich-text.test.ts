/**
 * Phase 3 (2026-04-30) — DescriptionRichText: structural + smoke tests.
 *
 * Source-level structural checks — guards the component contract without
 * a React renderer. No jsdom, no browser APIs needed.
 *
 * What's covered:
 *   1. Export shape — barrel + direct import both resolve the component.
 *   2. TipTap dependency — RichEditor is dynamic-imported (SSR safety).
 *   3. MediaPickerDialog wired for inline image pick.
 *   4. Props contract — value/onChange/locale/label/error/disabled all present.
 *   5. Error display — role="alert" on error text.
 *   6. Disabled mode — pointer-events-none applied.
 *   7. Focus ring — focus-within styles present for a11y.
 *   8. Client boundary — 'use client' at top.
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
  'DescriptionRichText.tsx',
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

describe('Phase 3 — DescriptionRichText structural guards', () => {
  test('file exists and is non-empty', () => {
    assert.ok(SRC.length > 100, 'Component source must be non-empty');
  });

  test('barrel index exports DescriptionRichText', () => {
    assert.ok(
      IDX.includes('DescriptionRichText'),
      'Barrel index must export DescriptionRichText',
    );
  });

  test('component is a client component', () => {
    assert.ok(
      SRC.trimStart().startsWith("'use client'"),
      "Must start with 'use client'",
    );
  });

  test('RichEditor is dynamically imported (SSR safe)', () => {
    assert.ok(
      SRC.includes("dynamic(") && SRC.includes('@kunacademy/ui/rich-editor'),
      'RichEditor must be dynamic-imported to keep TipTap off SSR',
    );
  });

  test('ssr: false on the dynamic import', () => {
    assert.ok(
      SRC.includes('ssr: false'),
      "Dynamic import must have ssr: false to prevent server-side rendering of TipTap",
    );
  });

  test('MediaPickerDialog is imported and used', () => {
    assert.ok(
      SRC.includes('MediaPickerDialog'),
      'MediaPickerDialog must be imported for inline image pick',
    );
  });

  test('onImagePick prop is wired to RichEditor', () => {
    assert.ok(
      SRC.includes('onImagePick'),
      'onImagePick must be passed to RichEditor to enable toolbar image button',
    );
  });

  test('props contract — value and onChange present', () => {
    assert.ok(
      SRC.includes('value: JSONContent | null'),
      'value prop must be typed JSONContent | null',
    );
    assert.ok(
      SRC.includes('onChange: (value: JSONContent) => void'),
      'onChange prop must accept JSONContent',
    );
  });

  test('props contract — locale present', () => {
    assert.ok(
      SRC.includes("locale: DescriptionRichTextLocale"),
      'locale prop must be present',
    );
  });

  test('props contract — label and helperText present', () => {
    assert.ok(SRC.includes('label?:'), 'label prop must be optional');
    assert.ok(SRC.includes('helperText?:'), 'helperText prop must be optional');
  });

  test('props contract — error prop triggers role=alert', () => {
    assert.ok(SRC.includes('role="alert"'), 'Error text must use role="alert"');
  });

  test('props contract — disabled sets pointer-events-none', () => {
    assert.ok(
      SRC.includes('pointer-events-none'),
      'Disabled mode must apply pointer-events-none to the editor container',
    );
  });

  test('props contract — required prop adds asterisk', () => {
    assert.ok(
      SRC.includes('required'),
      'required prop must be present for form validation hint',
    );
    assert.ok(
      SRC.includes('text-red-600'),
      'Required asterisk must be red-600',
    );
  });

  test('focus ring styling present for a11y', () => {
    assert.ok(
      SRC.includes('focus-within:border-[var(--color-primary)]'),
      'Editor wrapper must show focus ring when editor is focused',
    );
  });

  test('error state changes border to red', () => {
    assert.ok(
      SRC.includes('border-red-400'),
      'Error state must show red border',
    );
  });

  test('picker opens on image pick and closes on select/cancel', () => {
    assert.ok(
      SRC.includes('setPickerOpen(true)'),
      'Must open picker when image button is clicked',
    );
    assert.ok(
      SRC.includes('setPickerOpen(false)'),
      'Must close picker on select or cancel',
    );
  });
});
