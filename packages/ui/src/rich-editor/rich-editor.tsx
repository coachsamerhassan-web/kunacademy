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
import { Node, mergeAttributes } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';
import { useCallback, useEffect, useState } from 'react';
import { parseVideoEmbed } from './sanitizer';

// ── Custom VideoEmbed Node ──────────────────────────────────────────────────
// Declarative TipTap node for a video iframe. Stores normalized `src`,
// `provider` and `title` in the JSON document; renders a responsive iframe
// at display time. The sanitizer re-validates src + enforces sandbox, so
// even if malicious JSON were inserted out-of-band, the render path is safe.
const VideoEmbedNode = Node.create({
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

function RichEditorToolbar({
  editor,
  locale,
  ext,
  onImagePick,
}: RichEditorToolbarProps) {
  const L = LABELS[locale];
  const [gdriveHint, setGdriveHint] = useState<string | null>(null);

  const handleLink = useCallback(() => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(L.linkPrompt, prev ?? 'https://');
    if (url === null) return; // cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    // Only allow http(s)://, mailto:, tel:, #anchor, /same-origin
    if (!/^(?:https?:\/\/|mailto:|tel:|#|\/[^/\\])/.test(url)) {
      return; // silently reject — the linkPrompt already displayed; user can retry
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run();
  }, [editor, L.linkPrompt]);

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
      // Auto-dismiss after 10s so it doesn't linger
      setTimeout(() => setGdriveHint(null), 10000);
    }
  }, [editor, L.videoPrompt, L.videoInvalid, L.videoGdriveHint]);

  const handleImage = useCallback(async () => {
    if (!onImagePick) {
      // Fallback: prompt for URL (developer mode / no media library wired yet)
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
    editor
      .chain()
      .focus()
      .setImage({ src: pick.url, alt: pick.alt ?? '' })
      .run();
  }, [editor, locale, onImagePick]);

  const btn = (
    key: string,
    active: boolean,
    disabled: boolean,
    onClick: () => void,
    label: string,
    icon: string,
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rich-editor-btn ${active ? 'is-active' : ''}`}
    >
      {icon}
    </button>
  );

  return (
    <>
      <div
        className="rich-editor-toolbar"
        role="toolbar"
        aria-label={locale === 'ar' ? 'شريط أدوات التحرير' : 'Editor toolbar'}
      >
        {btn(
          'bold',
          editor.isActive('bold'),
          !editor.can().toggleBold(),
          () => editor.chain().focus().toggleBold().run(),
          L.bold,
          'B',
        )}
        {btn(
          'italic',
          editor.isActive('italic'),
          !editor.can().toggleItalic(),
          () => editor.chain().focus().toggleItalic().run(),
          L.italic,
          'I',
        )}
        {btn(
          'strike',
          editor.isActive('strike'),
          !editor.can().toggleStrike(),
          () => editor.chain().focus().toggleStrike().run(),
          L.strike,
          'S',
        )}

        {ext.headings && (
          <>
            <span className="rich-editor-divider" aria-hidden />
            {btn(
              'h1',
              editor.isActive('heading', { level: 1 }),
              false,
              () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
              L.h1,
              'H1',
            )}
            {btn(
              'h2',
              editor.isActive('heading', { level: 2 }),
              false,
              () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
              L.h2,
              'H2',
            )}
            {btn(
              'h3',
              editor.isActive('heading', { level: 3 }),
              false,
              () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
              L.h3,
              'H3',
            )}
            {btn(
              'p',
              editor.isActive('paragraph'),
              false,
              () => editor.chain().focus().setParagraph().run(),
              L.paragraph,
              '¶',
            )}
          </>
        )}

        {ext.lists && (
          <>
            <span className="rich-editor-divider" aria-hidden />
            {btn(
              'ul',
              editor.isActive('bulletList'),
              false,
              () => editor.chain().focus().toggleBulletList().run(),
              L.bulletList,
              '•',
            )}
            {btn(
              'ol',
              editor.isActive('orderedList'),
              false,
              () => editor.chain().focus().toggleOrderedList().run(),
              L.orderedList,
              '1.',
            )}
          </>
        )}

        {ext.blockquote && (
          <>
            <span className="rich-editor-divider" aria-hidden />
            {btn(
              'bq',
              editor.isActive('blockquote'),
              false,
              () => editor.chain().focus().toggleBlockquote().run(),
              L.blockquote,
              '“”',
            )}
          </>
        )}

        {ext.link && (
          <>
            <span className="rich-editor-divider" aria-hidden />
            {btn(
              'link',
              editor.isActive('link'),
              false,
              handleLink,
              L.link,
              '🔗',
            )}
            {editor.isActive('link') &&
              btn(
                'unlink',
                false,
                false,
                () => editor.chain().focus().unsetLink().run(),
                L.removeLink,
                '✕🔗',
              )}
          </>
        )}

        {ext.image && (
          <>
            <span className="rich-editor-divider" aria-hidden />
            {btn('img', false, false, handleImage, L.image, '🖼')}
          </>
        )}

        {ext.video && (
          <>{btn('video', false, false, handleVideo, L.video, '▶')}</>
        )}

        {ext.alignment && (
          <>
            <span className="rich-editor-divider" aria-hidden />
            {btn(
              'al-left',
              editor.isActive({ textAlign: 'left' }),
              false,
              () => editor.chain().focus().setTextAlign('left').run(),
              L.alignLeft,
              '⇤',
            )}
            {btn(
              'al-center',
              editor.isActive({ textAlign: 'center' }),
              false,
              () => editor.chain().focus().setTextAlign('center').run(),
              L.alignCenter,
              '≡',
            )}
            {btn(
              'al-right',
              editor.isActive({ textAlign: 'right' }),
              false,
              () => editor.chain().focus().setTextAlign('right').run(),
              L.alignRight,
              '⇥',
            )}
          </>
        )}

        <span className="rich-editor-divider" aria-hidden />
        {btn(
          'undo',
          false,
          !editor.can().undo(),
          () => editor.chain().focus().undo().run(),
          L.undo,
          '↶',
        )}
        {btn(
          'redo',
          false,
          !editor.can().redo(),
          () => editor.chain().focus().redo().run(),
          L.redo,
          '↷',
        )}
        {btn(
          'clear',
          false,
          false,
          () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
          L.clearFormatting,
          '✕',
        )}
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
        </div>
      )}
    </>
  );
}
