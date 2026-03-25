'use client';

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
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  return (
    <div className={cn('mx-auto max-w-3xl', className)}>
      <div className="space-y-3">
        {items.map((faq, i) => {
          const item = isAr ? faq.ar : faq.en;
          const isOpen = openIndex === i;

          return (
            <div
              key={i}
              className={cn(
                'rounded-2xl border transition-all duration-300',
                isOpen
                  ? 'border-[var(--color-primary-200)] bg-white shadow-[0_4px_20px_rgba(71,64,153,0.08)]'
                  : 'border-[var(--color-neutral-100)] bg-white hover:border-[var(--color-neutral-200)]'
              )}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-start"
                aria-expanded={isOpen}
              >
                <span className={cn(
                  'font-medium transition-colors duration-200',
                  isOpen ? 'text-[var(--color-primary)]' : 'text-[var(--color-neutral-800)]'
                )}>
                  {item.q}
                </span>
                <div className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
                  isOpen ? 'bg-[var(--color-primary)] rotate-180' : 'bg-[var(--color-neutral-50)]'
                )}>
                  <svg
                    className={cn('h-4 w-4 transition-colors', isOpen ? 'text-white' : 'text-[var(--color-neutral-400)]')}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              <div
                className={cn(
                  'overflow-hidden transition-all duration-300 ease-out',
                  isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                )}
              >
                <p className="px-6 pb-5 text-[var(--color-neutral-600)] leading-relaxed">
                  {item.a}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Generate FAQ JSON-LD for Google Rich Results — server-safe */
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
