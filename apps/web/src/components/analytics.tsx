'use client';

import Script from 'next/script';
import { useState, useEffect } from 'react';
import { useConsent } from './cookie-consent';

const GA_ID = process.env.NEXT_PUBLIC_GA4_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function Analytics() {
  const initialConsent = useConsent();
  const [consent, setConsent] = useState(initialConsent);

  useEffect(() => {
    // Sync initial consent from hook on mount
    setConsent(initialConsent);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleConsentChange() {
      // Re-read consent from localStorage when it changes
      try {
        const raw = localStorage.getItem('kun-cookie-consent');
        if (raw) {
          const parsed = JSON.parse(raw);
          setConsent({
            analytics: parsed.analytics === true,
            marketing: parsed.marketing === true,
          });
        } else {
          setConsent({ analytics: false, marketing: false });
        }
      } catch {
        setConsent({ analytics: false, marketing: false });
      }
    }

    window.addEventListener('cookie-consent-changed', handleConsentChange);
    return () => {
      window.removeEventListener('cookie-consent-changed', handleConsentChange);
    };
  }, []);

  return (
    <>
      {/* Google Analytics 4 — only when analytics consent is granted */}
      {GA_ID && consent.analytics && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', {
                page_path: window.location.pathname,
                send_page_view: true,
              });
            `}
          </Script>
        </>
      )}

      {/* Meta Pixel — only when marketing consent is granted */}
      {META_PIXEL_ID && consent.marketing && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}

/** Fire a custom GA4 event — no-op when analytics consent is not granted */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  // Check consent before firing
  try {
    const raw = localStorage.getItem('kun-cookie-consent');
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed.analytics !== true) return;
  } catch {
    return;
  }

  if ('gtag' in window) {
    (window as any).gtag('event', eventName, params);
  }
}

/** Fire a custom Meta Pixel event — no-op when marketing consent is not granted */
export function trackMetaEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  // Check consent before firing
  try {
    const raw = localStorage.getItem('kun-cookie-consent');
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed.marketing !== true) return;
  } catch {
    return;
  }

  if ('fbq' in window) {
    (window as any).fbq('track', eventName, params);
  }
}
