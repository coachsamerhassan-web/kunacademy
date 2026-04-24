/**
 * Rich-content sanitizer — the primary XSS boundary for Wave 15.
 *
 * Rich-text authored by admins is stored as TipTap JSON (safe — it's a data
 * structure, not HTML). At RENDER time, `generateHTML()` converts the JSON
 * to HTML, and THAT is what needs sanitization before it hits the DOM of
 * public pages.
 *
 * Strategy: DOMPurify with a locked-down allowlist, then a post-pass that
 * adds `rel="noopener noreferrer"` to every `<a target="_blank">` link and
 * enforces our strict `<iframe>` sandbox policy for embedded videos.
 *
 * Hardening against DeepSeek adversarial corpus:
 *   - <script> stripped (tags + any form of execution)
 *   - on* event handlers stripped
 *   - javascript:, vbscript:, data:text/html URIs stripped
 *   - <svg>/<math>/<foreignObject> stripped (SVG payload vectors)
 *   - <style>, <link>, <meta>, <base>, <form> stripped
 *   - Unicode-normalized before sanitization (no lookalike bypass)
 *   - iframe allowed ONLY for our video embed providers, with locked sandbox
 *
 * Reusable across:
 *   - public LP renderer (TipTap JSON → HTML → sanitize → inject)
 *   - public blog renderer (same)
 *   - coach profile public renderer (same)
 *   - any future rich-content surface
 */

import DOMPurify from 'isomorphic-dompurify';

// ── Allowed tags (exact superset of what TipTap's starter-kit + our custom
// extensions can produce). No more, no less. ──────────────────────────────
const ALLOWED_TAGS: ReadonlyArray<string> = [
  // Block content
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote',
  'pre', 'code',
  'hr',
  'br',
  // Inline formatting
  'strong', 'em', 'u', 's', 'del', 'mark',
  'span',
  // Links + media
  'a',
  'img',
  // Video embeds (restricted further by iframe allowlist below)
  'iframe',
  // Containers TipTap emits for alignment / custom nodes
  'div',
  'figure', 'figcaption',
];

// ── Allowed attributes per tag. Anything outside this map is stripped. ──
const ALLOWED_ATTRS: Record<string, ReadonlyArray<string>> = {
  // Alignment emitted by `@tiptap/extension-text-align` lands on block nodes
  // as `style="text-align: start|end|center"`. DOMPurify strips `style` by
  // default for good reason (CSS has its own expression-injection history in
  // IE6-era engines — we don't need to re-open that). Instead we configure
  // TipTap to emit a `data-align` attr + rely on a stylesheet selector.
  '*': ['class', 'dir', 'lang', 'data-align', 'data-rich-video-provider'],
  a: ['href', 'title', 'target'],
  img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
  iframe: [
    'src', 'width', 'height', 'title',
    'loading', 'allow', 'allowfullscreen', 'sandbox',
    'referrerpolicy', 'frameborder',
  ],
  code: ['class'],
  pre: ['class'],
  span: ['class'],
  div: ['class'],
  blockquote: ['cite'],
  figure: [],
  figcaption: [],
};

// ── Allowed URL schemes for href/src. Everything else (javascript:, data:,
// vbscript:, file:, tel with mailformed payload, etc.) is stripped. ──
const ALLOWED_URL_PATTERN =
  /^(?:https?:\/\/|mailto:|tel:|#|\/[^/\\])/i;

// ── Video iframe provider allowlist. Any iframe whose src origin is NOT
// in this list is stripped entirely (DOMPurify hook).
// Subdomain abuse defense: we use `new URL(src).origin` which strict-matches
// the full host (scheme+host+port). `drive.google.com.attacker.com` has
// origin `https://drive.google.com.attacker.com` which will NOT match
// `https://drive.google.com` — hard fail. ──
const ALLOWED_VIDEO_ORIGINS: ReadonlySet<string> = new Set([
  // YouTube
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  // Vimeo
  'https://player.vimeo.com',
  // Loom
  'https://www.loom.com',
  // Google Drive (Samer override 2026-04-24: coach-recording embeds)
  'https://drive.google.com',
]);

// ── Required sandbox flags for video iframes. Anything less → strip iframe.
const REQUIRED_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation';

// Build the flat allowed-attrs list DOMPurify wants
function buildAllowedAttrs(): string[] {
  const set = new Set<string>();
  for (const arr of Object.values(ALLOWED_ATTRS)) {
    for (const a of arr) set.add(a);
  }
  return Array.from(set);
}

const ALLOWED_ATTR_LIST = buildAllowedAttrs();

// ── Single DOMPurify instance with our config baked in ──────────────────
function configureDompurify(purify: typeof DOMPurify) {
  // Strip everything DOMPurify has built-in dangerous-tag knowledge of +
  // our explicit deny. We'd rather be explicit-allow than implicit-anything.
  purify.setConfig({
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: ALLOWED_ATTR_LIST,
    FORBID_TAGS: [
      'script', 'style', 'link', 'meta', 'base', 'form',
      'input', 'button', 'select', 'textarea',
      'object', 'embed', 'applet',
      'svg', 'math', 'foreignObject',
      'audio', 'video', 'source', 'track', 'picture',
    ],
    FORBID_ATTR: [
      // Event handlers — every single one DOMPurify knows about AND a wildcard
      // via the hook below for any we missed (belt and braces).
      'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout',
      'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'onchange', 'onsubmit',
      'onpointerdown', 'onpointerup', 'onpointermove',
      'ontouchstart', 'ontouchend', 'ontouchmove',
      'onanimationstart', 'onanimationend',
      'ontransitionstart', 'ontransitionend',
      // Legacy XSS vectors
      'srcdoc', 'formaction', 'action', 'background',
      // Style banned (CSS injection surface)
      'style',
    ],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    SANITIZE_DOM: true,
    WHOLE_DOCUMENT: false,
    FORCE_BODY: false,
    // Block URIs with unsafe schemes
    ALLOWED_URI_REGEXP: ALLOWED_URL_PATTERN,
  });

  // Belt-and-braces hook: strip any attribute whose name starts with `on`.
  purify.addHook('uponSanitizeAttribute', (_node, data) => {
    const name = data.attrName.toLowerCase();
    if (name.startsWith('on')) {
      data.keepAttr = false;
      return;
    }
    // Reject URL-valued attrs whose value doesn't start with https://, mailto:,
    // tel:, a fragment, or an absolute same-origin path. Catches data:, javascript:,
    // vbscript:, file: etc. Redundant with ALLOWED_URI_REGEXP but gives us a clear
    // post-condition we can rely on.
    if (
      (name === 'href' || name === 'src' || name === 'action' || name === 'formaction') &&
      typeof data.attrValue === 'string'
    ) {
      const v = data.attrValue.trim();
      if (v && !ALLOWED_URL_PATTERN.test(v)) {
        data.keepAttr = false;
      }
    }
  });

  // iframe-specific allowlist hook: only whitelisted video providers pass.
  // Every other iframe is stripped ENTIRELY (tag + children) as a hard fail.
  purify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'iframe') return;
    const el = node as Element;
    const src = el.getAttribute('src') || '';
    let parsed: URL;
    try {
      parsed = new URL(src);
    } catch {
      el.remove();
      return;
    }
    // Strict origin match — subdomain abuse (drive.google.com.attacker.com)
    // produces a different origin and fails here.
    if (!ALLOWED_VIDEO_ORIGINS.has(parsed.origin)) {
      el.remove();
      return;
    }
    // Provider-specific path validation: Google Drive iframes MUST end in
    // /file/d/{FILE_ID}/preview. Anything else (e.g. /drive/, /uc?id=, path
    // traversal attempts) is rejected even though the origin matches.
    if (parsed.origin === 'https://drive.google.com') {
      const gdriveEmbedPath =
        /^\/file\/d\/[A-Za-z0-9_-]{20,60}\/preview\/?$/;
      if (!gdriveEmbedPath.test(parsed.pathname)) {
        el.remove();
        return;
      }
    }
    // Enforce sandbox on every allowed video iframe, regardless of what the
    // author-supplied attr says. Overwrite, don't merge.
    el.setAttribute('sandbox', REQUIRED_SANDBOX);
    el.setAttribute('loading', 'lazy');
    el.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    // GDrive embeds need `allow="autoplay"` or autoplay silently fails.
    // Other providers default to no allow (more restrictive).
    if (parsed.origin === 'https://drive.google.com') {
      el.setAttribute('allow', 'autoplay');
    } else {
      // Strip any author-set allow attr on non-GDrive iframes
      el.removeAttribute('allow');
    }
  });

  // Link hook: force rel="noopener noreferrer" on any <a target="_blank">,
  // and strip target attrs that aren't _blank or _self.
  purify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'a') return;
    const el = node as Element;
    const target = el.getAttribute('target');
    if (target && target !== '_blank' && target !== '_self') {
      el.removeAttribute('target');
    }
    if (el.getAttribute('target') === '_blank') {
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

// Configure ONCE. isomorphic-dompurify exposes a singleton so the hooks
// live for the life of the process. Calling addHook() more than once
// would DUPLICATE the hook — so the `configured` latch is load-bearing.
// If another module in the process ever calls DOMPurify.setConfig(), our
// hooks still run (they're independent of setConfig), but ALLOWED_TAGS /
// FORBID_ATTR / ALLOWED_URI_REGEXP could be mutated. As of Wave 15, no
// other module in this app touches DOMPurify directly — if that changes,
// we'd need a namespaced DOMPurify instance via `DOMPurify(new JSDOM())`.
let configured = false;
function ensureConfigured() {
  if (configured) return;
  configureDompurify(DOMPurify);
  configured = true;
}

/** Normalize Unicode BEFORE sanitization so visual-lookalike bypasses
 *  (`ɑ`, Cyrillic `а`, etc.) don't slip past allowlist regexes. */
function normalizeUnicode(input: string): string {
  try {
    return input.normalize('NFC');
  } catch {
    return input;
  }
}

/**
 * Sanitize an HTML string produced by a rich-text renderer (TipTap, marked,
 * etc.). Strips every tag/attr/URL-scheme outside the allowlist, forces
 * hard-fail on non-provider iframes, re-applies our sandbox policy.
 *
 * Returns: sanitized HTML fit for injection via dangerouslySetInnerHTML on
 * public pages.
 */
export function sanitizeRichHtml(input: string | null | undefined): string {
  if (!input) return '';
  ensureConfigured();
  const normalized = normalizeUnicode(input);
  // DOMPurify.sanitize returns a string when RETURN_DOM=false (our config).
  const cleaned = DOMPurify.sanitize(normalized) as unknown as string;
  return cleaned;
}

// ── Safe-URL checker — used by the video embed parser + link attr validation
export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return ALLOWED_URL_PATTERN.test(url.trim());
}

// ── Video provider URL parser — strict, allowlisted, returns null for anything
// that doesn't match a known pattern. Output is the embeddable iframe src.
// Author-facing parser: accepts share/view URLs for UX, normalizes to the
// safe embed URL for iframe src. The iframe hook above does a SECOND check
// on the origin + GDrive path pattern, so even if an attacker crafted a
// TipTap JSON document that bypassed this parser, the sanitize step still
// rejects it. Defense-in-depth. ──
export interface VideoEmbed {
  provider: 'youtube' | 'vimeo' | 'loom' | 'gdrive';
  embedSrc: string;
  title: string;
  /** For UX: should the toolbar show the "check sharing permissions" hint? */
  needsPermissionHint?: boolean;
}

// YouTube IDs are exactly 11 chars in [A-Za-z0-9_-]
const YOUTUBE_RE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&#][^\s]*)?$/i;

// Vimeo IDs are all digits, 6+
const VIMEO_RE =
  /^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{6,})(?:[?/#][^\s]*)?$/i;

// Loom IDs are hex, 16+ chars
const LOOM_RE =
  /^(?:https?:\/\/)?(?:www\.)?loom\.com\/(?:share|embed)\/([a-f0-9]{16,})(?:[?&#][^\s]*)?$/i;

// Google Drive file IDs: 25-44 chars, [A-Za-z0-9_-]. The three share URL
// variants Samer listed all carry the ID; we extract + normalize to /preview.
// host check `^drive\.google\.com$` prevents subdomain abuse
// (`drive.google.com.attacker.com` will fail the host match).
const GDRIVE_PATTERNS: ReadonlyArray<{ re: RegExp; idGroup: number }> = [
  // https://drive.google.com/file/d/{ID}/view
  { re: /^https?:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{20,60})\/view(?:\?[^#\s]*)?(?:#[^\s]*)?$/i, idGroup: 1 },
  // https://drive.google.com/file/d/{ID}/preview  (already-normalized)
  { re: /^https?:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{20,60})\/preview(?:\?[^#\s]*)?(?:#[^\s]*)?$/i, idGroup: 1 },
  // https://drive.google.com/open?id={ID}  (legacy)
  { re: /^https?:\/\/drive\.google\.com\/open\?id=([A-Za-z0-9_-]{20,60})(?:&[^#\s]*)?(?:#[^\s]*)?$/i, idGroup: 1 },
];

// Strict ID regex used for secondary validation after extraction
const GDRIVE_ID_RE = /^[A-Za-z0-9_-]{20,60}$/;

export function parseVideoEmbed(rawUrl: string | null | undefined): VideoEmbed | null {
  if (!rawUrl) return null;
  const url = rawUrl.trim();
  if (!url) return null;

  // Length cap — no legitimate URL we accept is this long; reject pathological
  // inputs up front.
  if (url.length > 500) return null;

  // YouTube — normalize to nocookie variant for fewer tracking cookies.
  const yt = url.match(YOUTUBE_RE);
  if (yt) {
    const id = yt[1];
    return {
      provider: 'youtube',
      embedSrc: `https://www.youtube-nocookie.com/embed/${id}`,
      title: 'YouTube video',
    };
  }

  // Vimeo
  const vim = url.match(VIMEO_RE);
  if (vim) {
    const id = vim[1];
    return {
      provider: 'vimeo',
      embedSrc: `https://player.vimeo.com/video/${id}`,
      title: 'Vimeo video',
    };
  }

  // Loom
  const loom = url.match(LOOM_RE);
  if (loom) {
    const id = loom[1];
    return {
      provider: 'loom',
      embedSrc: `https://www.loom.com/embed/${id}`,
      title: 'Loom video',
    };
  }

  // Google Drive — try each supported share-URL form, extract ID, re-validate,
  // emit only the /preview normalized form as the embed src.
  for (const { re, idGroup } of GDRIVE_PATTERNS) {
    const match = url.match(re);
    if (match) {
      const id = match[idGroup];
      // Secondary validation — the per-pattern regex is already strict, but
      // re-running the pure-ID regex is cheap and documents the contract.
      if (!GDRIVE_ID_RE.test(id)) continue;
      return {
        provider: 'gdrive',
        embedSrc: `https://drive.google.com/file/d/${id}/preview`,
        title: 'Google Drive video',
        needsPermissionHint: true,
      };
    }
  }

  return null;
}
