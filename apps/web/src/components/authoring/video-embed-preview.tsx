/**
 * Wave 15 Wave 3 canary v2 — Video embed preview + URL parser (Issue 6).
 *
 * Detects YouTube / Vimeo / Loom / Google Drive video URLs and renders a
 * proper privacy-respecting iframe preview INSIDE the editor (per WP UX
 * research §7 — embed block shows live thumbnail, not raw URL).
 *
 * Public-render path uses the same `parseVideoSrc` + `renderEmbedIframe`
 * logic via `lp-renderer.tsx`'s video section dispatcher (added in canary v2).
 *
 * Privacy:
 *   - YouTube transformed to youtube-nocookie.com
 *   - All iframes carry sandbox + referrerpolicy + loading=lazy
 *   - No third-party tracking scripts ever load from this code path
 *
 * Security:
 *   - Whitelist-only providers — nothing else parses
 *   - ID is regex-extracted from the URL; never trusted as raw HTML
 *   - sandbox attribute identical to packages/ui/src/rich-editor/rich-editor.tsx
 */

'use client';

import type { AspectRatio } from './panels/styling-types';
import { aspectToCss } from './panels/styling-types';
// Import + re-export the pure parser from the shared module (no 'use client')
// so Server Components (universal-sections.tsx) can call parseVideoSrc without
// crossing the client/server module boundary.  The local import of ParsedVideo
// is needed for the VideoEmbedPreview props type below.
import type { ParsedVideo } from './parse-video-src';
export type { ParsedVideo } from './parse-video-src';
export { parseVideoSrc } from './parse-video-src';

interface VideoEmbedPreviewProps {
  parsed: ParsedVideo;
  aspect?: AspectRatio;
  /** Editor preview shows pointer-events:none by default to prevent
   *  unintentional play (admins are authoring; they can preview-in-new-tab). */
  interactive?: boolean;
}

export function VideoEmbedPreview({
  parsed,
  aspect = '16/9',
  interactive = false,
}: VideoEmbedPreviewProps) {
  const aspectCss = aspectToCss(aspect);
  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-[var(--color-neutral-200)] bg-[var(--color-neutral-100)]"
      style={{
        aspectRatio: aspectCss ?? '16 / 9',
      }}
    >
      <iframe
        src={parsed.src}
        title={`Video preview (${parsed.provider})`}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox={
          parsed.provider === 'gdrive'
            ? 'allow-scripts allow-same-origin allow-presentation'
            : 'allow-scripts allow-same-origin allow-presentation allow-popups'
        }
        allowFullScreen
        className="absolute inset-0 w-full h-full"
        style={{
          pointerEvents: interactive ? 'auto' : 'none',
          border: 0,
        }}
      />
      {!interactive && (
        <div className="absolute bottom-1.5 inset-inline-end-1.5 bg-black/60 text-white rounded-full px-2 py-0.5 text-[10px] font-medium">
          Preview
        </div>
      )}
    </div>
  );
}
