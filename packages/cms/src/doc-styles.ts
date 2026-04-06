// @kunacademy/cms — Doc Styles
// Maps semantic HTML tags → Tailwind/shadcn classes using the brand design system.
// All CSS custom properties reference globals.css tokens (Tailwind v4).
//
// Task 9.1d: Class maps + applyDocStyles() transformer
// Task 9.1e: RTL support via dir="auto" container + logical CSS properties

// ── Tailwind class maps ─────────────────────────────────────────────────────

/**
 * Class maps keyed by HTML tag name.
 * Values are Tailwind utility strings that work with the existing design system.
 * CSS custom properties (--color-primary, --text-section, etc.) come from globals.css.
 */
export const DOC_CLASS_MAP: Readonly<Record<string, string>> = {
  // Headings — map to the established typography scale
  // font-size for h1–h4 is set via .kun-doc-prose h* rules in globals.css
  // (Tailwind v4 does not generate CSS for text-[var(--token)] arbitrary values)
  h1: [
    'font-bold',
    'leading-tight',
    'text-[var(--text-primary)]',
    'mt-8',
    'mb-4',
    'first:mt-0',
    'text-wrap-balance',
  ].join(' '),

  h2: [
    'font-bold',
    'leading-tight',
    'text-[var(--text-primary)]',
    'mt-7',
    'mb-3',
    'first:mt-0',
    'text-wrap-balance',
  ].join(' '),

  h3: [
    'font-semibold',
    'leading-snug',
    'text-[var(--text-primary)]',
    'mt-6',
    'mb-2',
  ].join(' '),

  h4: [
    'font-semibold',
    'leading-snug',
    'text-[var(--text-accent)]',
    'mt-5',
    'mb-2',
  ].join(' '),

  // Body text
  p: [
    'text-[var(--text-body)]',
    'leading-relaxed',
    'text-[var(--text-primary)]',
    'mb-4',
    'last:mb-0',
  ].join(' '),

  // Lists — logical properties for RTL support
  ul: [
    'list-disc',
    'ps-6',       // padding-inline-start: 1.5rem (RTL-aware)
    'mb-4',
    'space-y-1',
    'text-[var(--text-body)]',
    'text-[var(--text-primary)]',
  ].join(' '),

  ol: [
    'list-decimal',
    'ps-6',       // padding-inline-start: RTL-aware
    'mb-4',
    'space-y-1',
    'text-[var(--text-body)]',
    'text-[var(--text-primary)]',
  ].join(' '),

  li: [
    'leading-relaxed',
    'marker:text-[var(--color-primary)]',
  ].join(' '),

  // Links — brand primary color, animated underline
  a: [
    'text-[var(--color-primary)]',
    'underline',
    'underline-offset-2',
    'decoration-[var(--color-primary-200)]',
    'hover:decoration-[var(--color-primary)]',
    'transition-colors',
    'duration-200',
    'font-medium',
  ].join(' '),

  // Inline formatting
  strong: 'font-semibold text-[var(--text-primary)]',
  em: 'italic text-[var(--text-muted)]',
  u: 'underline underline-offset-2',

  // Blockquote
  blockquote: [
    'border-s-4',              // border-inline-start: RTL-aware
    'border-[var(--color-primary-200)]',
    'ps-4',
    'py-2',
    'my-4',
    'italic',
    'text-[var(--text-muted)]',
    'bg-[var(--color-primary-50)]',
    'rounded-e-lg',            // border-radius on inline-end side
  ].join(' '),

  // Tables — responsive wrapper applied programmatically
  table: [
    'w-full',
    'border-collapse',
    'text-[var(--text-body)]',
    'text-[var(--text-primary)]',
    'my-4',
  ].join(' '),

  th: [
    'bg-[var(--color-primary-50)]',
    'text-[var(--color-primary-700)]',
    'font-semibold',
    'px-4',
    'py-3',
    'border',
    'border-[var(--color-neutral-300)]',
    'text-start',             // logical text-align: RTL-aware
  ].join(' '),

  td: [
    'px-4',
    'py-3',
    'border',
    'border-[var(--color-neutral-300)]',
    'align-top',
    'text-start',             // logical text-align: RTL-aware
  ].join(' '),

  tr: 'even:bg-[var(--color-neutral-50)] hover:bg-[var(--color-primary-50)] transition-colors duration-150',

  // Images — constrained width, float beside text on desktop
  img: [
    'max-w-md',           // max ~448px — smaller than container but not tiny
    'h-auto',
    'rounded-lg',
    'my-6',
    'sm:float-start',     // float inline-start (left in LTR, right in RTL)
    'sm:me-6',            // margin-inline-end: spacing between image and text
    'sm:mb-4',            // bottom margin when floated
  ].join(' '),
};

// ── Callout aside classes ───────────────────────────────────────────────────

/** Maps aside className → Tailwind classes for the callout box */
export const CALLOUT_CLASS_MAP: Readonly<Record<string, string>> = {
  // 📖 Heritage/traditional knowledge
  'callout-heritage': [
    'relative',
    'border-s-4',
    'border-[var(--color-primary)]',
    'bg-[var(--color-primary-50)]',
    'rounded-e-lg',
    'ps-5',
    'pe-4',
    'py-3',
    'my-4',
    'text-[var(--text-body)]',
    'text-[var(--color-primary-800)]',
  ].join(' '),

  // 💡 Key insight
  'callout-insight': [
    'relative',
    'border-s-4',
    'border-[var(--color-accent)]',
    'bg-[var(--color-accent-50)]',
    'rounded-e-lg',
    'ps-5',
    'pe-4',
    'py-3',
    'my-4',
    'text-[var(--text-body)]',
    'text-[var(--color-accent-800)]',
  ].join(' '),

  // ⚠️ Warning/caution
  'callout-warning': [
    'relative',
    'border-s-4',
    'border-amber-500',
    'bg-amber-50',
    'rounded-e-lg',
    'ps-5',
    'pe-4',
    'py-3',
    'my-4',
    'text-[var(--text-body)]',
    'text-amber-900',
  ].join(' '),

  // ✅ Success/best practice
  'callout-success': [
    'relative',
    'border-s-4',
    'border-emerald-600',
    'bg-emerald-50',
    'rounded-e-lg',
    'ps-5',
    'pe-4',
    'py-3',
    'my-4',
    'text-[var(--text-body)]',
    'text-emerald-900',
  ].join(' '),

  // 🔑 Key takeaway
  'callout-key': [
    'relative',
    'border-s-4',
    'border-[var(--color-secondary-500)]',
    'bg-[var(--color-secondary-50)]',
    'rounded-e-lg',
    'ps-5',
    'pe-4',
    'py-3',
    'my-4',
    'text-[var(--text-body)]',
    'text-[var(--color-secondary-800)]',
  ].join(' '),

  // ⏸️ Pause & Reflect / توقّف وتأمّل — amber accent, italic prompt
  'callout-pause': [
    'relative',
    'border-s-4',
    'border-amber-400',
    'bg-amber-50',
    'rounded-e-lg',
    'ps-5',
    'pe-4',
    'py-3',
    'my-4',
    'italic',
    'text-[var(--text-body)]',
    'text-amber-900',
  ].join(' '),

  // 🔬 Try It Now / جرّب بنفسك — green accent, exercise prompt
  'callout-exercise': [
    'relative',
    'border-s-4',
    'border-emerald-500',
    'bg-emerald-50',
    'rounded-e-lg',
    'ps-5',
    'pe-4',
    'py-3',
    'my-4',
    'text-[var(--text-body)]',
    'text-emerald-900',
  ].join(' '),
};

// ── applyDocStyles ──────────────────────────────────────────────────────────

/**
 * Transform raw semantic HTML (from google-docs-fetcher) into styled HTML by
 * injecting Tailwind/brand classes onto each element.
 *
 * This is a lightweight string-based transformer that avoids a full DOM parse
 * on the server. It works on the predictable, sanitized output from our own
 * documentToHtml() function — not arbitrary user HTML.
 *
 * Task 9.1d: class injection
 * Task 9.1e: wraps output in a dir="auto" container for bilingual RTL support
 *
 * @param html - Sanitized semantic HTML string
 * @returns Styled HTML wrapped in a brand-ready prose container
 */
export function applyDocStyles(html: string): string {
  if (!html) return '';

  let styled = html;

  // Apply element classes via regex-based attribute injection.
  // Pattern: matches opening tag, optionally with existing attributes.
  // We inject class="" before the first space or closing >.

  for (const [tag, classes] of Object.entries(DOC_CLASS_MAP)) {
    // Only replace opening tags (not self-closing img handled separately)
    styled = injectClass(styled, tag, classes);
  }

  // Apply callout aside classes
  for (const [calloutClass, classes] of Object.entries(CALLOUT_CLASS_MAP)) {
    styled = styled.replace(
      new RegExp(`<aside class="${calloutClass}">`, 'g'),
      `<aside class="${calloutClass} ${classes}">`
    );
  }

  // Wrap tables in a responsive overflow container
  styled = styled.replace(
    /<table /g,
    '<div class="overflow-x-auto my-4 rounded-lg border border-[var(--color-neutral-300)] shadow-sm"><table '
  );
  styled = styled.replace(/<\/table>/g, '</table></div>');

  // Wrap in prose container — direction is set by DocRenderer's outer wrapper,
  // NOT here, because dir="auto" misdetects mixed-script content (e.g. "GPS الحياة"
  // starts with Latin → whole container becomes LTR). Removing dir lets the
  // parent's explicit dir="rtl" or dir="ltr" cascade correctly.
  return `<div class="kun-doc-prose">\n${styled}\n<div class="clear-both"></div>\n</div>`;
}

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Inject a Tailwind class string into every opening <tag> in an HTML string.
 * Handles:
 *   <tag>           → <tag class="...">
 *   <tag attr="x"> → <tag attr="x" class="...">
 * Does NOT touch closing tags or already-classed tags from callout processing.
 */
function injectClass(html: string, tag: string, classes: string): string {
  // Match <tag> or <tag ...> but not </tag> or <tagname> (ensure word boundary)
  const pattern = new RegExp(`<(${tag})(\\s[^>]*)?>`, 'gi');
  return html.replace(pattern, (_match, tagName: string, attrs?: string) => {
    const existingAttrs = attrs ?? '';
    // Don't double-inject if this tag already has classes from callout pass
    if (existingAttrs.includes('class=')) {
      return `<${tagName}${existingAttrs}>`;
    }
    return `<${tagName}${existingAttrs} class="${classes}">`;
  });
}
