/**
 * Wave 15 Phase 2 Session 2 — runtime assertion for `hasRichContent` per
 * Hakima Concern 3.
 *
 * The repo has no unit-test runner configured (no vitest, no jest). Rather
 * than add one in this commit, we ship a standalone tsx script that asserts
 * the `hasRichContent` contract. Run with:
 *
 *   cd /Users/samer/kunacademy/packages/ui
 *   pnpm exec tsx src/rich-editor/__assert-has-rich-content.ts
 *
 * Exits 0 on PASS, exits 1 on FAIL with a description of which case broke.
 *
 * NOT shipped to production builds — file is prefixed __ to keep it out of
 * the public barrel. Wave 14b can fold this into a real vitest suite later.
 */

import { hasRichContent } from './rich-content';
import type { JSONContent } from '@tiptap/react';

interface Case {
  label: string;
  doc: JSONContent | null | undefined;
  expected: boolean;
}

const cases: Case[] = [
  // Per Hakima Concern 3 — the two named assertions.
  {
    label: 'empty content array',
    doc: { type: 'doc', content: [] },
    expected: false,
  },
  {
    label: 'paragraph with text "x"',
    doc: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    },
    expected: true,
  },

  // Defensive coverage of likely real-world edges.
  { label: 'null doc', doc: null, expected: false },
  { label: 'undefined doc', doc: undefined, expected: false },
  {
    label: 'wrong type (not doc)',
    doc: { type: 'paragraph', content: [{ type: 'text', text: 'x' }] } as JSONContent,
    expected: false,
  },
  {
    label: 'doc with single empty paragraph',
    doc: { type: 'doc', content: [{ type: 'paragraph' }] },
    expected: false,
  },
  {
    label: 'doc with paragraph containing whitespace-only text',
    doc: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }],
    },
    expected: false,
  },
  {
    label: 'doc with heading containing real text',
    doc: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hello' }] },
      ],
    },
    expected: true,
  },
  {
    label: 'doc with bullet list containing real text',
    doc: {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }],
            },
          ],
        },
      ],
    },
    expected: true,
  },
  {
    label: 'doc with nested empty wrappers (bullet → listItem → empty paragraph)',
    doc: {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
      ],
    },
    expected: false,
  },
  {
    label: 'doc with Arabic text (RTL content sanity)',
    doc: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'مرحبا' }] },
      ],
    },
    expected: true,
  },
];

let failed = 0;
for (const c of cases) {
  const actual = hasRichContent(c.doc);
  const ok = actual === c.expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.label} — expected ${c.expected}, got ${actual}`);
  if (!ok) failed++;
}

console.log('');
if (failed > 0) {
  console.error(`FAIL: ${failed}/${cases.length} cases did not match.`);
  process.exit(1);
}
console.log(`PASS: ${cases.length}/${cases.length} cases matched.`);
process.exit(0);
