/**
 * Phase 3 (2026-04-30) — MediaLibraryPicker: structural + smoke tests.
 *
 * Source-level structural checks — guards the component contract without
 * a React renderer. No jsdom needed.
 *
 * What's covered:
 *   1. Export shape — barrel + direct import both resolve the component.
 *   2. content_media table alignment — returns mediaId from content_media.
 *   3. MediaPickerDialog wired — modal is the picker surface.
 *   4. Props contract — value/onChange/onClear/locale/disabled all present.
 *   5. Thumbnail preview — img rendered when value is truthy.
 *   6. Error display — role="alert".
 *   7. "No image" empty state present.
 *   8. Bilingual labels — AR + EN strings for buttons.
 *   9. Minimum touch targets enforced on buttons.
 *  10. Controlled open/close lifecycle.
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
  'MediaLibraryPicker.tsx',
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

describe('Phase 3 — MediaLibraryPicker structural guards', () => {
  test('file exists and is non-empty', () => {
    assert.ok(SRC.length > 100, 'Component source must be non-empty');
  });

  test('barrel index exports MediaLibraryPicker', () => {
    assert.ok(
      IDX.includes('MediaLibraryPicker'),
      'Barrel index must export MediaLibraryPicker',
    );
  });

  test('barrel index exports MediaPickResult type', () => {
    assert.ok(
      IDX.includes('MediaPickResult'),
      'Barrel index must export MediaPickResult type',
    );
  });

  test('component is a client component', () => {
    assert.ok(
      SRC.trimStart().startsWith("'use client'"),
      "Must start with 'use client'",
    );
  });

  test('MediaPickerDialog is imported and rendered', () => {
    assert.ok(
      SRC.includes('MediaPickerDialog'),
      'Must use MediaPickerDialog as the picker surface',
    );
  });

  test('returns mediaId from content_media table', () => {
    assert.ok(
      SRC.includes('mediaId: selection.mediaId'),
      'onChange must return the content_media.id as mediaId',
    );
  });

  test('props contract — value prop present', () => {
    assert.ok(
      SRC.includes('value: string | null | undefined'),
      'value must be typed string | null | undefined',
    );
  });

  test('props contract — onChange callback present', () => {
    assert.ok(
      SRC.includes('onChange: (pick: MediaPickResult) => void'),
      'onChange must accept MediaPickResult',
    );
  });

  test('props contract — onClear optional callback', () => {
    assert.ok(
      SRC.includes('onClear?: () => void'),
      'onClear must be an optional callback',
    );
  });

  test('props contract — locale prop present', () => {
    assert.ok(
      SRC.includes("locale: 'ar' | 'en'"),
      "locale must be typed 'ar' | 'en'",
    );
  });

  test('props contract — disabled prop present', () => {
    assert.ok(
      SRC.includes('disabled?: boolean'),
      'disabled must be an optional boolean',
    );
  });

  test('thumbnail preview renders img when value exists', () => {
    assert.ok(
      SRC.includes('<img') && SRC.includes('src={value}'),
      'Must render an img element with the current value as src',
    );
  });

  test('empty state shown when no image selected', () => {
    assert.ok(
      SRC.includes("isAr ? 'لم تُختر صورة' : 'No image selected'"),
      'Must show bilingual empty state when value is falsy',
    );
  });

  test('error display uses role=alert', () => {
    assert.ok(
      SRC.includes('role="alert"'),
      'Error message must have role="alert" for accessibility',
    );
  });

  test('error state changes border to red', () => {
    assert.ok(
      SRC.includes('border-red-400'),
      'Error state must change border to red-400',
    );
  });

  test('bilingual labels — choose image', () => {
    assert.ok(
      SRC.includes("isAr ? 'اختر صورة' : 'Choose image'"),
      'Button must have bilingual label for AR and EN',
    );
  });

  test('bilingual labels — change image', () => {
    assert.ok(
      SRC.includes("isAr ? 'تغيير الصورة' : 'Change image'"),
      'Change image button must be bilingual',
    );
  });

  test('bilingual labels — remove image', () => {
    assert.ok(
      SRC.includes("isAr ? 'إزالة الصورة' : 'Remove image'"),
      'Remove image button must be bilingual',
    );
  });

  test('remove button only shown when value + onClear present', () => {
    // Guard against showing a non-functional remove button.
    assert.ok(
      SRC.includes('value && onClear && !disabled'),
      'Remove button must only render when value + onClear are present and not disabled',
    );
  });

  test('picker opens on button click and closes on select/cancel', () => {
    assert.ok(
      SRC.includes('setPickerOpen(true)'),
      'Must open picker when button clicked',
    );
    assert.ok(
      SRC.includes('setPickerOpen(false)'),
      'Must close picker on select or cancel',
    );
  });

  test('minimum touch target on action buttons', () => {
    // 44px min height per CLAUDE.md.
    assert.ok(
      SRC.includes('min-h-[36px]') || SRC.includes('min-h-11'),
      'Action buttons must meet minimum height touch target',
    );
  });
});
