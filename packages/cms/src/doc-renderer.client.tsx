// @kunacademy/cms — DocRenderer React Component (Client-safe)
// Renders sanitized, styled Google Doc HTML safely inside a React tree.
//
// The HTML arriving here has already been:
//   1. Converted from Google Docs JSON to semantic HTML
//   2. Callout-parsed (emoji → <aside class="callout-*">)
//   3. Style-stripped (no inline style="" attributes)
//   4. XSS-sanitized (isomorphic-dompurify, server-side)
//   5. Branded (Tailwind classes injected by applyDocStyles)
//   6. Wrapped in dir="auto" container for RTL support
//
// Using dangerouslySetInnerHTML here is intentional and SAFE because:
//   - All HTML was sanitized server-side before caching
//   - DOMPurify allowlist permits only whitelisted tags and attributes
//   - No user-supplied strings bypass this pipeline

import React from 'react';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DocRendererProps {
  /** Pre-processed HTML from fetchDocAsHtml() — already sanitized + styled */
  html: string | null | undefined;
  /** Additional class names to apply to the outer wrapper */
  className?: string;
  /**
   * Explicit locale hint for font selection.
   * 'auto' (default) relies on dir="auto" detection inside the HTML.
   * Pass 'ar' or 'en' to force font family at the wrapper level.
   */
  locale?: 'ar' | 'en' | 'auto';
  /** Fallback content when html is null/empty */
  fallback?: React.ReactNode;
}

// ── Locale font classes ───────────────────────────────────────────────────────

const LOCALE_FONT_CLASS: Record<'ar' | 'en' | 'auto', string> = {
  auto: '',
  ar: 'font-[var(--font-arabic-body)] leading-[1.8] text-justify',
  en: 'font-[var(--font-english-body)] leading-[1.7] text-justify',
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * DocRenderer — renders a Google Doc as branded, RTL-aware HTML.
 *
 * Usage:
 *   const html = await fetchDocAsHtml(docId);
 *   <DocRenderer html={html} />
 *
 * With locale hint (forces Arabic font family):
 *   <DocRenderer html={html} locale="ar" />
 */
export function DocRenderer({
  html,
  className,
  locale = 'auto',
  fallback = null,
}: DocRendererProps): React.ReactElement | null {
  if (!html) {
    return fallback ? <>{fallback}</> : null;
  }

  const localeClass = LOCALE_FONT_CLASS[locale];

  return (
    <div
      dir={locale === 'ar' ? 'rtl' : locale === 'en' ? 'ltr' : undefined}
      className={[
        'kun-doc-wrapper',
        // Full width — parent page controls the container width, not us
        'w-full',
        // Consecutive images: clear float so they stack vertically, not side-by-side
        '[&_img+img]:clear-both [&_img+img]:float-none [&_img+img]:mx-auto',
        // Clear floats before callouts and blockquotes
        '[&_aside]:clear-both [&_blockquote]:clear-both',
        localeClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML pre-sanitized server-side
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
