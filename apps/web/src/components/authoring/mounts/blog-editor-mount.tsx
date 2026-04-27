/**
 * Wave 15 Wave 3 — Blog editor mount.
 *
 * Blog posts have BOTH scalar content_ar/_en (canonical for the existing
 * `/blog/[slug]` rendering) AND optional composition_json (for sectioned
 * long-form blog posts — Wave 16 promotion). For Wave 3 canary the editor
 * surfaces composition_json sections as the primary editing surface; the
 * scalar title/content fall through to a "page-level" panel when nothing
 * is selected (post-canary refinement).
 *
 * Canary scope: composition_json is the editing surface; scalar content
 * gets a single auto-injected synthetic section so admins can edit title +
 * content right away.
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

export function BlogEditorMount({ row, locale }: Props) {
  const id = row.id as string;
  const slug = (row.slug as string) ?? '';
  const status: RowStatus = (row.status as RowStatus) || 'draft';
  const updatedAt = (row.updated_at as string) || null;
  const title = locale === 'ar'
    ? ((row.title_ar as string) || (row.title_en as string) || slug)
    : ((row.title_en as string) || (row.title_ar as string) || slug);

  const initialBlogFields = useMemo(() => ({
    title_ar: (row.title_ar as string) ?? null,
    title_en: (row.title_en as string) ?? null,
    content_ar: (row.content_ar as string) ?? null,
    content_en: (row.content_en as string) ?? null,
    featured_image_url: (row.featured_image_url as string) ?? null,
  }), [row]);

  // composition_json may be null on legacy posts. We materialize it as
  // empty for the canvas; if present, surface its sections as-is.
  const compositionInitial = useMemo<LpComposition>(() => {
    const c = row.composition_json;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { sections: [] };
    return c as LpComposition;
  }, [row.composition_json]);

  async function onSave(composition: LpComposition, blogFields: Props['row'] | null | undefined): Promise<string | null> {
    const payload: Record<string, unknown> = {
      composition_json: composition,
    };
    // Persist scalar blog fields when present.
    if (blogFields && typeof blogFields === 'object' && !Array.isArray(blogFields)) {
      const bf = blogFields as unknown as { title_ar?: string | null; title_en?: string | null; content_ar?: string | null; content_en?: string | null; featured_image_url?: string | null };
      if ('title_ar' in bf) payload.title_ar = bf.title_ar;
      if ('title_en' in bf) payload.title_en = bf.title_en;
      if ('content_ar' in bf) payload.content_ar = bf.content_ar;
      if ('content_en' in bf) payload.content_en = bf.content_en;
      if ('featured_image_url' in bf) payload.featured_image_url = bf.featured_image_url;
    }
    const res = await fetch(`/api/admin/blog/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error || `HTTP ${res.status}`);
    }
    return null;
  }

  async function onTransition(to: 'review' | 'published'): Promise<TransitionResult> {
    const res = await fetch(`/api/admin/blog/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: (body.status as RowStatus) ?? to, lints: body.lints ?? null };
    if (res.status === 422 && body.code === 'lint_block') {
      return { ok: false, lints: body.lints ?? null, error: body.message };
    }
    return { ok: false, error: body.error || `HTTP ${res.status}` };
  }

  const previewHref = `/${locale}/blog/${slug}`;

  return (
    <EditorShell
      entity="blog_posts"
      rowId={id}
      slug={slug}
      title={title}
      initialStatus={status}
      initialComposition={compositionInitial}
      initialBlogFields={initialBlogFields}
      initialEtag={updatedAt}
      onSave={onSave}
      onTransition={onTransition}
      previewHref={previewHref}
      locale={locale}
    />
  );
}
