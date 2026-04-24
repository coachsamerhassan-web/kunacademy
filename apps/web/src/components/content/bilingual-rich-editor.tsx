'use client';

/**
 * App-level wrapper around @kunacademy/ui/rich-editor's BilingualRichEditor.
 *
 * Two jobs:
 *   1. Keep the TipTap bundle lazy — imported via next/dynamic with ssr:false.
 *      Pages that embed this component get a tiny skeleton and the ~80KB
 *      editor bundle downloads only once the user actually opens the admin
 *      form.
 *   2. Provide an app-configured image picker that hits our /api/admin/upload/media
 *      endpoint (default) so authors get a clean "click image → upload →
 *      inserted" experience instead of pasting a URL.
 *
 * This file is imported from admin pages / server components. It re-exports
 * with 'use client' so the dynamic import doesn't blow hydration boundaries.
 */

import dynamic from 'next/dynamic';
import { useCallback } from 'react';
import type {
  BilingualRichDoc,
  BilingualRichEditorProps,
} from '@kunacademy/ui/rich-editor';

// Dynamic import of the editor — SSR disabled so TipTap's React hooks don't
// run on the server (avoids the hydration mismatch that TipTap warns about
// when `immediatelyRender` is true). The ~80KB bundle downloads on-demand
// when an admin opens an editor.
const BilingualRichEditorLazy = dynamic(
  () =>
    import('@kunacademy/ui/rich-editor').then((m) => ({
      default: m.BilingualRichEditor,
    })),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  },
);

// Skeleton shown while the TipTap bundle downloads. Matches the final
// editor footprint so the page doesn't jump.
function EditorSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      }}
      aria-hidden
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            minHeight: 280,
            background: 'var(--color-neutral-50, #F7F7F8)',
            border: '1px solid var(--color-neutral-200, #E5E5E7)',
            borderRadius: 12,
            padding: 16,
            color: 'var(--color-neutral-400, #9E9EA3)',
            fontSize: 14,
          }}
        >
          Loading editor…
        </div>
      ))}
    </div>
  );
}

// ── App-level image picker ─────────────────────────────────────────────────
// Default uploader: POSTs a FormData blob to /api/admin/upload/media.
// Admin pages can override by passing a custom `onImagePick`.
async function defaultImagePick(
  locale: 'ar' | 'en',
): Promise<{ url: string; alt?: string } | null> {
  // Build a file input on the fly — no need to clutter the DOM when idle.
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const alt = window.prompt(
        locale === 'ar'
          ? 'النص البديل (عربي)؟ مطلوب للوصولية:'
          : 'Alt text (English)? Required for accessibility:',
        '',
      );
      if (alt === null) {
        // User cancelled the alt prompt; abort upload to avoid missing alt
        resolve(null);
        return;
      }

      const fd = new FormData();
      fd.append('file', file);
      fd.append('alt_ar', locale === 'ar' ? alt : '');
      fd.append('alt_en', locale === 'en' ? alt : '');

      try {
        const res = await fetch('/api/admin/upload/media', {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }));
          window.alert(err.error ?? 'Upload failed');
          resolve(null);
          return;
        }
        const data = (await res.json()) as { url: string };
        resolve({ url: data.url, alt });
      } catch (e) {
        console.error('[image upload] network error:', e);
        window.alert(
          locale === 'ar'
            ? 'فشل رفع الصورة. تحقق من الاتصال.'
            : 'Image upload failed. Check your connection.',
        );
        resolve(null);
      }
    };
    input.click();
  });
}

// ── Public wrapper ─────────────────────────────────────────────────────────
export interface AppBilingualRichEditorProps
  extends Omit<BilingualRichEditorProps, 'onImagePick'> {
  /** Override the default uploader (e.g. to go through a media library). */
  onImagePick?: BilingualRichEditorProps['onImagePick'];
}

export function AppBilingualRichEditor(props: AppBilingualRichEditorProps) {
  const { onImagePick, ...rest } = props;
  const pick = useCallback(
    async (locale: 'ar' | 'en') =>
      onImagePick ? onImagePick(locale) : defaultImagePick(locale),
    [onImagePick],
  );
  return <BilingualRichEditorLazy {...rest} onImagePick={pick} />;
}

// Re-export the doc type for admin-page authors
export type { BilingualRichDoc };
