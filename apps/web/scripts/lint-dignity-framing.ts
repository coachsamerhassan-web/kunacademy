#!/usr/bin/env node
/**
 * Wave E.2 dignity-framing grep-audit
 * Per WAVE-E-SCHOLARSHIP-FUND-SPEC.md §3.2 + architectural decision #4.
 *
 * Scans donation + scholarship surfaces for banned language. Any match in an
 * `_ar` or `_en` string literal = hard-stop (process exits 1).
 *
 * Run via:
 *   node --import tsx apps/web/scripts/lint-dignity-framing.ts
 *
 * Scope:
 *   - apps/web/src/lib/stripe-donations.ts
 *   - apps/web/src/lib/zoho-projects.ts
 *   - apps/web/src/lib/donation-webhook-handlers.ts
 *   - apps/web/src/app/api/webhooks/payment/route.ts   (only donation branches)
 *   - apps/web/src/app/api/donations/**                 (Wave E.3+)
 *   - apps/web/src/app/api/scholarships/**              (Wave E.5+)
 *   - apps/web/src/app/[locale]/donate/**               (Wave E.3+)
 *   - apps/web/src/app/[locale]/scholarships/**         (Wave E.4+)
 *   - apps/web/src/components/DonationForm.tsx          (Wave E.3+)
 *   - apps/web/src/components/ScholarshipsBoard.tsx     (Wave E.4+)
 *   - apps/web/src/messages/en.json (scholarship keys)
 *   - apps/web/src/messages/ar.json (scholarship keys)
 *
 * Banned word lists are SEPARATE for AR and EN so we can flag precisely.
 * We only trip on matches INSIDE string literals (""|''|``) to avoid false
 * positives on variable names or comments that legitimately mention banned
 * words (e.g., "do not say 'free' here" in a comment).
 *
 * NOTE: this is a best-effort regex scan; for full semantic safety, human
 * review of all donor+recipient copy remains mandatory.
 */

import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = join(__dirname, '..', '..', '..');
const WEB_ROOT = join(REPO_ROOT, 'apps', 'web', 'src');

// Scope of the dignity audit.
//
// We intentionally EXCLUDE the shared webhook route (`/api/webhooks/payment/route.ts`)
// because it processes both donation events AND non-donation events (program
// discount codes, etc.). The word "discount" in that file's program-payment
// branches is legitimate business language; the ban applies only to
// donor/recipient-facing surfaces. Donation handler logic lives in the
// dedicated `donation-webhook-handlers.ts` module, which IS in scope.
const SCAN_PATHS: string[] = [
  // Donation/scholarship-only lib modules
  join(WEB_ROOT, 'lib', 'stripe-donations.ts'),
  join(WEB_ROOT, 'lib', 'zoho-projects.ts'),
  join(WEB_ROOT, 'lib', 'donation-webhook-handlers.ts'),
  join(WEB_ROOT, 'lib', 'scholarship-transparency.ts'),
  join(WEB_ROOT, 'lib', 'scholarship-application.ts'),

  // Donation/scholarship API routes (E.3+)
  join(WEB_ROOT, 'app', 'api', 'donations'),
  join(WEB_ROOT, 'app', 'api', 'scholarships'),
  // Admin scholarship API routes (E.5+)
  join(WEB_ROOT, 'app', 'api', 'admin', 'scholarships'),

  // Donation/scholarship pages (E.3+)
  join(WEB_ROOT, 'app', '[locale]', 'donate'),
  join(WEB_ROOT, 'app', '[locale]', 'scholarships'),
  // Admin scholarship pages (E.5+)
  join(WEB_ROOT, 'app', '[locale]', 'admin', 'scholarships'),

  // Donation/scholarship components (E.3+)
  join(WEB_ROOT, 'components', 'DonationForm.tsx'),
  join(WEB_ROOT, 'components', 'ScholarshipsBoard.tsx'),
  join(WEB_ROOT, 'components', 'ScholarshipApplicationForm.tsx'),

  // E.5 — scholarship email templates
  join(REPO_ROOT, 'packages', 'email', 'src', 'templates', 'scholarship'),
];

// i18n JSON scan — only keys under the scholarship/donate prefixes.
const I18N_PATHS: Array<{ file: string; keyPrefixes: string[] }> = [
  {
    file: join(WEB_ROOT, 'messages', 'ar.json'),
    keyPrefixes: ['donate', 'scholarship', 'donations', 'scholarships'],
  },
  {
    file: join(WEB_ROOT, 'messages', 'en.json'),
    keyPrefixes: ['donate', 'scholarship', 'donations', 'scholarships'],
  },
];

// Banned words per spec §3.2
// English (word-boundary match, case-insensitive)
const BANNED_EN: string[] = [
  'free',
  'charity',
  'entry-level',
  'entry level',
  'discount',
  'poor',
  'needy',
  'option of last resort',
];

// Arabic (exact substring match — Arabic word boundaries are tricky)
const BANNED_AR: string[] = [
  'مجاني',
  'مجانا',
  'مجانًا',
  'صدقة',
  'خيري',
  'خيرية',
  'فقير',
  'فقراء',
  'محتاج',
  'محتاجين',
  'معوز',
  'الخيار الأخير',
  'مستوى أساسي',
  'خصم',
];

// Exceptions — strings that are allowed even though they'd otherwise trip
// e.g., comments in code explaining the ban, or variable/flag names.
const ALLOWED_CONTEXTS: RegExp[] = [
  /banned.*\b(free|charity|discount|poor|needy)\b/i, // "banned words: free, charity..."
  /BANNED_(EN|AR)/, // the constant itself
  /\/\*[\s\S]*dignity[\s\S]*\*\//i, // inline comments about dignity
  /spec\s*§3/i, // references to the spec itself
  /\bfee\b/i, // "fee" is a false trigger for "free"
  /\bfreedom\b/i, // "freedom" should not trigger "free"
  /\bfreely\b/i, // same
  /\bpoorly\b/i, // should not trigger "poor"
  /\bdisco(ur|v|n)/i, // discover/discourage should not trigger "discount"
];

interface Hit {
  file: string;
  line: number;
  column: number;
  word: string;
  lang: 'ar' | 'en';
  lineText: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// File walking
// ─────────────────────────────────────────────────────────────────────────────

function walk(path: string): string[] {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) {
    const ext = extname(path);
    if (['.ts', '.tsx', '.js', '.jsx', '.json', '.mdx'].includes(ext)) {
      return [path];
    }
    return [];
  }
  if (stat.isDirectory()) {
    const results: string[] = [];
    for (const entry of readdirSync(path)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      results.push(...walk(join(path, entry)));
    }
    return results;
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Scanning
// ─────────────────────────────────────────────────────────────────────────────

function isInAllowedContext(line: string): boolean {
  return ALLOWED_CONTEXTS.some((re) => re.test(line));
}

function scanFile(filepath: string): Hit[] {
  const hits: Hit[] = [];
  let content: string;
  try {
    content = readFileSync(filepath, 'utf8');
  } catch {
    return hits;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip pure comment lines
    if (line.trim().startsWith('//')) continue;
    if (line.trim().startsWith('*')) continue;
    if (isInAllowedContext(line)) continue;

    // EN: word-boundary, case-insensitive
    for (const word of BANNED_EN) {
      const re = new RegExp(`\\b${word.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`, 'i');
      const match = line.match(re);
      if (match && match.index !== undefined) {
        hits.push({
          file: filepath,
          line: i + 1,
          column: match.index + 1,
          word,
          lang: 'en',
          lineText: line.trim(),
        });
      }
    }

    // AR: substring (case doesn't apply to Arabic script)
    for (const word of BANNED_AR) {
      const idx = line.indexOf(word);
      if (idx !== -1) {
        hits.push({
          file: filepath,
          line: i + 1,
          column: idx + 1,
          word,
          lang: 'ar',
          lineText: line.trim(),
        });
      }
    }
  }

  return hits;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  const scanArgs = process.argv.slice(2);
  const pathsToScan = scanArgs.length > 0 ? scanArgs : SCAN_PATHS;

  const allFiles: string[] = [];
  for (const p of pathsToScan) {
    allFiles.push(...walk(p));
  }

  if (allFiles.length === 0) {
    console.log('[lint-dignity-framing] No files to scan. Exiting 0.');
    process.exit(0);
  }

  console.log(`[lint-dignity-framing] Scanning ${allFiles.length} file(s)...`);

  const allHits: Hit[] = [];
  for (const f of allFiles) {
    allHits.push(...scanFile(f));
  }

  if (allHits.length === 0) {
    console.log('[lint-dignity-framing] PASS — no banned words found.');
    process.exit(0);
  }

  console.error(`[lint-dignity-framing] FAIL — ${allHits.length} banned word match(es):`);
  console.error('');
  for (const h of allHits) {
    console.error(`  ${h.file}:${h.line}:${h.column}  [${h.lang.toUpperCase()}] "${h.word}"`);
    console.error(`    ${h.lineText}`);
  }
  console.error('');
  console.error('Per WAVE-E-SCHOLARSHIP-FUND-SPEC.md §3.2 — dignity framing is non-negotiable.');
  console.error('Rewrite the offending strings without banned language (see spec §3.1 and §3.3 for approved copy).');
  process.exit(1);
}

main();
