'use client';

import { useState } from 'react';
import { TestimonialCard } from '@kunacademy/ui/card';

interface TestimonialItem {
  id: string;
  authorName: string;
  content: string;
  program: string;
  role?: string;
  videoUrl?: string;
  countryCode?: string;
}

const ITEMS_PER_PAGE = 12; // 3 columns x 4 rows

export function TestimonialsGrid({
  testimonials,
  locale,
}: {
  testimonials: TestimonialItem[];
  locale: string;
}) {
  const isAr = locale === 'ar';
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const visible = testimonials.slice(0, visibleCount);
  const hasMore = visibleCount < testimonials.length;

  return (
    <>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((t) => (
          <TestimonialCard
            key={t.id}
            authorName={t.authorName}
            content={t.content}
            program={t.program}
            role={t.role}
            videoUrl={t.videoUrl}
            countryCode={t.countryCode}
            locale={locale}
          />
        ))}
      </div>

      {hasMore && (
        <div className="text-center mt-10">
          <button
            onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold border-2 border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-all duration-300"
          >
            {isAr ? 'عرض المزيد' : 'Load More'}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      )}

      {!hasMore && testimonials.length > ITEMS_PER_PAGE && (
        <p className="text-center mt-8 text-sm text-[var(--color-neutral-500)]">
          {isAr
            ? `${testimonials.length} تجربة من ${isAr ? '١٣' : '13'} دولة`
            : `${testimonials.length} experiences from 13 countries`}
        </p>
      )}
    </>
  );
}
