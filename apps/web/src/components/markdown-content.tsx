/**
 * Server-side markdown-to-HTML renderer for blog articles and editorial content.
 * Produces styled, accessible HTML with direct Tailwind classes.
 * Does NOT rely on @tailwindcss/typography (prose plugin).
 *
 * Supports: headings, bold, italic, links, images, lists, blockquotes,
 * horizontal rules (editorial section breaks), pull-quotes, paragraphs.
 */

// ── Tailwind class maps ──────────────────────────────────────────────────────
// Applied directly to generated HTML elements — no prose plugin dependency.

const CLASSES = {
  h1: 'text-2xl md:text-3xl font-bold text-[var(--text-primary)] leading-tight mt-10 mb-5 first:mt-0',
  h2: 'text-xl md:text-2xl font-bold text-[var(--text-primary)] leading-tight mt-10 mb-4',
  h3: 'text-lg md:text-xl font-semibold text-[var(--text-primary)] leading-snug mt-8 mb-3',
  h4: 'text-base md:text-lg font-semibold text-[var(--text-primary)] leading-snug mt-6 mb-2',
  p: 'text-[var(--color-neutral-700)] text-base md:text-lg leading-[1.8] mb-5',
  pFirst: 'text-[var(--color-neutral-700)] text-lg md:text-xl leading-[1.8] mb-6',
  a: 'text-[var(--color-primary)] underline underline-offset-2 decoration-[var(--color-primary-200)] hover:decoration-[var(--color-primary)] transition-colors',
  strong: 'font-semibold text-[var(--text-primary)]',
  em: 'italic',
  blockquote: 'border-s-4 border-[var(--color-primary)] bg-[var(--color-primary-50)] rounded-e-lg ps-5 pe-4 py-4 my-6 text-[var(--color-neutral-700)] italic leading-relaxed',
  pullQuote: 'text-xl md:text-2xl font-medium text-[var(--text-primary)] leading-relaxed my-8 px-4 md:px-8 text-center italic',
  ul: 'my-5 ps-6 space-y-2',
  ol: 'my-5 ps-6 space-y-2 list-decimal',
  li: 'text-[var(--color-neutral-700)] text-base md:text-lg leading-relaxed',
  // hr is rendered as a <div> with dots, not <hr>, to avoid void-element pseudo-element issues
  hr: 'my-10 flex items-center justify-center',
  hrDots: 'text-[var(--color-neutral-300)] tracking-[0.5em] text-lg select-none',
  img: 'max-w-full h-auto rounded-xl my-8 shadow-sm',
} as const;

// ── Markdown → HTML ──────────────────────────────────────────────────────────

function markdownToHtml(md: string): string {
  let html = md
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings (before paragraph wrapping)
  html = html.replace(/^#### (.+)$/gm, `<h4 class="${CLASSES.h4}">$1</h4>`);
  html = html.replace(/^### (.+)$/gm, `<h3 class="${CLASSES.h3}">$1</h3>`);
  html = html.replace(/^## (.+)$/gm, `<h2 class="${CLASSES.h2}">$1</h2>`);
  html = html.replace(/^# (.+)$/gm, `<h1 class="${CLASSES.h1}">$1</h1>`);

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, `<blockquote class="${CLASSES.blockquote}">$1</blockquote>`);

  // Bold and italic (order matters: *** before ** before *)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, `<strong class="${CLASSES.strong}"><em>$1</em></strong>`);
  html = html.replace(/\*\*(.+?)\*\*/g, `<strong class="${CLASSES.strong}">$1</strong>`);
  html = html.replace(/\*(.+?)\*/g, `<em class="${CLASSES.em}">$1</em>`);

  // Images: ![alt](url) — before links to avoid ![...]() conflict
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    `<img src="$2" alt="$1" class="${CLASSES.img}" loading="lazy" />`
  );

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    `<a href="$2" class="${CLASSES.a}" target="_blank" rel="noopener noreferrer">$1</a>`
  );

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, `<li class="${CLASSES.li}">$1</li>`);
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul class="${CLASSES.ul}">${match}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, `<li class="${CLASSES.li}">$1</li>`);

  // Horizontal rules → editorial section breaks (div with dots, not void <hr>)
  html = html.replace(/^---$/gm, `<div class="${CLASSES.hr}" role="separator" aria-hidden="true"><span class="${CLASSES.hrDots}">\u2022 \u2022 \u2022</span></div>`);

  // ── Paragraph wrapping with pull-quote detection ──────────────────────────
  const lines = html.split('\n');
  const result: string[] = [];
  let paragraph: string[] = [];
  let isFirstParagraph = true;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join('<br />');
    if (!text.trim()) {
      paragraph = [];
      return;
    }

    // Detect pull-quotes: single short line that's entirely in quotes
    const stripped = text.replace(/<[^>]+>/g, '').trim();
    const isPullQuote =
      paragraph.length === 1 &&
      stripped.length < 200 &&
      /^[""\u201C].*[""\u201D]$/.test(stripped);

    if (isPullQuote) {
      result.push(`<p class="${CLASSES.pullQuote}">${text}</p>`);
    } else {
      const cls = isFirstParagraph ? CLASSES.pFirst : CLASSES.p;
      result.push(`<p class="${cls}">${text}</p>`);
      isFirstParagraph = false;
    }

    paragraph = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      flushParagraph();
    } else if (/^<(h[1-4]|blockquote|ul|ol|li|hr|div|img|figure)/.test(trimmed)) {
      flushParagraph();
      result.push(trimmed);
      // Reset first-paragraph flag after a heading (next paragraph after heading is not "first")
    } else {
      paragraph.push(trimmed);
    }
  }
  flushParagraph();

  return result.join('\n');
}

// ── Component ────────────────────────────────────────────────────────────────

interface MarkdownContentProps {
  content: string;
  className?: string;
  isAr?: boolean;
}

export function MarkdownContent({ content, className = '', isAr }: MarkdownContentProps) {
  const html = markdownToHtml(content);

  return (
    <div
      className={`kun-article-prose max-w-none ${className}`}
      dir={isAr ? 'rtl' : 'ltr'}
      style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
