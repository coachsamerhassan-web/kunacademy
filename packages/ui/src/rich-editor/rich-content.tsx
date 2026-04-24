/**
 * RichContent — public-facing renderer for TipTap JSON documents.
 *
 * Pipeline:
 *   TipTap JSON  →  generateHTML()  →  sanitizeRichHtml()  →  dangerouslySetInnerHTML
 *
 * Why sanitize on RENDER and not on STORE:
 *   1. Bulk fix: when the sanitizer allowlist changes (e.g. a new CVE in an
 *      extension), we don't need to rewrite every stored document — next
 *      render picks up the new rules automatically.
 *   2. Author intent preserved: the DB keeps exactly what the author typed.
 *      Sanitization is a rendering concern, not an authoring concern.
 *   3. Defense in depth: even if bad JSON sneaks in via a bypass, the render
 *      step is the last line before the browser and catches it.
 *
 * This component is a SERVER component — no 'use client'. That's intentional:
 *   - Generates HTML on the server
 *   - Runs DOMPurify in Node (via isomorphic-dompurify)
 *   - Ships zero JavaScript to the client for rendered content
 *
 * Usage:
 *   <RichContent doc={lp.description_ar} locale="ar" />
 */
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { Node, mergeAttributes } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';
import { sanitizeRichHtml } from './sanitizer';

// Mirror VideoEmbedNode from the editor so generateHTML produces the right
// iframe markup. Kept identical — any drift here causes the sanitizer to strip
// authored video embeds.
const VideoEmbedServerNode = Node.create({
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
  renderHTML({ HTMLAttributes, node }) {
    const provider = node.attrs.provider as string | null;
    const allowAttr = provider === 'gdrive' ? { allow: 'autoplay' } : {};
    return [
      'div',
      { class: 'rich-video-embed', 'data-align': 'center' },
      [
        'iframe',
        mergeAttributes(HTMLAttributes, {
          'data-rich-video-provider': provider ?? '',
          width: '100%',
          height: '400',
          loading: 'lazy',
          referrerpolicy: 'strict-origin-when-cross-origin',
          sandbox: 'allow-scripts allow-same-origin allow-presentation',
          frameborder: '0',
          allowfullscreen: 'true',
          ...allowAttr,
        }),
      ],
    ];
  },
});

// Extension set used for server-side HTML generation. MUST be a superset of
// whatever the authoring editor allows, otherwise TipTap drops unknown nodes.
const SERVER_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    code: false,
    codeBlock: false,
  }),
  Link.configure({
    openOnClick: false,
    autolink: false,
    HTMLAttributes: {
      rel: 'noopener noreferrer',
      target: '_blank',
    },
  }),
  Image.configure({
    inline: false,
    allowBase64: false,
    HTMLAttributes: {
      loading: 'lazy',
      decoding: 'async',
    },
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
    alignments: ['left', 'center', 'right'],
  }),
  VideoEmbedServerNode,
];

/** Convert TipTap style="text-align:X" attributes to data-align so DOMPurify
 *  can strip style wholesale without losing alignment. Post-generateHTML,
 *  pre-sanitize pass. */
function convertTextAlignToDataAttr(html: string): string {
  // Matches: text-align: left | right | center | start | end (case-insensitive,
  // with optional whitespace + trailing semicolon).
  return html.replace(
    /style\s*=\s*"([^"]*)"/gi,
    (_match, inner: string) => {
      const m = inner.match(/text-align\s*:\s*(left|right|center|start|end)\s*;?/i);
      if (!m) return ''; // strip style entirely if no recognized alignment
      const value = m[1].toLowerCase();
      // Normalize logical 'start'/'end' to physical — the rendering context
      // already carries direction, so left/right works for both LTR and RTL.
      const normalized =
        value === 'start' ? 'left' : value === 'end' ? 'right' : value;
      return `data-align="${normalized}"`;
    },
  );
}

// ── Public API ──────────────────────────────────────────────────────────────
export interface RichContentProps {
  doc: JSONContent | null | undefined;
  /** Optional — sets `dir` + `lang` on the wrapper. Default: no wrapper attrs. */
  locale?: 'ar' | 'en';
  /** Optional extra className on the wrapper. */
  className?: string;
  /** Optional aria-label on the wrapper. */
  ariaLabel?: string;
}

/**
 * Render a TipTap JSON document as sanitized HTML.
 * Returns an empty fragment if `doc` is null/undefined/empty.
 */
export function RichContent({ doc, locale, className, ariaLabel }: RichContentProps) {
  if (!doc || !isNonEmptyDoc(doc)) {
    return null;
  }

  let rawHtml: string;
  try {
    rawHtml = generateHTML(doc, SERVER_EXTENSIONS);
  } catch (err) {
    // If the stored JSON is malformed (e.g. a breaking change in TipTap's
    // schema, or content from a future version), don't explode the page —
    // log + render nothing.
    console.error('[RichContent] generateHTML failed:', err);
    return null;
  }

  const alignConverted = convertTextAlignToDataAttr(rawHtml);
  const safeHtml = sanitizeRichHtml(alignConverted);

  if (!safeHtml.trim()) return null;

  return (
    <div
      className={`rich-content ${className ?? ''}`.trim()}
      dir={locale === 'ar' ? 'rtl' : locale === 'en' ? 'ltr' : undefined}
      lang={locale}
      aria-label={ariaLabel}
      // This is the ONLY place in the app that uses dangerouslySetInnerHTML
      // with dynamic content. The HTML has gone through generateHTML (strict
      // schema) + DOMPurify (locked allowlist) + text-align conversion.
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

/** Check whether a TipTap doc has meaningful content — avoids rendering an
 *  empty <p></p> div for empty fields. */
function isNonEmptyDoc(doc: JSONContent): boolean {
  if (!doc || typeof doc !== 'object') return false;
  if (doc.type !== 'doc') return false;
  const content = doc.content;
  if (!Array.isArray(content) || content.length === 0) return false;
  // A single empty paragraph is not meaningful.
  if (content.length === 1) {
    const only = content[0];
    if (only?.type === 'paragraph' && (!only.content || only.content.length === 0)) {
      return false;
    }
  }
  return true;
}

/**
 * Convenience: render one-of-two bilingual fields based on current locale.
 * Falls back to the other language if the preferred one is empty.
 */
export interface RichContentBilingualProps {
  docAr: JSONContent | null | undefined;
  docEn: JSONContent | null | undefined;
  locale: 'ar' | 'en';
  className?: string;
}

export function RichContentBilingual({
  docAr,
  docEn,
  locale,
  className,
}: RichContentBilingualProps) {
  const primary = locale === 'ar' ? docAr : docEn;
  const fallback = locale === 'ar' ? docEn : docAr;

  if (primary && isNonEmptyDoc(primary)) {
    return <RichContent doc={primary} locale={locale} className={className} />;
  }
  // Fallback to the other language — still rendered with the FALLBACK locale's
  // dir/lang, not the caller's. RTL Arabic content in an English page should
  // still render rtl.
  if (fallback && isNonEmptyDoc(fallback)) {
    const fallbackLocale = locale === 'ar' ? 'en' : 'ar';
    return <RichContent doc={fallback} locale={fallbackLocale} className={className} />;
  }
  return null;
}

/**
 * Plain-text extraction from a TipTap doc — for SEO meta descriptions, search
 * indexing, email body previews. Doesn't render HTML at all.
 */
export function extractPlainText(
  doc: JSONContent | null | undefined,
  maxLength = 500,
): string {
  if (!doc || typeof doc !== 'object') return '';
  const out: string[] = [];

  function walk(node: JSONContent | undefined): void {
    if (!node) return;
    if (typeof node.text === 'string') {
      out.push(node.text);
      return;
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
      // Insert a single space between block-level nodes so paragraphs don't
      // run together without whitespace.
      const blockTypes = new Set([
        'paragraph',
        'heading',
        'blockquote',
        'listItem',
        'bulletList',
        'orderedList',
      ]);
      if (blockTypes.has(node.type ?? '')) {
        out.push(' ');
      }
    }
  }

  walk(doc);
  const joined = out.join('').replace(/\s+/g, ' ').trim();
  if (joined.length <= maxLength) return joined;
  // Cut on word boundary just before maxLength
  const cut = joined.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.7 ? cut.slice(0, lastSpace) : cut) + '…';
}
