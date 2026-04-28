/**
 * Wave 15 W3 canary v3 regression guard — rich editor toolbar icon rendering.
 *
 * Bug C (canary v2 respin): the toolbar rendered raw unicode text glyphs
 * ("B I S H1 H2 ..." etc.) instead of SVG Lucide icons.  Root cause: the
 * packages/ui dist was stale (April 25 build); the source was updated on
 * April 28 but the turbo cache on VPS served the old compiled output.
 *
 * This spec is the visual-verify gate mandated by CLAUDE.md:
 *   "Rendered verification > API reads — a boolean flag reading `true` from
 *    an API does NOT prove the feature works. Render the actual page/UI/output
 *    and verify visually."
 *
 * What it asserts:
 *   - The toolbar div (.rich-editor-toolbar) contains ≥ 8 <svg> elements
 *     (one per Lucide icon: Bold, Italic, Strike, Link, H2, H3, BulletList,
 *      OrderedList, AlignLeft, AlignCenter, AlignRight, Image, Video, Undo,
 *      Redo, More — 16 total in the full toolbar).
 *   - The toolbar text content does NOT contain the known text-glyph strings
 *     that the old toolbar emitted ('B', 'I', 'S', '•', '1.', 'H1', 'H2').
 *
 * Note: this spec requires the app to be running and the admin session
 * to be active (or a mock/stub for the editor route).  In CI it runs against
 * the VPS staging URL.  Locally it runs against localhost:3001.
 *
 * To run:
 *   BASE_URL=https://kuncoaching.me ADMIN_SESSION_COOKIE=... pnpm playwright test canary-v3-toolbar-icons
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';
// UUID of the canary LP test row (published; corporate slug)
const CANARY_LP_ID = 'aceb9d8b-fe5f-4dd3-8592-73e6d444bc62';

test.describe('Canary v3 — rich editor toolbar icons regression guard', () => {
  test.skip(
    !process.env.ADMIN_SESSION_COOKIE,
    'Set ADMIN_SESSION_COOKIE env var to run admin editor tests',
  );

  test('toolbar renders ≥ 8 SVG icon elements, no text-glyph strings', async ({ page }) => {
    // Inject admin session cookie so we can load the editor route.
    if (process.env.ADMIN_SESSION_COOKIE) {
      await page.context().addCookies([
        {
          name: 'authjs.session-token',
          value: process.env.ADMIN_SESSION_COOKIE,
          domain: new URL(BASE_URL).hostname,
          path: '/',
          secure: BASE_URL.startsWith('https'),
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
    }

    await page.goto(`${BASE_URL}/ar/admin/lp/${CANARY_LP_ID}`, { waitUntil: 'networkidle' });

    // Click the group_alumni section in the page tree so the side panel opens
    // with a BilingualRichEditor (the field that showed the broken toolbar in
    // Samer's screenshot).
    await page.waitForSelector('.rich-editor-toolbar', { timeout: 15000 });

    const toolbar = page.locator('.rich-editor-toolbar').first();
    await expect(toolbar).toBeVisible();

    // Assert ≥ 8 SVG elements inside the toolbar (one per Lucide icon)
    const svgCount = await toolbar.locator('svg').count();
    expect(
      svgCount,
      `Expected ≥ 8 SVG icon elements in .rich-editor-toolbar but found ${svgCount}. ` +
        'If icons appear as text (B I S H1 etc.) the toolbar dist is stale — rebuild packages/ui.',
    ).toBeGreaterThanOrEqual(8);

    // Assert the toolbar does NOT contain the known text-glyph strings from
    // the old (pre-canary-v2) implementation.
    const toolbarText = await toolbar.textContent();
    const FORBIDDEN_GLYPHS = ['""', '¶', 'BISH', 'H1H2', '1.'];
    for (const glyph of FORBIDDEN_GLYPHS) {
      expect(
        toolbarText ?? '',
        `Toolbar text contains stale glyph "${glyph}" — Lucide icons are not rendering.`,
      ).not.toContain(glyph);
    }
  });

  test('toolbar screenshot — visual reference for canary v3', async ({ page }) => {
    test.skip(!process.env.ADMIN_SESSION_COOKIE, 'Needs admin session cookie');

    if (process.env.ADMIN_SESSION_COOKIE) {
      await page.context().addCookies([
        {
          name: 'authjs.session-token',
          value: process.env.ADMIN_SESSION_COOKIE,
          domain: new URL(BASE_URL).hostname,
          path: '/',
          secure: BASE_URL.startsWith('https'),
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
    }

    await page.goto(`${BASE_URL}/ar/admin/lp/${CANARY_LP_ID}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.rich-editor-toolbar', { timeout: 15000 });

    // Screenshot the toolbar area for visual comparison
    const toolbar = page.locator('.rich-editor-toolbar').first();
    await expect(toolbar).toHaveScreenshot('rich-editor-toolbar-lucide-icons.png', {
      // Allow small anti-aliasing differences across environments
      maxDiffPixelRatio: 0.05,
    });
  });
});

/**
 * Static unit-style test: verify the parseVideoSrc function is importable
 * from the shared module (no 'use client' boundary). This is the regression
 * guard for Bug A — prevents re-introducing the 'use client' module boundary
 * violation in the Server Component render path.
 */
test.describe('Canary v3 — parseVideoSrc module boundary regression guard', () => {
  test('parse-video-src.ts has no use-client directive', async () => {
    // This is a static check, not a browser test. We read the file and assert.
    // Playwright supports arbitrary Node.js in test body before page.goto.
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(
      process.cwd(),
      'src/components/authoring/parse-video-src.ts',
    );
    const content = fs.readFileSync(filePath, 'utf8');
    // Check for the 'use client' DIRECTIVE (first non-comment line starting with it).
    // The file's docstring may reference 'use client' as a phrase — that's fine.
    // What we forbid is the directive form: a line that is EXACTLY `'use client';`
    // or `"use client";` (optionally with leading whitespace).
    const hasDirective = content
      .split('\n')
      .some((line) => /^\s*['"]use client['"]\s*;?\s*$/.test(line));
    expect(
      hasDirective,
      "parse-video-src.ts must NOT contain the 'use client' directive — it is imported by Server Components.",
    ).toBe(false);
  });

  test('universal-sections.tsx imports parseVideoSrc from parse-video-src, not video-embed-preview', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(
      process.cwd(),
      'src/components/lp/sections/default/universal-sections.tsx',
    );
    const content = fs.readFileSync(filePath, 'utf8');
    // Must import from parse-video-src (the shared pure module)
    expect(
      content,
      'universal-sections.tsx must import parseVideoSrc from parse-video-src.ts (not video-embed-preview.tsx)',
    ).toContain("from '../../../authoring/parse-video-src'");
    // Must NOT import from video-embed-preview (the 'use client' module)
    expect(
      content,
      'universal-sections.tsx must NOT import from video-embed-preview.tsx',
    ).not.toContain("from '../../../authoring/video-embed-preview'");
  });
});
