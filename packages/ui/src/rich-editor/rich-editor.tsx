'use client';

/**
 * RichEditor — TipTap-powered headless rich-text editor for Wave 15.
 *
 * GLOBAL component. Usable across: LP admin, blog post admin, coach/instructor
 * bio admin, Ihya long-form authoring, program copy admin, pathfinder blocks,
 * and any future content-editing surface.
 *
 * Props:
 *   - value:      TipTap JSON document (stored as-is in DB JSONB)
 *   - onChange:   called with fresh JSON on every edit
 *   - locale:     'ar' | 'en' — drives `dir` attribute + toolbar labels
 *   - placeholder (optional)
 *   - extensions  (optional): opt-in subset to narrow toolbar (future)
 *   - maxHeight   (optional): CSS value for scroll container
 *
 * Output shape: TipTap JSON. To render publicly, use the companion
 * <RichContent> component which calls `generateHTML()` + `sanitizeRichHtml()`.
 *
 * IMPORTANT: This file has 'use client'. Consumer pages should dynamic-import
 * it via next/dynamic to keep the ~80KB TipTap bundle off public pages:
 *
 *   const RichEditor = dynamic(
 *     () => import('@kunacademy/ui/rich-editor').then(m => m.RichEditor),
 *     { ssr: false }
 *   );
 */

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseVideoEmbed } from './sanitizer';
import {
  Bold as IBold,
  Italic as IItalic,
  Strikethrough as IStrike,
  Link2 as ILink,
  Link2Off as IUnlink,
  Quote as IBlockquote,
  Heading2 as IH2,
  Heading3 as IH3,
  Heading4 as IH4,
  List as IUL,
  ListOrdered as IOL,
  AlignLeft as IAL,
  AlignCenter as IAC,
  AlignRight as IAR,
  Image as IImage,
  Video as IVideo,
  Undo2 as IUndo,
  Redo2 as IRedo,
  MoreHorizontal as IMore,
  X as IX,
  Eraser as IClear,
} from 'lucide-react';

// ── Custom VideoEmbed Node ──────────────────────────────────────────────────
// Declarative TipTap node for a video iframe. Stores normalized `src`,
// `provider` and `title` in the JSON document; renders a responsive iframe
// at display time. The sanitizer re-validates src + enforces sandbox, so
// even if malicious JSON were inserted out-of-band, the render path is safe.
const VideoEmbedNode = TiptapNode.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true, // not editable inline; select-as-a-whole
  draggable: true,
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

// ── Public types + defaults ─────────────────────────────────────────────────
export type RichEditorLocale = 'ar' | 'en';

/** Empty TipTap document — safe default for a freshly-opened editor. */
export const EMPTY_RICH_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

/** Opt-in extension groups. Default = all MVP features enabled. */
export interface RichEditorExtensions {
  headings?: boolean;       // H1, H2, H3 (default true)
  lists?: boolean;          // ul, ol (default true)
  blockquote?: boolean;     // (default true)
  link?: boolean;           // (default true)
  image?: boolean;          // (default true) — wires to onImageUpload
  video?: boolean;          // (default true) — prompts for URL, parses provider
  alignment?: boolean;      // (default true) — left/right/center via data-align
}

export interface RichEditorProps {
  value: JSONContent | null;
  onChange: (value: JSONContent) => void;
  locale: RichEditorLocale;
  placeholder?: string;
  extensions?: RichEditorExtensions;
  maxHeight?: string;
  /** Called when the user clicks the image button. Should open an image
   *  picker (Wave 14b/15 media library) and resolve with the chosen image's
   *  public URL + alt_{locale}. Returning null means the user cancelled. */
  onImagePick?: (locale: RichEditorLocale) => Promise<{ url: string; alt?: string } | null>;
  /** Disable the whole editor (read-only). */
  readOnly?: boolean;
}

// ── Editor + toolbar ────────────────────────────────────────────────────────
export function RichEditor({
  value,
  onChange,
  locale,
  placeholder,
  extensions = {},
  maxHeight = '480px',
  onImagePick,
  readOnly = false,
}: RichEditorProps) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const ext = {
    headings: extensions.headings !== false,
    lists: extensions.lists !== false,
    blockquote: extensions.blockquote !== false,
    link: extensions.link !== false,
    image: extensions.image !== false,
    video: extensions.video !== false,
    alignment: extensions.alignment !== false,
  };

  const editor = useEditor({
    // next/dynamic + TipTap's own SSR handling: immediatelyRender must be
    // false so the editor waits for client hydration. Without this, Next.js
    // reports a hydration mismatch.
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        heading: ext.headings ? { levels: [1, 2, 3] } : false,
        bulletList: ext.lists ? {} : false,
        orderedList: ext.lists ? {} : false,
        blockquote: ext.blockquote ? {} : false,
        // Disable code features — we don't want authors pasting in <code>
        // with HTML entities that confuse the sanitizer.
        code: false,
        codeBlock: false,
      }),
      ext.link
        ? Link.configure({
            openOnClick: false,
            autolink: true,
            HTMLAttributes: {
              rel: 'noopener noreferrer',
              target: '_blank',
            },
          })
        : null,
      ext.image
        ? Image.configure({
            inline: false,
            allowBase64: false, // base64 uploads get rejected — must go through the media endpoint
            HTMLAttributes: {
              loading: 'lazy',
              decoding: 'async',
            },
          })
        : null,
      ext.alignment
        ? TextAlign.configure({
            types: ['heading', 'paragraph'],
            // Emit as `text-align` CSS initially — the sanitizer converts it
            // to a `data-align` attr via a post-pass so sanitizer can strip
            // `style` attr wholesale (CSS injection surface).
            alignments: ['left', 'center', 'right'],
            defaultAlignment: locale === 'ar' ? 'right' : 'left',
          })
        : null,
      ext.video ? VideoEmbedNode : null,
    ].filter((x): x is NonNullable<typeof x> => x !== null),
    content: value ?? EMPTY_RICH_DOC,
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON());
    },
    editorProps: {
      attributes: {
        class: 'rich-editor-content',
        dir,
        lang: locale,
        style: `min-height: 240px; max-height: ${maxHeight}; overflow-y: auto; padding: 16px; outline: none;`,
        'data-placeholder': placeholder ?? '',
      },
    },
  });

  // When `value` changes externally (e.g. form reset, load from server),
  // sync the editor. Skip if the content is already identical to avoid
  // an infinite loop.
  useEffect(() => {
    if (!editor) return;
    if (!value) return;
    const current = editor.getJSON();
    // Stringify is a coarse comparison but safe — both are plain data.
    if (JSON.stringify(current) === JSON.stringify(value)) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className="rich-editor-skeleton"
        style={{
          minHeight: 240,
          padding: 16,
          background: 'var(--color-neutral-50, #F7F7F8)',
          borderRadius: 12,
          color: 'var(--color-neutral-500, #757578)',
          fontStyle: 'italic',
        }}
        dir={dir}
      >
        {locale === 'ar' ? 'جارٍ التحميل…' : 'Loading editor…'}
      </div>
    );
  }

  return (
    <div className="rich-editor" dir={dir} lang={locale}>
      <RichEditorToolbar
        editor={editor}
        locale={locale}
        ext={ext}
        onImagePick={onImagePick}
      />
      <EditorContent editor={editor} />
    </div>
  );
}

// ── Toolbar ─────────────────────────────────────────────────────────────────
interface ToolbarLabels {
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  h1: string;
  h2: string;
  h3: string;
  paragraph: string;
  bulletList: string;
  orderedList: string;
  blockquote: string;
  link: string;
  linkPrompt: string;
  image: string;
  video: string;
  videoPrompt: string;
  videoInvalid: string;
  videoGdriveHint: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  undo: string;
  redo: string;
  clearFormatting: string;
  removeLink: string;
}

const LABELS: Record<RichEditorLocale, ToolbarLabels> = {
  ar: {
    bold: 'عريض',
    italic: 'مائل',
    underline: 'تسطير',
    strike: 'شطب',
    h1: 'عنوان 1',
    h2: 'عنوان 2',
    h3: 'عنوان 3',
    paragraph: 'فقرة',
    bulletList: 'قائمة نقطية',
    orderedList: 'قائمة مرقّمة',
    blockquote: 'اقتباس',
    link: 'رابط',
    linkPrompt: 'أدخل الرابط:',
    image: 'صورة',
    video: 'فيديو',
    videoPrompt: 'أدخل رابط YouTube أو Vimeo أو Loom أو Google Drive:',
    videoInvalid: 'رابط غير مدعوم. مقبول فقط: YouTube · Vimeo · Loom · Google Drive.',
    videoGdriveHint:
      'ملاحظة: تأكّد أن ملف Google Drive مضبوط على صلاحية «Anyone with the link» كي يعمل التضمين.',
    alignLeft: 'محاذاة لليسار',
    alignCenter: 'محاذاة للمنتصف',
    alignRight: 'محاذاة لليمين',
    undo: 'تراجع',
    redo: 'إعادة',
    clearFormatting: 'مسح التنسيق',
    removeLink: 'إزالة الرابط',
  },
  en: {
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    strike: 'Strikethrough',
    h1: 'Heading 1',
    h2: 'Heading 2',
    h3: 'Heading 3',
    paragraph: 'Paragraph',
    bulletList: 'Bullet list',
    orderedList: 'Numbered list',
    blockquote: 'Quote',
    link: 'Link',
    linkPrompt: 'Enter URL:',
    image: 'Image',
    video: 'Video',
    videoPrompt: 'Paste a YouTube, Vimeo, Loom or Google Drive URL:',
    videoInvalid: 'Unsupported URL. Accepted: YouTube · Vimeo · Loom · Google Drive.',
    videoGdriveHint:
      'Tip: make sure the Google Drive file is set to "Anyone with the link" viewer permission, otherwise the embed will fail.',
    alignLeft: 'Align left',
    alignCenter: 'Align center',
    alignRight: 'Align right',
    undo: 'Undo',
    redo: 'Redo',
    clearFormatting: 'Clear formatting',
    removeLink: 'Remove link',
  },
};

interface RichEditorToolbarProps {
  editor: Editor;
  locale: RichEditorLocale;
  ext: Required<RichEditorExtensions>;
  onImagePick?: RichEditorProps['onImagePick'];
}

/**
 * Wave 15 W3 canary v2 — RichEditorToolbar redesigned per WP Gutenberg
 * grouping convention. See `Workspace/CTO/output/2026-04-28-wp-ux-research.md`
 * §4 (block toolbar grouping) for the lineage.
 *
 * Layout (LTR; auto-mirrored in RTL by parent dir):
 *   [Group 1: Bold · Italic · Strikethrough · Inline code]
 *     | divider |
 *   [Group 2: Link · H2 · H3 · H4 · Blockquote]
 *     | divider |
 *   [Group 3: Bullet · Numbered]
 *     | divider |
 *   [Group 4: Align Left · Align Center · Align Right] (RTL-aware)
 *     | divider |
 *   [Image] [Video]                         ← media insertion (lives in toolbar
 *                                              per Hakawati §6.3 correction)
 *     | divider |
 *   [Undo · Redo]
 *     | divider |
 *   [More menu: ··· → Strikethrough, Inline image, Subscript, Superscript,
 *                     Clear formatting]
 *
 * Sticky to the top of the editor's scroll container (CSS handles position:
 * sticky + top: 0). Tooltips on every icon button (title + aria-label).
 * Lucide icons throughout — no more text glyphs.
 */
function RichEditorToolbar({
  editor,
  locale,
  ext,
  onImagePick,
}: RichEditorToolbarProps) {
  const L = LABELS[locale];
  const [gdriveHint, setGdriveHint] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkOpenInNewTab, setLinkOpenInNewTab] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const linkRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (linkOpen && linkRef.current && !linkRef.current.contains(e.target as Node)) {
        setLinkOpen(false);
      }
      if (moreOpen && moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [linkOpen, moreOpen]);

  const handleLinkOpen = useCallback(() => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const prevTarget = editor.getAttributes('link').target as string | undefined;
    setLinkUrl(prev ?? '');
    setLinkOpenInNewTab(prevTarget !== '_self');
    setLinkOpen(true);
  }, [editor]);

  const handleLinkConfirm = useCallback(() => {
    const url = linkUrl.trim();
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (!/^(?:https?:\/\/|mailto:|tel:|#|\/[^/\\])/.test(url)) {
      return; // invalid; popover stays open so user can fix
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({
        href: url,
        target: linkOpenInNewTab ? '_blank' : '_self',
        rel: linkOpenInNewTab ? 'noopener noreferrer' : null,
      })
      .run();
    setLinkOpen(false);
  }, [editor, linkUrl, linkOpenInNewTab]);

  const handleVideo = useCallback(() => {
    const raw = window.prompt(L.videoPrompt, '');
    if (!raw) return;
    const embed = parseVideoEmbed(raw);
    if (!embed) {
      window.alert(L.videoInvalid);
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'videoEmbed',
        attrs: {
          src: embed.embedSrc,
          provider: embed.provider,
          title: embed.title,
        },
      })
      .run();
    if (embed.needsPermissionHint) {
      setGdriveHint(L.videoGdriveHint);
      setTimeout(() => setGdriveHint(null), 10000);
    }
  }, [editor, L.videoPrompt, L.videoInvalid, L.videoGdriveHint]);

  const handleImage = useCallback(async () => {
    if (!onImagePick) {
      const url = window.prompt(
        locale === 'ar' ? 'أدخل رابط الصورة:' : 'Image URL:',
        'https://',
      );
      if (!url) return;
      if (!/^https?:\/\//.test(url)) return;
      editor.chain().focus().setImage({ src: url }).run();
      return;
    }
    const pick = await onImagePick(locale);
    if (!pick) return;
    editor.chain().focus().setImage({ src: pick.url, alt: pick.alt ?? '' }).run();
  }, [editor, locale, onImagePick]);

  /** Reusable button shape — Lucide icon + tooltip + active state. */
  const IconBtn = ({
    onClick,
    active,
    disabled,
    label,
    keys,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    label: string;
    keys?: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={keys ? `${label} (${keys})` : label}
      className={`rich-editor-btn ${active ? 'is-active' : ''}`}
    >
      {children}
    </button>
  );

  // Alignment cluster — RTL-aware (logical: start/center/end).
  // Per WP UX research §4: in AR, the visual order of the 3 buttons stays
  // [Left | Center | Right] visually mirrored, but each button keeps its
  // semantic meaning. We bind to TipTap's textAlign which uses 'left' /
  // 'center' / 'right' literal directions.
  const isRtl = locale === 'ar';

  return (
    <>
      <div
        className="rich-editor-toolbar"
        role="toolbar"
        aria-label={isRtl ? 'شريط أدوات التحرير' : 'Editor toolbar'}
      >
        {/* Group 1 — Inline formatting */}
        <IconBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          disabled={!editor.can().toggleBold()}
          label={L.bold}
          keys="Ctrl+B"
        >
          <IBold size={16} />
        </IconBtn>
        <IconBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          disabled={!editor.can().toggleItalic()}
          label={L.italic}
          keys="Ctrl+I"
        >
          <IItalic size={16} />
        </IconBtn>
        <IconBtn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          disabled={!editor.can().toggleStrike()}
          label={L.strike}
          keys="Ctrl+Shift+S"
        >
          <IStrike size={16} />
        </IconBtn>

        <span className="rich-editor-divider" aria-hidden />

        {/* Group 2 — Block-level + Link */}
        {ext.link && (
          <div ref={linkRef} className="rich-editor-popover-anchor">
            <IconBtn
              onClick={handleLinkOpen}
              active={editor.isActive('link')}
              label={L.link}
              keys="Ctrl+K"
            >
              <ILink size={16} />
            </IconBtn>
            {linkOpen && (
              <div className="rich-editor-popover" role="dialog" aria-label={L.link}>
                <label className="rich-editor-popover-row">
                  <span className="rich-editor-popover-label">URL</span>
                  <input
                    type="url"
                    autoFocus
                    value={linkUrl}
                    placeholder="https://"
                    dir="ltr"
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLinkConfirm();
                      }
                      if (e.key === 'Escape') {
                        setLinkOpen(false);
                      }
                    }}
                    className="rich-editor-popover-input"
                  />
                </label>
                <label className="rich-editor-popover-row rich-editor-popover-row--checkbox">
                  <input
                    type="checkbox"
                    checked={linkOpenInNewTab}
                    onChange={(e) => setLinkOpenInNewTab(e.target.checked)}
                  />
                  <span>{isRtl ? 'فتح في تبويب جديد' : 'Open in new tab'}</span>
                </label>
                <div className="rich-editor-popover-actions">
                  {editor.isActive('link') && (
                    <button
                      type="button"
                      onClick={() => {
                        editor.chain().focus().unsetLink().run();
                        setLinkOpen(false);
                      }}
                      className="rich-editor-popover-btn rich-editor-popover-btn--danger"
                    >
                      {L.removeLink}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setLinkOpen(false)}
                    className="rich-editor-popover-btn"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLinkConfirm}
                    className="rich-editor-popover-btn rich-editor-popover-btn--primary"
                  >
                    {isRtl ? 'تطبيق' : 'Apply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {ext.headings && (
          <>
            <IconBtn
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive('heading', { level: 2 })}
              label={L.h2}
            >
              <IH2 size={16} />
            </IconBtn>
            <IconBtn
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor.isActive('heading', { level: 3 })}
              label={L.h3}
            >
              <IH3 size={16} />
            </IconBtn>
            {/* H4 — TipTap StarterKit ships levels 1-3 by default; we add H4
                via the heading-extension levels config below. Until then,
                H4 button is hidden if level 4 isn't available. */}
            {(editor.extensionManager.extensions.find((ex) => ex.name === 'heading')?.options as { levels?: number[] } | undefined)?.levels?.includes(4) && (
              <IconBtn
                onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                active={editor.isActive('heading', { level: 4 })}
                label="Heading 4"
              >
                <IH4 size={16} />
              </IconBtn>
            )}
          </>
        )}
        {ext.blockquote && (
          <IconBtn
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            label={L.blockquote}
          >
            <IBlockquote size={16} />
          </IconBtn>
        )}

        <span className="rich-editor-divider" aria-hidden />

        {/* Group 3 — Lists */}
        {ext.lists && (
          <>
            <IconBtn
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')}
              label={L.bulletList}
            >
              <IUL size={16} />
            </IconBtn>
            <IconBtn
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive('orderedList')}
              label={L.orderedList}
            >
              <IOL size={16} />
            </IconBtn>
            <span className="rich-editor-divider" aria-hidden />
          </>
        )}

        {/* Group 4 — Alignment (RTL-aware) */}
        {ext.alignment && (
          <>
            <IconBtn
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              active={editor.isActive({ textAlign: 'left' })}
              label={L.alignLeft}
            >
              <IAL size={16} />
            </IconBtn>
            <IconBtn
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              active={editor.isActive({ textAlign: 'center' })}
              label={L.alignCenter}
            >
              <IAC size={16} />
            </IconBtn>
            <IconBtn
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              active={editor.isActive({ textAlign: 'right' })}
              label={L.alignRight}
            >
              <IAR size={16} />
            </IconBtn>
            <span className="rich-editor-divider" aria-hidden />
          </>
        )}

        {/* Media insertion — lives in toolbar per Hakawati §6.3 correction */}
        {ext.image && (
          <IconBtn onClick={handleImage} label={L.image}>
            <IImage size={16} />
          </IconBtn>
        )}
        {ext.video && (
          <IconBtn onClick={handleVideo} label={L.video}>
            <IVideo size={16} />
          </IconBtn>
        )}

        <span className="rich-editor-divider" aria-hidden />

        {/* History */}
        <IconBtn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          label={L.undo}
          keys="Ctrl+Z"
        >
          <IUndo size={16} />
        </IconBtn>
        <IconBtn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          label={L.redo}
          keys="Ctrl+Shift+Z"
        >
          <IRedo size={16} />
        </IconBtn>

        <span className="rich-editor-divider" aria-hidden />

        {/* More menu — overflow per WP convention */}
        <div ref={moreRef} className="rich-editor-popover-anchor">
          <IconBtn
            onClick={() => setMoreOpen((v) => !v)}
            active={moreOpen}
            label={isRtl ? 'المزيد' : 'More'}
          >
            <IMore size={16} />
          </IconBtn>
          {moreOpen && (
            <div className="rich-editor-popover rich-editor-popover--menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="rich-editor-menu-item"
                onClick={() => {
                  editor.chain().focus().unsetAllMarks().clearNodes().run();
                  setMoreOpen(false);
                }}
              >
                <IClear size={14} />
                <span>{L.clearFormatting}</span>
              </button>
              {editor.isActive('link') && (
                <button
                  type="button"
                  role="menuitem"
                  className="rich-editor-menu-item"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setMoreOpen(false);
                  }}
                >
                  <IUnlink size={14} />
                  <span>{L.removeLink}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {gdriveHint && (
        <div
          role="status"
          className="rich-editor-hint"
          style={{
            padding: '10px 14px',
            background: 'rgba(201, 150, 58, 0.08)',
            borderInlineStart: '3px solid #C9963A',
            borderRadius: 8,
            margin: '8px 0',
            fontSize: 14,
            color: 'var(--color-neutral-700, #5D5F62)',
            lineHeight: 1.5,
          }}
        >
          {gdriveHint}
          <button
            type="button"
            onClick={() => setGdriveHint(null)}
            aria-label={isRtl ? 'إغلاق' : 'Dismiss'}
            className="rich-editor-hint-dismiss"
            style={{
              float: isRtl ? 'left' : 'right',
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              padding: 4,
              color: 'var(--color-neutral-500)',
            }}
          >
            <IX size={14} />
          </button>
        </div>
      )}
    </>
  );
}
