/**
 * Wave 15 Wave 3 canary v2 — video URL parser tests (Issue 6).
 *
 * Coverage matrix:
 *   - YouTube — watch?v=, youtu.be, embed, nocookie variants
 *   - Vimeo — vimeo.com/123, vimeo.com/video/123
 *   - Loom — loom.com/share, loom.com/embed
 *   - Google Drive — drive.google.com/file/d/<id>
 *   - Rejects: non-allowlisted hosts, javascript:, data:, missing scheme
 *
 * Privacy invariant: YouTube parsing MUST output youtube-nocookie.com.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoSrc } from '../../components/authoring/video-embed-preview';

describe('Wave 15 W3 v2 / parseVideoSrc / YouTube', () => {
  test('youtube.com/watch?v=', () => {
    const r = parseVideoSrc('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.ok(r);
    assert.strictEqual(r!.provider, 'youtube');
    assert.strictEqual(r!.id, 'dQw4w9WgXcQ');
    assert.strictEqual(r!.src, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  test('youtu.be short URL', () => {
    const r = parseVideoSrc('https://youtu.be/dQw4w9WgXcQ');
    assert.ok(r);
    assert.strictEqual(r!.provider, 'youtube');
    assert.match(r!.src, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  });

  test('youtube.com/embed/', () => {
    const r = parseVideoSrc('https://www.youtube.com/embed/dQw4w9WgXcQ');
    assert.ok(r);
    assert.match(r!.src, /youtube-nocookie\.com/);
  });

  test('PRIVACY: never emits raw youtube.com in the embed src', () => {
    const r = parseVideoSrc('https://www.youtube.com/watch?v=test1234567');
    assert.ok(r);
    assert.ok(!r!.src.startsWith('https://www.youtube.com/'));
    assert.match(r!.src, /^https:\/\/www\.youtube-nocookie\.com\//);
  });
});

describe('Wave 15 W3 v2 / parseVideoSrc / Vimeo', () => {
  test('vimeo.com/<id>', () => {
    const r = parseVideoSrc('https://vimeo.com/123456789');
    assert.ok(r);
    assert.strictEqual(r!.provider, 'vimeo');
    assert.strictEqual(r!.id, '123456789');
    assert.match(r!.src, /^https:\/\/player\.vimeo\.com\/video\/123456789$/);
  });

  test('vimeo.com/video/<id>', () => {
    const r = parseVideoSrc('https://vimeo.com/video/987654321');
    assert.ok(r);
    assert.strictEqual(r!.id, '987654321');
  });
});

describe('Wave 15 W3 v2 / parseVideoSrc / Loom', () => {
  test('loom.com/share/<id>', () => {
    const r = parseVideoSrc('https://www.loom.com/share/abcdef0123456789abcdef01');
    assert.ok(r);
    assert.strictEqual(r!.provider, 'loom');
    assert.match(r!.src, /loom\.com\/embed/);
  });

  test('loom.com/embed/<id>', () => {
    const r = parseVideoSrc('https://www.loom.com/embed/abcdef0123456789abcdef01');
    assert.ok(r);
    assert.strictEqual(r!.provider, 'loom');
  });
});

describe('Wave 15 W3 v2 / parseVideoSrc / Google Drive', () => {
  test('drive.google.com/file/d/<id>', () => {
    const r = parseVideoSrc('https://drive.google.com/file/d/abcdef0123456789abcdef01/view');
    assert.ok(r);
    assert.strictEqual(r!.provider, 'gdrive');
    assert.match(r!.src, /\/preview$/);
  });
});

describe('Wave 15 W3 v2 / parseVideoSrc / Rejects', () => {
  test('rejects non-allowlisted host', () => {
    assert.strictEqual(parseVideoSrc('https://malicious.example.com/video/xyz'), null);
  });

  test('rejects javascript:', () => {
    assert.strictEqual(parseVideoSrc('javascript:alert(1)'), null);
  });

  test('rejects data:', () => {
    assert.strictEqual(parseVideoSrc('data:text/html,<script>alert(1)</script>'), null);
  });

  test('rejects URL with no scheme', () => {
    assert.strictEqual(parseVideoSrc('youtube.com/watch?v=dQw4w9WgXcQ'), null);
  });

  test('rejects null / undefined / empty', () => {
    assert.strictEqual(parseVideoSrc(null), null);
    assert.strictEqual(parseVideoSrc(undefined), null);
    assert.strictEqual(parseVideoSrc(''), null);
  });

  test('rejects file://', () => {
    assert.strictEqual(parseVideoSrc('file:///etc/passwd'), null);
  });
});
