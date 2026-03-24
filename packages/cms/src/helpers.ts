// @kunacademy/cms — Template helpers for page components
// Makes CMS content ergonomic to use in RSC pages.

import type { PageSections, BilingualText } from './types';

/**
 * Create a content getter for a specific page + locale.
 *
 * Usage in a page component:
 *   const sections = await cms.getPageContent('home');
 *   const t = contentGetter(sections, locale);
 *   <h1>{t('hero', 'title')}</h1>
 *   <p>{t('hero', 'subtitle')}</p>
 *
 * Returns the localized string, or a fallback "[section.key]" if missing.
 * This makes missing content visible during development instead of silent.
 */
export function contentGetter(
  sections: PageSections,
  locale: string
): (section: string, key: string, fallback?: string) => string {
  const lang = locale === 'ar' ? 'ar' : 'en';

  return (section: string, key: string, fallback?: string): string => {
    const bilingual = sections[section]?.[key];
    if (!bilingual) {
      return fallback ?? `[${section}.${key}]`;
    }
    // Prefer requested locale, fall back to the other
    return bilingual[lang] || bilingual[lang === 'ar' ? 'en' : 'ar'] || (fallback ?? `[${section}.${key}]`);
  };
}

/**
 * Get a single bilingual value with locale resolution.
 */
export function localize(text: BilingualText | undefined, locale: string, fallback = ''): string {
  if (!text) return fallback;
  const lang = locale === 'ar' ? 'ar' : 'en';
  return text[lang] || text[lang === 'ar' ? 'en' : 'ar'] || fallback;
}
