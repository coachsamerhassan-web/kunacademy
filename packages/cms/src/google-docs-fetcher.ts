// @kunacademy/cms — Google Docs Content Fetcher
// Fetches a Google Doc by ID, exports as clean, brand-ready HTML.
// Used for rich content: program descriptions, coach bios, blog posts.
//
// Requires: Google Service Account with Docs API access
//
// Pipeline per fetch:
//   documentToHtml()   — Google Docs JSON → semantic HTML
//   parseCallouts()    — emoji prefixes → <aside class="callout-*"> (9.1c)
//   stripStyleAttrs()  — remove any leaking style="" attributes (9.1b)
//   sanitizeHtml()     — XSS sanitization via isomorphic-dompurify (9.1a)
//   applyDocStyles()   — inject brand Tailwind classes + RTL container (9.1d/e)

import { google } from 'googleapis';
import { readFileSync } from 'fs';
import DOMPurify from 'isomorphic-dompurify';
import { applyDocStyles } from './doc-styles';

// ── Auth ──────────────────────────────────────────────────────────────────────

let authClient: InstanceType<typeof google.auth.GoogleAuth> | null = null;

function getAuth() {
  if (authClient) return authClient;

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  if (!keyPath) {
    console.warn('[cms/docs] No GOOGLE_SERVICE_ACCOUNT_PATH — rich content disabled');
    return null;
  }

  try {
    const creds = JSON.parse(readFileSync(keyPath, 'utf-8'));
    authClient = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/documents.readonly'],
    });
    return authClient;
  } catch (e) {
    console.error('[cms/docs] Failed to load service account:', e);
    return null;
  }
}

// ── In-memory cache ──────────────────────────────────────────────────────────

const docCache = new Map<string, { html: string; fetchedAt: number }>();
const CACHE_TTL = 300_000; // 5 minutes — matches ISR

// ── XSS Allowlist (9.1a) ────────────────────────────────────────────────────
// Only semantic tags that our renderer produces are whitelisted.
// Scripts, event handlers, style attrs, iframes, and arbitrary elements are stripped.

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4',
  'p', 'ul', 'ol', 'li',
  'strong', 'em', 'u',
  'a',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'aside', 'blockquote',
  'img',
  'div',   // used for responsive table wrapper
];

const ALLOWED_ATTR = [
  'href',        // <a href>
  'src', 'alt',  // <img>
  'class',       // Tailwind classes added by applyDocStyles
  'dir',         // dir="auto" RTL container (9.1e)
];

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a Google Doc and return clean, brand-ready, XSS-safe HTML.
 * Returns null if the doc can't be fetched (missing ID, no auth, API error).
 *
 * The returned HTML is:
 *   - Sanitized (DOMPurify, server-side)
 *   - Styled with brand Tailwind classes
 *   - Wrapped in a dir="auto" container for bilingual RTL support
 *
 * @param docId  - Google Doc ID
 * @param slug   - Program slug used to resolve [IMAGE: ...] placeholders
 *                 to /images/programs/content/{slug}--{nn}-*.png paths
 * @param locale - 'ar' returns the Arabic section only, 'en' returns the
 *                 English section only. 'auto' (default) returns the full doc.
 *                 Dual-language docs follow the convention: Arabic first, then
 *                 an English H1 heading marks the start of the English section.
 */
export async function fetchDocAsHtml(
  docId: string | undefined,
  slug?: string,
  locale: 'ar' | 'en' | 'auto' = 'auto'
): Promise<string | null> {
  if (!docId) return null;

  // Cache key includes slug + locale so each variant is cached independently
  const cacheKey = [docId, slug ?? '', locale].join('::');

  // Check cache
  const cached = docCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.html;
  }

  const auth = getAuth();
  if (!auth) return null;

  try {
    const docs = google.docs({ version: 'v1', auth });
    const doc = await docs.documents.get({ documentId: docId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawHtml = documentToHtml(doc.data as any);

    // ── Locale split (dual-language docs) ───────────────────────────────
    // Docs follow the convention: Arabic content first, then an English H1
    // heading starts the English section.  We split at that boundary so each
    // locale receives only its own content — correct alignment, no bloat.
    const localizedHtml = locale === 'auto' ? rawHtml : splitByLocale(rawHtml, locale);

    // ── Processing pipeline ──────────────────────────────────────────────
    const withCallouts = parseCallouts(localizedHtml);    // 9.1c — emoji → <aside>
    const stripped = stripStyleAttrs(withCallouts);       // 9.1b — remove style=""
    const sanitized = sanitizeHtml(stripped);             // 9.1a — XSS sanitization
    const withImages = slug                               // 9.1f — [IMAGE:] → <img>
      ? injectContentImages(sanitized, slug)
      : sanitized;
    const html = applyDocStyles(withImages);              // 9.1d/e — classes + RTL

    docCache.set(cacheKey, { html, fetchedAt: Date.now() });
    return html;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[cms/docs] Failed to fetch doc ${docId}:`, msg);
    return null;
  }
}

/** Clear the doc cache (called by revalidation webhook) */
export function invalidateDocCache(): void {
  docCache.clear();
}

// ── Locale split ─────────────────────────────────────────────────────────────

/**
 * Split dual-language HTML at the boundary between Arabic and English sections.
 *
 * Convention in Kun program Google Docs:
 *   - Arabic content comes first (H1 in Arabic script).
 *   - The English section begins with an H1 whose text contains ONLY Latin /
 *     ASCII characters and common punctuation — no Arabic Unicode characters.
 *
 * Detection: scan for the SECOND <h1> whose inner text is free of Arabic
 * Unicode characters (U+0600–U+06FF, U+0750–U+077F, U+FB50–U+FDFF,
 * U+FE70–U+FEFF).  The first H1 is always the Arabic title; the first
 * all-Latin H1 after that is the English section start.
 *
 * If no split point is found (single-language doc or unexpected structure),
 * the full HTML is returned unchanged — safe fallback.
 *
 * @param html   - Raw HTML from documentToHtml()
 * @param locale - 'ar' → before the split; 'en' → from the split onward
 */
function splitByLocale(html: string, locale: 'ar' | 'en'): string {
  // Match every <h1> opening tag + its text content (ignoring inline tags).
  // We look for the first H1 whose stripped text has no Arabic codepoints.
  // The regex captures the character offset of the opening <h1> tag.
  const h1Pattern = /<h1(?:\s[^>]*)?>([^<]*(?:<(?!\/h1)[^>]*>[^<]*)*)<\/h1>/gi;

  // Arabic Unicode ranges (covers Arabic, Arabic Extended-A, Arabic Presentation Forms)
  const arabicRangeRe = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

  let seenFirstH1 = false;
  let match: RegExpExecArray | null;

  while ((match = h1Pattern.exec(html)) !== null) {
    const innerText = match[1].replace(/<[^>]+>/g, ''); // strip any nested tags
    const hasArabic = arabicRangeRe.test(innerText);

    if (!seenFirstH1) {
      // Skip the Arabic title (first H1)
      seenFirstH1 = true;
      continue;
    }

    if (!hasArabic) {
      // Found the English H1 — this is the split point
      const splitIndex = match.index;
      if (locale === 'ar') {
        return html.slice(0, splitIndex).trimEnd();
      }
      // 'en': return from this H1 to end
      return html.slice(splitIndex);
    }
  }

  // No split point found — return full content (single-language doc)
  console.warn('[cms/docs] splitByLocale: no English H1 boundary found — returning full doc');
  return html;
}

// ── 9.1a — XSS Sanitization ─────────────────────────────────────────────────

/**
 * Run isomorphic-dompurify with strict allowlist.
 * Strips: scripts, event handlers (on*), style attributes, iframes, objects,
 * and any element or attribute not in the allowlist above.
 *
 * Safe to run server-side (uses JSDOM under the hood in Node.js).
 */
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORCE_BODY: false,
    // Prevent DOM clobbering
    SANITIZE_DOM: true,
    // Block all data: URIs except in img src (handled by DOMPurify default)
    ALLOW_DATA_ATTR: false,
  }) as string;
}

// ── 9.1b — Strip inline style attributes ────────────────────────────────────

/**
 * Strip any style="" attributes that might leak through text content.
 * Our JSON parser doesn't produce them, but defensive post-processing
 * ensures nothing sneaks through (e.g. if Google adds new fields).
 */
function stripStyleAttrs(html: string): string {
  // Remove style="..." with any content (handles quotes and escaped chars)
  return html.replace(/\s+style=["'][^"']*["']/gi, '');
}

// ── 9.1c — Callout box parser ────────────────────────────────────────────────

/**
 * Callout prefix map: emoji OR [bracket] prefix → aside class name.
 * Supports both legacy emoji markers and new text-only bracket markers.
 * The prefix is stripped from rendered text; CSS handles visual styling.
 */
const CALLOUT_MAP: ReadonlyArray<{ emoji: string; bracket?: string; className: string }> = [
  { emoji: '📖', bracket: 'من التراث',      className: 'callout-heritage'  },
  { emoji: '📖', bracket: 'From the Heritage', className: 'callout-heritage' },
  { emoji: '⏸️', bracket: 'توقّف وتأمّل',   className: 'callout-pause'     },
  // Note: '&' is HTML-entity-encoded to '&amp;' by escapeHtml() before parseCallouts runs.
  // Both forms are listed to handle docs that may contain the raw or pre-encoded variant.
  { emoji: '⏸️', bracket: 'Pause &amp; Reflect', className: 'callout-pause'  },
  { emoji: '⏸️', bracket: 'Pause & Reflect',      className: 'callout-pause'  },
  { emoji: '🔬', bracket: 'جرّب بنفسك',     className: 'callout-exercise'  },
  { emoji: '🔬', bracket: 'Try It Now',       className: 'callout-exercise' },
  { emoji: '⚠️', bracket: 'حدود العلم هنا',  className: 'callout-warning'   },
  { emoji: '💡', className: 'callout-insight'  },
  { emoji: '✅', className: 'callout-success'  },
  { emoji: '🔑', className: 'callout-key'      },
];

/**
 * Detect <p> elements whose text content begins with a callout prefix.
 * Supports three formats:
 *
 *   A. Two-paragraph split (Google Docs bold label on own line):
 *      <p ...><strong ...>[من التراث]</strong></p>
 *      <p ...>body text here</p>
 *      → <aside class="callout-heritage"><p ...>body text here</p></aside>
 *
 *   B. Inline bracket (label + body in same paragraph):
 *      <p ...>[من التراث] body text here</p>
 *      → <aside class="callout-heritage"><p ...>body text here</p></aside>
 *
 *   C. Emoji prefix (legacy):
 *      <p ...>📖 body text here</p>
 *      → <aside class="callout-heritage"><p ...>body text here</p></aside>
 *
 * Format A is detected first (most common from Google Docs when label is bolded).
 * The label paragraph is removed; the body paragraph is wrapped in the aside.
 * Handles both plain <p> and <p class="..."> forms.
 */
function parseCallouts(html: string): string {
  // ── Generic tag pattern helpers ──────────────────────────────────────────
  // Matches an opening <p> tag with optional attributes
  const openP = '<p(\\s[^>]*)?>'; // capture group 1: attrs (may be undefined)
  // Matches an optional inline formatting wrapper around the bracket text.
  // Google Docs bolded labels render as <strong class="...">...</strong>.
  // We also allow <em>, plain text, or no wrapper.
  const inlineWrapOpen = '(?:<(?:strong|em|u)(?:\\s[^>]*)?>)?';
  const inlineWrapClose = '(?:</(?:strong|em|u)>)?';
  // Matches any amount of whitespace including newlines
  const ws = '\\s*';
  // A <p> closing tag with optional trailing whitespace/newlines
  const closeP = `</p>${ws}\\n?`;

  for (const { emoji, bracket, className } of CALLOUT_MAP) {
    // ── Format A: two-paragraph split (label-only paragraph + body paragraph) ─
    // Pattern: <p ...><strong ...>[LABEL]</strong></p>\n<p ...>body</p>
    if (bracket) {
      const escapedBracket = bracket.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&');
      const twoParaPattern = new RegExp(
        // Label paragraph: <p ...> optional-wrapper [LABEL] optional-wrapper </p> \n
        `${openP}${ws}${inlineWrapOpen}${ws}\\[${escapedBracket}\\]${ws}${inlineWrapClose}${ws}${closeP}` +
        // Body paragraph: <p attrs>body content</p>
        `<p(\\s[^>]*)?>([\\s\\S]*?)</p>`,
        'gi'
      );
      html = html.replace(
        twoParaPattern,
        (_match, _labelAttrs: string | undefined, bodyAttrs: string | undefined, body: string) => {
          const trimmed = body.trim();
          if (!trimmed) return _match; // empty body — don't consume
          return `<aside class="${className}"><p${bodyAttrs ?? ''}>${trimmed}</p></aside>`;
        }
      );
    }

    // ── Format C: emoji prefix (legacy) ──────────────────────────────────────
    // Pattern: <p ...>EMOJI body text</p>
    const emojiPattern = new RegExp(
      `<p(\\s[^>]*)?>\\s*${escapeEmoji(emoji)}\\s+([\\s\\S]*?)</p>`,
      'gi'
    );
    html = html.replace(emojiPattern, (_match, attrs: string | undefined, content: string) => {
      return `<aside class="${className}"><p${attrs ?? ''}>${content.trim()}</p></aside>`;
    });

    // ── Format B: inline bracket in same paragraph ────────────────────────────
    // Pattern: <p ...>[LABEL] body text</p>
    // Also handles <p ...><strong>[LABEL]</strong> body text</p> (inline bold label + body)
    if (bracket) {
      const escapedBracket = bracket.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&');
      const inlinePattern = new RegExp(
        `<p(\\s[^>]*)?>\\s*${inlineWrapOpen}\\s*\\[${escapedBracket}\\]\\s*${inlineWrapClose}\\s*([\\s\\S]*?)</p>`,
        'gi'
      );
      html = html.replace(inlinePattern, (_match, attrs: string | undefined, content: string) => {
        return `<aside class="${className}"><p${attrs ?? ''}>${content.trim()}</p></aside>`;
      });
    }
  }

  return html;
}

/**
 * Escape an emoji string for safe use in a RegExp pattern.
 * Emoji codepoints above U+FFFF need no special treatment in modern JS,
 * but we escape any regex metacharacters just to be safe.
 */
function escapeEmoji(emoji: string): string {
  return emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── 9.1f — Content Image Injection ──────────────────────────────────────────

/**
 * Replace [IMAGE: ...] placeholder paragraphs with <img> tags pointing to
 * the pre-generated program content images at /images/programs/content/.
 *
 * Naming convention: {slug}--{nn}-{description}.png
 * where {nn} is the 1-based index of the [IMAGE:] occurrence in the doc.
 *
 * The actual filename on disk may have any description suffix — we match
 * by prefix ({slug}--{nn}-) and use a known filename map. Since we scan
 * /images/programs/content/ at build time, we rely on the ordered index
 * approach: first [IMAGE:] → 01, second → 02, third → 03.
 *
 * Image filenames are deterministic (generated during the extraction step),
 * so we build the src from the slug + zero-padded index.
 *
 * The PROGRAM_CONTENT_IMAGE_MAP maps each slug to its ordered image filenames.
 * This avoids any filesystem access at render time (Edge runtime compatible).
 */
const PROGRAM_CONTENT_IMAGE_MAP: Record<string, string[]> = {
  'stce-level-1-stic': [
    'stce-level-1-stic--01-coaching-room-presence.png',
    'stce-level-1-stic--02-contemplation-window.png',
    'stce-level-1-stic--03-doorway-arrival.png',
  ],
  'stce-level-2-staic': [
    'stce-level-2-staic--01-terrace-dusk.png',
    'stce-level-2-staic--02-retreat-circle.png',
    'stce-level-2-staic--03-summit-sunrise.png',
  ],
  'stce-level-3-stgc': [
    'stce-level-3-stgc--01-coaching-circle.png',
    'stce-level-3-stgc--02-group-moment.png',
    'stce-level-3-stgc--03-courtyard-walk.png',
  ],
  'stce-level-4-stoc': [
    'stce-level-4-stoc--01-executive-office.png',
    'stce-level-4-stoc--02-institutional-corridor.png',
    'stce-level-4-stoc--03-empty-boardroom.png',
  ],
  'stce-level-5-stfc': [
    'stce-level-5-stfc--01-couple-couch.png',
    'stce-level-5-stfc--02-almost-touching-hands.png',
    'stce-level-5-stfc--03-olive-grove-walk.png',
  ],
  'somatic-thinking-intro': [
    'somatic-thinking-intro--01-stone-doorway.png',
    'somatic-thinking-intro--02-seated-meditation.png',
    'somatic-thinking-intro--03-olive-grove-path.png',
  ],
  'your-identity': [
    'your-identity--01-coach-client-profile.png',
    'your-identity--02-water-basin-reflection.png',
  ],
  'mcc-mentoring': [
    'mcc-mentoring--01-master-apprentice-chiaroscuro.png',
    'mcc-mentoring--02-hands-close-up.png',
  ],
  'menhajak-training': [
    'menhajak-training--01-empty-seminar-room.png',
    'menhajak-training--02-workshop-circle.png',
    'menhajak-training--03-whiteboard-ownership.png',
  ],
  'menhajak-organizational': [
    'menhajak-organizational--01-institutional-corridor.png',
    'menhajak-organizational--02-round-table-conversation.png',
  ],
  'menhajak-leadership': [
    'menhajak-leadership--01-founder-at-window.png',
    'menhajak-leadership--02-rooftop-circle.png',
  ],
  'gps-of-life': [
    'gps-of-life--01-cairo-crossroads.png',
    'gps-of-life--02-workshop-clusters.png',
    'gps-of-life--03-morning-desk-clarity.png',
  ],
  'impact-engineering': [
    'impact-engineering--02-workshop-table.png',
  ],
  'gm-playbook-briefing': [
    'gm-playbook-briefing--01-leader-phone.png',
    'gm-playbook-briefing--02-coaching-conversation.png',
    'gm-playbook-briefing--03-leader-semicircle.png',
  ],
  'ihya-reviving-the-self': [
    'ihya-reviving-the-self--01-car-night-recognition.png',
    'ihya-reviving-the-self--02-mountain-arrival-aerial.png',
    'ihya-reviving-the-self--03-stone-terrace-circle.png',
  ],
};

const CONTENT_IMAGES_BASE = '/images/programs/content';

/**
 * Replace every [IMAGE: ...] paragraph in the HTML with an <img> tag.
 * The n-th occurrence maps to the n-th filename in PROGRAM_CONTENT_IMAGE_MAP[slug].
 * Paragraphs whose image index exceeds the available files are removed silently.
 *
 * Matches both:
 *   <p>[IMAGE: some description]</p>
 *   <p>[IMAGE: some description with &amp; entities]</p>
 */
function injectContentImages(html: string, slug: string): string {
  const images = PROGRAM_CONTENT_IMAGE_MAP[slug];
  if (!images || images.length === 0) return html;

  let imageIndex = 0;

  // Match <p ...>[IMAGE: ...]</p> — the paragraph may have class attributes
  // added by earlier pipeline steps or by the Google Docs JSON parser.
  // We use a non-greedy match on the content to avoid spanning multiple tags.
  return html.replace(
    /<p(\s[^>]*)?\s*>\s*\[IMAGE:[^\]]*\]\s*<\/p>/gi,
    () => {
      const filename = images[imageIndex];
      imageIndex++;
      if (!filename) return ''; // more [IMAGE:] tags than images — remove silently
      const src = `${CONTENT_IMAGES_BASE}/${filename}`;
      // Extract a human-readable alt from the filename:
      //   "stce-level-1-stic--01-coaching-room-presence.png"  → "coaching room presence"
      //   "gm-playbook-briefing--01-leader-phone.png"         → "leader phone"
      // Strategy: strip everything up to and including the "--NN-" separator.
      const alt = filename
        .replace(/\.png$/i, '')
        .replace(/^.*?--\d+-/, '') // strip slug prefix + "--NN-" index
        .replace(/-/g, ' ');
      // No class here — applyDocStyles() injects DOC_CLASS_MAP.img classes
      // (max-w-sm, float-start, etc.) in the next pipeline step.
      return `<img src="${src}" alt="${alt}" />`;
    }
  );
}

// ── Google Docs JSON → Clean HTML ────────────────────────────────────────────
// Google Docs API returns a deeply nested JSON structure (not HTML).
// We walk the structural elements and produce semantic HTML.

interface DocElement {
  paragraph?: {
    paragraphStyle?: { namedStyleType?: string };
    elements?: TextRun[];
    bullet?: { listId?: string; nestingLevel?: number };
  };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: DocElement[];
      }>;
    }>;
  };
}

interface TextRun {
  textRun?: {
    content?: string;
    textStyle?: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      link?: { url?: string };
    };
  };
  inlineObjectElement?: {
    inlineObjectId?: string;
  };
}

type InlineObjects = Record<string, {
  inlineObjectProperties?: {
    embeddedObject?: {
      imageProperties?: { contentUri?: string };
      title?: string;
      description?: string;
    };
  };
}>;

function documentToHtml(doc: {
  body?: { content?: DocElement[] };
  inlineObjects?: InlineObjects;
}): string {
  if (!doc.body?.content) return '';

  const inlineObjects: InlineObjects = doc.inlineObjects ?? {};
  const parts: string[] = [];
  let inList = false;

  for (const element of doc.body.content) {
    if (element.paragraph) {
      const p = element.paragraph;
      const style = p.paragraphStyle?.namedStyleType ?? 'NORMAL_TEXT';
      const text = renderTextRuns(p.elements ?? [], inlineObjects);

      // Skip empty paragraphs
      if (!text.trim()) {
        if (inList) {
          parts.push('</ul>');
          inList = false;
        }
        continue;
      }

      // Bullet lists
      if (p.bullet) {
        if (!inList) {
          parts.push('<ul>');
          inList = true;
        }
        parts.push(`<li>${text}</li>`);
        continue;
      }

      // Close list if we were in one
      if (inList) {
        parts.push('</ul>');
        inList = false;
      }

      // Headings
      switch (style) {
        case 'HEADING_1':
          parts.push(`<h1>${text}</h1>`);
          break;
        case 'HEADING_2':
          parts.push(`<h2>${text}</h2>`);
          break;
        case 'HEADING_3':
          parts.push(`<h3>${text}</h3>`);
          break;
        case 'HEADING_4':
          parts.push(`<h4>${text}</h4>`);
          break;
        default:
          parts.push(`<p>${text}</p>`);
      }
    }

    // Tables
    if (element.table?.tableRows) {
      if (inList) {
        parts.push('</ul>');
        inList = false;
      }
      parts.push('<table>');
      for (const row of element.table.tableRows) {
        parts.push('<tr>');
        for (const cell of row.tableCells ?? []) {
          const cellHtml = cell.content
            ?.map((el) => {
              if (el.paragraph?.elements) {
                return renderTextRuns(el.paragraph.elements, inlineObjects);
              }
              return '';
            })
            .join(' ') ?? '';
          parts.push(`<td>${cellHtml}</td>`);
        }
        parts.push('</tr>');
      }
      parts.push('</table>');
    }
  }

  if (inList) parts.push('</ul>');

  return parts.join('\n');
}

function renderTextRuns(elements: TextRun[], inlineObjects: InlineObjects = {}): string {
  return elements
    .map((el) => {
      // Inline image element
      if (el.inlineObjectElement?.inlineObjectId) {
        const objectId = el.inlineObjectElement.inlineObjectId;
        const embedded = inlineObjects[objectId]?.inlineObjectProperties?.embeddedObject;
        const contentUri = embedded?.imageProperties?.contentUri;
        if (!contentUri) return '';
        const alt = escapeHtml(embedded?.description ?? embedded?.title ?? '');
        return `<img src="${escapeHtml(contentUri)}" alt="${alt}" />`;
      }

      const run = el.textRun;
      if (!run?.content) return '';

      let text = escapeHtml(run.content.replace(/\n$/, ''));
      if (!text) return '';

      // Apply inline formatting
      if (run.textStyle?.bold) text = `<strong>${text}</strong>`;
      if (run.textStyle?.italic) text = `<em>${text}</em>`;
      if (run.textStyle?.underline && !run.textStyle?.link) text = `<u>${text}</u>`;
      if (run.textStyle?.link?.url) text = `<a href="${escapeHtml(run.textStyle.link.url)}">${text}</a>`;

      return text;
    })
    .join('');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
