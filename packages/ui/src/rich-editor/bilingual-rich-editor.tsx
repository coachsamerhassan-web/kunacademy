'use client';

/**
 * BilingualRichEditor — two RichEditor instances side-by-side for Arabic +
 * English authoring. Used wherever content is bilingual (LP descriptions,
 * blog posts, program copy, coach bio, Ihya long-form).
 *
 * Shape:
 *   +------------------------+  +------------------------+
 *   | [العربية]  [tab btns]  |  | [English]  [tab btns]  |
 *   |------------------------|  |------------------------|
 *   | Arabic editor (rtl)    |  | English editor (ltr)   |
 *   +------------------------+  +------------------------+
 *
 * On mobile the two stack vertically (Arabic on top, consistent with our
 * brand's AR-primary reading order).
 *
 * Props:
 *   - value: { ar, en } both TipTap JSON documents
 *   - onChange: called with the whole { ar, en } shape whenever either side
 *     changes. Tiny debounce optional in caller; component is uncontrolled in
 *     that it fires on every keystroke.
 *   - extensions, onImagePick, maxHeight: forwarded to both panes
 *   - labelAr, labelEn: header copy (e.g. "العنوان — عربي" / "Title — EN")
 *   - readOnly: disables both panes
 */

import type { JSONContent } from '@tiptap/react';
import { RichEditor, EMPTY_RICH_DOC } from './rich-editor';
import type { RichEditorProps, RichEditorExtensions } from './rich-editor';

export interface BilingualRichDoc {
  ar: JSONContent | null;
  en: JSONContent | null;
}

export interface BilingualRichEditorProps {
  value: BilingualRichDoc | null;
  onChange: (value: BilingualRichDoc) => void;
  labelAr?: string;
  labelEn?: string;
  placeholderAr?: string;
  placeholderEn?: string;
  extensions?: RichEditorExtensions;
  maxHeight?: string;
  onImagePick?: RichEditorProps['onImagePick'];
  readOnly?: boolean;
  /** Stack orientation: 'side-by-side' (default on desktop) | 'stacked' (always vertical).
   *  If 'side-by-side', a CSS breakpoint collapses to stacked on <768px. */
  orientation?: 'side-by-side' | 'stacked';
}

export function BilingualRichEditor({
  value,
  onChange,
  labelAr,
  labelEn,
  placeholderAr,
  placeholderEn,
  extensions,
  maxHeight,
  onImagePick,
  readOnly = false,
  orientation = 'side-by-side',
}: BilingualRichEditorProps) {
  const docAr = value?.ar ?? EMPTY_RICH_DOC;
  const docEn = value?.en ?? EMPTY_RICH_DOC;

  const handleArChange = (next: JSONContent) => {
    onChange({ ar: next, en: value?.en ?? null });
  };
  const handleEnChange = (next: JSONContent) => {
    onChange({ ar: value?.ar ?? null, en: next });
  };

  const isSideBySide = orientation === 'side-by-side';

  return (
    <div
      className={`bilingual-rich-editor ${isSideBySide ? 'is-side-by-side' : 'is-stacked'}`}
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: isSideBySide ? 'repeat(2, minmax(0, 1fr))' : '1fr',
      }}
      data-orientation={orientation}
    >
      <BilingualPane
        locale="ar"
        label={labelAr ?? 'العربية'}
        value={docAr}
        onChange={handleArChange}
        placeholder={placeholderAr}
        extensions={extensions}
        maxHeight={maxHeight}
        onImagePick={onImagePick}
        readOnly={readOnly}
      />
      <BilingualPane
        locale="en"
        label={labelEn ?? 'English'}
        value={docEn}
        onChange={handleEnChange}
        placeholder={placeholderEn}
        extensions={extensions}
        maxHeight={maxHeight}
        onImagePick={onImagePick}
        readOnly={readOnly}
      />
    </div>
  );
}

// ── Single pane wrapper (label + RichEditor) ───────────────────────────────
interface BilingualPaneProps {
  locale: 'ar' | 'en';
  label: string;
  value: JSONContent;
  onChange: (value: JSONContent) => void;
  placeholder?: string;
  extensions?: RichEditorExtensions;
  maxHeight?: string;
  onImagePick?: RichEditorProps['onImagePick'];
  readOnly?: boolean;
}

function BilingualPane({
  locale,
  label,
  value,
  onChange,
  placeholder,
  extensions,
  maxHeight,
  onImagePick,
  readOnly,
}: BilingualPaneProps) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <div
      className={`bilingual-rich-pane bilingual-rich-pane-${locale}`}
      dir={dir}
      lang={locale}
    >
      <div
        className="bilingual-rich-pane-label"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-neutral-700, #5D5F62)',
          marginBottom: 6,
          letterSpacing: locale === 'en' ? '0.02em' : 0,
        }}
      >
        {label}
      </div>
      <RichEditor
        value={value}
        onChange={onChange}
        locale={locale}
        placeholder={placeholder}
        extensions={extensions}
        maxHeight={maxHeight}
        onImagePick={onImagePick}
        readOnly={readOnly}
      />
    </div>
  );
}

/** Empty bilingual doc — safe default for new records. */
export const EMPTY_BILINGUAL_DOC: BilingualRichDoc = {
  ar: EMPTY_RICH_DOC,
  en: EMPTY_RICH_DOC,
};
