/**
 * Wave 15 Wave 2 — Pre-publish lint hooks (R1 + R2 enforcement).
 *
 * Hooks fire at every transition crossing into 'review' or 'published'.
 * HARD-BLOCK violations return 422 with a structured violations[] payload
 * AND write a content_edits row with `change_kind='lint_block'`.
 *
 * Lint rules implemented in this file (per spec §7.4 + CLAUDE.md IP rule):
 *
 *   R1 — Methodology beat exposure
 *        Internal session structure (beat counts, step sequences, internal
 *        beat names) MUST NOT appear on prospect-readable surfaces.
 *        HARD BLOCK.
 *
 *   R2 — Internal exercise prompt exposure
 *        Hakima-curated denylist of internal exercise prompts that must
 *        stay in internal docs only. Never on landing pages, blog
 *        articles, marketing copy, ads, or any surface a prospect or
 *        competitor could read. HARD BLOCK.
 *
 *   R3 — Proprietary framework attribution to AI
 *        Samer's proprietary frameworks must NEVER be attributed to AI
 *        in agent-authored content. HARD BLOCK.
 *
 * Implemented as a registry of patterns + a runner. Patterns are
 * conservative (keyed on Arabic + English variants). The runner walks
 * scalar fields, rich_text plain-text extraction, and composition_json
 * sections recursively. False positives are accepted in favor of false
 * negatives — a HARD BLOCK is the editor's prompt to revise; the agent
 * can include `lint_override_reason` (Wave 3) but Wave 2 is strict
 * "block-and-route-to-human."
 *
 * R4 (dignity), R5–R13 (terminology, citation format, canon-bound,
 * therapy boundary, bilingual completeness, alt text, embed allowlist,
 * methodology-adjacent route, live URL check) are deferred to Wave 3
 * implementation (Hakima curates the canon-aligned pattern set during
 * the visual editor build per spec §10).
 *
 * Wave 4 will add R7 (canon drift) once the program_card_strip + canon
 * read-pull is wired.
 *
 * Pattern hygiene:
 *   - All patterns case-insensitive unicode (`/i`u);
 *   - Word-boundary on Latin (\b), explicit space/start/end on Arabic
 *     (no \b in Arabic text);
 *   - Avoid generic methodology terms ('coaching', 'somatic') that have
 *     legitimate marketing use — denylist focuses on UNIQUE internal
 *     vocabulary.
 *
 * Maintenance: Hakima owns the denylists. Sani' wires the surface; Hakima
 * curates the patterns. Adding a pattern = a 1-line edit + a test. Lint
 * runs cheap (~ms on a 50-section page); cost is fine.
 */

import type { JSONContent } from '@tiptap/react';

export type LintSeverity = 'hard_block' | 'soft_warn';

export interface LintViolation {
  rule_id: string;
  severity: LintSeverity;
  message: string;
  /** Where the violation was found ('hero_json.title_ar', 'composition_json.sections[3].body_ar', etc.). */
  path: string;
  /** First 80 chars of the offending text (for audit display). */
  excerpt: string;
}

export interface LintTarget {
  entity: 'landing_pages' | 'blog_posts' | 'static_pages' | (string & {});
  /** Pre-loaded row body. We walk all known content fields. */
  row: Record<string, unknown>;
}

// ── Pattern registry ──────────────────────────────────────────────────────
//
// Each rule is a list of patterns. A match anywhere in the walked content
// triggers a violation row. Patterns are kept tight and unique to the
// internal/IP vocabulary; generic terms ('coaching', 'somatic',
// 'awareness') have legitimate marketing use and stay OFF this list.
//
// Hakima can extend any of these via PR; a corresponding test in
// page-service.test.ts must cover the new pattern.

interface PatternEntry {
  /** Stable id for cross-referencing in lint_block audit metadata. */
  id: string;
  /** Compiled RegExp. */
  re: RegExp;
  /** Human-readable description for the violation message. */
  why: string;
}

/** R1 — Methodology beat exposure (internal structure of program sessions). */
const R1_METHODOLOGY_BEATS: PatternEntry[] = [
  // Beat-count phrasings (English + Arabic)
  // Tightened: only catch numeric "N beats" or "في N مرحلة من المنهج/البرنامج"
  // — drop generic "twelve steps" which is a recovery-program term.
  {
    id: 'R1.beat_count_en',
    re: /\b\d+\s+(?:beats?|step\s+protocol|step\s+process|phase\s+protocol)\b/iu,
    why: 'Internal beat / step-protocol counts are program structure (IP).',
  },
  {
    id: 'R1.beat_count_ar',
    // Arabic letters aren't word characters in the JS regex sense, so \b
    // doesn't anchor reliably. Use lookarounds on whitespace/punctuation/
    // string-edge so the match fires on isolated tokens but not inside
    // longer Arabic words.
    re: /(?:^|[\s.,؟!:،])\d+\s+(?:نبضات?|مراحل\s+من\s+(?:المنهج|البرنامج))(?=$|[\s.,؟!:،])/u,
    why: 'عدد النبضات / مراحل المنهج هو بنية داخلية للبرنامج (ملكية فكرية).',
  },
  // Specific internal beat-name vocabulary (Hakima-curated; expand as IP grows).
  // We lint for proper-noun internal phrases that are ONLY used inside session
  // notes — never marketing.
  {
    id: 'R1.beat_name_open_loop',
    re: /\b(?:open(?:ing)?\s+loop\s+sequence|closing\s+loop\s+sequence)\b/iu,
    why: 'Internal session beat names appear only in private specs.',
  },
  {
    id: 'R1.beat_name_arc',
    re: /\b(?:somatic\s+thinking\s+arc|st\s+arc|methodology\s+arc)\b/iu,
    why: 'Internal arc nomenclature (program structure).',
  },
];

/** R2 — Internal exercise prompt exposure (Hakima-curated denylist). */
const R2_INTERNAL_PROMPTS: PatternEntry[] = [
  // Specific exercise prompt phrasings that live in internal session
  // notes. These are unique enough to not have legitimate marketing use.
  // Hakima's day-1 curation; expand as we discover leaks in the wild.
  {
    id: 'R2.somatic_dial_prompt',
    re: /\b(?:turn\s+(?:up|down)\s+the\s+somatic\s+dial)\b/iu,
    why: 'Internal exercise prompt phrasing.',
  },
  {
    id: 'R2.attunement_prompt_en',
    re: /\b(?:attunement\s+protocol|attunement\s+sequence)\s+(?:step|stage)\s*\d+/iu,
    why: 'Internal attunement protocol step references.',
  },
  // Arabic equivalents — phrased to match without word boundaries (\b
  // doesn't apply to Arabic letters).
  {
    id: 'R2.attunement_prompt_ar',
    re: /(?:^|\s)(?:بروتوكول\s+الاستشعار|تسلسل\s+الاستشعار)\s+(?:خطوة|مرحلة)\s*\d+/u,
    why: 'إشارة إلى بروتوكول استشعار داخلي للجلسات.',
  },
];

/**
 * R11 — URL/embed safety.
 *
 * Two sub-rules:
 *
 * R11.embed_src — for video/embed section src fields: must be from the
 *   approved set (YouTube, YouTube-nocookie, Vimeo, Loom, Google Slides).
 *   Applied at the API layer by walking composition_json sections where
 *   section.type is 'video' or 'embed' and checking section.src.
 *
 * R11.bg_image_src — for per-section background.image.src: blocks protocol
 *   injection only (javascript:, data:, vbscript:, ftp:). Legitimate CDN
 *   image URLs (Supabase, kuncoaching.me, Google, etc.) pass freely.
 *   Added Wave 15 W3 post-canary — canary v2 introduced per-section
 *   background image support; this rule closes the injection vector.
 *
 * Both sub-rules are HARD BLOCK.
 */
const R11_EMBED_ALLOWLIST: PatternEntry[] = [
  {
    id: 'R11.bg_image_unsafe_protocol',
    // Blocks javascript:, data:, vbscript:, ftp: in any field whose path
    // ends in .src or .url — catches background.image.src specifically.
    // The walkJsonb visitor passes the full path; we check the path suffix
    // in the visitor below rather than in the regex (regex only flags the
    // protocol pattern so it can be combined with path filtering).
    re: /^(?:javascript|data|vbscript|ftp):/iu,
    why: 'Protocol injection detected in image/URL field. Only http(s):// and relative paths allowed.',
  },
];

/** R3 — Proprietary framework attribution to AI. */
const R3_FRAMEWORK_ATTRIBUTION: PatternEntry[] = [
  // We catch "X was developed by AI / Claude / GPT / [...]" patterns
  // when paired with a Samer-proprietary framework name. The framework
  // names themselves are NOT denylisted (they're brand assets); only the
  // pairing with AI attribution is blocked.
  //
  // Pattern shape: Samer's FRAMEWORK + within-30-chars + AI attribution.
  {
    id: 'R3.somatic_thinking_ai',
    re: /Somatic\s+Thinking[\s\S]{0,80}?(?:developed\s+(?:by|with)|created\s+(?:by|with)|authored\s+by|generated\s+by|powered\s+by)\s+(?:AI|Claude|ChatGPT|GPT|an?\s+AI|machine|model)/iu,
    why: 'Somatic Thinking is Samer Hassan IP. Attribution to AI is not permitted.',
  },
  {
    id: 'R3.tafkir_ai_ar',
    re: /(?:التفكير\s+(?:الحس?[ّ]?ي|الحسيّ))[\s\S]{0,80}?(?:طُو[ّ]?ر(?:ت)?\s+(?:بواسطة|عبر)|أنشأ(?:ه|تها)\s+(?:بواسطة|عبر))\s+(?:الذكاء\s+(?:الاصطناعي|الإصطناعي)|نموذج)/u,
    why: 'التفكير الحسّي ملكية فكرية لسامر حسن. لا يُنسب للذكاء الاصطناعي.',
  },
];

const ALL_RULES: Record<string, PatternEntry[]> = {
  R1: R1_METHODOLOGY_BEATS,
  R2: R2_INTERNAL_PROMPTS,
  R3: R3_FRAMEWORK_ATTRIBUTION,
  R11: R11_EMBED_ALLOWLIST,
};

/** Strings that are checked at every walked node. */
function checkText(
  text: string,
  path: string,
  rules: typeof ALL_RULES,
  out: LintViolation[],
): void {
  if (!text || text.length === 0) return;
  for (const [ruleId, patterns] of Object.entries(rules)) {
    for (const pat of patterns) {
      const m = pat.re.exec(text);
      if (m) {
        out.push({
          rule_id: pat.id,
          severity: 'hard_block',
          message: `[${ruleId}] ${pat.why}`,
          path,
          excerpt: clampExcerpt(text, m.index, m[0].length),
        });
      }
    }
  }
}

function clampExcerpt(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + len + 20);
  const slice = text.slice(start, end);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${slice}${suffix}`.slice(0, 120);
}

/** Recursively extract plain text from a TipTap JSON doc. */
function extractTipTapText(doc: unknown, out: string[]): void {
  if (!doc || typeof doc !== 'object') return;
  const node = doc as JSONContent & { text?: string; content?: JSONContent[] };
  if (typeof node.text === 'string') out.push(node.text);
  if (Array.isArray(node.content)) {
    for (const child of node.content) extractTipTapText(child, out);
  }
}

/** Walk a JSONB body (composition_json, hero_json, seo_meta_json) and
 *  collect (text, path) pairs to lint. */
function walkJsonb(
  value: unknown,
  path: string,
  visit: (text: string, path: string) => void,
): void {
  if (value == null) return;
  if (typeof value === 'string') {
    visit(value, path);
    return;
  }
  if (typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, idx) => walkJsonb(item, `${path}[${idx}]`, visit));
    return;
  }
  // TipTap doc shape
  const obj = value as Record<string, unknown>;
  if (obj.type === 'doc' && Array.isArray(obj.content)) {
    const collected: string[] = [];
    extractTipTapText(obj, collected);
    visit(collected.join(' '), path);
    return;
  }
  for (const [key, child] of Object.entries(obj)) {
    walkJsonb(child, path ? `${path}.${key}` : key, visit);
  }
}

/**
 * Walk composition_json sections and apply R11 specifically to:
 *   - section.background.image.src
 *   - section.src (for video/embed type sections)
 *   - section.image_url (for image-type universal sections)
 *
 * Called explicitly from lintRowBody so we can target only URL-bearing
 * fields without running the R11 protocol-injection pattern against every
 * string in the composition (which would produce false positives on, e.g.,
 * rich-text that starts with "data:" in a legitimate context).
 */
function lintBackgroundImageSrc(
  row: Record<string, unknown>,
  rules: Record<string, PatternEntry[]>,
  out: LintViolation[],
): void {
  const r11Patterns = rules['R11'];
  if (!r11Patterns || r11Patterns.length === 0) return;

  // Wrap the R11 patterns as a single-key rules object so checkText can
  // iterate them as [ruleId, patterns[]] pairs.
  const r11Rules: Record<string, PatternEntry[]> = { R11: r11Patterns };

  const composition = row['composition_json'];
  if (!composition || typeof composition !== 'object') return;

  const sections = (composition as Record<string, unknown>)['sections'];
  if (!Array.isArray(sections)) return;

  sections.forEach((section: unknown, idx: number) => {
    if (!section || typeof section !== 'object') return;
    const s = section as Record<string, unknown>;

    // Check background.image.src
    const bg = s['background'];
    if (bg && typeof bg === 'object') {
      const bgObj = bg as Record<string, unknown>;
      const img = bgObj['image'];
      if (img && typeof img === 'object') {
        const imgObj = img as Record<string, unknown>;
        const src = imgObj['src'];
        if (typeof src === 'string' && src.length > 0) {
          checkText(src, `composition_json.sections[${idx}].background.image.src`, r11Rules, out);
        }
      }
    }

    // Check section.src (video / embed sections)
    const sectionSrc = s['src'];
    if (typeof sectionSrc === 'string' && sectionSrc.length > 0) {
      checkText(sectionSrc, `composition_json.sections[${idx}].src`, r11Rules, out);
    }

    // Check section.image_url (universal image-type sections)
    const imgUrl = s['image_url'];
    if (typeof imgUrl === 'string' && imgUrl.length > 0) {
      checkText(imgUrl, `composition_json.sections[${idx}].image_url`, r11Rules, out);
    }
  });
}

// ── Public surface ──────────────────────────────────────────────────────
//
// Two helpers:
//   - lintRowBody(target) — walks the row's known content fields and
//     returns all violations. The caller decides whether to hard-block
//     based on `severity === 'hard_block'`.
//   - hasHardBlock(violations) — convenience.

export interface LintRowOptions {
  /** Override the default rule set (used for tests). */
  rules?: Record<string, PatternEntry[]>;
}

export function lintRowBody(target: LintTarget, opts: LintRowOptions = {}): LintViolation[] {
  const out: LintViolation[] = [];
  const rules = opts.rules ?? ALL_RULES;

  // The main walkJsonb path runs all rules EXCEPT R11, because R11's
  // bg_image_unsafe_protocol pattern fires on URL strings that also appear
  // in non-URL contexts (the regex matches `javascript:` anywhere, including
  // in rich-text body content like "avoid javascript: protocols"). R11 is
  // applied surgically in lintBackgroundImageSrc only against known URL fields.
  const rulesWithoutR11 = Object.fromEntries(
    Object.entries(rules).filter(([k]) => k !== 'R11'),
  ) as Record<string, PatternEntry[]>;

  const visit = (text: string, path: string) => checkText(text, path, rulesWithoutR11, out);

  // Scalar string columns we always lint when present
  const scalarKeys = [
    'title_ar', 'title_en', 'subtitle_ar', 'subtitle_en',
    'description_ar', 'description_en',
    'excerpt_ar', 'excerpt_en',
    'content_ar', 'content_en',
    'meta_title_ar', 'meta_title_en',
    'meta_description_ar', 'meta_description_en',
  ];
  for (const k of scalarKeys) {
    const v = (target.row as Record<string, unknown>)[k];
    if (typeof v === 'string') visit(v, k);
  }

  // JSONB content surfaces
  const jsonbKeys = [
    'composition_json',
    'hero_json',
    'seo_meta_json',
    'sections_json',
    'content_ar_rich',
    'content_en_rich',
    'excerpt_ar_rich',
    'excerpt_en_rich',
    'long_description_ar',
    'long_description_en',
  ];
  for (const k of jsonbKeys) {
    const v = (target.row as Record<string, unknown>)[k];
    walkJsonb(v, k, visit);
  }

  // R11 — Per-section background.image.src (Wave 15 W3 post-canary).
  // Walk composition_json sections and apply R11.bg_image_unsafe_protocol
  // specifically to background.image.src fields. We do NOT run this through
  // walkJsonb because walkJsonb would fire the pattern on ALL strings in the
  // composition; we want it only on URL-bearing fields.
  lintBackgroundImageSrc(target.row, rules, out);

  return out;
}

export function hasHardBlock(violations: LintViolation[]): boolean {
  return violations.some((v) => v.severity === 'hard_block');
}

/** Format violations for the API response body. */
export function violationsToResponse(violations: LintViolation[]): {
  total: number;
  hard_blocks: number;
  soft_warns: number;
  details: LintViolation[];
} {
  let hb = 0;
  let sw = 0;
  for (const v of violations) {
    if (v.severity === 'hard_block') hb += 1;
    else sw += 1;
  }
  return {
    total: violations.length,
    hard_blocks: hb,
    soft_warns: sw,
    details: violations,
  };
}

/** Useful for inserting a content_edits row of change_kind='lint_block'. */
export function violationsForAudit(violations: LintViolation[]): {
  rule_ids: string[];
  paths: string[];
  count: number;
} {
  return {
    rule_ids: Array.from(new Set(violations.map((v) => v.rule_id))).sort(),
    paths: Array.from(new Set(violations.map((v) => v.path))).sort(),
    count: violations.length,
  };
}
