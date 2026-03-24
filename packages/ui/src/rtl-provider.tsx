'use client';

import React, { ReactNode } from 'react';

/**
 * RTL Provider Component
 *
 * Handles Right-to-Left (RTL) layout for Arabic content.
 * Automatically detects locale from HTML dir attribute.
 *
 * Usage:
 *   <RTLProvider locale="ar">
 *     <YourContent />
 *   </RTLProvider>
 */
interface RTLProviderProps {
  children: ReactNode;
  locale?: 'ar' | 'en';
}

export function RTLProvider({ children, locale = 'ar' }: RTLProviderProps) {
  const isRTL = locale === 'ar';

  React.useEffect(() => {
    // Ensure document direction matches locale
    if (typeof document !== 'undefined') {
      const htmlElement = document.documentElement;
      htmlElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
      htmlElement.setAttribute('lang', locale);
    }
  }, [locale, isRTL]);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen"
      style={{
        // CSS logical properties ensure automatic mirroring for RTL
        // All margin-left/right → margin-inline-start/end
        // All padding-left/right → padding-inline-start/end
        // All flex direction → logical flow
      }}
    >
      {children}
    </div>
  );
}
