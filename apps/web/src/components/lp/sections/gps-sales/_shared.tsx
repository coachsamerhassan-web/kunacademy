/**
 * Wave 15 Phase 2 Session 1 — extracted from
 * `apps/web/src/components/lp/themes/gps-sales-renderer.tsx` (was 822 LOC,
 * monolithic). Per-section files live under this folder; this `_shared.tsx`
 * holds the cross-section primitives (types, sanitizer, watermark).
 *
 * Behaviour-preserving: every primitive is byte-identical to the original
 * before-refactor code. Only file location changed.
 */

import type { ReactNode } from 'react';
import type {
  LpSection,
  LpLeadCaptureConfig,
} from '@/lib/lp/composition-types';

// ── Per-section component contract ──────────────────────────────────────────
export interface SectionProps {
  section: LpSection;
  isAr: boolean;
  slug: string;
  locale: string;
  leadCaptureConfig: LpLeadCaptureConfig | null;
  conversionEventName: string;
}

// ── Author-supplied HTML sanitizer ──────────────────────────────────────────
/**
 * Minimal HTML sanitizer for author-supplied copy fields that need line-break
 * preservation. Strategy: escape EVERYTHING then re-enable only the tags we
 * explicitly allow. Keeps the "paste a link in the contact copy" authoring
 * experience without opening <script> / on*-handler / iframe vectors.
 *
 * Authors go through admin auth (role: admin | super_admin | content_editor
 * in Wave 14b) — but defense-in-depth against a compromised admin account
 * is still cheap. Per DeepSeek adversarial pass 2026-04-24.
 *
 * Allowed tags: <br>, <a href="...">, <strong>, <em>. Nothing else.
 */
export function sanitizeAuthorHtml(input: string): string {
  if (!input) return '';
  // 1. Escape every HTML-special character.
  const escaped = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  // 2. Selectively re-enable the whitelisted tags.
  return escaped
    // <br/> and <br>
    .replace(/&lt;br\s*\/?&gt;/gi, '<br/>')
    // <strong>...</strong>
    .replace(/&lt;strong&gt;/gi, '<strong>')
    .replace(/&lt;\/strong&gt;/gi, '</strong>')
    // <em>...</em>
    .replace(/&lt;em&gt;/gi, '<em>')
    .replace(/&lt;\/em&gt;/gi, '</em>')
    // <a href="..."> — only http/https/mailto/tel URLs, quotes must be simple
    .replace(
      /&lt;a\s+href=&quot;((?:https?:\/\/|mailto:|tel:|#|\/)[^"<>\s]+)&quot;&gt;/gi,
      (_, url) => `<a href="${url}" rel="noopener noreferrer">`,
    )
    .replace(/&lt;\/a&gt;/gi, '</a>');
}

// ── Flower-of-life watermark (SVG, CSS-scoped, reused across dark sections) ─
export function GpsGeoWatermark(): ReactNode {
  return (
    <div className="gps-geo-watermark" aria-hidden="true">
      <svg
        viewBox="0 0 800 800"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="gps-geo" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
            <circle cx="80" cy="80" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
            <circle cx="80" cy="34" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
            <circle cx="80" cy="126" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
            <circle cx="120" cy="57" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
            <circle cx="40" cy="57" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
            <circle cx="120" cy="103" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
            <circle cx="40" cy="103" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="800" height="800" fill="url(#gps-geo)" />
      </svg>
    </div>
  );
}
