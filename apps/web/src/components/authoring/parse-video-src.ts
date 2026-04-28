/**
 * Shared video URL parser — NO 'use client' directive.
 *
 * Extracted from video-embed-preview.tsx (Wave 15 W3 canary v2 respin) to
 * allow Server Components (e.g. universal-sections.tsx in lp-renderer) to
 * call parseVideoSrc without crossing the client/server module boundary.
 *
 * Bug fix (canary v2 respin — Bug A): `universal-sections.tsx` imports this
 * function for the public LP renderer (a Server Component). The original
 * location was `video-embed-preview.tsx` which carries 'use client' for its
 * VideoEmbedPreview React component. Next.js 15 enforces that Server Components
 * cannot call functions from 'use client' modules — doing so throws:
 *   "Attempted to call parseVideoSrc() from the server but parseVideoSrc is on
 *    the client. It's not possible to invoke a client function from the server."
 *
 * Resolution: move the pure-function logic here (zero React, zero hooks, no
 * side effects). Both `video-embed-preview.tsx` AND `universal-sections.tsx`
 * now import from this file.
 */

export interface ParsedVideo {
  provider: 'youtube' | 'vimeo' | 'loom' | 'gdrive';
  id: string;
  /** Final iframe src (privacy-respecting). */
  src: string;
}

const YT_RE =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{6,20})/i;
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
 *
 * Pure function — no side effects, no React, safe to call from Server Components.
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
