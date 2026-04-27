/**
 * Wave 15 Wave 3 — Static-page editor mount.
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

export function StaticPageEditorMount({ row, locale }: Props) {
  const id = row.id as string;
  const slug = (row.slug as string) ?? '';
  const compositionInitial = useMemo<LpComposition>(() => {
    const c = row.composition_json;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return {};
    return c as LpComposition;
  }, [row.composition_json]);

  const status: RowStatus = (row.status as RowStatus) || 'draft';
  const updatedAt = (row.updated_at as string) || null;

  const seo = (row.seo_meta_json as Record<string, unknown>) ?? {};
  const titleAr = (seo.meta_title_ar as string) ?? '';
  const titleEn = (seo.meta_title_en as string) ?? '';
  const title = locale === 'ar' ? (titleAr || titleEn || slug) : (titleEn || titleAr || slug);

  async function onSave(composition: LpComposition): Promise<string | null> {
    const res = await fetch(`/api/admin/static-pages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ composition_json: composition }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error || `HTTP ${res.status}`);
    }
    return null;
  }

  async function onTransition(to: 'review' | 'published'): Promise<TransitionResult> {
    const res = await fetch(`/api/admin/static-pages/${id}/transition`, {
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

  // Static pages don't have a public URL convention yet (Wave 4 migration
  // wires /faq, /about, etc.). For canary, no preview link.
  const previewHref = null;

  return (
    <EditorShell
      entity="static_pages"
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
