/**
 * Wave 15 Wave 3 — /admin/blog/[id] visual editor mount.
 *
 * Sister of /admin/posts/[id] (the legacy post editor) — same data, different
 * surface. Wave 4 will eventually retire /admin/posts.
 */

'use client';

import { use, useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { BlogEditorMount } from '@/components/authoring/mounts/blog-editor-mount';

export default function AdminBlogEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = use(params);
  const isAr = locale === 'ar';
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/blog/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          setError(b.error || `HTTP ${r.status}`);
          return;
        }
        const b = await r.json();
        setRow(b.row);
      })
      .catch(() => setError(isAr ? 'فشل التحميل' : 'Failed to load'));
  }, [id, isAr]);

  if (error) {
    return (
      <Section variant="white">
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">{error}</div>
      </Section>
    );
  }
  if (!row) {
    return (
      <Section variant="white">
        <p className="text-[var(--color-neutral-500)]">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
      </Section>
    );
  }

  return <BlogEditorMount row={row} locale={locale} />;
}
