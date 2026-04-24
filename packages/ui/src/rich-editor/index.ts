/**
 * @kunacademy/ui/rich-editor — Barrel export.
 *
 * Import the editor via next/dynamic to keep the TipTap bundle (~80KB) off
 * public pages:
 *
 *   import dynamic from 'next/dynamic';
 *   const RichEditor = dynamic(
 *     () => import('@kunacademy/ui/rich-editor').then((m) => m.RichEditor),
 *     { ssr: false },
 *   );
 *
 * The public renderer (RichContent) is a server component and ships zero
 * JavaScript, so it's safe to import directly:
 *
 *   import { RichContent } from '@kunacademy/ui/rich-editor';
 */

// Editor (client, 'use client' in rich-editor.tsx)
export {
  RichEditor,
  EMPTY_RICH_DOC,
  type RichEditorProps,
  type RichEditorLocale,
  type RichEditorExtensions,
} from './rich-editor';

// Bilingual editor (client)
export {
  BilingualRichEditor,
  EMPTY_BILINGUAL_DOC,
  type BilingualRichDoc,
  type BilingualRichEditorProps,
} from './bilingual-rich-editor';

// Public renderer (server — dangerouslySetInnerHTML after sanitize)
export {
  RichContent,
  RichContentBilingual,
  extractPlainText,
  type RichContentProps,
  type RichContentBilingualProps,
} from './rich-content';

// Sanitizer (server/edge utility — exported for external callers that need
// to sanitize rendered HTML from non-TipTap sources, e.g. markdown-derived
// content or the agent content API)
export {
  sanitizeRichHtml,
  isSafeUrl,
  parseVideoEmbed,
  type VideoEmbed,
} from './sanitizer';
