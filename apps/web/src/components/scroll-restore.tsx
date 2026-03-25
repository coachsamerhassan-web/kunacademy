'use client';

import { useEffect } from 'react';

/**
 * Restores scroll position after language switch.
 * The Header stores { path, scrollY } in sessionStorage before navigating.
 * This component reads it on mount and scrolls to the saved position.
 */
export function ScrollRestore() {
  useEffect(() => {
    const raw = sessionStorage.getItem('kun-scroll-restore');
    if (!raw) return;

    try {
      const { path, scrollY } = JSON.parse(raw) as { path: string; scrollY: number };
      // Only restore if we're on the expected page
      if (window.location.pathname === path || window.location.pathname === path.replace(/\/$/, '')) {
        sessionStorage.removeItem('kun-scroll-restore');
        // Small delay to let the page render before scrolling
        requestAnimationFrame(() => {
          window.scrollTo({ top: scrollY, behavior: 'instant' });
        });
      }
    } catch {
      sessionStorage.removeItem('kun-scroll-restore');
    }
  }, []);

  return null;
}
