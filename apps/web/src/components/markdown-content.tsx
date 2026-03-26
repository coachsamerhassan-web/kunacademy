/**
 * Lightweight server-side markdown-to-HTML renderer for blog content.
 * Supports: headings, bold, italic, links, lists, blockquotes, paragraphs.
 * No external dependencies — runs in RSC.
 */

function markdownToHtml(md: string): string {
  let html = md
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Headings (must be before paragraph wrapping)
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />')

  // Paragraphs: wrap consecutive non-tag lines
  const lines = html.split('\n')
  const result: string[] = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      const text = paragraph.join('<br />')
      if (text.trim()) {
        result.push(`<p>${text}</p>`)
      }
      paragraph = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') {
      flushParagraph()
    } else if (/^<(h[1-4]|blockquote|ul|ol|li|hr|div)/.test(trimmed)) {
      flushParagraph()
      result.push(trimmed)
    } else {
      paragraph.push(trimmed)
    }
  }
  flushParagraph()

  return result.join('\n')
}

interface MarkdownContentProps {
  content: string
  className?: string
  isAr?: boolean
}

export function MarkdownContent({ content, className = '', isAr }: MarkdownContentProps) {
  const html = markdownToHtml(content)

  return (
    <div
      className={`prose prose-lg max-w-none
        prose-headings:text-[var(--text-primary)] prose-headings:font-bold
        prose-h2:text-xl prose-h2:md:text-2xl prose-h2:mt-10 prose-h2:mb-4
        prose-h3:text-lg prose-h3:md:text-xl prose-h3:mt-8 prose-h3:mb-3
        prose-p:text-[var(--color-neutral-700)] prose-p:leading-relaxed prose-p:mb-4
        prose-strong:text-[var(--text-primary)] prose-strong:font-semibold
        prose-a:text-[var(--color-primary)] prose-a:underline prose-a:underline-offset-2
        prose-blockquote:border-[var(--color-primary)] prose-blockquote:border-s-4 prose-blockquote:ps-4 prose-blockquote:italic prose-blockquote:text-[var(--color-neutral-600)]
        prose-ul:my-4 prose-ul:ps-6 prose-li:text-[var(--color-neutral-700)] prose-li:mb-1
        prose-hr:border-[var(--color-neutral-200)] prose-hr:my-8
        ${className}`}
      style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
