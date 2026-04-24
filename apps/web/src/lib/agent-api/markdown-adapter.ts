/**
 * Wave 15 Phase 1.5 — Markdown → TipTap JSON adapter.
 *
 * Agents (LLMs) natively produce Markdown. Rather than forcing them to
 * construct TipTap JSON by hand (brittle, verbose, drifts on version bumps),
 * we accept Markdown on PATCH and convert to TipTap JSON server-side.
 *
 * Strategy:
 *   1. Parse Markdown via `marked` (battle-tested, well-maintained)
 *   2. Produce raw HTML
 *   3. Run sanitizeRichHtml() — same XSS boundary as the rich editor path
 *   4. Use TipTap's generateJSON() to convert HTML → JSON
 *   5. Store the JSON
 *
 * Why not direct markdown → TipTap JSON (skip HTML)?
 *   Because the sanitizer is the SECURITY boundary, and it operates on
 *   HTML. Any path that stores content MUST go through the sanitizer.
 *   Making HTML the intermediate guarantees no content channel bypasses
 *   our XSS defense.
 *
 * Supported Markdown features (matches editor capabilities):
 *   - Headings (H1–H3)
 *   - Paragraphs
 *   - Bold / italic / strikethrough / inline code (inline code styled as strong)
 *   - Bullet + numbered lists
 *   - Blockquotes
 *   - Links (sanitizer enforces URL scheme allowlist)
 *   - Images (with alt text) — note: images here reference EXTERNAL URLs.
 *     Uploading files must go through /api/admin/upload/media.
 *   - Video embeds via the HTML <iframe> syntax — but callers should PREFER
 *     a {provider, url} marker (see embedVideoMarker helper) since raw iframes
 *     are easier to mis-construct.
 */

import { marked } from 'marked';
import { generateJSON } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { Node, mergeAttributes } from '@tiptap/core';
// Import directly from the sanitizer file — avoid the barrel so server
// builds never bundle the 'use client' editor component.
import { sanitizeRichHtml, parseVideoEmbed } from '@kunacademy/ui/rich-editor/sanitizer';
import type { JSONContent } from '@tiptap/react';

// Mirror the VideoEmbedNode — must match the editor's schema for generateJSON
// to produce a round-trippable document.
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

export interface MarkdownToJsonOptions {
  /** If the Markdown mentions video URLs on bare lines, convert them to
   *  videoEmbed nodes via parseVideoEmbed. Default: true. */
  autoEmbedVideos?: boolean;
}

/** Scan Markdown for bare video URLs on their own lines and replace with
 *  an HTML iframe marker that our schema's VideoEmbedNode recognizes. */
function preprocessBareVideoLinks(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    // Only consider lines that are JUST a URL (nothing else)
    if (/^https?:\/\/\S+$/i.test(trimmed)) {
      const embed = parseVideoEmbed(trimmed);
      if (embed) {
        const allowAttr = embed.provider === 'gdrive' ? ' allow="autoplay"' : '';
        // Emit as raw HTML — the sanitizer will validate the iframe
        out.push(
          `<iframe data-rich-video-provider="${embed.provider}" src="${embed.embedSrc}" title="${embed.title.replace(/"/g, '&quot;')}" width="100%" height="400" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" frameborder="0" allowfullscreen="true"${allowAttr}></iframe>`,
        );
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * Convert Markdown to TipTap JSON, applying our sanitizer as part of the
 * pipeline. Returns a valid TipTap doc suitable for direct DB insertion.
 * Throws on parse error.
 */
export function markdownToTipTapJson(
  markdown: string,
  opts: MarkdownToJsonOptions = {},
): JSONContent {
  if (!markdown) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  if (markdown.length > 200_000) {
    throw new Error('Markdown input too large (max 200 KB)');
  }

  const autoEmbed = opts.autoEmbedVideos !== false;
  const preprocessed = autoEmbed ? preprocessBareVideoLinks(markdown) : markdown;

  // marked config — breaks on → <br>, gfm for tables/strikethrough.
  // We explicitly disable mangle + headerIds which add DOM noise we don't need.
  const rawHtml = marked.parse(preprocessed, {
    async: false,
    gfm: true,
    breaks: false,
  }) as string;

  // Sanitize — same boundary as the rich editor's public render path.
  const safeHtml = sanitizeRichHtml(rawHtml);

  // Convert sanitized HTML to TipTap JSON
  const json = generateJSON(safeHtml, ADAPTER_EXTENSIONS);

  // Always return a doc — generateJSON should already give us one, but
  // guard against the rare edge-case of empty input.
  if (!json || json.type !== 'doc') {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  return json as JSONContent;
}

/** Convert TipTap JSON back to Markdown for reading responses. This is
 *  lossy (TipTap has nodes that don't map to Markdown cleanly) but good
 *  enough for agent consumption. */
export function tipTapJsonToMarkdown(doc: JSONContent | null | undefined): string {
  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) return '';
  return doc.content.map((node) => nodeToMd(node, 0)).join('\n\n').trim();
}

// Per-node serializer. Kept in one file to avoid sprawl.
function nodeToMd(node: JSONContent, depth: number): string {
  if (!node) return '';
  const marks = (text: string, n: JSONContent) => {
    let out = text;
    const markList = n.marks ?? [];
    const hasMark = (type: string) => markList.some((m) => m.type === type);
    if (hasMark('bold'))   out = `**${out}**`;
    if (hasMark('italic')) out = `*${out}*`;
    if (hasMark('strike')) out = `~~${out}~~`;
    if (hasMark('link')) {
      const linkMark = markList.find((m) => m.type === 'link');
      const href = (linkMark?.attrs as { href?: string } | undefined)?.href ?? '';
      out = `[${out}](${href})`;
    }
    return out;
  };

  switch (node.type) {
    case 'text':
      return marks(node.text ?? '', node);
    case 'paragraph': {
      const inner = (node.content ?? []).map((c) => nodeToMd(c, depth)).join('');
      return inner;
    }
    case 'heading': {
      const level = ((node.attrs as { level?: number } | undefined)?.level ?? 1);
      const inner = (node.content ?? []).map((c) => nodeToMd(c, depth)).join('');
      return `${'#'.repeat(level)} ${inner}`;
    }
    case 'bulletList': {
      return (node.content ?? []).map((c) => `- ${nodeToMd(c, depth + 1).trim()}`).join('\n');
    }
    case 'orderedList': {
      return (node.content ?? [])
        .map((c, idx) => `${idx + 1}. ${nodeToMd(c, depth + 1).trim()}`)
        .join('\n');
    }
    case 'listItem': {
      return (node.content ?? []).map((c) => nodeToMd(c, depth)).join(' ');
    }
    case 'blockquote': {
      const inner = (node.content ?? []).map((c) => nodeToMd(c, depth)).join('\n');
      return inner.split('\n').map((l) => `> ${l}`).join('\n');
    }
    case 'hardBreak':
      return '  \n';
    case 'image': {
      const attrs = node.attrs as { src?: string; alt?: string } | undefined;
      return `![${attrs?.alt ?? ''}](${attrs?.src ?? ''})`;
    }
    case 'videoEmbed': {
      const attrs = node.attrs as { src?: string; provider?: string } | undefined;
      return `\n${attrs?.src ?? ''}\n`;
    }
    default:
      // Unknown node — drop it rather than crash.
      return (node.content ?? []).map((c) => nodeToMd(c, depth)).join('');
  }
}
