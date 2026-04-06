'use client';

import { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TabData {
  id: string;
  labelAr: string;
  labelEn: string;
  content: React.ReactNode;
  ctaHref: string;
  ctaLabelAr: string;
  ctaLabelEn: string;
}

interface AudienceTabsProps {
  tabs: TabData[];
  locale: string;
  /** Section heading (optional) */
  headingAr?: string;
  headingEn?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function AudienceTabs({
  tabs,
  locale,
  headingAr = 'لمن هذا البرنامج؟',
  headingEn = 'Who Is This For?',
}: AudienceTabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div dir={dir} className="w-full">
      {/* Section heading */}
      <h2
        className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-6 text-center"
        style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
      >
        {isAr ? headingAr : headingEn}
      </h2>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label={isAr ? 'اختر شريحتك' : 'Select your segment'}
        className="flex overflow-x-auto gap-2 pb-1 mb-6 justify-center flex-wrap"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveId(tab.id)}
              className={`
                whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-semibold
                transition-all duration-200 min-h-[44px] border
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
                ${isActive
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
                  : 'bg-white text-[var(--color-neutral-600)] border-[var(--color-neutral-200)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                }
              `}
            >
              {isAr ? tab.labelAr : tab.labelEn}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== activeId}
          className={tab.id === activeId ? 'block' : 'hidden'}
        >
          {/* Content area */}
          <div className="rounded-2xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] p-6 md:p-8">
            {tab.content}

            {/* CTA button */}
            <div className="mt-6 flex justify-center">
              <a
                href={tab.ctaHref}
                className="inline-flex items-center justify-center h-12 px-8 text-base font-semibold rounded-xl text-white bg-[var(--color-accent)] shadow-[0_4px_16px_rgba(244,126,66,0.30)] hover:bg-[var(--color-accent-500)] hover:shadow-[0_8px_24px_rgba(244,126,66,0.40)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 min-h-[44px]"
              >
                {isAr ? tab.ctaLabelAr : tab.ctaLabelEn}
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
