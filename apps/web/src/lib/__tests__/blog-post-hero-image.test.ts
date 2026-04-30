/**
 * Phase 2 (2026-04-30) — Blog post hero image: regression guards.
 *
 * Locks the fix for Samer's reported "blurry/pixelated face image at top
 * of /ar/blog/what-is-somatic-thinking, looks like image-on-image overlay."
 *
 * The bug came from three compounding factors in the hero design:
 *   1. Featured image rendered as absolute-positioned background `<Image fill>`
 *      with `object-cover` — portrait images got cropped to a thin horizontal
 *      band stretched across a wide hero, distorted and dim.
 *   2. `filter: brightness(0.25)` darkened the image to near-black, surfacing
 *      compression artifacts and reading as "blurry."
 *   3. GeometricPattern + gradient + dark image stack read as "image on image."
 *
 * Fix (committed in this same change): hero is now text-only on cream, with
 * the featured image rendered ONCE below the title block as a clean 16:9
 * `<figure>` — natural aspect ratio, no filter, no overlay.
 *
 * These tests are SOURCE-LEVEL assertions on apps/web/src/app/[locale]/blog/[slug]/page.tsx.
 * They guard against an inadvertent re-introduction of the old design during
 * a future visual edit. Visual rendering itself is verified during Samer canary.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BLOG_PAGE = join(
  __dirname,
  '..',
  '..',
  'app',
  '[locale]',
  'blog',
  '[slug]',
  'page.tsx',
);

const RAW_SOURCE = readFileSync(BLOG_PAGE, 'utf8');

/** Strip comments so source-level pattern checks don't match strings that
 *  appear only in the "what this REPLACED" documentation block. Removes:
 *    - JSX comments:     {/* ... *\/}
 *    - block comments:   /* ... *\/
 *    - line comments:    // ... \n
 *  (Comment-stripping is rough but adequate for this use case — we don't
 *  parse strings/regexes specially because the patterns we test for are
 *  JSX attribute syntax that only appears in real JSX, not in literals.)
 */
function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '') // JSX block comments {/* ... */}
    .replace(/\/\*[\s\S]*?\*\//g, '')           // /* ... */ block comments
    .replace(/^\s*\/\/.*$/gm, '');              // // ... line comments (line start)
}

const SOURCE = stripComments(RAW_SOURCE);

describe('Phase 2 — blog post hero image regression guards', () => {
  test('the brightness(0.25) darkening filter is gone', () => {
    assert.equal(
      SOURCE.includes("brightness(0.25)"),
      false,
      'The hero darkening filter caused the perceived blur. Do not re-introduce.',
    );
  });

  test('the dark gradient overlay over the hero image is gone', () => {
    // The original overlay read as a second image over the first.
    assert.equal(
      SOURCE.includes("from-transparent to-[rgba(29,26,61,0.9)]"),
      false,
      'The dark gradient overlay caused the "image on image" perception.',
    );
  });

  test('post.featured_image_url Image render appears exactly ONCE in the page', () => {
    // Count substring occurrences of the exact JSX pattern that renders
    // the featured image. The author avatar uses author.photo_url, which
    // is a different prop and won't match.
    const pattern = 'src={post.featured_image_url}';
    const count = SOURCE.split(pattern).length - 1;
    assert.equal(
      count,
      1,
      `Expected 1 occurrence of "${pattern}", got ${count}. ` +
        `The featured image must render ONCE per blog post page.`,
    );
  });

  test('hero text colors do not branch on featured_image_url presence', () => {
    // The old design needed white text on dark image OR dark text on cream,
    // creating a thicket of `post.featured_image_url ? 'text-white' : ...`
    // ternaries. The new design uses dark text on cream uniformly, which is
    // simpler AND eliminates the readability-vs-image-presence coupling.
    assert.equal(
      SOURCE.includes("post.featured_image_url ? 'text-white"),
      false,
      'Text colors should not branch on whether featured_image_url exists.',
    );
    assert.equal(
      SOURCE.includes("post.featured_image_url ? 'text-[#FFF5E9]'"),
      false,
      'Hero h1 should not have a featured-image-conditional color branch.',
    );
  });

  test('featured image is rendered inside a <figure> with aspect ratio constraint', () => {
    // The portrait/wide aspect-ratio mismatch was the root cause of
    // the visual distortion. The new figure must constrain to 16:9.
    assert.match(
      SOURCE,
      /<figure[^>]*>[\s\S]*?aspect-\[16\/9\][\s\S]*?<\/figure>/,
      'Featured image must be rendered inside a <figure> with a 16/9 aspect-ratio container.',
    );
  });

  test('hero <Image> uses unoptimized prop as a safety net', () => {
    // Next.js 16's image optimizer was rejecting ink-portrait-meditation.jpg
    // with "received null" — likely sharp choking on the EXIF profile. The
    // unoptimized prop bypasses sharp entirely so the browser handles
    // sizing. Cheap insurance against per-file optimizer failures.
    const featuredImageBlock =
      SOURCE.match(
        /<Image[^>]*src=\{post\.featured_image_url\}[^>]*\/>/m,
      )?.[0] ?? '';
    assert.match(
      featuredImageBlock,
      /unoptimized/,
      'Featured image must use unoptimized prop to bypass per-file Next/Image optimizer failures.',
    );
  });

  test('absolute-positioned image background is gone (the "image on image" cause)', () => {
    // Old hero had: <div className="absolute inset-0"><Image ... fill ... />
    // The combination of absolute inset-0 + Image fill = the image-as-bg
    // pattern that caused the visual stacking. Verify the pattern is gone
    // by asserting that a featured-image Image fill block is NOT inside
    // an absolute-inset-0 container in source order.
    const absInsetWithImage =
      /className="absolute inset-0"[\s\S]{0,200}<Image[^>]*fill/m.test(SOURCE);
    assert.equal(
      absInsetWithImage,
      false,
      'The hero must not render featured_image_url inside an absolute-inset-0 fill container.',
    );
  });
});
