// @kunacademy/cms/server — AsyncDocRenderer (Server Component only)
// Server-side async component that fetches and renders Google Docs.
//
// This file must NOT be imported from client components or the client barrel.
// Import from '@kunacademy/cms/server' only.

import React from 'react';
import { DocRenderer } from './doc-renderer.client';

/**
 * AsyncDocRenderer — fetches and renders a Google Doc in a React Server Component.
 *
 * Usage (Next.js App Router):
 *   <AsyncDocRenderer docId={program.descriptionDocId} />
 *
 * Pass `slug` to resolve [IMAGE: ...] placeholders to actual images:
 *   <AsyncDocRenderer docId={program.content_doc_id} slug={slug} />
 *
 * Falls back gracefully when the doc is unavailable.
 */
export async function AsyncDocRenderer({
  docId,
  slug,
  className,
  locale = 'auto',
  fallback,
}: {
  docId: string | undefined;
  /** Program slug — used to resolve [IMAGE: ...] placeholders to /images/programs/content/ */
  slug?: string;
  className?: string;
  /**
   * 'ar' or 'en' — fetches only the matching language section from a
   * dual-language Google Doc, then applies the correct font family.
   * 'auto' (default) returns the full document unchanged.
   */
  locale?: 'ar' | 'en' | 'auto';
  fallback?: React.ReactNode;
}): Promise<React.ReactElement | null> {
  // Lazy import to avoid bundling googleapis in client-side chunks
  const { fetchDocAsHtml } = await import('./google-docs-fetcher');
  // Pass locale so fetchDocAsHtml can split dual-language docs at the boundary
  const html = await fetchDocAsHtml(docId, slug, locale);

  return (
    <DocRenderer
      html={html}
      className={className}
      locale={locale}
      fallback={fallback}
    />
  );
}
