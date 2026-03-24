

import * as React from 'react';
import { cn } from './utils';

export interface FAQItem {
  ar: { q: string; a: string };
  en: { q: string; a: string };
}

interface FAQSectionProps {
  items: FAQItem[];
  locale: string;
  title?: string;
  className?: string;
}

export function FAQSection({ items, locale, title, className }: FAQSectionProps) {
  const isAr = locale === 'ar';
  const heading = title ?? (isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions');

  return (
    <div className={cn('mx-auto max-w-3xl', className)}>
      <h2 className="text-2xl font-bold mb-6">{heading}</h2>
      <div className="space-y-3">
        {items.map((faq, i) => {
          const item = isAr ? faq.ar : faq.en;
          return (
            <details
              key={i}
              className="group rounded-lg border border-[var(--color-neutral-200)] bg-white px-6 py-4"
            >
              <summary className="cursor-pointer font-medium text-[var(--color-neutral-800)] list-none flex items-center justify-between gap-4">
                <span>{item.q}</span>
                <svg
                  className="h-5 w-5 shrink-0 text-[var(--color-neutral-400)] transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-3 text-[var(--color-neutral-600)] leading-relaxed">{item.a}</p>
            </details>
          );
        })}
      </div>
    </div>
  );
}

/** Generate FAQ JSON-LD for Google Rich Results */
export function faqJsonLd(items: FAQItem[], locale: string) {
  const lang = locale === 'ar' ? 'ar' : 'en';
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((faq) => {
      const item = locale === 'ar' ? faq.ar : faq.en;
      return {
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
          inLanguage: lang,
        },
      };
    }),
  };
}
