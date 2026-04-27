/**
 * Wave 14b LP-ADMIN-UX Session 2 — image upload hook for the per-section editor.
 *
 * Returns:
 *   - `onImagePick(locale)` — drop-in for `BilingualRichEditor`/`RichEditor`
 *     `onImagePick` prop. Opens a native file picker, posts to
 *     `/api/admin/upload/media`, returns `{ url, alt }` or null on cancel/error.
 *   - `uploadFile(file, alt_ar, alt_en)` — generic uploader for surfaces that
 *     have their own form (e.g. featured image), not driven by the rich editor.
 *
 * Endpoint contract (verified in `apps/web/src/app/api/admin/upload/media/route.ts`):
 *   POST formData: { file: File, alt_ar?: string, alt_en?: string }
 *   201 { id, url, alt_ar, alt_en, width, height, size_bytes }
 *   429 / 415 / 413 / 400 / 401 / 403 / 500 surfaced as Error.
 *
 * Auth: middleware enforces admin | super_admin | content_editor on the
 * route. The hook does NOT pass any credentials — relies on cookie-based JWT
 * session attached automatically by the browser.
 *
 * Note: prompt() is used for alt-text capture from inside the rich editor —
 * keeps the canary surface small. A modal-based picker is future polish.
 */

'use client';

import { useCallback } from 'react';

export interface UploadedMedia {
  id: string;
  url: string;
  alt_ar: string | null;
  alt_en: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number;
}

export interface UseImageUploadOptions {
  /** When the upload throws, `onError` (if provided) is called instead of
   *  letting the error propagate. Useful for inline status banners. */
  onError?: (error: Error) => void;
}

export function useImageUpload(opts: UseImageUploadOptions = {}) {
  const { onError } = opts;

  /** Generic upload — used by featured-image / hero-image / any non-rich-editor flow. */
  const uploadFile = useCallback(
    async (file: File, altAr: string, altEn: string): Promise<UploadedMedia> => {
      const fd = new FormData();
      fd.append('file', file);
      if (altAr) fd.append('alt_ar', altAr);
      if (altEn) fd.append('alt_en', altEn);

      const res = await fetch('/api/admin/upload/media', {
        method: 'POST',
        body: fd,
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
      };
      if (!res.ok) {
        const msg = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`;
        const err = new Error(msg);
        if (onError) {
          onError(err);
        }
        throw err;
      }
      return body as unknown as UploadedMedia;
    },
    [onError],
  );

  /** Drop-in for `BilingualRichEditor.onImagePick` / `RichEditor.onImagePick`.
   *  Opens a native <input type=file>, prompts for alt-text, uploads, returns
   *  `{ url, alt }`. Returns null on cancel or upload failure (errors are
   *  surfaced via `onError`). */
  const onImagePick = useCallback(
    async (locale: 'ar' | 'en'): Promise<{ url: string; alt?: string } | null> => {
      const file = await pickFile();
      if (!file) return null;

      const isAr = locale === 'ar';
      const altPromptLocaleSpecific = isAr
        ? 'النص البديل بالعربية (مطلوب لإمكانية الوصول):'
        : 'English alt text (required for accessibility):';
      const altPromptOther = isAr
        ? 'النص البديل بالإنجليزية (اختياري):'
        : 'Arabic alt text (optional):';

      const altPrimary = (window.prompt(altPromptLocaleSpecific, '') ?? '').trim();
      if (!altPrimary) {
        // Endpoint requires at least one alt; cancel rather than upload garbage
        return null;
      }
      const altOther = (window.prompt(altPromptOther, '') ?? '').trim();

      const altAr = isAr ? altPrimary : altOther;
      const altEn = isAr ? altOther : altPrimary;

      try {
        const media = await uploadFile(file, altAr, altEn);
        return {
          url: media.url,
          alt: isAr ? altAr || altEn : altEn || altAr,
        };
      } catch {
        return null;
      }
    },
    [uploadFile],
  );

  return { uploadFile, onImagePick };
}

/** Open a native file picker and resolve with the chosen File or null on cancel.
 *
 *  Detection of cancel uses (in order of reliability):
 *    1. The `cancel` event on the input element — widely supported in
 *       modern Chrome/Edge/Safari/Firefox (2024+). When fired, resolves null.
 *    2. The `change` event — fires on file selection. Resolves with file.
 *    3. A focus-restore fallback — older browsers don't fire `cancel`; if
 *       neither `change` nor `cancel` fires within 60s of window focus
 *       returning, the promise resolves null defensively. The cap prevents
 *       a permanent dangling promise.
 *
 *  Listeners are cleaned up exactly once via a guarded `done(value)` helper.
 *  (DeepSeek MEDIUM 2026-04-27 — replaces previous 250ms focus-only heuristic.) */
function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';

    let settled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      window.removeEventListener('focus', onFocus);
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const done = (value: File | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onChange = () => {
      done(input.files?.[0] ?? null);
    };
    const onCancel = () => {
      done(null);
    };
    const onFocus = () => {
      // Fallback: if focus returns to the window (picker dismissed) and
      // neither `change` nor `cancel` fires within 60 seconds, give up.
      // Modern browsers fire `cancel` reliably; this guard is a safety net
      // for older runtimes only and won't fire in normal flow.
      if (fallbackTimer) return;
      fallbackTimer = setTimeout(() => {
        done(null);
      }, 60_000);
    };

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    window.addEventListener('focus', onFocus);
    input.click();
  });
}
