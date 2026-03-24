// @kunacademy/cms — Google Docs Content Fetcher
// Fetches a Google Doc by ID, exports as clean HTML, strips Google's inline mess.
// Used for rich content: program descriptions, coach bios, blog posts.
//
// Requires: Google Service Account with Docs API access

import { google } from 'googleapis';
import { readFileSync } from 'fs';

// ── Auth ──────────────────────────────────────────────────────────────────────

let authClient: InstanceType<typeof google.auth.GoogleAuth> | null = null;

function getAuth() {
  if (authClient) return authClient;

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  if (!keyPath) {
    console.warn('[cms/docs] No GOOGLE_SERVICE_ACCOUNT_PATH — rich content disabled');
    return null;
  }

  try {
    const creds = JSON.parse(readFileSync(keyPath, 'utf-8'));
    authClient = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/documents.readonly'],
    });
    return authClient;
  } catch (e) {
    console.error('[cms/docs] Failed to load service account:', e);
    return null;
  }
}

// ── In-memory cache ──────────────────────────────────────────────────────────

const docCache = new Map<string, { html: string; fetchedAt: number }>();
const CACHE_TTL = 300_000; // 5 minutes — matches ISR

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a Google Doc and return clean, brand-ready HTML.
 * Returns null if the doc can't be fetched (missing ID, no auth, API error).
 */
export async function fetchDocAsHtml(docId: string | undefined): Promise<string | null> {
  if (!docId) return null;

  // Check cache
  const cached = docCache.get(docId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.html;
  }

  const auth = getAuth();
  if (!auth) return null;

  try {
    const docs = google.docs({ version: 'v1', auth });
    const doc = await docs.documents.get({ documentId: docId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = documentToHtml(doc.data as any);

    docCache.set(docId, { html, fetchedAt: Date.now() });
    return html;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[cms/docs] Failed to fetch doc ${docId}:`, msg);
    return null;
  }
}

/** Clear the doc cache (called by revalidation webhook) */
export function invalidateDocCache(): void {
  docCache.clear();
}

// ── Google Docs JSON → Clean HTML ────────────────────────────────────────────
// Google Docs API returns a deeply nested JSON structure (not HTML).
// We walk the structural elements and produce semantic HTML.

interface DocElement {
  paragraph?: {
    paragraphStyle?: { namedStyleType?: string };
    elements?: TextRun[];
    bullet?: { listId?: string; nestingLevel?: number };
  };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: DocElement[];
      }>;
    }>;
  };
}

interface TextRun {
  textRun?: {
    content?: string;
    textStyle?: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      link?: { url?: string };
    };
  };
}

function documentToHtml(doc: { body?: { content?: DocElement[] } }): string {
  if (!doc.body?.content) return '';

  const parts: string[] = [];
  let inList = false;

  for (const element of doc.body.content) {
    if (element.paragraph) {
      const p = element.paragraph;
      const style = p.paragraphStyle?.namedStyleType ?? 'NORMAL_TEXT';
      const text = renderTextRuns(p.elements ?? []);

      // Skip empty paragraphs
      if (!text.trim()) {
        if (inList) {
          parts.push('</ul>');
          inList = false;
        }
        continue;
      }

      // Bullet lists
      if (p.bullet) {
        if (!inList) {
          parts.push('<ul>');
          inList = true;
        }
        parts.push(`<li>${text}</li>`);
        continue;
      }

      // Close list if we were in one
      if (inList) {
        parts.push('</ul>');
        inList = false;
      }

      // Headings
      switch (style) {
        case 'HEADING_1':
          parts.push(`<h1>${text}</h1>`);
          break;
        case 'HEADING_2':
          parts.push(`<h2>${text}</h2>`);
          break;
        case 'HEADING_3':
          parts.push(`<h3>${text}</h3>`);
          break;
        case 'HEADING_4':
          parts.push(`<h4>${text}</h4>`);
          break;
        default:
          parts.push(`<p>${text}</p>`);
      }
    }

    // Tables
    if (element.table?.tableRows) {
      if (inList) {
        parts.push('</ul>');
        inList = false;
      }
      parts.push('<table>');
      for (const row of element.table.tableRows) {
        parts.push('<tr>');
        for (const cell of row.tableCells ?? []) {
          const cellHtml = cell.content
            ?.map((el) => {
              if (el.paragraph?.elements) {
                return renderTextRuns(el.paragraph.elements);
              }
              return '';
            })
            .join(' ') ?? '';
          parts.push(`<td>${cellHtml}</td>`);
        }
        parts.push('</tr>');
      }
      parts.push('</table>');
    }
  }

  if (inList) parts.push('</ul>');

  return parts.join('\n');
}

function renderTextRuns(elements: TextRun[]): string {
  return elements
    .map((el) => {
      const run = el.textRun;
      if (!run?.content) return '';

      let text = escapeHtml(run.content.replace(/\n$/, ''));
      if (!text) return '';

      // Apply inline formatting
      if (run.textStyle?.bold) text = `<strong>${text}</strong>`;
      if (run.textStyle?.italic) text = `<em>${text}</em>`;
      if (run.textStyle?.underline && !run.textStyle?.link) text = `<u>${text}</u>`;
      if (run.textStyle?.link?.url) text = `<a href="${escapeHtml(run.textStyle.link.url)}">${text}</a>`;

      return text;
    })
    .join('');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
