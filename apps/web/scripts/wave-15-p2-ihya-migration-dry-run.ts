/**
 * Wave 15 Phase 2 Session 2 — Ihya rich-text migration DRY RUN.
 *
 * Per Specs/wave-15-phase-2-spec.md v2 §6.2.2.
 *
 * Reads the 6 Ihya programs from staging and produces a Markdown diff
 * artifact at:
 *   /Users/samer/Claude Code/Workspace/CTO/output/2026-04-25-ihya-rich-migration-diff.md
 *
 * STRICTLY READ-ONLY against production data. No DB writes. No commits.
 *
 * IMPORTANT FINDING (recorded for Hakima review):
 * The 6 Ihya programs do NOT live in `landing_pages` (zero matches for
 * `slug LIKE 'ihya-%'`). They live in `programs.long_description_{ar,en}`
 * as JSONB with a custom typed schema:
 *
 *   {
 *     "who_for": [string, ...],            // bullet list
 *     "benefits": [string, ...],           // bullet list
 *     "pull_quote": string,                // single sentence/quote
 *     "impressions": [string, ...],        // 2-4 narrative paragraphs
 *     "who_not_for": [string, ...],        // bullet list
 *     "opening_invitation": string         // 1 long paragraph
 *   }
 *
 * The spec's premise — "parse plain-string body_ar/body_en markdown" — does
 * NOT apply. There is no plain-string body. There is structured typed JSON
 * authored by Hakima. So this dry-run treats each STRING field
 * (pull_quote + opening_invitation + each impressions[] item) as a
 * candidate for markdown→TipTap conversion, and leaves the LIST fields
 * (who_for, benefits, who_not_for) flagged for Hakima's call.
 *
 * Usage (local — but DATABASE_URL must be set):
 *   cd /Users/samer/kunacademy/apps/web
 *   set -a && source .env.local && set +a
 *   pnpm exec tsx scripts/wave-15-p2-ihya-migration-dry-run.ts
 *
 * Usage (VPS — DATABASE_URL already set in .env.local):
 *   ssh kun-vps "cd /var/www/kunacademy-git/apps/web && \
 *     set -a && source .env.local && set +a && \
 *     pnpm exec tsx scripts/wave-15-p2-ihya-migration-dry-run.ts" \
 *     > /tmp/ihya-dry-run.md
 */

import { inArray } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { programs } from '@kunacademy/db/schema';
import { marked } from 'marked';
// IMPORTANT: import from @tiptap/html/server, NOT @tiptap/html. The default
// '@tiptap/html' resolves to the browser build under tsx, which throws:
//   "generateJSON can only be used in a browser environment"
// The Next.js runtime auto-resolves to the Node-conditional export at
// /dist/server/, so the production Agent API (apps/web/src/lib/agent-api/
// markdown-adapter.ts) works fine without this hint. This script runs under
// raw tsx and needs the explicit /server subpath.
import { generateJSON } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { Node, mergeAttributes } from '@tiptap/core';
import { sanitizeRichHtml } from '@kunacademy/ui/rich-editor/sanitizer';
import type { JSONContent } from '@tiptap/react';
import * as fs from 'fs';
import * as path from 'path';

// Local copy of the markdown adapter, with the @tiptap/html/server import
// substituted. Logic is otherwise identical to apps/web/src/lib/agent-api/
// markdown-adapter.ts so the dry-run produces the same TipTap JSON the
// production Agent API would write.
const VideoEmbedAdapterNode = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      provider: { default: null },
      title: { default: 'Embedded video' },
    };
  },
  parseHTML() {
    return [{ tag: 'iframe[data-rich-video-provider]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['iframe', mergeAttributes(HTMLAttributes)];
  },
});

const ADAPTER_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    code: false,
    codeBlock: false,
  }),
  Link.configure({ openOnClick: false, autolink: false }),
  Image,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  VideoEmbedAdapterNode,
];

function markdownToTipTapJson(markdown: string): JSONContent {
  if (!markdown) return { type: 'doc', content: [{ type: 'paragraph' }] };
  if (markdown.length > 200_000) throw new Error('Markdown input too large (max 200 KB)');
  const rawHtml = marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
  const safeHtml = sanitizeRichHtml(rawHtml);
  const json = generateJSON(safeHtml, ADAPTER_EXTENSIONS);
  if (!json || json.type !== 'doc') return { type: 'doc', content: [{ type: 'paragraph' }] };
  return json as JSONContent;
}

const OUTPUT_PATH =
  process.env.IHYA_DRY_RUN_OUTPUT ??
  '/Users/samer/Claude Code/Workspace/CTO/output/2026-04-25-ihya-rich-migration-diff.md';

/** When set, write a SQL migration body to this path INSTEAD of the diff
 *  Markdown. Used by Phase 2 Session 2 to emit the verified-byte-identical
 *  jsonb_set UPDATE statements for `pull_quote_rich` + `opening_invitation_rich`
 *  on the 6 Ihya programs (24 cells = 6 × 2 langs × 2 fields). */
const EMIT_SQL_PATH = process.env.IHYA_EMIT_SQL_PATH;

const IHYA_SLUGS = [
  'ihya-body',
  'ihya-connection',
  'ihya-grand-journey',
  'ihya-impact',
  'ihya-innovation',
  'ihya-reviving-the-self',
];

/** Fields in long_description_{ar,en} that hold prose strings — candidates
 *  for TipTap conversion. */
const STRING_FIELDS = ['pull_quote', 'opening_invitation'];

/** Fields that hold arrays of prose items — each item is a candidate; the
 *  whole array conversion strategy is Hakima's call. */
const ARRAY_FIELDS = ['who_for', 'benefits', 'impressions', 'who_not_for'];

interface DryRunDiff {
  slug: string;
  locale: 'ar' | 'en';
  field: string;
  index: number | null; // for array items
  before: string;
  after_tiptap: unknown;
  flags: string[];
}

async function main() {
  const fail = (msg: string) => {
    console.error(`# DRY RUN FAILED: ${msg}`);
    process.exit(1);
  };

  // 1. Load all 6 Ihya programs
  const rows = await withAdminContext(async (db) => {
    return db
      .select({
        slug: programs.slug,
        long_description_ar: programs.long_description_ar,
        long_description_en: programs.long_description_en,
      })
      .from(programs)
      .where(inArray(programs.slug, IHYA_SLUGS));
  });

  if (rows.length === 0) {
    fail(`Found 0 Ihya programs in staging. Expected 6. Slugs queried: ${IHYA_SLUGS.join(', ')}`);
  }

  const foundSlugs = rows.map((r: { slug: string }) => r.slug).sort();
  const missingSlugs = IHYA_SLUGS.filter((s) => !foundSlugs.includes(s));

  // 2. For each row + locale + prose field, attempt markdown→TipTap conversion
  //    and capture the diff entry. Flag anything weird.
  const diffs: DryRunDiff[] = [];

  for (const row of rows) {
    for (const locale of ['ar', 'en'] as const) {
      const colKey = locale === 'ar' ? 'long_description_ar' : 'long_description_en';
      const blob = row[colKey] as Record<string, unknown> | null;
      if (!blob) {
        diffs.push({
          slug: row.slug,
          locale,
          field: '__null_long_description__',
          index: null,
          before: '(null)',
          after_tiptap: null,
          flags: [`🚩 long_description_${locale} is NULL — Hakima may want to backfill before migration`],
        });
        continue;
      }

      // Single-string prose fields
      for (const field of STRING_FIELDS) {
        const value = blob[field];
        if (typeof value !== 'string' || value.length === 0) {
          if (value !== undefined) {
            diffs.push({
              slug: row.slug,
              locale,
              field,
              index: null,
              before: JSON.stringify(value),
              after_tiptap: null,
              flags: [`🚩 expected string for ${field}, got ${typeof value} — schema drift`],
            });
          }
          continue;
        }
        const flags: string[] = [];
        let after: unknown = null;
        try {
          after = markdownToTipTapJson(value);
        } catch (err) {
          flags.push(
            `🚩 markdownToTipTapJson threw: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        // Heuristic flags
        if (value.includes('**') || value.includes('__')) {
          flags.push('contains markdown bold/italic — verify rendering');
        }
        if (value.includes('[') && value.includes('](')) {
          flags.push('contains markdown link — verify URL preserved');
        }
        if (value.includes('\n\n')) {
          flags.push('multi-paragraph string — verify paragraph splits preserved');
        }
        if (value.length > 500) {
          flags.push(`long string (${value.length} chars) — verify nothing truncated`);
        }
        diffs.push({
          slug: row.slug,
          locale,
          field,
          index: null,
          before: value,
          after_tiptap: after,
          flags,
        });
      }

      // Array prose fields
      for (const field of ARRAY_FIELDS) {
        const value = blob[field];
        if (!Array.isArray(value)) {
          if (value !== undefined) {
            diffs.push({
              slug: row.slug,
              locale,
              field,
              index: null,
              before: JSON.stringify(value),
              after_tiptap: null,
              flags: [`🚩 expected array for ${field}, got ${typeof value} — schema drift`],
            });
          }
          continue;
        }
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (typeof item !== 'string' || item.length === 0) {
            diffs.push({
              slug: row.slug,
              locale,
              field,
              index: i,
              before: JSON.stringify(item),
              after_tiptap: null,
              flags: [`🚩 array item ${i} is not a non-empty string — got ${typeof item}`],
            });
            continue;
          }
          const flags: string[] = [];
          let after: unknown = null;
          try {
            after = markdownToTipTapJson(item);
          } catch (err) {
            flags.push(
              `🚩 markdownToTipTapJson threw: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
          if (item.includes('**') || item.includes('__')) {
            flags.push('contains markdown bold/italic');
          }
          if (item.includes('[') && item.includes('](')) {
            flags.push('contains markdown link');
          }
          if (item.includes('\n\n')) {
            flags.push('multi-paragraph item — likely should stay scalar');
          }
          diffs.push({
            slug: row.slug,
            locale,
            field,
            index: i,
            before: item,
            after_tiptap: after,
            flags,
          });
        }
      }
    }
  }

  // 3. Build the Markdown diff artifact
  const now = new Date().toISOString();
  const out: string[] = [];

  out.push('# Wave 15 Phase 2 — Ihya Rich-Text Migration DRY RUN');
  out.push('');
  out.push(`Generated: ${now}`);
  out.push('Spec: `Specs/wave-15-phase-2-spec.md` v2 §6.2.2');
  out.push('');
  out.push('## ⚠️ For Hakima — read this section first');
  out.push('');
  out.push('### What this dry-run actually found');
  out.push('');
  out.push('1. **There are NO Ihya rows in `landing_pages`.** Zero matches for `slug LIKE \'ihya-%\'`.');
  out.push('   The spec assumed each Ihya was an LP with `composition_json.sections[]`. That model');
  out.push('   does not exist in the DB.');
  out.push('');
  out.push('2. **The 6 Ihya programs DO exist in `programs`** with structured rich content already');
  out.push('   stored in `long_description_{ar,en}` JSONB. The schema is YOUR custom shape:');
  out.push('   ```');
  out.push('   {');
  out.push('     "who_for":            [string, ...],   // bullet list');
  out.push('     "benefits":           [string, ...],   // bullet list');
  out.push('     "pull_quote":         string,          // single sentence/quote');
  out.push('     "impressions":        [string, ...],   // 2-4 narrative paragraphs');
  out.push('     "who_not_for":        [string, ...],   // bullet list');
  out.push('     "opening_invitation": string           // 1 long paragraph');
  out.push('   }');
  out.push('   ```');
  out.push('');
  out.push('3. **The spec\'s premise (parse plain-string body markdown → TipTap) DOES NOT APPLY here.**');
  out.push('   There is no plain-string body. There is typed structured JSON. So this dry-run does');
  out.push('   the most plausible thing: it tries each prose-string field through the markdown adapter');
  out.push('   and shows you what the TipTap JSON would look like, item by item.');
  out.push('');
  out.push('### Three migration paths Hakima can pick');
  out.push('');
  out.push('**Option A — keep current schema as-is.** It\'s already structured. Renderer consumes');
  out.push('  the typed lists/strings as-is. No migration needed. Phase 2 rich-text capability');
  out.push('  becomes available for OTHER programs that have free-form prose; Ihya stays structured.');
  out.push('');
  out.push('**Option B — full conversion to TipTap.** Replace every string + every list-item with');
  out.push('  TipTap JSON. Lists become ordered/bulleted lists inside a single TipTap document per');
  out.push('  field. **Cost:** loses the structural semantics (`who_for` vs `benefits` vs');
  out.push('  `impressions` are no longer programmatically distinguishable — they\'re all just');
  out.push('  "rich text"). Renderer would lose ability to style them differently per type.');
  out.push('');
  out.push('**Option C — hybrid (recommended).** Convert ONLY the single-string prose fields');
  out.push('  (`pull_quote` + `opening_invitation`) to TipTap. Keep arrays as-is. Add `_rich`');
  out.push('  companions where authors want inline links/bold (e.g.,');
  out.push('  `opening_invitation_rich: JSONContent | null` alongside the existing string).');
  out.push('  Renderer prefers `_rich` over scalar. **Smallest blast radius. Reversible.**');
  out.push('');
  out.push(`## Programs found: ${rows.length}/6`);
  out.push('');
  if (foundSlugs.length === 6) {
    out.push('All 6 expected Ihya programs present:');
  } else {
    out.push(`⚠️ MISSING: ${missingSlugs.join(', ')}`);
    out.push('');
    out.push('Found:');
  }
  for (const s of foundSlugs) out.push(`- \`${s}\``);
  out.push('');

  // Group diffs by slug for readability
  const bySlug = new Map<string, DryRunDiff[]>();
  for (const d of diffs) {
    const arr = bySlug.get(d.slug) ?? [];
    arr.push(d);
    bySlug.set(d.slug, arr);
  }

  out.push('## Per-program diff');
  out.push('');
  out.push('Each section below shows BEFORE (current scalar/array value) and AFTER (TipTap JSON');
  out.push('that the markdown adapter would produce). FLAGGED items use 🚩 and need Hakima review');
  out.push('before any migration apply.');
  out.push('');

  let totalSections = 0;
  let totalFlagged = 0;
  const allFlags: string[] = [];

  for (const slug of foundSlugs) {
    out.push(`---`);
    out.push('');
    out.push(`### \`${slug}\``);
    out.push('');
    const slugDiffs = bySlug.get(slug) ?? [];
    for (const d of slugDiffs) {
      totalSections++;
      const heading =
        d.index !== null ? `**${d.field}[${d.index}]** (${d.locale})` : `**${d.field}** (${d.locale})`;
      out.push(`#### ${heading}`);
      out.push('');
      out.push('BEFORE:');
      out.push('```');
      out.push(d.before.length > 800 ? `${d.before.slice(0, 800)}…(${d.before.length} chars total)` : d.before);
      out.push('```');
      out.push('');
      out.push('AFTER (TipTap JSON):');
      out.push('```json');
      out.push(JSON.stringify(d.after_tiptap, null, 2));
      out.push('```');
      if (d.flags.length > 0) {
        totalFlagged++;
        for (const f of d.flags) {
          allFlags.push(f);
          out.push('');
          out.push(`> ${f}`);
        }
      }
      out.push('');
    }
  }

  out.push('---');
  out.push('');
  out.push('## Summary');
  out.push('');
  out.push(`- Programs processed: ${rows.length} of 6 expected`);
  out.push(`- Total field/item conversions attempted: ${totalSections}`);
  out.push(`- Items with flags: ${totalFlagged}`);
  out.push('');
  out.push('### Flag distribution');
  out.push('');
  const flagCounts = new Map<string, number>();
  for (const f of allFlags) flagCounts.set(f, (flagCounts.get(f) ?? 0) + 1);
  const sorted = Array.from(flagCounts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [flag, count] of sorted) {
    out.push(`- ${count}× ${flag}`);
  }
  out.push('');
  out.push('## Hakima — what to send back');
  out.push('');
  out.push('Pick one of the three options (A, B, or C). For Option C (recommended), confirm:');
  out.push('1. Convert `pull_quote` to TipTap JSON? Y/N');
  out.push('2. Convert `opening_invitation` to TipTap JSON? Y/N');
  out.push('3. Add `_rich` companion fields, or REPLACE the scalar string in-place? (companion = safer)');
  out.push('4. Anything in the BEFORE column that should be rewritten before conversion? (list specifics)');
  out.push('');
  out.push('Once Hakima sends `APPROVE` + answers, Sani writes migration 0059 (or next free slot)');
  out.push('and applies via `kun-deploy.sh` with backup snapshot per spec §6.2.4.');
  out.push('');
  out.push('---');
  out.push('');
  out.push('*Generated by `apps/web/scripts/wave-15-p2-ihya-migration-dry-run.ts`. No production data was modified.*');
  out.push('');

  // 4. Write to disk
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, out.join('\n'));

  console.log(`Dry-run complete.`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log(`Programs found: ${rows.length}/6`);
  console.log(`Conversions attempted: ${totalSections}`);
  console.log(`Items flagged: ${totalFlagged}`);

  // 5. Optional: emit the C1-scope SQL migration body
  if (EMIT_SQL_PATH) {
    const sqlLines: string[] = [];
    sqlLines.push('-- Auto-generated by wave-15-p2-ihya-migration-dry-run.ts (EMIT_SQL mode).');
    sqlLines.push('-- DO NOT HAND-EDIT. Re-run the dry-run with IHYA_EMIT_SQL_PATH set to regenerate.');
    sqlLines.push('-- C1 scope (Hakima approved 2026-04-25): backfill pull_quote_rich +');
    sqlLines.push('-- opening_invitation_rich JSONB keys inside long_description_{ar,en} on');
    sqlLines.push('-- the 6 Ihya programs. List arrays untouched.');
    sqlLines.push('');
    const C1_FIELDS = ['pull_quote', 'opening_invitation'];
    let updateCount = 0;
    for (const slug of foundSlugs) {
      for (const locale of ['ar', 'en'] as const) {
        const colKey = locale === 'ar' ? 'long_description_ar' : 'long_description_en';
        for (const field of C1_FIELDS) {
          const diff = diffs.find(
            (d) => d.slug === slug && d.locale === locale && d.field === field && d.index === null,
          );
          if (!diff || diff.after_tiptap === null) continue;
          const richKey = `${field}_rich`;
          const tiptapLiteral = JSON.stringify(diff.after_tiptap).replace(/'/g, "''");
          sqlLines.push(`UPDATE programs SET ${colKey} = jsonb_set(${colKey}, '{${richKey}}', '${tiptapLiteral}'::jsonb) WHERE slug = '${slug}';`);
          updateCount++;
        }
      }
    }
    sqlLines.push('');
    sqlLines.push(`-- Total UPDATE statements: ${updateCount}`);
    fs.writeFileSync(EMIT_SQL_PATH, sqlLines.join('\n') + '\n');
    console.log(`SQL emitted: ${EMIT_SQL_PATH} (${updateCount} UPDATE statements)`);
  }
}

main().catch((err) => {
  console.error('Dry-run failed:', err);
  process.exit(1);
});
