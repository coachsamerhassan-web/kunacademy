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

export interface ParsedVideo {
  provider: 'youtube' | 'vimeo' | 'loom' | 'gdrive';
  id: string;
  /** Final iframe src (privacy-respecting). */
  src: string;
}

const YT_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{6,20})/i;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d{6,12})/i;
const LOOM_RE = /loom\.com\/(?:share|embed)\/([a-f0-9]{24,40})/i;
const GDRIVE_RE = /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{20,80})/i;

/**
 * Parse a user-supplied video URL into a normalized embed src.
 * Returns null when the URL doesn't match any allowlisted provider.
 *
 * Mirror behaviour of `packages/ui/src/rich-editor/sanitizer.ts`'s
 * `parseVideoEmbed` for consistency. The two implementations are intentionally
 * decoupled (this one for the universal video section, that one for inline
 * rich-text videos) but share the same provider matrix.
 */
export function parseVideoSrc(input: string | undefined | null): ParsedVideo | null {
  if (!input || typeof input !== 'string') return null;
  const url = input.trim();
  if (!url) return null;
  // Reject anything not http(s)
  if (!/^https?:\/\//i.test(url)) return null;
  let m = url.match(YT_RE);
  if (m) {
    return {
      provider: 'youtube',
      id: m[1],
      src: `https://www.youtube-nocookie.com/embed/${m[1]}`,
    };
  }
  m = url.match(VIMEO_RE);
  if (m) {
    return {
      provider: 'vimeo',
      id: m[1],
      src: `https://player.vimeo.com/video/${m[1]}`,
    };
  }
  m = url.match(LOOM_RE);
  if (m) {
    return {
      provider: 'loom',
      id: m[1],
      src: `https://www.loom.com/embed/${m[1]}`,
    };
  }
  m = url.match(GDRIVE_RE);
  if (m) {
    return {
      provider: 'gdrive',
      id: m[1],
      src: `https://drive.google.com/file/d/${m[1]}/preview`,
    };
  }
  return null;
}

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
