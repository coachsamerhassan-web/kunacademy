/**
 * Wave 15 Wave 3 — LP editor mount.
 *
 * Wraps `EditorShell` with the landing_pages-specific data path:
 *   - read: already done by the parent page (reuses /api/admin/lp/[id])
 *   - save: PATCH /api/admin/lp/[id] (existing route — unchanged)
 *   - transition: POST /api/admin/lp/[id]/transition  (NEW thin wrapper —
 *     forwards to the agent transition logic but with admin auth)
 *
 * This mount keeps the data plumbing local so EditorShell remains entity-agnostic.
 */

'use client';

import { useMemo } from 'react';
import { EditorShell, type TransitionResult } from '../editor-shell';
import type { LpComposition } from '@/lib/lp/composition-types';
import type { RowStatus } from '../top-bar';

interface Props {
  row: Record<string, unknown>;
  locale: string;
}

export function LpEditorMount({ row, locale }: Props) {
  const id = row.id as string;
  const slug = (row.slug as string) ?? '';
  const compositionInitial = useMemo<LpComposition>(() => {
    const c = row.composition_json;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return {};
    return c as LpComposition;
  }, [row.composition_json]);

  const status: RowStatus = (row.status as RowStatus) || 'draft';
  const updatedAt = (row.updated_at as string) || null;

  // Title: prefer SEO meta title for the canvas-locale, fall back to slug.
  const seo = (row.seo_meta_json as Record<string, unknown>) ?? {};
  const titleAr = (seo.meta_title_ar as string) ?? '';
  const titleEn = (seo.meta_title_en as string) ?? '';
  const title = locale === 'ar' ? (titleAr || titleEn || slug) : (titleEn || titleAr || slug);

  async function onSave(
    composition: LpComposition,
    blogFields: Props['row'] | null | undefined,
    etag?: string | null,
  ): Promise<string | null> {
    void blogFields;
    void etag;
    const res = await fetch(`/api/admin/lp/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        composition_json: JSON.stringify(composition),
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error || `HTTP ${res.status}`);
    }
    // Server doesn't return updated_at on PATCH yet; etag stays the load-time
    // value until the next read. (Conflict surfacing wires post-canary.)
    return null;
  }

  async function onTransition(to: 'review' | 'published'): Promise<TransitionResult> {
    const res = await fetch(`/api/admin/lp/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      return { ok: true, status: (body.status as RowStatus) ?? to, lints: body.lints ?? null };
    }
    if (res.status === 422 && body.code === 'lint_block') {
      return { ok: false, lints: body.lints ?? null, error: body.message };
    }
    return { ok: false, error: body.error || `HTTP ${res.status}` };
  }

  const previewHref = `/${locale}/lp/${slug}`;

  return (
    <EditorShell
      entity="landing_pages"
      rowId={id}
      slug={slug}
      title={title}
      initialStatus={status}
      initialComposition={compositionInitial}
      initialEtag={updatedAt}
      onSave={onSave}
      onTransition={onTransition}
      previewHref={previewHref}
      locale={locale}
    />
  );
}
