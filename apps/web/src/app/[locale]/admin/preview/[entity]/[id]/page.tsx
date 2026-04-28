'use client';

/**
 * Wave 15 Wave 3 canary v2 — Preview-in-new-tab route (Issue 5B).
 *
 * Per WP UX research §5.4 — preview opens in a new tab with a top device-size
 * toggle. Iframe renders the public page at the chosen viewport width, framed
 * so admins can see "this is what mobile users see."
 *
 * URL shape:  /[locale]/admin/preview/[entity]/[id]?as=draft
 *   - entity ∈ landing_pages | blog_posts | static_pages
 *   - id     = row UUID
 *   - as     = draft | published   (default: draft)
 *
 * The iframe src points to the public render path with a `?preview=1` query
 * parameter; the public renderer reads draft state when `?preview=1 + admin
 * cookie` is present, falling back to live row otherwise.
 */

import { use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type EntityKey = 'landing_pages' | 'blog_posts' | 'static_pages';
type DeviceSize = 'mobile' | 'tablet' | 'desktop';

const DEVICE_WIDTHS: Record<DeviceSize, number | string> = {
  mobile: 375,
  tablet: 768,
  desktop: '100%',
};

export default function PreviewPage({
  params,
}: {
  params: Promise<{ locale: string; entity: string; id: string }>;
}) {
  const { locale, entity, id } = use(params);
  const isAr = locale === 'ar';
  const searchParams = useSearchParams();
  const previewAs = searchParams?.get('as') === 'published' ? 'published' : 'draft';
  const [device, setDevice] = useState<DeviceSize>('desktop');
  const [iframeKey, setIframeKey] = useState(0);

  const safeEntity =
    entity === 'landing_pages' || entity === 'blog_posts' || entity === 'static_pages'
      ? (entity as EntityKey)
      : null;

  // Resolve the public render path for the entity via the admin lookup
  // endpoint. Hooks are called unconditionally; the early-return for unknown
  // entity ships AFTER all hook calls.
  const [resolvedHref, setResolvedHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!safeEntity) return;
    let alive = true;
    fetch(`/api/admin/preview-href?entity=${safeEntity}&id=${id}&as=${previewAs}&locale=${locale}`, {
      credentials: 'same-origin',
    })
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) {
          const b: { error?: string } = await r.json().catch(() => ({}));
          setError(b.error ?? `HTTP ${r.status}`);
          return;
        }
        const b = (await r.json()) as { href: string };
        setResolvedHref(b.href);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Lookup failed');
      });
    return () => {
      alive = false;
    };
  }, [safeEntity, id, previewAs, locale]);

  if (!safeEntity) {
    return (
      <div className="p-8 text-center text-red-700">
        Unknown entity: {entity}
      </div>
    );
  }

  const width = DEVICE_WIDTHS[device];
  const isFullWidth = width === '100%';

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen flex flex-col bg-[var(--color-neutral-100,#F0F0F1)]"
    >
      {/* Top toolbar */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-[var(--color-neutral-200)] shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {isAr ? 'معاينة' : 'Preview'}
          </span>
          <span className="text-xs text-[var(--color-neutral-500)] truncate">
            {safeEntity} · {id.slice(0, 8)}…
            <span
              className={`ms-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                previewAs === 'published'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {previewAs}
            </span>
          </span>
        </div>

        {/* Device size toggle */}
        <div role="tablist" className="flex items-center rounded-lg border border-[var(--color-neutral-200)] p-0.5 bg-[var(--color-neutral-50)] gap-0.5">
          {(['mobile', 'tablet', 'desktop'] as DeviceSize[]).map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={device === d}
              onClick={() => setDevice(d)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors min-h-9 ${
                device === d
                  ? 'bg-white shadow-sm text-[var(--text-primary)]'
                  : 'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-800)]'
              }`}
              aria-label={
                d === 'mobile'
                  ? isAr ? 'هاتف 375 بكسل' : 'Mobile 375px'
                  : d === 'tablet'
                  ? isAr ? 'لوحي 768 بكسل' : 'Tablet 768px'
                  : isAr ? 'سطح المكتب' : 'Desktop'
              }
            >
              {d === 'mobile' ? '📱' : d === 'tablet' ? '📲' : '🖥'}
              <span className="ms-1">
                {d === 'mobile'
                  ? isAr ? 'هاتف' : 'Mobile'
                  : d === 'tablet'
                  ? isAr ? 'لوحي' : 'Tablet'
                  : isAr ? 'سطح المكتب' : 'Desktop'}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIframeKey((k) => k + 1)}
            title={isAr ? 'تحديث' : 'Refresh'}
            aria-label={isAr ? 'تحديث' : 'Refresh'}
            className="rounded-lg border border-[var(--color-neutral-300)] p-2 text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-50)] min-h-9 min-w-9"
          >
            ⟳
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="rounded-lg border border-[var(--color-neutral-300)] px-3 py-1.5 text-xs text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-50)] min-h-9"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </header>

      {/* Frame */}
      <main className="flex-1 flex items-start justify-center p-4 overflow-auto">
        {error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 mt-12">
            {error}
          </div>
        ) : !resolvedHref ? (
          <div className="text-sm text-[var(--color-neutral-500)] mt-12">
            {isAr ? 'جارٍ التحميل...' : 'Loading preview...'}
          </div>
        ) : (
          <div
            className="bg-white shadow-lg border border-[var(--color-neutral-300)] rounded-lg overflow-hidden transition-all duration-200"
            style={{
              width: typeof width === 'number' ? `${width}px` : width,
              maxWidth: '100%',
              height: isFullWidth ? 'calc(100vh - 96px)' : '85vh',
              minHeight: 600,
            }}
          >
            <iframe
              key={iframeKey}
              src={resolvedHref}
              title={isAr ? 'معاينة الصفحة' : 'Page preview'}
              className="w-full h-full"
              referrerPolicy="strict-origin-when-cross-origin"
              // DeepSeek extra-care QA (2026-04-28): drop allow-popups —
              // admin preview is read-only; popups would only surface for
              // CTAs that visitors click, which we don't simulate here.
              sandbox="allow-scripts allow-same-origin allow-forms"
              style={{ border: 0 }}
            />
          </div>
        )}
      </main>

      {/* Bottom info bar */}
      <footer className="px-4 py-2 bg-white border-t border-[var(--color-neutral-200)] text-[11px] text-[var(--color-neutral-500)] flex items-center justify-between flex-wrap gap-2">
        <span>
          {device === 'mobile'
            ? '375px (iPhone SE/8)'
            : device === 'tablet'
            ? '768px (iPad portrait)'
            : isAr ? 'عرض كامل' : 'Full width'}
        </span>
        {resolvedHref && (
          <a
            href={resolvedHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[var(--color-neutral-700)] hover:text-[var(--color-primary)]"
          >
            {resolvedHref} ↗
          </a>
        )}
      </footer>
    </div>
  );
}
