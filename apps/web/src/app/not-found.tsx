/**
 * Root-level not-found.tsx
 *
 * Catches 404s that occur BEFORE any locale segment is matched —
 * e.g. /garbage (no locale prefix, middleware didn't match).
 *
 * Redirects immediately to the Arabic (default) locale 404.
 * The [locale]/not-found.tsx handles all locale-aware 404 rendering.
 */
import { redirect } from 'next/navigation';

export default function GlobalNotFound() {
  // Default locale is 'ar' — redirect so the user gets the branded,
  // locale-aware 404 page with the correct RTL layout.
  redirect('/ar');
}
