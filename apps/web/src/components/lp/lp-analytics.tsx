'use client';

import Script from 'next/script';
import type { LpAnalyticsConfig } from '@/lib/lp/composition-types';

/**
 * Wave 14 LP-INFRA — per-LP analytics layer.
 *
 * Site-wide GA4 (NEXT_PUBLIC_GA4_ID) is already loaded by the global
 * Analytics component. This component layers per-LP additions:
 *   - Meta Pixel (per-LP id from analytics_config.meta_pixel_id)
 *   - TikTok Pixel (per-LP id from analytics_config.tiktok_pixel_id)
 *   - GA4 page-view ping with custom lp_slug param
 *
 * Renders nothing visible. Mount once at the top of the LP route.
 */
interface LpAnalyticsProps {
  slug: string;
  locale: string;
  config: LpAnalyticsConfig | null | undefined;
}

export function LpAnalytics({ slug, locale, config }: LpAnalyticsProps) {
  if (!config) return null;

  const metaId = config.meta_pixel_id?.trim();
  const tiktokId = config.tiktok_pixel_id?.trim();

  return (
    <>
      {/* GA4 page_view with lp_slug — fires only if global gtag is present */}
      <Script id={`lp-ga4-pageview-${slug}`} strategy="afterInteractive">
        {`
          (function() {
            try {
              if (typeof window === 'undefined') return;
              var w = window;
              var fire = function() {
                if (typeof w.gtag === 'function') {
                  w.gtag('event', 'lp_page_view', {
                    lp_slug: ${JSON.stringify(slug)},
                    locale: ${JSON.stringify(locale)},
                  });
                }
              };
              fire();
            } catch (e) {}
          })();
        `}
      </Script>

      {/* Meta Pixel */}
      {metaId && (
        <>
          <Script id={`lp-meta-pixel-${slug}`} strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
              n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
              document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', ${JSON.stringify(metaId)});
              fbq('track', 'PageView');
              fbq('trackCustom', 'lp_page_view', { lp_slug: ${JSON.stringify(slug)} });
            `}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${metaId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}

      {/* TikTok Pixel */}
      {tiktokId && (
        <Script id={`lp-tiktok-pixel-${slug}`} strategy="afterInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
              ttq.load(${JSON.stringify(tiktokId)});
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
      )}
    </>
  );
}
