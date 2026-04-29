/**
 * Wave 15 Wave 4 PRECURSOR — Static-section renderer shape tests (2026-04-29).
 *
 * Smoke-tests that:
 *  - the renderer module loads cleanly and exposes all 7 components
 *  - the dispatcher in lp-renderer.tsx imports each of the 7 by their canonical names
 *  - boundary contract is preserved:
 *      a) `static-sections.tsx` is NEUTRAL (no `'use client'`, no `'server-only'`,
 *         no DB imports — reachable from BOTH server tree AND editor canvas)
 *      b) `static-section-data.ts` is server-only (`import 'server-only'`)
 *      c) the data loader uses cms helpers (PROGRAM-CANON.md source-of-truth
 *         boundary), never @kunacademy/db directly
 *
 * Architecture: route-level page.tsx Server Component pre-resolves data via
 * `preloadStaticSectionData(sections)` and passes the resulting Map to
 * `<LpRenderer staticData=...>`. The renderers receive their data as plain
 * props, so the renderer module stays import-safe in the client bundle
 * (the editor canvas falls back to placeholder previews).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RENDERER_PATH = resolve(
  __dirname,
  '../../components/lp/sections/default/static-sections.tsx',
);
const DATA_LOADER_PATH = resolve(
  __dirname,
  '../../components/lp/sections/default/static-section-data.ts',
);
const DISPATCHER_PATH = resolve(__dirname, '../../components/lp/lp-renderer.tsx');

const EXPECTED_COMPONENTS = [
  'StaticFaqAccordionSection',
  'StaticTeamGridSection',
  'StaticMethodologyPillarSection',
  'StaticPhilosophyStatementSection',
  'StaticContactFormSection',
  'StaticTestimonialGridSection',
  'StaticProgramCardStripSection',
];

describe('Wave 15 W4 PRECURSOR / static-sections renderer module', () => {
  test('static-sections.tsx exports all 7 expected component names', () => {
    const src = readFileSync(RENDERER_PATH, 'utf8');
    for (const name of EXPECTED_COMPONENTS) {
      assert.match(
        src,
        new RegExp(`export\\s+function\\s+${name}\\b`),
        `static-sections.tsx must export ${name} as a function`,
      );
    }
  });

  test('renderer module is neutral — no DB imports, no use-client, no server-only', () => {
    // The renderer file is reachable from BOTH the public route's Server
    // Component tree AND the editor canvas's Client Component tree (via
    // lp-renderer.tsx). It MUST be neutral (no DB, no boundary directive).
    const src = readFileSync(RENDERER_PATH, 'utf8');
    assert.ok(
      !src.includes("from '@kunacademy/db'"),
      'static-sections must NOT import @kunacademy/db (boundary violation)',
    );
    assert.ok(
      !src.includes("from '@kunacademy/cms/server'"),
      'static-sections must NOT import @kunacademy/cms/server (would break client bundle)',
    );
    // Match a TOP-LEVEL "use client"/"server-only" directive only — strip
    // comments first so backtick-quoted prose in JSDoc isn't a false positive.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.ok(
      !/^\s*['"]use client['"]\s*;?\s*$/m.test(stripped),
      'static-sections must NOT declare "use client" (renderer should be neutral)',
    );
    assert.ok(
      !/^\s*import\s+['"]server-only['"]\s*;?\s*$/m.test(stripped),
      'static-sections must NOT import server-only (would break editor canvas)',
    );
  });

  test('static-section-data.ts is server-only and uses cms helpers', () => {
    const src = readFileSync(DATA_LOADER_PATH, 'utf8');
    assert.ok(
      /import\s+['"]server-only['"]/.test(src),
      "static-section-data.ts must `import 'server-only'` (boundary enforcement)",
    );
    assert.ok(
      /@kunacademy\/cms\/server/.test(src),
      'static-section-data.ts must import from @kunacademy/cms/server (canon source)',
    );
    assert.ok(
      !src.includes("from '@kunacademy/db'"),
      'static-section-data.ts should use cms helpers, not @kunacademy/db directly (preserves PROGRAM-CANON.md boundary)',
    );
  });

  test('static-section-data.ts exports the loader functions', () => {
    const src = readFileSync(DATA_LOADER_PATH, 'utf8');
    const expected = [
      'loadTestimonialGridData',
      'loadTeamGridData',
      'loadProgramCardStripData',
      'preloadStaticSectionData',
    ];
    for (const fn of expected) {
      assert.match(
        src,
        new RegExp(`export\\s+async\\s+function\\s+${fn}\\b`),
        `data loader must export ${fn}`,
      );
    }
  });

  test('lp-renderer.tsx imports all 7 static components', () => {
    const src = readFileSync(DISPATCHER_PATH, 'utf8');
    for (const name of EXPECTED_COMPONENTS) {
      assert.match(
        src,
        new RegExp(`\\b${name}\\b`),
        `lp-renderer.tsx must reference ${name}`,
      );
    }
  });

  test('lp-renderer.tsx dispatcher recognizes all 7 static type discriminators', () => {
    const src = readFileSync(DISPATCHER_PATH, 'utf8');
    const types = [
      'faq_accordion',
      'team_grid',
      'methodology_pillar',
      'philosophy_statement',
      'contact_form',
      'testimonial_grid',
      'program_card_strip',
    ];
    for (const t of types) {
      assert.match(
        src,
        new RegExp(`['"]${t}['"]`),
        `dispatcher must branch on type === '${t}'`,
      );
    }
  });

  test('lp-renderer.tsx accepts the staticData prop (data threading)', () => {
    const src = readFileSync(DISPATCHER_PATH, 'utf8');
    assert.ok(
      /staticData\??:\s*Map<number,\s*StaticSectionData>/.test(src),
      'LpRenderer props must include staticData?: Map<number, StaticSectionData>',
    );
    assert.ok(
      src.includes('staticDataForSection'),
      'dispatcher must thread staticDataForSection per section index',
    );
  });
});
